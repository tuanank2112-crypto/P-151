import { describe, expect, it } from "vitest";
import {
  buildDeptTicket,
  buildDetail,
  buildInboxItem,
  buildMgmtTicket,
  buildReadiness,
  buildResidentTicket,
  buildWarehouseRequest,
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
    expect(t).toMatchObject({ bqlWork: true, dept: "bql", late: true, urgent: true, stage: 2, merged: false });
    expect(buildMgmtTicket({ ...row, status: "MERGED", blocker: null }, undefined, now)).toMatchObject({ merged: true, cancelled: true });
  });

  it("warehouse request lists only short lines", () => {
    const c = aCase({ status: "ON_HOLD" });
    const stock = stockMap([{ item_code: "SIM-MAT-1", item_name: "Bóng LED", unit: "cái", qty: 0 }]);
    const r = buildWarehouseRequest(c, stock, { DEPT_TECHNICAL: "Phòng kỹ thuật" }, now);
    expect(r?.lines).toEqual([{ itemCode: "SIM-MAT-1", itemName: "Bóng LED", unit: "cái", plannedQty: 2, stock: 0, shortage: 2 }]);
    expect(r?.departmentName).toBe("Phòng kỹ thuật");
    expect(buildWarehouseRequest(c, stockMap([{ item_code: "SIM-MAT-1", item_name: "x", unit: "cái", qty: 9 }]), {}, now)).toBeNull();
  });
});
