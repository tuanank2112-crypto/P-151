// lib/types.ts — nguồn chân lý kiểu dùng chung (01-CONTRACTS.md §7).
// Mọi nơi khác import từ đây, KHÔNG định nghĩa lại các kiểu này.

/**
 * 15 mã reason_code, tập đóng (Đ12, BB-09, 01-CONTRACTS.md §2, §2.4).
 * Thay đổi tập này là breaking change — xem vùng cấm VC-06 và C-01..C-08.
 */
export type ReasonCode =
  | "pii_or_account_specific"
  | "legal_or_compensation_escalation"
  | "unsupported_intent"
  | "intent_unresolved"
  | "no_eligible_source"
  | "source_conflict"
  | "source_expired_or_unknown"
  | "system_error"
  | "emergency_or_life_safety"
  | "reviewer_rejected_draft"
  | "action_quota_exceeded"
  | "action_irreversible_requires_confirmation"
  | "action_partial_execution_unknown"
  | "action_authorization_missing"
  | "action_duplicate_suspected";

/**
 * Danh sách chạy được của `ReasonCode`, dùng để kiểm enum bằng máy (W3) và để
 * đối chiếu với DDL ở `db/migrations/001_enums.sql`. Đây KHÔNG phải một enum
 * TypeScript thứ hai — chỉ là mảng const suy từ đúng 15 mã ở trên, một nguồn.
 */
export const REASON_CODES = [
  "pii_or_account_specific",
  "legal_or_compensation_escalation",
  "unsupported_intent",
  "intent_unresolved",
  "no_eligible_source",
  "source_conflict",
  "source_expired_or_unknown",
  "system_error",
  "emergency_or_life_safety",
  "reviewer_rejected_draft",
  "action_quota_exceeded",
  "action_irreversible_requires_confirmation",
  "action_partial_execution_unknown",
  "action_authorization_missing",
  "action_duplicate_suspected",
] as const satisfies readonly ReasonCode[];

export type LifecycleState =
  | "answered"
  | "clarification_required"
  | "escalated"
  | "failed";

export const LIFECYCLE_STATES = [
  "answered",
  "clarification_required",
  "escalated",
  "failed",
] as const satisfies readonly LifecycleState[];

export type IntentId = "I-01" | "I-02" | "I-03" | "I-04" | "I-05";
export type Decision = "answer" | "clarify" | "escalate";
export type UserRole = "resident" | "bql";
export type DocStatus = "Draft" | "Approved" | "Deprecated";
export type EffectiveStatus = "Current" | "Expired" | "Unknown";
export type ReviewState = "pending" | "approved" | "edited_approved" | "rejected";

export interface Principal {
  user_id: string;
  role: UserRole;
  resident_id: string | null;
  owned_property_ids: string[];
  property_type: Array<"apartment" | "villa" | "commercial">;
}

export interface RetrievedChunk {
  chunk_id: string;
  section_id: string;
  document_id: string;
  content_vi: string;
  score: number; // ∈ (0,1) — xem 01-CONTRACTS.md §4.2
}

export interface Citation {
  document_id: string;
  section_id: string;
  document_title_vi: string;
  heading_vi: string;
  snippet_vi: string; // ≤ 300 ký tự, cắt theo câu
}

export interface ClaimVerdict {
  claim_vi: string;
  verdict: "supported" | "unsupported" | "contradicted";
  supporting_section_id: string | null; // bắt buộc non-null khi 'supported'
}

export interface PipelineStep {
  step:
    | "validate"
    | "safety"
    | "intent"
    | "context"
    | "risk"
    | "retrieval"
    | "eligibility"
    | "draft"
    | "verify";
  ok: boolean;
  ms: number;
  /** Union 3 ID Gemini đã chốt — xem `lib/adapters/model.ts` (BB-07.a, Đ17). */
  model?: "gemini-3.5-flash-lite" | "gemini-3.5-flash" | "gemini-2.5-flash";
  input_tokens?: number;
  output_tokens?: number;
  note?: string;
}

export interface TurnResult {
  decision: Decision;
  reason_code: ReasonCode | null;
  answer_vi: string | null; // null khi decision ≠ 'answer'
  clarify_question_vi: string | null; // non-null khi decision = 'clarify'
  citations: Citation[];
  claims: ClaimVerdict[];
  confidence: number; // CẤM truyền xuống React (VC-07)
  gate_triggered: string | null;
  steps: PipelineStep[];
}

/**
 * Kiểu props an toàn cho mọi component React hiển thị kết quả một lượt hỏi.
 * BẮT BUỘC dùng kiểu này (không dùng `TurnResult` thẳng) cho props — chặn
 * `confidence` ngay ở tầng type (BB-05 / VC-07). Định nghĩa nằm ở đây (file
 * `.ts`), KHÔNG lặp lại chữ "confidence" trong bất kỳ file `.tsx` nào.
 */
export type PublicTurnResult = Omit<TurnResult, "confidence" | "gate_triggered">;

