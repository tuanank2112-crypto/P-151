import { beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ fetch: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/server/backend-client", () => ({ backendFetch: mocked.fetch, BackendError: class extends Error { constructor(public status: number) { super("Backend failure"); } } }));
vi.mock("next/navigation", () => ({ redirect: mocked.redirect }));
import { BackendError } from "@/server/backend-client";
import { residentData, deptData } from "@/server/queries";
import type { SessionUser } from "@/server/backend-dto";
const user = { id: "SIM-ACTOR-RESIDENT-01", role: "resident" } as SessionUser;
beforeEach(() => vi.clearAllMocks());
describe("Python read loaders", () => {
  it("resident receives safe view only, never internal catalog or stock", async () => {
    mocked.fetch.mockResolvedValue([{ ticket_id: "SIM-TKT-0062", status: "VERIFYING", status_label: "Đang được kiểm tra", description: "Đèn hỏng", created_at: "2026-10-10", allowed_actions: [] }]);
    const result = await residentData(user);
    expect(mocked.fetch).toHaveBeenCalledTimes(1); expect(mocked.fetch).toHaveBeenCalledWith("/api/v1/resident/tickets");
    expect(result.catalog).toBeUndefined(); expect(result.stock).toBeUndefined(); expect(result.tickets[0].ticket_id).toBe("SIM-TKT-0062");
  });
  it("session expiry between auth/me and list redirects to login", async () => {
    mocked.fetch.mockRejectedValue(new BackendError(401, "expired"));
    await expect(residentData(user)).rejects.toThrow("REDIRECT:/login");
  });
  it("staff list loads only summary/catalog/stock, no N+1 Case", async () => {
    mocked.fetch.mockResolvedValue([]); await deptData({ ...user, role: "technical" });
    expect(mocked.fetch.mock.calls.map(([url]) => url)).toEqual(["/api/v1/mo/tickets", "/api/v1/mo/catalog", "/api/v1/mo/warehouse/stock"]);
  });
});
