import { describe, expect, it } from "vitest";
import { actualUsage, needsRole, safetyActions, stageFor, usagePayload, type PythonCase } from "../../src/lib/python-ui";
import type { TicketSummary } from "../../src/server/backend-dto";
describe("Python UI policy adapters", () => {
  it("offers safety decisions only in Python's allowed role and state", () => {
    const c = { ticket: { status: "VERIFYING", blocker: { code: "SAFETY_REVIEW_REQUIRED", escalated: false } } } as PythonCase;
    expect(safetyActions(c, "management")).toEqual([]);
    expect(safetyActions(c, "reception")).toEqual(["CONFIRM_SAFE", "REQUEST_INFO", "ESCALATE"]);
    c.ticket.blocker!.escalated = true;
    expect(safetyActions(c, "management")).toEqual(["CONFIRM_SAFE", "REQUEST_INFO", "ESCALATE"]);
    c.ticket.status = "NEED_INFO"; c.ticket.safety_context = true; c.ticket.blocker!.code = "MISSING_INFO";
    expect(safetyActions(c, "management")).toEqual(["CONFIRM_SAFE", "ESCALATE"]);
    expect(safetyActions(c, "reception")).toEqual([]);
  });
  it("uses Python statuses, including paused and terminal side states", () => {
    expect(stageFor("ROUTED")).toBe(3); expect(stageFor("IN_PROGRESS")).toBe(4);
    expect(stageFor("ON_HOLD")).toBe(2); expect(stageFor("MERGED")).toBeNull(); expect(stageFor("CANCELLED")).toBeNull();
  });
  it("does not make routed tickets wait for reception", () => {
    const row = { status: "ROUTED", reason_code: null } as TicketSummary;
    expect(needsRole(row, "reception")).toBe(false); expect(needsRole(row, "technical")).toBe(true);
    expect(needsRole({ ...row, status: "VERIFYING", reason_code: "PENDING_REVIEW" }, "reception")).toBe(true);
    expect(needsRole({ ...row, reason_code: "EMERGENCY_PENDING_BQL" }, "reception")).toBe(false);
    expect(needsRole({ ...row, reason_code: "EMERGENCY_PENDING_BQL" }, "management")).toBe(true);
    expect(needsRole({ ...row, status: "VERIFYING", reason_code: "SAFETY_REVIEW_REQUIRED", escalated: true }, "management")).toBe(true);
    expect(needsRole({ ...row, status: "VERIFYING", reason_code: "SAFETY_REVIEW_REQUIRED", escalated: false }, "management")).toBe(false);
  });
  it("does not prefill Agent materials", () => {
    const c = { material_lines: [{ item_code: "A", planned_qty: 1, used_qty: null }, { item_code: "B", used_qty: 4 }] } as unknown as PythonCase;
    expect(actualUsage(c)).toEqual([{ item_code: "B", quantity: "4" }]);
  });
  it("sends full actual usage regardless of norms without a reason", () => {
    expect(usagePayload([{ item_code: "A", quantity: "4" }], "DEPT_TECHNICAL", ["A"])).toEqual({ lines: [{ item_code: "A", used_qty: 4 }] });
    expect(usagePayload([], "DEPT_CLEANING", [])).toEqual({ lines: [] });
  });
  it.each(["0", "-1", "1.5", "NaN", "Infinity", "9007199254740992"])("rejects invalid quantity %s", (quantity) => {
    expect(() => usagePayload([{ item_code: "A", quantity }], "DEPT_TECHNICAL", ["A"])).toThrow("số nguyên dương");
  });
  it("rejects missing technical usage, wrong department and duplicates", () => {
    expect(() => usagePayload([], "DEPT_TECHNICAL", [])).toThrow("ít nhất");
    expect(() => usagePayload([{ item_code: "A", quantity: "1" }], "DEPT_TECHNICAL", [])).toThrow("phòng ban");
    expect(() => usagePayload([{ item_code: "A", quantity: "1" }, { item_code: "A", quantity: "2" }], "DEPT_TECHNICAL", ["A"])).toThrow("một lần");
  });
});
