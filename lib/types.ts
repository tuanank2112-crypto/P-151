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
/** Đ48 (2026-09-23): thêm `action` — lượt agent THỰC THI thay cư dân (P05).
 *  Khác `answer`: không có citation tri thức, có `action_result` (biên nhận /
 *  lý do chặn). Dashboard đếm `action.status='done'` là tự động giải quyết. */
export type Decision = "answer" | "clarify" | "escalate" | "action";
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
  score: number; // ∈ (0,1) — xem 01-CONTRACTS.md §4.2 — Đ59: có cộng trọng số TIÊU ĐỀ, chỉ dùng để XẾP HẠNG
  /** Đ59b — điểm CHỈ trên nội dung (như trước migration 007). Dùng cho E-5
   *  (nguồn điểm cao nhất có bị tranh chấp) và `s1` — giữ nguyên thang đo cũ
   *  để trọng số tiêu đề không xô lệch luật mâu thuẫn và `confidence`. */
  score_content?: number;
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
    | "verify"
    | "relevance" // Đ58 — kiểm "đáp đúng câu hỏi" (01-CONTRACTS §8.3b), NGAY sau verify
    | "action"; // Đ48 — chặng thực thi P05, đứng SAU risk, thay cho retrieval→verify
  ok: boolean;
  ms: number;
  /** Union 3 ID Gemini đã chốt — xem `lib/adapters/model.ts` (BB-07.a, Đ17). */
  model?:
    | "gemini-3.5-flash-lite"
    | "gemini-3.5-flash"
    | "gemini-3.6-flash"
    | "gemini-2.5-flash"
    // Đ53 — fallback Vyce khi cả chuỗi Gemini 429/503; tiền tố `vyce:` để
    // báo cáo/Golden luôn biết lượt nào KHÔNG chạy bằng Gemini.
    | "vyce:claude-sonnet-4-6"
    | "vyce:deepseek-v4.1"
    | "vyce:deepseek-v4-flash";
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
  /** Đ48 — chỉ non-null khi decision = 'action' (hoặc clarify chờ xác nhận hành động). */
  action_result?: ActionResult | null;
}

// ─────────────────────────────────────────────────────────────────────────
// P05 — Lớp hành động (Đ48). Hợp đồng giữa A1 → pipeline → lib/simbackend → UI.
// Chi tiết backend: lib/simbackend/contract.ts (SPEC-P05 §3–§7).
// ─────────────────────────────────────────────────────────────────────────

/** Capability agent được phép GỌI từ câu chat (01-CONTRACTS §8.4; đọc khác đi qua policy). */
export type ActionCapability =
  | "amenity.create_booking"
  | "amenity.cancel_booking"
  | "amenity.list_my_bookings";

/** A1 trích từ câu nói của cư dân. `capability = null` ⇒ lượt hỏi–đáp thường.
 *  `confirmed = true` khi cư dân nói "xác nhận/đồng ý/huỷ đi" cho hành động đang chờ. */
export interface ActionRequest {
  capability: ActionCapability | null;
  facility_hint_vi: string | null; // "sân bóng bàn", "BBQ"… — backend resolve sang facility_id
  slot_start: string | null; // ISO-8601 có offset, A1 tính từ server_time trong prompt
  slot_end: string | null;
  party_size: number | null;
  booking_ref: string | null; // mã biên nhận RC-… hoặc booking_id khi huỷ
  confirmed: boolean;
}

export type ActionStatus =
  | "done" // đã ghi, có biên nhận
  | "blocked" // policy chặn (intake_closed, slot_full, quota…) — KHÔNG ghi gì
  | "needs_confirmation" // lệnh không hoàn tác được, chờ cư dân xác nhận (B2)
  | "listed" // list_my_bookings
  | "unknown"; // WriteTimeout — đã gửi, không rõ kết quả (B3), CẤM retry

export interface ActionBlockingReason {
  code: string; // BlockingCode của simbackend
  human_message_vi: string;
  is_permanent: boolean;
  next_valid_at: string | null;
  remediation_hint_vi: string;
}

export interface ActionBookingView {
  booking_id: string;
  facility_id: string;
  facility_name_vi: string;
  slot_start: string;
  slot_end: string;
  party_size: number;
  state: "confirmed" | "cancelled";
  receipt_code: string;
}

export interface ActionResult {
  capability: ActionCapability;
  status: ActionStatus;
  facility_id: string | null;
  facility_name_vi: string | null;
  slot_start: string | null;
  slot_end: string | null;
  booking_id: string | null;
  receipt_code: string | null;
  undo_capability_id: "amenity.cancel_booking" | null;
  blocking_reasons: ActionBlockingReason[];
  next_intake_open_at: string | null;
  /** Nguồn nội quy của tiện ích (nếu có) — CHỈ để hiển thị "theo nội quy…", KHÔNG
   *  dùng kết quả hành động làm evidence cho phát biểu luật (BB-01). */
  policy_source: { document_id: string; section_id: string } | null;
  bookings: ActionBookingView[]; // chỉ dùng khi status = 'listed'
  /** Bao nhiêu lời gọi ghi đã thực hiện trong lượt — 0 khi blocked (P05-M8). */
  write_calls: number;
}

/**
 * Kiểu props an toàn cho mọi component React hiển thị kết quả một lượt hỏi.
 * BẮT BUỘC dùng kiểu này (không dùng `TurnResult` thẳng) cho props — chặn
 * `confidence` ngay ở tầng type (BB-05 / VC-07). Định nghĩa nằm ở đây (file
 * `.ts`), KHÔNG lặp lại chữ "confidence" trong bất kỳ file `.tsx` nào.
 */
export type PublicTurnResult = Omit<TurnResult, "confidence" | "gate_triggered">;

