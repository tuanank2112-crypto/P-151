import { describe, expect, it } from "vitest";
import {
  REASON_CODES,
  blockerLabel,
  deptKey,
  failingLabels,
  isBqlWork,
  isUrgent,
  mapStatus,
  parseDescription,
  roleFromMe,
  residentDeptName,
  titleOf,
  type BStatus,
} from "@/lib/backend-map";
import { BackendError, errorFrom } from "@/server/backend-error";

describe("mapStatus (01-CONTRACTS §3)", () => {
  const table: [BStatus, number, Partial<Record<"needInfo" | "paused" | "cancelled", boolean>>][] = [
    ["RECEIVED", 1, {}],
    ["NEED_INFO", 1, { needInfo: true }],
    ["VERIFYING", 2, {}],
    ["ROUTED", 3, {}],
    ["IN_PROGRESS", 4, {}],
    ["ON_HOLD", 4, { paused: true }],
    ["READY_FOR_REVIEW", 5, {}],
    ["CLOSED", 6, {}],
    ["CANCELLED", 1, { cancelled: true }],
    ["MERGED", 1, { cancelled: true }],
  ];
  it.each(table)("%s -> stage %i", (status, stage, flags) => {
    expect(mapStatus(status)).toEqual({
      stage,
      needInfo: flags.needInfo ?? false,
      paused: flags.paused ?? false,
      cancelled: flags.cancelled ?? false,
    });
  });
  it("covers exactly the 10 backend statuses", () => {
    expect(table).toHaveLength(10);
  });
});

describe("urgent / dept", () => {
  it("urgent = EMERGENCY risk only; HIGH priority alone is an ordinary ticket", () => {
    expect(isUrgent({ risk_level: "EMERGENCY", priority: "LOW" })).toBe(true);
    expect(isUrgent({ risk_level: "NONE", priority: "HIGH" })).toBe(false);
    expect(isUrgent({ risk_level: "UNCLEAR", priority: "MEDIUM" })).toBe(false);
    expect(isUrgent({ risk_level: null, priority: null })).toBe(false);
  });
  it("maps department ids and the BQL work flag", () => {
    expect(deptKey("DEPT_CLEANING")).toBe("ve_sinh");
    expect(deptKey("DEPT_TECHNICAL")).toBe("ky_thuat");
    expect(deptKey(null)).toBeNull();
    expect(deptKey(null, true)).toBe("bql");
    expect(isBqlWork({ code: "OUT_OF_SCOPE", escalated: true })).toBe(true);
    expect(isBqlWork({ code: "OUT_OF_SCOPE", escalated: false })).toBe(false);
    expect(isBqlWork({ code: "DUPLICATE", escalated: true })).toBe(false);
    expect(isBqlWork(null)).toBe(false);
  });
  it("hides the proposed department from residents unless handed over", () => {
    expect(residentDeptName("Phòng vệ sinh")).toBe("Phòng vệ sinh");
    expect(residentDeptName(null)).toBeNull();
  });
});

describe("parseDescription (01 §6.1)", () => {
  it("splits the trailing Vị trí line", () => {
    const r = parseDescription("Thùng rác đầy tràn\nVị trí: Tòa S2.05 · Tầng 12 · Hành lang");
    expect(r).toEqual({ description: "Thùng rác đầy tràn", location: "Tòa S2.05 · Tầng 12 · Hành lang" });
  });
  it("keeps multi-line text and only strips the last Vị trí line", () => {
    const r = parseDescription("Dòng 1\nDòng 2\nVị trí: Sảnh");
    expect(r.description).toBe("Dòng 1\nDòng 2");
    expect(r.location).toBe("Sảnh");
  });
  it("falls back to a dash without location", () => {
    expect(parseDescription("Đèn hỏng")).toEqual({ description: "Đèn hỏng", location: "—" });
  });
  it("title is the first line, at most 80 chars", () => {
    expect(titleOf("A\nB")).toBe("A");
    expect(titleOf("x".repeat(100))).toHaveLength(80);
  });
});

describe("blockerLabel / failing items", () => {
  it("has a Vietnamese label for all 16 reason codes", () => {
    expect(REASON_CODES).toHaveLength(16);
    for (const c of REASON_CODES) expect(blockerLabel(c).length).toBeGreaterThan(0);
    expect(blockerLabel("OUT_OF_SCOPE")).toBe("Ngoài phạm vi VS/KT");
    expect(blockerLabel("DUPLICATE")).toBe("Nghi trùng");
    expect(blockerLabel("WAITING_MATERIAL")).toBe("Chờ vật tư");
    expect(blockerLabel(null)).toBe("");
  });
  it("translates failing_items and passes unknown through", () => {
    expect(
      failingLabels(["checklist_complete", "photo_present", "materials_entered", "variance_explained", "no_open_blocker", "department_accepted", "zzz"]),
    ).toEqual([
      "Chưa xong checklist",
      "Thiếu ảnh sau xử lý",
      "Chưa nhập vật tư đã dùng",
      "Vật tư dùng khác định mức, cần ghi lý do",
      "Ticket đang bị chặn",
      "Chưa nhận việc",
      "zzz",
    ]);
  });
});

describe("errorFrom (01 §8)", () => {
  it("401 / 403 / 404", () => {
    expect(errorFrom(401, { detail: "Cần đăng nhập" }).code).toBe("UNAUTHENTICATED");
    const f = errorFrom(403, { detail: { message: "Chỉ BQL", code: "ACTION_DENIED" } });
    expect(f.code).toBe("FORBIDDEN");
    expect(f.message).toBe("Chỉ BQL");
    const n = errorFrom(404, { detail: "Không có ticket X" });
    expect(n.code).toBe("NOT_FOUND");
    expect(n.message).toBe("Không tìm thấy phản ánh");
  });
  it("409 with string and with object detail", () => {
    expect(errorFrom(409, { detail: "Tối đa 5 ảnh" })).toMatchObject({ code: "CONFLICT", message: "Tối đa 5 ảnh" });
    expect(errorFrom(409, { detail: { code: "GUARD_FAILED", message: "Cần ghi chú" } })).toMatchObject({ code: "CONFLICT", message: "Cần ghi chú" });
  });
  it("413 / 415 / 422 with the three detail shapes", () => {
    expect(errorFrom(413, { detail: "Ảnh quá lớn" })).toMatchObject({ code: "INVALID_INPUT", message: "Ảnh quá lớn" });
    expect(errorFrom(415, { detail: { message: "Sai định dạng" } })).toMatchObject({ code: "INVALID_INPUT", message: "Sai định dạng" });
    expect(errorFrom(422, { detail: [{ msg: "a" }, { msg: "b" }] })).toMatchObject({ code: "INVALID_INPUT", message: "a; b" });
  });
  it("5xx and unparsable bodies keep the status and never leak the body", () => {
    const e = errorFrom(502, "<html>bad gateway</html>");
    expect(e).toBeInstanceOf(BackendError);
    expect(e.status).toBe(502);
    expect(e.message).not.toContain("html");
    expect(errorFrom(409, null).message.length).toBeGreaterThan(0);
  });
});

describe("roleFromMe (01 §2)", () => {
  it("maps every backend role", () => {
    expect(roleFromMe("RESIDENT", null)).toBe("resident");
    expect(roleFromMe("BPTN", null)).toBe("reception");
    expect(roleFromMe("BQL", null)).toBe("management");
    expect(roleFromMe("WAREHOUSE", null)).toBe("warehouse");
    expect(roleFromMe("DEPARTMENT", "DEPT_CLEANING")).toBe("cleaning");
    expect(roleFromMe("DEPARTMENT", "DEPT_TECHNICAL")).toBe("technical");
    expect(roleFromMe("DEPARTMENT", null)).toBeNull();
    expect(roleFromMe("QA_INTERNAL", null)).toBeNull();
  });
});
