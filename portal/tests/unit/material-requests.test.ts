import { describe, expect, it } from "vitest";
import { buildShortagePayload, deptStatusLabel, requestSummary, toMaterialRequest, type BMaterialRequest } from "@/lib/material-requests";

const depts = { DEPT_TECHNICAL: "Phòng kỹ thuật", DEPT_CLEANING: "Phòng vệ sinh" };
const row = (o: Partial<BMaterialRequest> = {}): BMaterialRequest => ({
  request_id: "PVT-SIM-TKT-0071",
  ticket_id: "SIM-TKT-0071",
  department_id: "DEPT_TECHNICAL",
  location: "Ocean Park S1 / Tầng 3 / Hành lang",
  source: "DEPARTMENT",
  reported_by: "SIM-USR-TEC-01",
  since: "2026-10-14T02:00:00Z",
  note: " hết bóng ",
  lines: [{ item_code: "SIM-MAT-LAMP-02", item_name: "Bóng đèn tuýp", unit: "Cái", needed_qty: 4, stock_qty: 1, shortage_qty: 3 }],
  status: "OPEN",
  ...o,
});

describe("toMaterialRequest", () => {
  it("maps the PVT row: code, ticket, department name, source, lines", () => {
    const r = toMaterialRequest(row(), depts, (iso) => `T:${iso}`);
    expect(r).toMatchObject({
      requestId: "PVT-SIM-TKT-0071",
      ticketId: "SIM-TKT-0071",
      departmentName: "Phòng kỹ thuật",
      sourceLabel: "Phòng kỹ thuật",
      since: "T:2026-10-14T02:00:00Z",
      note: "hết bóng",
    });
    expect(r.lines).toEqual([{ itemCode: "SIM-MAT-LAMP-02", itemName: "Bóng đèn tuýp", unit: "Cái", needed: 4, stock: 1, shortage: 3 }]);
  });
  it("Agent source reads 'Agent'; missing location, note, unit and untracked stock stay safe", () => {
    const r = toMaterialRequest(
      row({ source: "AGENT", location: null, note: null, department_id: null, lines: [{ item_code: "C", item_name: "N", unit: null, needed_qty: 2, stock_qty: null, shortage_qty: 2 }] }),
      depts,
      String,
    );
    expect(r).toMatchObject({ sourceLabel: "Agent", location: "—", note: "", departmentName: "" });
    expect(r.lines[0]).toMatchObject({ unit: "", stock: null, shortage: 2 });
  });
  it("a department report from an unknown department still names a source", () => {
    expect(toMaterialRequest(row({ department_id: "DEPT_X" }), depts, String).sourceLabel).toBe("Phòng ban");
  });
  it("summarises every short line for the bell", () => {
    expect(requestSummary(toMaterialRequest(row(), depts, String))).toBe("Bóng đèn tuýp thiếu 3 Cái");
  });
});

describe("buildShortagePayload (CONTRACTS §3 body)", () => {
  it("builds lines with whole quantities and a trimmed note", () => {
    expect(buildShortagePayload({ picked: { A: "2", B: "1" }, note: "  gấp " })).toEqual({
      ok: true,
      lines: [
        { itemCode: "A", qty: 2 },
        { itemCode: "B", qty: 1 },
      ],
      note: "gấp",
    });
  });
  it("refuses nothing picked", () => {
    expect(buildShortagePayload({ picked: {}, note: "" })).toMatchObject({ ok: false });
  });
  it.each(["0", "-1", "1.5", "", "abc"])("refuses quantity %j", (q) => {
    const r = buildShortagePayload({ picked: { A: q }, note: "" });
    expect(r.ok).toBe(false);
  });
});

describe("deptStatusLabel", () => {
  it("WAITING_MATERIAL says the warehouse is the one to act", () => {
    expect(deptStatusLabel({ blockerCode: "WAITING_MATERIAL", statusLabel: "Tạm hoãn" })).toBe("Chờ kho nhập vật tư");
    expect(deptStatusLabel({ blockerCode: null, statusLabel: "Đang xử lý" })).toBe("Đang xử lý");
    expect(deptStatusLabel({ blockerCode: "BLOCKED_ONSITE", statusLabel: "Tạm hoãn" })).toBe("Tạm hoãn");
  });
});
