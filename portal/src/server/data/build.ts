/** Pure builders: backend payloads -> DTOs (01-CONTRACTS §5). No I/O, no framework imports. */
import {
  agentDept,
  blockerLabel,
  deptKey,
  escalationSource,
  failingLabels,
  hoursBetween,
  isBqlWork,
  isUrgent,
  lastKnownStage,
  mapStatus,
  parseDescription,
  splitReport,
  titleOf,
  type PerfRow,
} from "@/lib/backend-map";
import type {
  AgentInfo,
  ChecklistRow,
  DeptTicket,
  DuplicateRef,
  MaterialRow,
  MaterialStatus,
  MgmtTicket,
  PhotoRef,
  Readiness,
  ReceptionAllItem,
  ReceptionInboxItem,
  RatingInfo,
  ResidentTicket,
  TicketDetail,
  WarehouseRequest,
} from "@/lib/dto";
import { fmtDateTime, fmtHistory, fmtRelative } from "@/lib/format";
import type { BAgentRecord, BBqlRow, BCase, BEvidence, BResidentView, BStockRow, BSummary } from "./types";

const HOUR = 3_600_000;

export const photoUrl = (ticketId: string, evidenceId: string) =>
  `/api/photos/${encodeURIComponent(ticketId)}/${encodeURIComponent(evidenceId)}`;

function photos(ticketId: string, list: BEvidence[]): PhotoRef[] {
  return list.map((e, i) => ({ id: e.evidence_id, name: `Ảnh ${i + 1}`, url: photoUrl(ticketId, e.evidence_id) }));
}

const isBefore = (e: BEvidence) => e.evidence_type === "RESIDENT_ORIGINAL";
const isAfter = (e: BEvidence) => e.evidence_type === "SIMULATED_IMAGE";

// ---------- resident ----------
export function buildResidentTicket(v: BResidentView, now: Date): ResidentTicket {
  const { description, location } = parseDescription(v.description);
  const report = splitReport(v.description);
  const info = mapStatus(v.status);
  const canRate = v.allowed_actions.includes("RATE");
  const stage = info.cancelled ? lastKnownStage(v.timeline.map((t) => t.status)) : info.stage;
  return {
    id: v.ticket_id,
    code: v.ticket_id,
    title: report.title || titleOf(description || v.description),
    content: report.content,
    description,
    location,
    sentAt: fmtDateTime(new Date(v.created_at)),
    stage,
    statusLabel: v.status_label,
    publicMessage: v.public_message,
    needInfo: v.allowed_actions.includes("ADD_INFO"),
    canRate,
    rated: v.status === "CLOSED" && !canRate,
    cancelled: info.cancelled,
    mergedInto: v.merged_into?.ticket_id ?? null,
    deptName: v.department_name,
    eta: v.eta ? fmtDateTime(new Date(v.eta)) : null,
    rating: v.rating ?? null,
    ratingTags: v.rating_tags ?? [],
    ratingComment: v.rating_comment ?? "",
    extras: v.additions,
    // newest first, as the resident timeline shows it
    history: [...v.timeline].reverse().map((t) => ({
      label: t.status_label,
      note: t.public_message,
      time: fmtHistory(new Date(t.created_at), now),
    })),
    photos: v.photos.map((id, i) => ({ id, name: `Ảnh ${i + 1}`, url: photoUrl(v.ticket_id, id) })),
  };
}

// ---------- shared pieces of a full case ----------
export function stockMap(rows: BStockRow[]): Map<string, number | null> {
  return new Map(rows.map((r) => [r.item_code, r.qty]));
}

export function buildChecklist(c: BCase): ChecklistRow[] {
  return c.checklist_items.map((i) => ({
    templateItemId: i.template_item_id,
    label: i.label_snapshot,
    required: i.required,
    done: i.status === "COMPLETED",
  }));
}

export function buildMaterials(c: BCase, stock?: Map<string, number | null>): MaterialRow[] {
  return c.material_lines.map((m) => {
    const live = stock?.has(m.item_code) ? (stock.get(m.item_code) ?? null) : m.simulated_stock_qty;
    return {
      itemCode: m.item_code,
      itemName: m.item_name,
      unit: m.unit ?? "",
      plannedQty: m.planned_qty,
      normQty: m.norm_qty ?? null,
      issuedQty: m.issued_qty,
      usedQty: m.used_qty,
      stock: live,
      // what the warehouse still has to hand out, not the whole plan (WP7 review NEW-1b)
      shortage: live === null ? 0 : Math.max(0, m.planned_qty - (m.issued_qty ?? 0) - live),
    };
  });
}

/** Local read of the step-10 conditions so the form can show what is missing before "complete" is sent */
export function buildReadiness(c: BCase): Readiness {
  const checklist = c.checklist_items.every((i) => !i.required || i.status === "COMPLETED");
  const photo = c.evidence.slice(c.evidence_round_start).some(isAfter);
  const materials = c.material_lines.every((m) => m.used_qty !== null);
  const failing: string[] = [];
  if (!checklist) failing.push("checklist_complete");
  if (!photo) failing.push("photo_present");
  if (!materials) failing.push("materials_entered");
  return { checklist, photo, materials, failing: failingLabels(failing) };
}

/** Material request state (SPEC-P03 §4.1): every plan waits for an approver, even with enough stock (Q15) */
export function materialStatus(c: BCase, stock?: Map<string, number | null>): MaterialStatus {
  if (c.material_lines.length === 0) return "none";
  const b = c.ticket.blocker;
  if (c.ticket.status === "ON_HOLD" && b?.code === "WAITING_MATERIAL" && !b.resolved_at) {
    return buildMaterials(c, stock).some((m) => m.shortage > 0) ? "waiting_stock" : "pending";
  }
  return "approved";
}

function ratingOf(s: BSummary | BBqlRow | undefined): RatingInfo | null {
  if (!s || s.rating === null || s.rating === undefined) return null;
  return { stars: s.rating, tags: s.rating_tags ?? [], comment: s.rating_comment ?? "" };
}

const SOURCE_LABEL: Record<string, string> = {
  AGENT: "Agent LLM",
  FALLBACK_RULE: "Luật dự phòng",
  SKIPPED_RULE_EMERGENCY: "Luật khẩn cấp (bỏ qua Agent)",
};
export const AGENT_FAILED_REASON = "Agent không quyết được — luật cố định";

/** `Case.agent_decision` -> what the card and the modal show (SPEC-P04 §5). Real data only, no keywords or percentages. */
export function buildAgentInfo(r: BAgentRecord | null | undefined): AgentInfo | null {
  if (!r) return null;
  const d = r.decision;
  const failed = r.source !== "AGENT" || !d;
  const source = r.source;
  const jobIndex = r.valid_job_indexes?.[0] ?? 0;
  const job = d?.jobs[jobIndex] ?? d?.jobs[0];
  const proposed = d ? agentDept(source, job?.department_id, d.scope) : null;
  return {
    source,
    sourceLabel: SOURCE_LABEL[source] ?? source,
    model: r.model,
    proposedDept: proposed,
    riskLevel: d?.safety.risk_level ?? r.rule_risk_level ?? "NONE",
    signals: (d?.safety.signals ?? [])
      .filter((x) => (x.status === "PRESENT" || x.status === "UNCLEAR") && x.quote)
      .map((x) => ({ id: x.signal_id, quote: x.quote as string })),
    steps: (d?.reasoning ?? []).map((x) => x.conclusion),
    disagreements: r.disagreements.map((x) => `${x.field}: ${x.note}`),
    reason: failed ? AGENT_FAILED_REASON : (job?.reason || d?.note_for_staff || "").trim(),
    failed,
  };
}

function hoursLeft(c: BCase, now: Date): number | null {
  const eta = c.ticket.blocker?.eta;
  return eta ? Math.ceil((new Date(eta).getTime() - now.getTime()) / HOUR) : null;
}

/** The place the engine resolved from the text (draft.location) beats the form's "Vị trí:" line, which only echoes
 * the picker (e.g. the resident's own floor) and can disagree with what the resident wrote. */
function shownLocation(c: BCase, formLocation: string): string {
  const resolved = c.draft?.location?.trim();
  return resolved ? resolved.replace(/ \/ /g, " · ") : formLocation;
}

// ---------- department ----------
export function buildDeptTicket(
  c: BCase,
  labels: Record<string, string>,
  stock: Map<string, number | null>,
  now: Date,
  summary?: BSummary,
): DeptTicket {
  const t = c.ticket;
  const { description } = parseDescription(t.raw.original_description);
  const { title, content, location: formLocation } = splitReport(t.raw.original_description);
  const location = shownLocation(c, formLocation);
  const info = mapStatus(t.status);
  return {
    id: t.ticket_id,
    code: t.ticket_id,
    text: description,
    title,
    content,
    location,
    createdAt: fmtRelative(new Date(t.raw.created_at), now),
    urgent: isUrgent(t),
    stage: info.stage,
    paused: info.paused,
    blockerCode: t.blocker?.code ?? null,
    statusLabel: labels[t.status] ?? t.status,
    hoursLeft: hoursLeft(c, now),
    extras: c.additions.map((a) => a.content),
    photos: photos(t.ticket_id, c.evidence.filter((e) => isBefore(e) || isAfter(e))),
    checklist: buildChecklist(c),
    materials: buildMaterials(c, stock),
    readiness: buildReadiness(c),
    materialStatus: materialStatus(c, stock),
    staffId: summary?.staff_id ?? null,
    staffName: summary?.staff_name ?? null,
    rating: ratingOf(summary),
  };
}

/** Finished tickets are listed without the extra detail call (01 §4) */
export function deptTicketFromSummary(s: BSummary, now: Date): DeptTicket {
  const { description } = parseDescription(s.description);
  const { title, content, location } = splitReport(s.description);
  const info = mapStatus(s.status);
  return {
    id: s.ticket_id,
    code: s.ticket_id,
    text: description,
    title,
    content,
    location,
    createdAt: fmtRelative(new Date(s.created_at), now),
    urgent: isUrgent(s),
    stage: info.stage,
    paused: info.paused,
    blockerCode: s.reason_code,
    statusLabel: s.status_label,
    hoursLeft: null,
    extras: [],
    photos: [],
    checklist: [],
    materials: [],
    readiness: { checklist: true, photo: true, materials: true, failing: [] },
    materialStatus: "none",
    staffId: s.staff_id ?? null,
    staffName: s.staff_name ?? null,
    rating: ratingOf(s),
  };
}

// ---------- detail modal ----------
export function buildDetail(
  c: BCase,
  labels: Record<string, string>,
  departments: Record<string, string>,
  now: Date,
  summary?: BSummary,
): TicketDetail {
  const t = c.ticket;
  const { description } = parseDescription(t.raw.original_description);
  const { title, content, location: formLocation } = splitReport(t.raw.original_description);
  const location = shownLocation(c, formLocation);
  const info = mapStatus(t.status);
  const bql = isBqlWork(t.blocker);
  return {
    id: t.ticket_id,
    code: t.ticket_id,
    text: description,
    title,
    content,
    location,
    createdAt: fmtRelative(new Date(t.raw.created_at), now),
    stage: info.cancelled ? lastKnownStage(c.events.map((e) => e.to_status)) : info.stage,
    statusLabel: labels[t.status] ?? t.status,
    dept: deptKey(t.department_id, bql),
    deptName: t.department_id ? (departments[t.department_id] ?? null) : null,
    cancelled: info.cancelled,
    urgent: isUrgent(t),
    riskLevel: t.risk_level,
    priority: t.priority,
    blockerCode: t.blocker?.code ?? null,
    blockerLabel: blockerLabel(t.blocker?.code),
    publicMessage: t.blocker?.public_message ?? [...c.events].reverse().find((e) => e.public)?.public_message ?? "",
    extras: c.additions.map((a) => a.content),
    history: c.events.map((e) => ({
      label: labels[e.to_status] ?? e.to_status,
      note: e.internal_note ? `${e.public_message} (nội bộ: ${e.internal_note})` : e.public_message,
      time: fmtHistory(new Date(e.created_at), now),
      actorRole: e.actor_role,
    })),
    beforePhotos: photos(t.ticket_id, c.evidence.filter(isBefore)),
    afterPhotos: photos(t.ticket_id, c.evidence.filter(isAfter)),
    checklist: buildChecklist(c),
    materials: buildMaterials(c),
    materialStatus: materialStatus(c),
    staffName: summary?.staff_name ?? null,
    rating: ratingOf(summary),
    agent: buildAgentInfo(c.agent_decision),
  };
}

// ---------- reception ----------
export function buildInboxItem(c: BCase, byId: Map<string, BSummary>, now: Date): ReceptionInboxItem {
  const t = c.ticket;
  const b = t.blocker;
  const { description } = parseDescription(t.raw.original_description);
  const { title, content, location: formLocation } = splitReport(t.raw.original_description);
  const location = shownLocation(c, formLocation);
  const related = b?.related_ticket_id ?? null;
  const other = related ? byId.get(related) : undefined;
  const duplicate: DuplicateRef | undefined = other
    ? {
        id: other.ticket_id,
        code: other.ticket_id,
        text: titleOf(parseDescription(other.description).description),
        statusLabel: other.status_label,
      }
    : undefined;
  return {
    id: t.ticket_id,
    code: t.ticket_id,
    text: description,
    title,
    content,
    location,
    createdAt: fmtRelative(new Date(t.raw.created_at), now),
    urgent: isUrgent(t),
    blockerCode: b?.code ?? "",
    blockerLabel: blockerLabel(b?.code),
    note: b ? (b.internal_note ?? b.public_message) : "",
    proposedDept: deptKey(t.proposed_department_id),
    riskLevel: t.risk_level,
    priority: t.priority,
    extras: c.additions.map((a) => a.content),
    photos: photos(t.ticket_id, c.evidence.filter(isBefore)),
    duplicateOf: related,
    ...(duplicate ? { duplicate } : {}),
    agent: buildAgentInfo(c.agent_decision),
  };
}

/** One row of the "Hiệu suất Agent" tab (SPEC-P04 §5): the Agent's pick against where the ticket ended up */
export function perfRow(s: BSummary): PerfRow {
  const open = isBqlWork(s.reason_code ? { code: s.reason_code, escalated: s.escalated } : null);
  // BQL closed it ("handled"): CLOSED with no department and not an emergency (Q09) — still BQL's work (WP7 P9)
  const handled = s.status === "CLOSED" && !s.department_id && s.risk_level !== "EMERGENCY";
  const bql = open || handled;
  return {
    id: s.ticket_id,
    code: s.ticket_id,
    agentSource: s.agent_source ?? null,
    agentDept: agentDept(s.agent_source, s.agent_department, s.agent_scope),
    dept: deptKey(s.department_id, bql),
    needInfo: s.status === "NEED_INFO",
  };
}

export function buildAllItem(s: BSummary, now: Date): ReceptionAllItem {
  const { description } = parseDescription(s.description);
  const { title, content, location } = splitReport(s.description);
  const info = mapStatus(s.status);
  return {
    id: s.ticket_id,
    code: s.ticket_id,
    text: description,
    title,
    content,
    location,
    createdAt: fmtRelative(new Date(s.created_at), now),
    stage: info.stage,
    statusLabel: s.status_label,
    dept: deptKey(s.department_id, isBqlWork(s.reason_code ? { code: s.reason_code, escalated: s.escalated } : null)),
    cancelled: info.cancelled,
    urgent: isUrgent(s),
  };
}

// ---------- management ----------
/** `detail` (the full case) is only read for BQL work, to learn who escalated it from the notification payload */
export function buildMgmtTicket(row: BBqlRow, summary: BSummary | undefined, now: Date, detail?: BCase): MgmtTicket {
  const { description } = parseDescription(summary?.description ?? "");
  const { title, content, location } = splitReport(summary?.description ?? "");
  const info = mapStatus(row.status);
  const bqlWork = isBqlWork(row.blocker);
  const agent = agentDept(row.agent_source, row.agent_department, row.agent_scope);
  return {
    id: row.ticket_id,
    code: row.ticket_id,
    text: description,
    title,
    content,
    location,
    createdAt: fmtRelative(new Date(row.created_at), now),
    stage: info.stage,
    statusLabel: row.status_label,
    dept: deptKey(row.department_id, bqlWork),
    cancelled: info.cancelled,
    urgent: isUrgent(row),
    late: row.overdue,
    escalated: row.escalated,
    blockerCode: row.blocker?.code ?? null,
    riskLevel: row.risk_level,
    priority: row.priority,
    closureKind: row.closure_kind,
    ratingStars: row.rating ?? null,
    ratingTags: row.rating_tags ?? [],
    ratingComment: row.rating_comment ?? "",
    bqlWork,
    bqlSource: bqlWork ? escalationSource(detail?.notifications, agent === "bql") : null,
    agentDept: agent,
    agentSource: row.agent_source ?? null,
    staffName: row.staff_name ?? null,
    doneHours: hoursBetween(row.accepted_at, row.closed_at),
    merged: row.status === "MERGED",
    suspectOf: row.blocker?.code === "EMERGENCY_PENDING_BQL" ? (row.blocker.related_ticket_id ?? null) : null,
    duplicateCount: row.duplicate_count ?? 0,
  };
}

// ---------- warehouse ----------
export function buildWarehouseRequest(
  c: BCase,
  stock: Map<string, number | null>,
  departments: Record<string, string>,
  now: Date,
): WarehouseRequest | null {
  const t = c.ticket;
  // every plan is listed: even with enough stock it still needs an approver (Q15)
  const lines = buildMaterials(c, stock).map((m) => ({
    itemCode: m.itemCode,
    itemName: m.itemName,
    unit: m.unit,
    plannedQty: m.plannedQty,
    stock: m.stock,
    shortage: m.shortage,
    short: m.shortage > 0,
  }));
  if (lines.length === 0) return null;
  return {
    ticketId: t.ticket_id,
    ticketCode: t.ticket_id,
    ticketText: titleOf(parseDescription(t.raw.original_description).description),
    departmentName: t.department_id ? (departments[t.department_id] ?? "") : "",
    lines,
    since: fmtRelative(new Date(t.blocker?.since ?? t.raw.created_at), now),
    approved: !!t.blocker?.resolved_at,
    short: lines.some((l) => l.short),
  };
}
