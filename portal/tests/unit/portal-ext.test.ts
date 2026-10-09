import { describe, expect, it } from "vitest";
import {
  agentDept,
  agentPerformance,
  agentVerdict,
  deptLoadFilter,
  deptPerformance,
  escalationSource,
  hoursBetween,
  overviewCount,
  overviewFilter,
  splitReport,
  type OverviewKind,
} from "@/lib/backend-map";
import type { MgmtTicket } from "@/lib/dto";
import {
  buildAgentInfo,
  buildDeptTicket,
  buildDetail,
  buildInboxItem,
  buildMgmtTicket,
  buildResidentTicket,
  buildWarehouseRequest,
  materialStatus,
  stockMap,
} from "@/server/data/build";
import type { BAgentRecord, BBqlRow, BCase, BResidentView, BSummary } from "@/server/data/types";

const now = new Date("2026-10-09T03:00:00Z");
const labels = { IN_PROGRESS: "Đang xử lý", ON_HOLD: "Tạm dừng", VERIFYING: "Đang xác minh" };

// ---------- splitReport (SPEC-P03 §2) ----------
describe("splitReport", () => {
  it("title = first line, content = middle, location = last Vị trí line", () => {
    const r = splitReport("Đèn hành lang tắt\nTắt từ tối qua, rất tối\nVị trí: Tòa S2.05 · Tầng 12");
    expect(r).toEqual({ title: "Đèn hành lang tắt", content: "Tắt từ tối qua, rất tối", location: "Tòa S2.05 · Tầng 12" });
  });
  it("keeps multi-line content", () => {
    const r = splitReport("T\nDòng 1\nDòng 2\nVị trí: X");
    expect(r.content).toBe("Dòng 1\nDòng 2");
  });
  it("legacy single line: short text is only a title, no duplicated content", () => {
    expect(splitReport("Thùng rác đầy\nVị trí: Tầng 3")).toEqual({ title: "Thùng rác đầy", content: "", location: "Tầng 3" });
  });
  it("legacy single long line: title truncated to 80, content keeps the full text", () => {
    const long = "a".repeat(100);
    const r = splitReport(`${long}\nVị trí: Y`);
    expect(r.title).toBe("a".repeat(80));
    expect(r.content).toBe(long);
  });
  it("no location line gives the dash", () => {
    expect(splitReport("Tiêu đề\nNội dung").location).toBe("—");
  });
});

// ---------- agentDept / verdict / performance ----------
describe("agentDept", () => {
  it("only the real Agent counts", () => {
    expect(agentDept("AGENT", "DEPT_CLEANING", "IN_SCOPE")).toBe("ve_sinh");
    expect(agentDept("AGENT", "DEPT_TECHNICAL", null)).toBe("ky_thuat");
    expect(agentDept("FALLBACK_RULE", "DEPT_CLEANING", "IN_SCOPE")).toBeNull();
    expect(agentDept(null, "DEPT_CLEANING", null)).toBeNull();
  });
  it("OUT_OF_SCOPE means the BQL", () => {
    expect(agentDept("AGENT", null, "OUT_OF_SCOPE")).toBe("bql");
  });
});

describe("agentVerdict / agentPerformance", () => {
  const row = (id: string, a: "ve_sinh" | "ky_thuat" | "bql" | null, d: "ve_sinh" | "ky_thuat" | "bql" | null, needInfo = false, src = "AGENT") => ({
    id,
    code: id,
    agentSource: src,
    agentDept: a,
    dept: d,
    needInfo,
  });
  it("verdict", () => {
    expect(agentVerdict(row("1", "ve_sinh", "ve_sinh"))).toBe("correct");
    expect(agentVerdict(row("2", "ve_sinh", "ky_thuat"))).toBe("wrong");
    expect(agentVerdict(row("3", null, "ky_thuat"))).toBeNull();
    expect(agentVerdict(row("4", "ve_sinh", null))).toBeNull();
    expect(agentVerdict(row("5", "bql", "bql"))).toBe("correct");
    expect(agentVerdict(row("6", "ve_sinh", "ve_sinh", false, "FALLBACK_RULE"))).toBeNull();
  });
  it("counts", () => {
    const p = agentPerformance([
      row("1", "ve_sinh", "ve_sinh"),
      row("2", "ve_sinh", "ky_thuat"),
      row("3", "ky_thuat", "ky_thuat"),
      row("4", null, "ky_thuat"),
      row("5", null, null, true),
    ]);
    expect(p.transferred).toBe(4);
    expect(p.correct).toBe(2);
    expect(p.wrong).toBe(1);
    expect(p.correctPct).toBe(67);
    expect(p.waitingResident).toBe(1);
    expect(p.corrections).toEqual([{ id: "2", code: "2", agentDept: "ve_sinh", finalDept: "ky_thuat" }]);
  });
  it("no judged ticket gives null percent", () => {
    expect(agentPerformance([row("1", null, "ve_sinh")]).correctPct).toBeNull();
    expect(agentPerformance([]).correctPct).toBeNull();
  });
});

// ---------- overview filter (SPEC-P03 §5.2) ----------
function mt(over: Partial<MgmtTicket>): MgmtTicket {
  return {
    id: "x",
    code: "x",
    text: "",
    title: "",
    content: "",
    location: "",
    createdAt: "",
    stage: 1,
    statusLabel: "",
    dept: null,
    cancelled: false,
    urgent: false,
    late: false,
    escalated: false,
    blockerCode: null,
    riskLevel: "NONE",
    priority: null,
    closureKind: null,
    ratingStars: null,
    ratingTags: [],
    ratingComment: "",
    bqlWork: false,
    bqlSource: null,
    merged: false,
    agentDept: null,
    agentSource: null,
    staffName: null,
    doneHours: null,
    ...over,
  };
}

describe("overviewFilter", () => {
  const rows: MgmtTicket[] = [
    mt({ id: "a", stage: 1 }), // waiting
    mt({ id: "b", stage: 2 }), // waiting
    mt({ id: "c", stage: 2, bqlWork: true, dept: "bql" }), // BQL work: not waiting
    mt({ id: "d", stage: 3, dept: "ve_sinh" }), // processing
    mt({ id: "e", stage: 4, dept: "ky_thuat", late: true }), // processing + late
    mt({ id: "f", stage: 5, dept: "ky_thuat" }), // waiting inspection: not processing
    mt({ id: "g", stage: 6, riskLevel: "EMERGENCY", closureKind: "EMERGENCY_HANDLED" }), // closed emergency: not open
    mt({ id: "h", stage: 4, riskLevel: "EMERGENCY", dept: "ve_sinh" }), // open emergency
    mt({ id: "i", stage: 1, cancelled: true, late: true }), // cancelled
    mt({ id: "j", stage: 1, cancelled: true, merged: true }), // merged
  ];
  const ids = (k: OverviewKind) => rows.filter(overviewFilter(k)).map((r) => r.id);
  it("total excludes MERGED only", () => expect(ids("total")).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i"]));
  it("waiting = stage 1-2, not cancelled, not BQL work", () => expect(ids("waiting")).toEqual(["a", "b"]));
  it("processing = stage 3-4, not cancelled (no inspection)", () => expect(ids("processing")).toEqual(["d", "e", "h"]));
  it("emergency = EMERGENCY, stage < 6, not cancelled", () => expect(ids("emergency")).toEqual(["h"]));
  it("late = late and not cancelled", () => expect(ids("late")).toEqual(["e"]));
  it("count equals number of filtered rows for every kind", () => {
    for (const k of ["total", "waiting", "processing", "emergency", "late"] as OverviewKind[]) {
      expect(overviewCount(rows, k)).toBe(ids(k).length);
    }
  });
});

describe("deptLoadFilter", () => {
  const rows = [
    mt({ id: "a", dept: "ve_sinh", stage: 3 }),
    mt({ id: "b", dept: "ve_sinh", stage: 5 }),
    mt({ id: "c", dept: "ve_sinh", stage: 6 }),
    mt({ id: "d", dept: "ky_thuat", stage: 3 }),
    mt({ id: "e", dept: "ve_sinh", stage: 3, cancelled: true }),
  ];
  it("default hides finished and cancelled", () => {
    expect(rows.filter(deptLoadFilter("ve_sinh", false)).map((r) => r.id)).toEqual(["a"]);
  });
  it("showAll keeps finished and cancelled of that department", () => {
    expect(rows.filter(deptLoadFilter("ve_sinh", true)).map((r) => r.id)).toEqual(["a", "b", "c", "e"]);
  });
});

describe("hoursBetween / deptPerformance", () => {
  it("hours with one decimal", () => {
    expect(hoursBetween("2026-10-09T01:00:00Z", "2026-10-09T03:30:00Z")).toBe(2.5);
    expect(hoursBetween("2026-10-09T01:00:00Z", "2026-10-09T01:20:00Z")).toBe(0.3);
  });
  it("null when a side is missing or the order is wrong", () => {
    expect(hoursBetween(null, "2026-10-09T03:30:00Z")).toBeNull();
    expect(hoursBetween("2026-10-09T03:30:00Z", undefined)).toBeNull();
    expect(hoursBetween("2026-10-09T05:00:00Z", "2026-10-09T03:00:00Z")).toBeNull();
  });
  it("per department stats", () => {
    const rows = [
      mt({ dept: "ve_sinh", stage: 3 }),
      mt({ dept: "ve_sinh", stage: 4, late: true }),
      mt({ dept: "ve_sinh", stage: 6, ratingStars: 5, doneHours: 2 }),
      mt({ dept: "ve_sinh", stage: 6, ratingStars: 4, doneHours: 3 }),
      mt({ dept: "ve_sinh", stage: 6 }),
      mt({ dept: "ky_thuat", stage: 6, ratingStars: 1, doneHours: 9 }),
    ];
    expect(deptPerformance(rows, "ve_sinh")).toEqual({ processing: 2, late: 1, closed: 3, avgStars: 4.5, avgHours: 2.5 });
    expect(deptPerformance([], "ve_sinh")).toEqual({ processing: 0, late: 0, closed: 0, avgStars: null, avgHours: null });
  });
});

// ---------- escalationSource ----------
describe("escalationSource", () => {
  it("reads payload.by of the latest escalation", () => {
    expect(
      escalationSource([{ type: "escalation", payload: { by: "BPTN" } }, { type: "escalation", payload: { by: "AGENT" } }], false),
    ).toBe("Agent chuyển");
    expect(escalationSource([{ type: "escalation", payload: { by: "AGENT" } }, { type: "escalation", payload: { by: "BPTN" } }], true)).toBe(
      "Tiếp nhận chuyển",
    );
  });
  it("ignores other notification types", () => {
    expect(escalationSource([{ type: "reminder", payload: { by: "AGENT" } }], false)).toBe("Tiếp nhận chuyển");
  });
  it("falls back to the Agent hint when no notification says who", () => {
    expect(escalationSource(undefined, true)).toBe("Agent chuyển");
    expect(escalationSource([], false)).toBe("Tiếp nhận chuyển");
  });
});

// ---------- case fixtures ----------
const record = (over: Partial<BAgentRecord> = {}): BAgentRecord => ({
  source: "AGENT",
  model: "gemini-test",
  fallback_reason: null,
  rule_risk_level: "NONE",
  agent_risk_level: "NONE",
  valid_job_indexes: [0],
  disagreements: [],
  decision: {
    reasoning: [
      { step: "SAFETY", facts: [], conclusion: "Không có tín hiệu nguy hiểm" },
      { step: "CATEGORY", facts: [], conclusion: "Việc điện: đèn hành lang" },
    ],
    safety: {
      risk_level: "UNCLEAR",
      signals: [
        { signal_id: "SPARK", status: "UNCLEAR", quote: "có tia lửa" },
        { signal_id: "SMOKE", status: "ABSENT", quote: null },
      ],
      reason: "r",
    },
    scope: "IN_SCOPE",
    jobs: [{ department_id: "DEPT_TECHNICAL", category: "KY_THUAT", reason: "Đèn là thiết bị điện" }],
    next_step: "PROCEED",
    note_for_staff: "",
  },
  ...over,
});

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
      raw: {
        created_at: "2026-10-09T01:00:00Z",
        original_description: "Đèn hành lang tắt\nTắt hẳn từ tối\nVị trí: Tòa S2.05 · Tầng 12 · Hành lang",
      },
      closure_kind: null,
      merged_into: null,
      ...over,
    },
    checklist_items: [],
    material_lines: [
      { item_code: "SIM-MAT-1", item_name: "Bóng LED", unit: "cái", planned_qty: 2, issued_qty: null, used_qty: null, simulated_stock_qty: 5 },
    ],
    evidence: [],
    evidence_round_start: 0,
    additions: [],
    events: [{ to_status: "RECEIVED", public_message: "Đã nhận", internal_note: null, public: true, actor_role: "SYSTEM", created_at: "2026-10-09T01:00:00Z" }],
    draft: null,
    agent_decision: record(),
    notifications: [],
    ...extra,
  };
}

const waitingBlocker = (resolved: string | null = null) => ({
  code: "WAITING_MATERIAL",
  owner_role: "WAREHOUSE",
  since: "2026-10-09T02:00:00Z",
  escalated: false,
  eta: null,
  public_message: "Chờ vật tư",
  internal_note: null,
  related_ticket_id: null,
  resolved_at: resolved,
});

// ---------- agent block ----------
describe("buildAgentInfo", () => {
  it("real Agent decision", () => {
    const a = buildAgentInfo(record());
    expect(a).toMatchObject({
      source: "AGENT",
      model: "gemini-test",
      proposedDept: "ky_thuat",
      riskLevel: "UNCLEAR",
      failed: false,
      reason: "Đèn là thiết bị điện",
    });
    expect(a?.steps).toEqual(["Không có tín hiệu nguy hiểm", "Việc điện: đèn hành lang"]);
    // only present/unclear signals with a quote
    expect(a?.signals).toEqual([{ id: "SPARK", quote: "có tia lửa" }]);
  });
  it("OUT_OF_SCOPE Agent points at the BQL", () => {
    const r = record();
    r.decision!.scope = "OUT_OF_SCOPE";
    r.decision!.jobs = [];
    r.decision!.next_step = "TO_BPTN";
    r.decision!.note_for_staff = "Hóa đơn là việc của BQL";
    const a = buildAgentInfo(r);
    expect(a?.proposedDept).toBe("bql");
    expect(a?.reason).toBe("Hóa đơn là việc của BQL");
  });
  it("fallback gives the fixed-rule wording and no proposal", () => {
    const a = buildAgentInfo(record({ source: "FALLBACK_RULE", decision: null, fallback_reason: "TIMEOUT", model: "rules" }));
    expect(a).toMatchObject({ source: "FALLBACK_RULE", proposedDept: null, failed: true, steps: [], signals: [] });
    expect(a?.reason).toBe("Agent không quyết được — luật cố định");
  });
  it("disagreements are readable strings", () => {
    const a = buildAgentInfo(
      record({ disagreements: [{ field: "department", severity: "SERIOUS", rule_value: "A", agent_value: "B", note: "Khác phòng" }] }),
    );
    expect(a?.disagreements).toEqual(["department: Khác phòng"]);
  });
  it("null record gives null", () => {
    expect(buildAgentInfo(null)).toBeNull();
    expect(buildAgentInfo(undefined)).toBeNull();
  });
});

describe("TicketDetail.agent and fields", () => {
  it("detail carries the Agent info, title and content", () => {
    const d = buildDetail(aCase(), labels, {}, now);
    expect(d.agent?.proposedDept).toBe("ky_thuat");
    expect(d.title).toBe("Đèn hành lang tắt");
    expect(d.content).toBe("Tắt hẳn từ tối");
    expect(d.location).toBe("Tòa S2.05 · Tầng 12 · Hành lang");
  });
  it("detail without a decision has agent null", () => {
    expect(buildDetail(aCase({}, { agent_decision: null }), labels, {}, now).agent).toBeNull();
  });
  it("summary adds staff and rating", () => {
    const s = { staff_name: "Tổ B", rating: 4, rating_tags: ["Xử lý nhanh"], rating_comment: "ok" } as BSummary;
    const d = buildDetail(aCase(), labels, {}, now, s);
    expect(d.staffName).toBe("Tổ B");
    expect(d.rating).toEqual({ stars: 4, tags: ["Xử lý nhanh"], comment: "ok" });
  });
});

// ---------- resident ----------
describe("resident ticket (title/content, rating)", () => {
  const view: BResidentView = {
    ticket_id: "SIM-TKT-0001",
    created_at: "2026-10-09T01:00:00Z",
    description: "Thùng rác đầy\nĐầy từ sáng, hôi\nVị trí: Tòa S2.05 · Tầng 12",
    additions: [],
    photos: [],
    status: "CLOSED",
    status_label: "Hoàn tất",
    department_name: "Phòng vệ sinh",
    public_message: "",
    eta: null,
    timeline: [],
    allowed_actions: [],
    merged_into: null,
  };
  it("splits title/content/location", () => {
    const t = buildResidentTicket(view, now);
    expect(t).toMatchObject({ title: "Thùng rác đầy", content: "Đầy từ sáng, hôi", location: "Tòa S2.05 · Tầng 12" });
  });
  it("rating, tags, comment from the backend", () => {
    const t = buildResidentTicket({ ...view, rating: 5, rating_tags: ["Xử lý nhanh"], rating_comment: "Tốt" }, now);
    expect(t).toMatchObject({ rating: 5, ratingTags: ["Xử lý nhanh"], ratingComment: "Tốt", rated: true });
  });
  it("older backend without rating fields still works", () => {
    const t = buildResidentTicket(view, now);
    expect(t).toMatchObject({ rating: null, ratingTags: [], ratingComment: "", rated: true });
  });
});

// ---------- material status ----------
describe("materialStatus", () => {
  const stock = stockMap([{ item_code: "SIM-MAT-1", item_name: "Bóng LED", unit: "cái", qty: 5 }]);
  it("none without lines", () => {
    expect(materialStatus(aCase({}, { material_lines: [] }), stock)).toBe("none");
  });
  it("waiting approval when stock is enough", () => {
    expect(materialStatus(aCase({ status: "ON_HOLD", blocker: waitingBlocker() }), stock)).toBe("pending");
  });
  it("waiting stock when short", () => {
    const low = stockMap([{ item_code: "SIM-MAT-1", item_name: "Bóng LED", unit: "cái", qty: 0 }]);
    expect(materialStatus(aCase({ status: "ON_HOLD", blocker: waitingBlocker() }), low)).toBe("waiting_stock");
  });
  it("approved once the blocker is resolved or the ticket moved on", () => {
    expect(materialStatus(aCase({ status: "ON_HOLD", blocker: waitingBlocker("2026-10-09T02:30:00Z") }), stock)).toBe("approved");
    expect(materialStatus(aCase({ status: "IN_PROGRESS" }), stock)).toBe("approved");
  });
});

describe("department ticket (staff, rating, material status)", () => {
  const stock = stockMap([{ item_code: "SIM-MAT-1", item_name: "Bóng LED", unit: "cái", qty: 5 }]);
  it("uses the summary for staff and rating, title/content from the description", () => {
    const s = { staff_name: "Kỹ thuật viên 2", rating: 3, rating_tags: ["Chậm trễ"], rating_comment: "chậm" } as BSummary;
    const t = buildDeptTicket(aCase({ status: "ON_HOLD", blocker: waitingBlocker() }), labels, stock, now, s);
    expect(t).toMatchObject({
      title: "Đèn hành lang tắt",
      content: "Tắt hẳn từ tối",
      staffName: "Kỹ thuật viên 2",
      materialStatus: "pending",
      rating: { stars: 3, tags: ["Chậm trễ"], comment: "chậm" },
    });
  });
  it("without summary fields staff is null and rating null", () => {
    const t = buildDeptTicket(aCase(), labels, stock, now);
    expect(t.staffName).toBeNull();
    expect(t.rating).toBeNull();
  });
});

// ---------- warehouse ----------
describe("warehouse request (approve)", () => {
  const stock = stockMap([{ item_code: "SIM-MAT-1", item_name: "Bóng LED", unit: "cái", qty: 5 }]);
  it("a request with enough stock is listed, can be approved", () => {
    const r = buildWarehouseRequest(aCase({ status: "ON_HOLD", blocker: waitingBlocker() }), stock, { DEPT_TECHNICAL: "Phòng kỹ thuật" }, now);
    expect(r).not.toBeNull();
    expect(r).toMatchObject({ approved: false, short: false, ticketText: "Đèn hành lang tắt" });
    expect(r!.lines[0]).toMatchObject({ itemCode: "SIM-MAT-1", plannedQty: 2, stock: 5, shortage: 0, short: false });
  });
  it("short stock flags the request and the line", () => {
    const low = stockMap([{ item_code: "SIM-MAT-1", item_name: "Bóng LED", unit: "cái", qty: 1 }]);
    const r = buildWarehouseRequest(aCase({ status: "ON_HOLD", blocker: waitingBlocker() }), low, {}, now);
    expect(r).toMatchObject({ approved: false, short: true });
    expect(r!.lines[0]).toMatchObject({ shortage: 1, short: true });
  });
  it("resolved blocker means approved", () => {
    const r = buildWarehouseRequest(aCase({ status: "ON_HOLD", blocker: waitingBlocker("2026-10-09T02:30:00Z") }), stock, {}, now);
    expect(r?.approved).toBe(true);
  });
  it("no lines gives null", () => {
    expect(buildWarehouseRequest(aCase({}, { material_lines: [] }), stock, {}, now)).toBeNull();
  });
});

// ---------- reception inbox ----------
describe("reception inbox", () => {
  it("has title, content and the real Agent block", () => {
    const c = aCase({
      status: "VERIFYING",
      department_id: null,
      blocker: { ...waitingBlocker(), code: "CATEGORY_UNCLEAR", owner_role: "BPTN", public_message: "Đang xác minh" },
    });
    const item = buildInboxItem(c, new Map(), now);
    expect(item).toMatchObject({ title: "Đèn hành lang tắt", content: "Tắt hẳn từ tối" });
    expect(item.agent).toMatchObject({ source: "AGENT", proposedDept: "ky_thuat", failed: false });
  });
  it("agent null when the case has no decision", () => {
    const c = aCase({ status: "VERIFYING" }, { agent_decision: null });
    expect(buildInboxItem(c, new Map(), now).agent).toBeNull();
  });
});

// ---------- management ----------
describe("management ticket", () => {
  const row = (over: Partial<BBqlRow> = {}): BBqlRow => ({
    ticket_id: "SIM-TKT-0042",
    status: "CLOSED",
    status_label: "Hoàn tất",
    department_id: "DEPT_CLEANING",
    blocker: null,
    escalated: false,
    overdue: false,
    created_at: "2026-10-09T01:00:00Z",
    risk_level: "NONE",
    priority: "MEDIUM",
    closure_kind: "NORMAL",
    rating: 5,
    rating_tags: ["Xử lý nhanh"],
    rating_comment: "tốt",
    staff_name: "Tổ A",
    agent_source: "AGENT",
    agent_department: "DEPT_CLEANING",
    agent_scope: "IN_SCOPE",
    accepted_at: "2026-10-09T01:30:00Z",
    closed_at: "2026-10-09T04:00:00Z",
    ...over,
  });
  const summary = { ticket_id: "SIM-TKT-0042", description: "Rác tràn\nNhiều rác ở hành lang\nVị trí: Tầng 3" } as BSummary;
  it("title, content, agent department, hours, stars, staff", () => {
    const t = buildMgmtTicket(row(), summary, now);
    expect(t).toMatchObject({
      title: "Rác tràn",
      content: "Nhiều rác ở hành lang",
      location: "Tầng 3",
      agentDept: "ve_sinh",
      doneHours: 2.5,
      ratingStars: 5,
      ratingTags: ["Xử lý nhanh"],
      ratingComment: "tốt",
      staffName: "Tổ A",
    });
  });
  it("rows from an older backend still map", () => {
    const old = row();
    for (const k of ["rating", "rating_tags", "rating_comment", "staff_name", "agent_source", "agent_department", "agent_scope", "accepted_at", "closed_at"] as const) {
      delete (old as Record<string, unknown>)[k];
    }
    const t = buildMgmtTicket(old, summary, now);
    expect(t).toMatchObject({ agentDept: null, doneHours: null, ratingStars: null, ratingTags: [], staffName: null });
  });
  it("BQL work shows its source from the case notifications, else from the Agent hint", () => {
    const blocker = { ...waitingBlocker(), code: "OUT_OF_SCOPE", owner_role: "BQL", escalated: true };
    const base = row({ status: "VERIFYING", department_id: null, blocker, escalated: true, agent_scope: "OUT_OF_SCOPE", agent_department: null });
    const byAgent = buildMgmtTicket(base, summary, now, aCase({}, { notifications: [{ type: "escalation", payload: { by: "AGENT" } }] }));
    expect(byAgent).toMatchObject({ bqlWork: true, bqlSource: "Agent chuyển", agentDept: "bql" });
    const byBptn = buildMgmtTicket(base, summary, now, aCase({}, { notifications: [{ type: "escalation", payload: { by: "BPTN" } }] }));
    expect(byBptn.bqlSource).toBe("Tiếp nhận chuyển");
    const hint = buildMgmtTicket(base, summary, now);
    expect(hint.bqlSource).toBe("Agent chuyển");
    expect(buildMgmtTicket(row(), summary, now).bqlSource).toBeNull();
  });
});
