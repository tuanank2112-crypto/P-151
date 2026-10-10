import type { PortalRole, TicketSummary } from "@/server/backend-dto";

export type PythonCase = {
  ticket: {
    ticket_id: string; status: string; raw: { original_description: string; created_at: string };
    department_id: string | null; risk_level: string; priority: string | null;
    blocker: { code: string; owner_role: string; public_message: string; escalated?: boolean } | null;
    safety_context?: boolean;
    flags: string[];
  };
  classification: { classification_reason: string; location_proposed: string | null; service_category_proposed: string } | null;
  agent_decision: { source: string } | null;
  draft: {
    location: string; scope_summary: string; material_requirement_mode?: string;
    evidence_requirements: { requirement_id: string; allowed_evidence_types: string[] }[];
    readiness_evaluation: { failing_items: string[] } | null;
  } | null;
  checklist_items: { template_item_id: string; label_snapshot: string; required: boolean; status: string }[];
  material_lines: { item_code: string; item_name: string; used_qty: number | null }[];
  evidence: { evidence_id: string; evidence_type: string; source: string; content_or_metadata: string }[];
  events: { status: string; public_message: string; created_at: string }[];
};

export const BPTN_REASONS = new Set(["MISSING_INFO", "DUPLICATE", "CATEGORY_UNCLEAR", "OUT_OF_SCOPE", "PENDING_REVIEW", "ASSET_UNCLEAR", "WRONG_DEPT", "SAFETY_REVIEW_REQUIRED"]);
export const terminal = (status: string) => ["CLOSED", "MERGED", "CANCELLED"].includes(status);
export function stageFor(status: string): number | null {
  return ({ RECEIVED: 1, VERIFYING: 2, NEED_INFO: 2, ON_HOLD: 2, ROUTED: 3, IN_PROGRESS: 4, READY_FOR_REVIEW: 5, CLOSED: 6 } as Record<string, number>)[status] ?? null;
}
export function needsRole(ticket: TicketSummary, role: PortalRole): boolean {
  if (role === "reception") return BPTN_REASONS.has(ticket.reason_code ?? "");
  if (role === "management") return ticket.status === "READY_FOR_REVIEW" || ["EMERGENCY_PENDING_BQL", "WRONG_DEPT_AFTER_START"].includes(ticket.reason_code ?? "") || (ticket.reason_code === "SAFETY_REVIEW_REQUIRED" && ticket.escalated);
  if (role === "warehouse") return ticket.reason_code === "WAITING_MATERIAL";
  return ticket.status === "ROUTED" || ticket.status === "IN_PROGRESS";
}
export type UsageDraft = { item_code: string; quantity: string };
export function safetyActions(c: PythonCase, role: PortalRole): string[] {
  const t = c.ticket;
  if (t.status === "VERIFYING" && t.blocker?.code === "SAFETY_REVIEW_REQUIRED" && (role === "reception" || (role === "management" && t.blocker.escalated))) return ["CONFIRM_SAFE", "REQUEST_INFO", "ESCALATE"];
  if (role === "management" && t.status === "NEED_INFO" && t.safety_context && t.blocker?.code === "MISSING_INFO") return ["CONFIRM_SAFE", "ESCALATE"];
  return [];
}
/** Saved actual usage only. Agent plans never become technician input. */
export function actualUsage(c: PythonCase): UsageDraft[] {
  return c.material_lines.filter((m) => m.used_qty !== null && m.used_qty > 0).map((m) => ({ item_code: m.item_code, quantity: String(m.used_qty) }));
}
export function usagePayload(lines: UsageDraft[], department: string | null, allowed: string[]): { lines: { item_code: string; used_qty: number }[] } {
  if (department === "DEPT_TECHNICAL" && !lines.length) throw new Error("Kỹ thuật phải chọn ít nhất một vật tư đã dùng.");
  const seen = new Set<string>();
  return { lines: lines.map((line) => {
    const qty = Number(line.quantity);
    if (!allowed.includes(line.item_code)) throw new Error("Chọn vật tư thuộc phòng ban của bạn.");
    if (!Number.isSafeInteger(qty) || qty <= 0) throw new Error("Số lượng phải là số nguyên dương.");
    if (seen.has(line.item_code)) throw new Error("Mỗi vật tư chỉ được chọn một lần.");
    seen.add(line.item_code);
    return { item_code: line.item_code, used_qty: qty };
  }) };
}
export const dateLabel = (value: string) => new Date(value).toLocaleString("vi-VN");
