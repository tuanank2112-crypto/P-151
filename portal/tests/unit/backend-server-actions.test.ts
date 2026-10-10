import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), fetch: vi.fn() }));
vi.mock("@/server/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/server/backend-client", () => ({ backendFetch: mocks.fetch, BackendError: class extends Error { status = 422; code = "INVALID_INPUT"; } }));
import { createResidentTicket, getTicketDetail, runTicketAction, receiveStock, uploadTicketPhotos } from "@/app/actions/backend";

describe("Python server action results", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ role: "technical" }); });
  it("treats complete HTTP200 with failing gates as business failure", async () => {
    const data = { ticket: { status: "IN_PROGRESS" }, draft: { readiness_evaluation: { failing_items: ["material_required"] } } };
    mocks.fetch.mockResolvedValue(data);
    expect(await runTicketAction("SIM-TKT-0062", "complete")).toMatchObject({ ok: false, code: "READINESS_FAILED", status: 409, data, message: expect.stringContaining("material_required") });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("returns successful completion only when backend is READY_FOR_REVIEW", async () => {
    mocks.fetch.mockResolvedValue({ ticket: { status: "READY_FOR_REVIEW" } });
    expect(await runTicketAction("SIM-TKT-0062", "complete")).toMatchObject({ ok: true });
  });
  it("uses resident safe detail endpoint only", async () => {
    mocks.user.mockResolvedValue({ role: "resident" }); mocks.fetch.mockResolvedValue({ ticket_id: "SIM-TKT-0062" });
    await getTicketDetail("SIM-TKT-0062");
    expect(mocks.fetch).toHaveBeenCalledWith("/api/v1/resident/tickets/SIM-TKT-0062");
  });
  it("minimizes internal Case on detail and mutation responses", async () => {
    mocks.fetch.mockResolvedValue({ ticket: { ticket_id: "SIM-TKT-0062", status: "IN_PROGRESS", resident_id: "SECRET" }, audit: [{ actor_id: "SECRET" }] });
    const detail = await getTicketDetail("SIM-TKT-0062");
    const saved = await runTicketAction("SIM-TKT-0062", "material-usage", { lines: [{ item_code: "LIGHT", used_qty: 4 }] });
    expect(JSON.stringify(detail)).not.toContain("SECRET");
    expect(JSON.stringify(saved)).not.toContain("SECRET");
  });
  it("minimizes photo attachment and stock mutation Case responses", async () => {
    const raw = { ticket: { ticket_id: "SIM-TKT-0062", status: "IN_PROGRESS", resident_id: "SECRET" }, audit: [{ actor_id: "SECRET" }] };
    mocks.fetch.mockResolvedValue(raw);
    expect(JSON.stringify(await uploadTicketPhotos("SIM-TKT-0062", new FormData()))).not.toContain("SECRET");
    mocks.user.mockResolvedValue({ role: "warehouse" });
    mocks.fetch.mockResolvedValue([raw]);
    expect(JSON.stringify(await receiveStock("LIGHT", 4))).not.toContain("SECRET");
  });
  it("creates one Python ticket without clock/actor spoof fields", async () => {
    mocks.user.mockResolvedValue({ role: "resident" }); mocks.fetch.mockResolvedValue({ ticket_id: "SIM-TKT-0062" });
    await createResidentTicket("Đèn hỏng sảnh S2 tầng 1");
    expect(mocks.fetch).toHaveBeenCalledWith("/api/v1/resident/tickets", expect.objectContaining({ method: "POST", body: JSON.stringify({ original_description: "Đèn hỏng sảnh S2 tầng 1", channel: "form" }) }));
  });
  it("does not retry mutations or manufacture success on outage", async () => {
    mocks.fetch.mockRejectedValue(new Error("network"));
    expect(await runTicketAction("SIM-TKT-0062", "accept")).toMatchObject({ ok: false, status: 503 });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("prevents unauthenticated mutations and wrong-role stock receipt", async () => {
    mocks.user.mockResolvedValue(null);
    expect(await runTicketAction("SIM-TKT-0062", "accept")).toMatchObject({ ok: false, status: 401 });
    mocks.user.mockResolvedValue({ role: "resident" });
    expect(await receiveStock("LIGHT", 4)).toMatchObject({ ok: false, status: 403 });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
