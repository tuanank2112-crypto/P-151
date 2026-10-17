import { describe, expect, it } from "vitest";
import {
  buildDeptTicket,
  buildDetail,
  buildInboxItem,
  buildMgmtTicket,
  buildReadiness,
  buildResidentTicket,
  buildWarehouseRequest,
  perfRow,
  stockMap,
} from "@/server/data/build";
import type { BBqlRow, BCase, BResidentView, BSummary } from "@/server/data/types";

const now = new Date("2026-10-09T03:00:00Z");
const labels = { IN_PROGRESS: "Đang xử lý", ON_HOLD: "Tạm dừng", VERIFYING: "Đang xác minh" };

function aCase(over: Partial<BCase["ticket"]> = {}, extra: Partial<BCase> = {}): BCase {
  return {
    ticket: {
      ticket_id: "SIM-TKT-0042",
      status: "IN_PROGRESS",
      department_id: "DEPT_TECHNICAL",
      proposed_department_id: "DEPT_TECHNICAL",
      blocker: null,
      risk_level: "NONE",
      priority: "MEDIUM",
      raw: { created_at: "2026-10-09T01:00:00Z", original_description: "Đèn hành lang tắt\nVị trí: Tòa S2.05 · Tầng 12 · Hành lang" },
      closure_kind: null,
      merged_into: null,
      ...over,
    },
    checklist_items: [
      { template_item_id: "C1", label_snapshot: "Thay bóng", required: true, status: "COMPLETED" },
      { template_item_id: "C2", label_snapshot: "Thử đèn", required: true, status: "PENDING" },
    ],
    material_lines: [
      { item_code: "SIM-MAT-1", item_name: "Bóng LED", unit: "cái", planned_qty: 2, issued_qty: null, used_qty: null, simulated_stock_qty: 5 },
    ],
    evidence: [
      { evidence_id: "E1", evidence_type: "RESIDENT_ORIGINAL", source: "RESIDENT_ORIGINAL" },
      { evidence_id: "E2", evidence_type: "SIMULATED_IMAGE", source: "DEPARTMENT_EXECUTION" },
    ],
    evidence_round_start: 0,
    additions: [{ content: "Tắt hẳn từ tối" }],
    events: [
      { to_status: "RECEIVED", public_message: "Đã nhận", internal_note: null, public: true, actor_role: "SYSTEM", created_at: "2026-10-09T01:00:00Z" },
      { to_status: "ROUTED", public_message: "Đã chuyển", internal_note: "rule R1", public: true, actor_role: "AGENT", created_at: "2026-10-09T01:05:00Z" },
    ],
    draft: null,
    ...extra,
  };
}

describe("resident ticket", () => {
  const view: BResidentView = {
    ticket_id: "SIM-TKT-0001",
    created_at: "2026-10-09T01:00:00Z",
    description: "Thùng rác đầy tràn\nVị trí: Tòa S2.05 · Tầng 12",
    additions: ["thêm"],
    photos: ["E1"],
    status: "CLOSED",
    status_label: "Hoàn thành",
    department_name: "Phòng vệ sinh",
    public_message: "Xong",
    eta: null,
    timeline: [
      { status: "RECEIVED", status_label: "Đã tiếp nhận", public_message: "a", created_at: "2026-10-09T01:00:00Z" },
      { status: "CLOSED", status_label: "Hoàn thành", public_message: "b", created_at: "2026-10-09T02:00:00Z" },
    ],
    allowed_actions: ["RATE"],
    merged_into: null,
  };
  it("maps the resident view without staff-only fields", () => {
    const t = buildResidentTicket(view, now);
    expect(t).toMatchObject({
      id: "SIM-TKT-0001",
      code: "SIM-TKT-0001",
      title: "Thùng rác đầy tràn",
      location: "Tòa S2.05 · Tầng 12",
      stage: 6,
      canRate: true,
      rated: false,
      needInfo: false,
      deptName: "Phòng vệ sinh",
    });
    expect(t.photos).toEqual([{ id: "E1", name: "Ảnh 1", url: "/api/photos/SIM-TKT-0001/E1" }]);
    expect(t.history[0].label).toBe("Hoàn thành"); // newest first
    expect(Object.keys(t)).not.toContain("urgent");
  });
  it("a closed ticket that can no longer be rated is marked rated", () => {
    expect(buildResidentTicket({ ...view, allowed_actions: [] }, now).rated).toBe(true);
  });
  // góp ý nhóm [c]: a merged report is "Đã gộp", not "Đã hủy", and follows the ticket it was merged into
  const merged = (status: BResidentView["status"], label: string): BResidentView => ({
    ...view,
    status: "MERGED",
    status_label: "Đã gộp",
    department_name: null,
    public_message: "Phản ánh đã được gộp vào phản ánh SIM-TKT-0026.",
    timeline: [
      { status: "RECEIVED", status_label: "Đã tiếp nhận", public_message: "a", created_at: "2026-10-09T01:00:00Z" },
      { status: "MERGED", status_label: "Đã gộp", public_message: "gộp", created_at: "2026-10-09T01:10:00Z" },
    ],
    allowed_actions: [],
    merged_into: { ticket_id: "SIM-TKT-0026", status, status_label: label, department_name: "Phòng kỹ thuật", public_message: "Đang sửa" },
  });
  it("a merged report follows its root ticket and is not cancelled", () => {
    const t = buildResidentTicket(merged("IN_PROGRESS", "Đang xử lý"), now);
    expect(t).toMatchObject({
      merged: true,
      cancelled: false,
      mergedInto: "SIM-TKT-0026",
      stage: 4,
      deptName: "Phòng kỹ thuật",
      statusLabel: "Đã gộp · Đang xử lý",
      publicMessage: "Đang sửa",
    });
  });
  it("a merged report reaches stage 6 with its root and can then be rated", () => {
    const t = buildResidentTicket({ ...merged("CLOSED", "Hoàn thành"), allowed_actions: ["RATE"] }, now);
    expect(t).toMatchObject({ merged: true, cancelled: false, stage: 6, canRate: true });
  });
  it("a merged report whose root was cancelled is cancelled too", () => {
    const t = buildResidentTicket(merged("CANCELLED", "Đã hủy"), now);
    expect(t).toMatchObject({ merged: true, cancelled: true, stage: 1 });
  });
});

describe("department ticket", () => {
  it("builds checklist, materials with live stock and a local readiness read", () => {
    const stock = stockMap([{ item_code: "SIM-MAT-1", item_name: "Bóng LED", unit: "cái", qty: 1 }]);
    const t = buildDeptTicket(aCase(), labels, stock, now);
    expect(t.stage).toBe(4);
    expect(t.statusLabel).toBe("Đang xử lý");
    expect(t.checklist.map((c) => c.done)).toEqual([true, false]);
    expect(t.materials[0]).toMatchObject({ stock: 1, shortage: 1, plannedQty: 2 });
    expect(t.photos).toHaveLength(2);
    expect(t.readiness).toEqual({ checklist: false, photo: true, materials: false, failing: ["Chưa xong checklist", "Chưa nhập vật tư đã dùng"] });
  });
  it("photo readiness only counts photos of the current round", () => {
    const c = aCase({}, { evidence_round_start: 2 });
    expect(buildReadiness(c).photo).toBe(false);
    expect(buildReadiness(c).failing).toContain("Thiếu ảnh sau xử lý");
  });
  it("hoursLeft comes from the blocker eta, null without one", () => {
    expect(buildDeptTicket(aCase(), labels, new Map(), now).hoursLeft).toBeNull();
    const c = aCase({
      status: "ON_HOLD",
      blocker: { code: "BLOCKED_ONSITE", owner_role: "DEPARTMENT", since: "2026-10-09T01:00:00Z", escalated: false, eta: "2026-10-09T08:00:00Z", public_message: "x", internal_note: null, related_ticket_id: null },
    });
    const t = buildDeptTicket(c, labels, new Map(), now);
    expect(t.hoursLeft).toBe(5);
    expect(t.paused).toBe(true);
  });
});

describe("detail, inbox, management, warehouse", () => {
  it("detail separates before/after photos, keeps internal notes and has no agent fields", () => {
    const d = buildDetail(aCase(), labels, { DEPT_TECHNICAL: "Phòng kỹ thuật" }, now);
    expect(d.beforePhotos.map((p) => p.id)).toEqual(["E1"]);
    expect(d.afterPhotos.map((p) => p.id)).toEqual(["E2"]);
    expect(d.deptName).toBe("Phòng kỹ thuật");
    expect(d.history[1].note).toContain("nội bộ: rule R1");
    expect(JSON.stringify(d)).not.toMatch(/aiDept|keywords|"conf"/);
  });

  it("inbox item links the duplicate ticket and translates the blocker", () => {
    const c = aCase({
      status: "VERIFYING",
      department_id: null,
      blocker: { code: "DUPLICATE", owner_role: "BPTN", since: "2026-10-09T01:00:00Z", escalated: false, eta: null, public_message: "m", internal_note: null, related_ticket_id: "SIM-TKT-0007" },
    });
    const other: BSummary = {
      ticket_id: "SIM-TKT-0007", status: "ROUTED", status_label: "Đã chuyển", reason_code: null, proposed_department_id: null, department_id: "DEPT_TECHNICAL",
      escalated: false, risk_level: "NONE", priority: "LOW", created_at: "2026-10-08T01:00:00Z", description: "Đèn hỏng\nVị trí: Sảnh",
    };
    const item = buildInboxItem(c, new Map([[other.ticket_id, other]]), now);
    expect(item.blockerLabel).toBe("Nghi trùng");
    expect(item.duplicateOf).toBe("SIM-TKT-0007");
    expect(item.duplicate).toEqual({ id: "SIM-TKT-0007", code: "SIM-TKT-0007", text: "Đèn hỏng", statusLabel: "Đã chuyển" });
    expect(item.proposedDept).toBe("ky_thuat");
  });

  it("management row marks BQL work, late and merged", () => {
    const row = {
      ticket_id: "SIM-TKT-0009", status: "VERIFYING", status_label: "Đang xác minh", department_id: null, escalated: true, overdue: true,
      created_at: "2026-10-09T01:00:00Z", risk_level: "NONE", priority: "HIGH", closure_kind: null,
      blocker: { code: "OUT_OF_SCOPE", owner_role: "BPTN", since: "2026-10-09T01:00:00Z", escalated: true, eta: null, public_message: "m", internal_note: null, related_ticket_id: null },
    } as BBqlRow;
    const t = buildMgmtTicket(row, undefined, now);
    expect(t).toMatchObject({ bqlWork: true, dept: "bql", late: true, urgent: false, stage: 2, merged: false }); // HIGH priority alone is not "Khẩn cấp"
    expect(buildMgmtTicket({ ...row, risk_level: "EMERGENCY" }, undefined, now)).toMatchObject({ urgent: true });
    expect(buildMgmtTicket({ ...row, status: "MERGED", blocker: null }, undefined, now)).toMatchObject({ merged: true, cancelled: true });
  });

  it("plan 23: an emergency suspect shows the open emergency it may duplicate; a DUPLICATE blocker does not", () => {
    const emergency = {
      ticket_id: "SIM-TKT-0002", status: "VERIFYING", status_label: "Đang xác minh", department_id: null, escalated: false, overdue: false,
      created_at: "2026-10-09T01:05:00Z", risk_level: "EMERGENCY", priority: null, closure_kind: null, duplicate_count: 0,
      blocker: { code: "EMERGENCY_PENDING_BQL", owner_role: "BQL", since: "2026-10-09T01:05:00Z", escalated: false, eta: null, public_message: "m", internal_note: null, related_ticket_id: "SIM-TKT-0001" },
    } as BBqlRow;
    expect(buildMgmtTicket(emergency, undefined, now)).toMatchObject({ suspectOf: "SIM-TKT-0001", duplicateCount: 0 });
    const root = { ...emergency, ticket_id: "SIM-TKT-0001", duplicate_count: 2, blocker: { ...emergency.blocker!, related_ticket_id: null } };
    expect(buildMgmtTicket(root, undefined, now)).toMatchObject({ suspectOf: null, duplicateCount: 2 });
    const ordinary = { ...emergency, risk_level: "NONE", blocker: { ...emergency.blocker!, code: "DUPLICATE", owner_role: "BPTN" } };
    expect(buildMgmtTicket(ordinary, undefined, now).suspectOf).toBeNull();
  });

  it("warehouse request lists every line, flags the short ones (Q15: all plans need approval)", () => {
    const c = aCase({ status: "ON_HOLD" });
    const stock = stockMap([{ item_code: "SIM-MAT-1", item_name: "Bóng LED", unit: "cái", qty: 0 }]);
    const r = buildWarehouseRequest(c, stock, { DEPT_TECHNICAL: "Phòng kỹ thuật" }, now);
    expect(r?.lines).toEqual([{ itemCode: "SIM-MAT-1", itemName: "Bóng LED", unit: "cái", plannedQty: 2, stock: 0, shortage: 2, short: true }]);
    expect(r?.departmentName).toBe("Phòng kỹ thuật");
    expect(buildWarehouseRequest(c, stockMap([{ item_code: "SIM-MAT-1", item_name: "x", unit: "cái", qty: 9 }]), {}, now)).toMatchObject({ short: false, approved: false });
  });
});

describe("perfRow (WP7 P9)", () => {
  const base: BSummary = {
    ticket_id: "SIM-TKT-0050", status: "CLOSED", status_label: "Hoàn thành", reason_code: null, proposed_department_id: null, department_id: null,
    escalated: false, risk_level: "NONE", priority: null, created_at: "2026-10-09T01:00:00Z", description: "Phí dịch vụ tính sai",
    agent_source: "AGENT", agent_department: null, agent_scope: "OUT_OF_SCOPE",
  };
  it("a ticket BQL closed as handled still counts as BQL work, so the Agent's out-of-scope pick is judged right", () => {
    expect(perfRow(base)).toMatchObject({ agentDept: "bql", dept: "bql" });
  });
  it("an emergency BQL closed is not BQL work", () => {
    expect(perfRow({ ...base, risk_level: "EMERGENCY" }).dept).toBeNull();
  });
});

describe("material shortage (WP7 NEW-1b)", () => {
  it("counts only what is still to hand out: an issued line is not short even with stock 0", () => {
    const c = aCase({}, {
      material_lines: [
        { item_code: "SIM-MAT-X-1", item_name: "Ống", unit: "cái", planned_qty: 1, issued_qty: 1, used_qty: null, simulated_stock_qty: 0 },
        { item_code: "SIM-MAT-X-2", item_name: "Van", unit: "cái", planned_qty: 3, issued_qty: 1, used_qty: null, simulated_stock_qty: 1 },
      ],
    });
    const t = buildDeptTicket(c, labels, new Map(), now);
    expect(t.materials.map((m) => m.shortage)).toEqual([0, 1]);
  });
});

describe("merged ticket in the staff detail", () => {
  it("is flagged merged so the modal says 'Đã gộp', not 'Đã hủy'", () => {
    const d = buildDetail(aCase({ status: "MERGED", merged_into: "SIM-TKT-0026" }), { MERGED: "Đã gộp" }, {}, now);
    expect(d).toMatchObject({ merged: true, cancelled: true, statusLabel: "Đã gộp" });
    expect(buildDetail(aCase({ status: "CANCELLED" }), {}, {}, now).merged).toBe(false);
  });
});

describe("inbox item for a MISSING_INFO ticket", () => {
  const blocker = { code: "MISSING_INFO", owner_role: "BPTN", since: "2026-10-09T01:00:00Z", escalated: false, eta: null, public_message: "Vui lòng bổ sung", internal_note: null, related_ticket_id: null };
  it("marks a safety NEED_INFO so reception gets no fill-in form", () => {
    const item = buildInboxItem(aCase({ status: "NEED_INFO", blocker, safety_context: true }), new Map(), now);
    expect(item.safetyContext).toBe(true);
    expect(buildInboxItem(aCase({ status: "NEED_INFO", blocker }), new Map(), now).safetyContext).toBe(false);
  });
});
