/** Backend response shapes the portal reads (src/maintenance/models.py, views.py, routers/maintenance.py). Only the fields used. */
import type { BStatus } from "@/lib/backend-map";

export type BBlocker = {
  code: string;
  owner_role: string;
  since: string;
  escalated: boolean;
  eta: string | null;
  public_message: string;
  internal_note: string | null;
  related_ticket_id: string | null;
  /** Set when the clearing event happened (WAITING_MATERIAL: approved by the warehouse / BQL, SPEC-P04 §2) */
  resolved_at?: string | null;
};

/** `Case.agent_decision` (src/maintenance/agent/schema.py AgentDecisionRecord), only the fields the portal reads */
export type BAgentRecord = {
  source: "AGENT" | "FALLBACK_RULE" | "SKIPPED_RULE_EMERGENCY" | string;
  model: string;
  fallback_reason?: string | null;
  rule_risk_level?: string;
  agent_risk_level?: string;
  valid_job_indexes?: number[];
  disagreements: { field: string; severity: string; rule_value: string | null; agent_value: string | null; note: string }[];
  decision: {
    reasoning: { step: string; facts?: string[]; conclusion: string }[];
    safety: {
      risk_level: string;
      signals: { signal_id: string; status: string; quote: string | null }[];
      reason: string;
    };
    scope: string;
    jobs: { department_id: string; category: string; reason: string }[];
    next_step: string;
    note_for_staff: string;
  } | null;
};

export type BNotification = { type: string; payload?: Record<string, unknown> };

export type BTicket = {
  ticket_id: string;
  status: BStatus;
  department_id: string | null;
  proposed_department_id: string | null;
  blocker: BBlocker | null;
  risk_level: string;
  priority: string | null;
  raw: { created_at: string; original_description: string };
  closure_kind: string | null;
  merged_into: string | null;
};

export type BChecklistItem = { template_item_id: string; label_snapshot: string; required: boolean; status: string };

export type BMaterialLine = {
  material_line_id?: string;
  item_code: string;
  item_name: string;
  unit: string | null;
  planned_qty: number;
  issued_qty: number | null;
  used_qty: number | null;
  simulated_stock_qty: number | null;
};

export type BEvidence = { evidence_id: string; evidence_type: string; source: string };
export type BEvent = {
  to_status: string;
  public_message: string;
  internal_note: string | null;
  public: boolean;
  actor_role: string;
  created_at: string;
};

export type BCase = {
  ticket: BTicket;
  checklist_items: BChecklistItem[];
  material_lines: BMaterialLine[];
  evidence: BEvidence[];
  evidence_round_start: number;
  additions: { content: string }[];
  events: BEvent[];
  draft: { readiness_evaluation: { failing_items: string[] } | null } | null;
  agent_decision?: BAgentRecord | null;
  notifications?: BNotification[];
};

/** Fields SPEC-P04 adds to list rows; optional so the portal still runs against a backend that lacks them */
type BExt = {
  staff_id?: string | null;
  staff_name?: string | null;
  rating?: number | null;
  rating_tags?: string[];
  rating_comment?: string;
  agent_source?: string | null;
  agent_department?: string | null;
  agent_scope?: string | null;
};

export type BSummary = BExt & {
  ticket_id: string;
  status: BStatus;
  status_label: string;
  reason_code: string | null;
  proposed_department_id: string | null;
  department_id: string | null;
  escalated: boolean;
  risk_level: string | null;
  priority: string | null;
  created_at: string;
  description: string;
};

export type BBqlRow = BExt & {
  ticket_id: string;
  status: BStatus;
  status_label: string;
  department_id: string | null;
  blocker: BBlocker | null;
  escalated: boolean;
  overdue: boolean;
  created_at: string;
  risk_level: string;
  priority: string | null;
  closure_kind: string | null;
  accepted_at?: string | null;
  closed_at?: string | null;
};

export type BStaff = {
  staff_id: string;
  department_id: string;
  name: string;
  skill: string;
  area: string;
  capacity: number;
  open_tickets: number;
};

export type BResidentView = {
  ticket_id: string;
  created_at: string;
  description: string;
  additions: string[];
  photos: string[];
  status: BStatus;
  status_label: string;
  department_name: string | null;
  public_message: string;
  eta: string | null;
  timeline: { status: string; status_label: string; public_message: string; created_at: string }[];
  allowed_actions: ("ADD_INFO" | "RATE")[];
  merged_into: { ticket_id: string } | null;
  rating?: number | null;
  rating_tags?: string[];
  rating_comment?: string;
};

export type BStockRow = { item_code: string; item_name: string; unit: string | null; qty: number | null };

export type BCatalog = {
  departments: Record<string, string>;
  status_labels: Record<string, string>;
  custom_materials_enabled?: boolean;
};
