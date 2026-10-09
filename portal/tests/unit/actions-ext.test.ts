import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { url: string; opts: { method?: string; json?: unknown } | undefined }[] = [];

vi.mock("@/server/backend", () => ({
  api: vi.fn(async (url: string, opts?: { method?: string; json?: unknown }) => {
    calls.push({ url, opts });
    return { ticket_id: "SIM-TKT-0099", item_code: "SIM-MAT-X-1" };
  }),
}));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => ({ name: "T", tower: "S2.05", floor: "12", apartment: "1203", role: "resident" }),
}));
vi.mock("next/cache", () => ({ refresh: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));

import { assignStaffAction } from "@/app/actions/departments";
import { rateTicketAction, submitTicketAction } from "@/app/actions/resident";
import { approveMaterialsAction } from "@/app/actions/warehouse";

beforeEach(() => {
  calls.length = 0;
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("submitTicketAction", () => {
  it("sends title, content and location lines to the backend", async () => {
    const r = await submitTicketAction(
      form({ title: "Đèn hành lang tắt", description: "Tắt hẳn từ tối qua rồi", place: "floor", placeDetail: "Hành lang" }),
    );
    expect(r.ok).toBe(true);
    const body = calls[0].opts?.json as { original_description: string };
    expect(body.original_description).toBe("Đèn hành lang tắt\nTắt hẳn từ tối qua rồi\nVị trí: Tòa S2.05 · Tầng 12 · Hành lang");
  });
  it("rejects a title that is too short or missing without calling the backend", async () => {
    const r = await submitTicketAction(form({ title: "ab", description: "Nội dung đủ dài rồi", place: "floor" }));
    expect(r.ok).toBe(false);
    const r2 = await submitTicketAction(form({ description: "Nội dung đủ dài rồi", place: "floor" }));
    expect(r2.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("rejects a title longer than 120 and content shorter than 10", async () => {
    expect((await submitTicketAction(form({ title: "a".repeat(121), description: "Nội dung đủ dài rồi", place: "floor" }))).ok).toBe(false);
    expect((await submitTicketAction(form({ title: "Tiêu đề", description: "ngắn", place: "floor" }))).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("flattens line breaks inside the title", async () => {
    await submitTicketAction(form({ title: "Dòng một\nDòng hai", description: "Nội dung đủ dài rồi", place: "floor" }));
    const body = calls[0].opts?.json as { original_description: string };
    expect(body.original_description.split("\n")[0]).toBe("Dòng một Dòng hai");
  });
});

describe("rateTicketAction", () => {
  it("posts score, tags and comment", async () => {
    const r = await rateTicketAction("SIM-TKT-1", { stars: 5, tags: ["Xử lý nhanh"], comment: "Tốt" });
    expect(r.ok).toBe(true);
    expect(calls[0].url).toBe("/resident/tickets/SIM-TKT-1/rating");
    expect(calls[0].opts?.json).toEqual({ score: 5, tags: ["Xử lý nhanh"], comment: "Tốt" });
  });
  it("rejects a bad tag for the score, long comment and bad stars", async () => {
    expect((await rateTicketAction("SIM-TKT-1", { stars: 5, tags: ["Chậm trễ"], comment: "" })).ok).toBe(false);
    expect((await rateTicketAction("SIM-TKT-1", { stars: 2, tags: ["Xử lý nhanh"], comment: "" })).ok).toBe(false);
    expect((await rateTicketAction("SIM-TKT-1", { stars: 3, tags: [], comment: "x".repeat(501) })).ok).toBe(false);
    expect((await rateTicketAction("SIM-TKT-1", { stars: 0, tags: [], comment: "" })).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("accepts a low score with a bad tag and an empty comment", async () => {
    const r = await rateTicketAction("SIM-TKT-1", { stars: 2, tags: ["Chậm trễ"] });
    expect(r.ok).toBe(true);
    expect(calls[0].opts?.json).toEqual({ score: 2, tags: ["Chậm trễ"], comment: "" });
  });
});

describe("assignStaffAction / approveMaterialsAction", () => {
  it("assign posts the staff id", async () => {
    const r = await assignStaffAction("SIM-TKT-1", "SIM-STAFF-CLN-B");
    expect(r.ok).toBe(true);
    expect(calls[0].url).toBe("/mo/tickets/SIM-TKT-1/assign");
    expect(calls[0].opts?.json).toEqual({ staff_id: "SIM-STAFF-CLN-B" });
  });
  it("assign rejects empty ids", async () => {
    expect((await assignStaffAction("SIM-TKT-1", "")).ok).toBe(false);
    expect((await assignStaffAction("", "SIM-STAFF-CLN-B")).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("approve posts to materials/approve with an optional note", async () => {
    await approveMaterialsAction("SIM-TKT-1");
    expect(calls[0].url).toBe("/mo/tickets/SIM-TKT-1/materials/approve");
    expect(calls[0].opts?.json).toEqual({});
    await approveMaterialsAction("SIM-TKT-1", " đủ hàng ");
    expect(calls[1].opts?.json).toEqual({ note: "đủ hàng" });
  });
  it("approve rejects an invalid id", async () => {
    expect((await approveMaterialsAction("../x")).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
