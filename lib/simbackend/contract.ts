// lib/simbackend/contract.ts — HỢP ĐỒNG của lớp hành động P05 (Đ48, SPEC-P05 §3–§7).
//
// `lib/simbackend/` là BACKEND CƯ DÂN MÔ PHỎNG do chúng ta tự viết (Đ02). Mọi tên
// lệnh, trường, mã lỗi ở đây là hợp đồng tự định nghĩa — KHÔNG phải API Vinhomes,
// KHÔNG có lời gọi mạng ra ngoài. Ba ảnh trong docs/assets/ chỉ là tư liệu giao diện.
//
// File này CHỈ chứa kiểu + hằng + lớp lỗi. Cài đặt thật ở lib/simbackend/index.ts
// (gói H19). Pipeline (H20) và UI (H21) chỉ được import từ ./contract.ts và ./index.ts.
//
// Mọi truy cập DB của simbackend đi qua `getSql()` của lib/adapters/db.ts (BB-07 —
// db.ts là file DUY NHẤT mở connection). Bảng của P05 là bảng RIÊNG (VC-09):
// facilities · bookings · receipts · precheck_log · pending_actions.

import type { ActionCapability, ReasonCode } from "../types.ts";

// ── Capability registry (01-CONTRACTS §8.4) ─────────────────────────────
export interface CapabilitySpec {
  capability_id: string;
  kind: "read" | "write";
  precheck_capability_id: string | null; // BẮT BUỘC non-null khi kind='write' (BB-03)
  reversible: boolean;
  idempotent: boolean;
  required_params: string[];
}

export const CAPABILITIES: readonly CapabilitySpec[] = [
  { capability_id: "amenity.list_facilities", kind: "read", precheck_capability_id: null, reversible: true, idempotent: true, required_params: [] },
  { capability_id: "amenity.get_facility_detail", kind: "read", precheck_capability_id: null, reversible: true, idempotent: true, required_params: ["facility_id"] },
  { capability_id: "amenity.get_booking_policy", kind: "read", precheck_capability_id: null, reversible: true, idempotent: true, required_params: ["facility_id", "resident_id", "property_id"] },
  { capability_id: "amenity.get_availability", kind: "read", precheck_capability_id: null, reversible: true, idempotent: true, required_params: ["facility_id", "from", "to"] },
  { capability_id: "amenity.check_eligibility", kind: "read", precheck_capability_id: null, reversible: true, idempotent: true, required_params: ["session_id", "facility_id", "resident_id", "property_id", "slot_start", "slot_end", "party_size"] },
  { capability_id: "amenity.list_my_bookings", kind: "read", precheck_capability_id: null, reversible: true, idempotent: true, required_params: ["resident_id"] },
  { capability_id: "amenity.get_booking_detail", kind: "read", precheck_capability_id: null, reversible: true, idempotent: true, required_params: ["session_id", "booking_id", "resident_id"] },
  { capability_id: "amenity.create_booking", kind: "write", precheck_capability_id: "amenity.check_eligibility", reversible: true, idempotent: true, required_params: ["session_id", "facility_id", "resident_id", "property_id", "slot_start", "slot_end", "party_size", "idempotency_key"] },
  { capability_id: "amenity.cancel_booking", kind: "write", precheck_capability_id: "amenity.get_booking_detail", reversible: false, idempotent: true, required_params: ["session_id", "booking_id", "resident_id", "reason_vi", "confirmed"] },
] as const;

/** Tiện ích CÓ nội quy nhưng KHÔNG có mục đặt chỗ — CẤM vào danh sách đặt (P05-C11). */
export const NON_BOOKABLE_FACILITY_IDS = ["FAC-PLAYGROUND", "FAC-OUTDOOR-GYM"] as const;

// ── Policy (SPEC-P05 §3) ────────────────────────────────────────────────
export type BlockingCode =
  | "intake_closed"
  | "outside_operating_hours"
  | "slot_full"
  | "quota_exceeded"
  | "too_early"
  | "too_late"
  | "under_age"
  | "not_bookable"
  | "maintenance";

export interface BlockingReason {
  code: BlockingCode;
  human_message_vi: string;
  is_permanent: boolean;
  next_valid_at: string | null;
  remediation_hint_vi: string;
}

export interface TimeWindow {
  days_of_week: number[]; // 0 = CN … 6 = T7
  start_time: string; // "08:30"
  end_time: string; // "17:30"
}
export interface OperatingWindow {
  days_of_week: number[];
  open_time: string;
  close_time: string;
}
export interface SlotCalendarEntry {
  slot_start: string;
  slot_end: string;
  capacity_total: number;
  capacity_remaining: number;
  status: "open" | "full" | "closed" | "maintenance";
}

export interface BookingPolicy {
  // Nhóm 1 — định danh & truy vết
  facility_id: string;
  facility_name_vi: string; // tên ĐẦY ĐỦ, không cắt '...'
  zone: string;
  policy_version: string;
  source_document_id: string | null; // null khi không có nguồn nội quy
  source_section_id: string | null;
  has_authoritative_rules: boolean; // cờ khoá của BB-01
  // Nhóm 2 — thời gian máy chủ
  server_time: string; // ISO-8601 có offset (tôn trọng SIM_NOW)
  timezone: "Asia/Ho_Chi_Minh";
  // Nhóm 3 — cửa NHẬN ĐĂNG KÝ (t_submit)
  intake_windows: TimeWindow[];
  intake_open_now: boolean;
  next_intake_open_at: string | null; // biến lỗi thành lịch hẹn
  next_intake_close_at: string | null;
  // Nhóm 4 — giờ HOẠT ĐỘNG (t_slot) — TUYỆT ĐỐI không gộp với nhóm 3 (BB-02)
  operating_hours: OperatingWindow[];
  operating_now: boolean;
  closure_dates: string[];
  // Nhóm 5 — slot
  is_bookable: boolean;
  slot_granularity_minutes: number;
  slot_calendar: SlotCalendarEntry[];
  // Nhóm 6 — đặt trước
  min_lead_time_minutes: number;
  max_advance_days: number;
  // Nhóm 7 — hạn mức của CHÍNH cư dân này
  max_active_bookings: number;
  max_bookings_per_week: number;
  quota_used: number;
  quota_remaining: number;
  quota_resets_at: string;
  // Nhóm 8 (rút gọn) — đối tượng
  min_age: number | null;
  requires_adult_supervision_under_age: number | null;
  // Nhóm 10 — huỷ
  is_cancellable: boolean;
  cancel_deadline_before_slot_minutes: number;
  // Nhóm 13 — lỗi, giải thích, hành động khả dụng
  blocking_reasons: BlockingReason[]; // MẢNG: trả HẾT vi phạm cùng lúc (§3.1)
  allowed_actions_now: string[]; // capability_id gọi được NGAY
  // Nhóm 14 — an toàn khi gọi lặp
  idempotency_supported: true;
  idempotency_key_ttl_seconds: number;
  duplicate_booking_behavior: "reject";
}

// ── Facilities & bookings ───────────────────────────────────────────────
export interface FacilitySummary {
  facility_id: string;
  facility_name_vi: string;
  zone: string;
  is_bookable: boolean;
  has_authoritative_rules: boolean;
  aliases_vi: string[]; // "sân bóng bàn", "bóng bàn", "pingpong"…
}

export interface BookingRecord {
  booking_id: string;
  facility_id: string;
  facility_name_vi: string;
  resident_id: string;
  property_id: string;
  slot_start: string;
  slot_end: string;
  party_size: number;
  state: "confirmed" | "cancelled";
  idempotency_key: string;
  receipt_code: string; // biên nhận của lệnh TẠO
  created_at: string;
  cancelled_at: string | null;
  cancel_receipt_code: string | null;
}

export interface ReceiptRecord {
  receipt_code: string; // RC-XXXXXXXX
  action: "create" | "cancel";
  booking_id: string;
  resident_id: string;
  undo_capability_id: "amenity.cancel_booking" | null; // cancel ⇒ null (§5.2)
  undone_by: string | null; // receipt_code của lệnh huỷ đã hoàn tác biên nhận này
  created_at: string;
  summary_vi: string;
}

/** Hành động đang chờ xác nhận (B2). Bảng riêng của P05, TTL 10 phút. */
export interface PendingAction {
  conversation_id: string;
  capability: ActionCapability;
  payload: Record<string, unknown>;
  created_at: string;
  expires_at: string;
}

// ── Kết quả lệnh ghi (SPEC-P05 §5) ──────────────────────────────────────
export type CreateBookingResult =
  | { ok: true; booking_id: string; receipt_code: string; undo_capability_id: "amenity.cancel_booking"; duplicate: boolean }
  | { ok: false; reason_code: ReasonCode; blocking_reasons: BlockingReason[] };

export type CancelBookingResult =
  | { ok: true; receipt_code: string; undo_capability_id: null }
  | { ok: false; reason_code: ReasonCode; blocking_reasons: BlockingReason[] };

// ── Lỗi (SPEC-P05 §7) ───────────────────────────────────────────────────
export type SimBackendErrorKind =
  | "PrecheckMissing" // ⇒ action_authorization_missing
  | "QuotaExceeded" // ⇒ action_quota_exceeded — CẤM thử lại
  | "DuplicateKey" // ⇒ action_duplicate_suspected — trả biên nhận đã có
  | "SlotTaken" // ⇒ action_duplicate_suspected
  | "IrreversibleUnconfirmed" // ⇒ action_irreversible_requires_confirmation
  | "WriteTimeout" // ⇒ action_partial_execution_unknown — CẤM RETRY, audit_log warn
  | "NotBookable" // ⇒ unsupported_intent
  | "NotFound" // facility/booking không tồn tại hoặc không thuộc cư dân
  | "Forbidden"; // resident_id không khớp chủ sở hữu ⇒ pii_or_account_specific

export const REASON_CODE_FOR_ERROR: Record<SimBackendErrorKind, ReasonCode> = {
  PrecheckMissing: "action_authorization_missing",
  QuotaExceeded: "action_quota_exceeded",
  DuplicateKey: "action_duplicate_suspected",
  SlotTaken: "action_duplicate_suspected",
  IrreversibleUnconfirmed: "action_irreversible_requires_confirmation",
  WriteTimeout: "action_partial_execution_unknown",
  NotBookable: "unsupported_intent",
  NotFound: "unsupported_intent",
  Forbidden: "pii_or_account_specific",
};

export class SimBackendError extends Error {
  readonly kind: SimBackendErrorKind;
  readonly reason_code: ReasonCode;
  readonly blocking_reasons: BlockingReason[];
  constructor(kind: SimBackendErrorKind, message: string, blocking_reasons: BlockingReason[] = []) {
    super(message);
    this.name = "SimBackendError";
    this.kind = kind;
    this.reason_code = REASON_CODE_FOR_ERROR[kind];
    this.blocking_reasons = blocking_reasons;
  }
}

// ── Giao diện backend — H19 cài đặt CẢ HAI: PostgresSimBackend và MemorySimBackend
//    (mock KHÔNG được dễ tính hơn Postgres về hình dạng dữ liệu — Đ43) ────────
export interface SimBackend {
  readonly backend: "mock" | "postgres";
  /** Thời gian máy chủ; tôn trọng `SIM_NOW` (ISO) để diễn cảnh 23:39 (§9). */
  now(): Date;

  listFacilities(): Promise<FacilitySummary[]>;
  /** Khớp gợi ý tiếng Việt ("sân bóng bàn") sang một tiện ích; null nếu không rõ. Tất định, không gọi model. */
  resolveFacility(hintVi: string): Promise<FacilitySummary | null>;
  getFacilityDetail(facility_id: string): Promise<FacilitySummary | null>;

  /** Đọc-thuần, MỘT lần đủ lập kế hoạch (§3). Không ghi dấu precheck. */
  getBookingPolicy(input: {
    facility_id: string;
    resident_id: string;
    property_id: string;
    slot_start?: string | null;
    slot_end?: string | null;
    party_size?: number | null;
  }): Promise<BookingPolicy>;

  getAvailability(input: { facility_id: string; from: string; to: string }): Promise<SlotCalendarEntry[]>;

  /** Precheck của create_booking (BB-03). GHI DẤU `(session_id, fingerprint)` vào precheck_log.
   *  fingerprint = SHA-256(facility_id, slot_start, slot_end, property_id). */
  checkEligibility(input: {
    session_id: string;
    facility_id: string;
    resident_id: string;
    property_id: string;
    slot_start: string;
    slot_end: string;
    party_size: number;
  }): Promise<{ eligible: boolean; blocking_reasons: BlockingReason[]; params_fingerprint: string }>;

  listMyBookings(resident_id: string): Promise<BookingRecord[]>;
  /** Precheck của cancel_booking. GHI DẤU precheck. Không thuộc cư dân ⇒ SimBackendError('Forbidden'). */
  getBookingDetail(input: { session_id: string; booking_id: string; resident_id: string }): Promise<BookingRecord>;

  /** §5.1 — thứ tự BẮT BUỘC: assertPrechecked → idempotency_key → tính lại policy → INSERT bookings+receipts trong MỘT transaction. */
  createBooking(input: {
    session_id: string;
    facility_id: string;
    resident_id: string;
    property_id: string;
    slot_start: string;
    slot_end: string;
    party_size: number;
    idempotency_key: string; // caller sinh — CẤM server tự sinh (P05-C9)
  }): Promise<CreateBookingResult>;

  /** §5.2 — precheck get_booking_detail; `confirmed=false` ⇒ IrreversibleUnconfirmed; quá hạn huỷ ⇒ ok:false kèm blocking_reasons. */
  cancelBooking(input: {
    session_id: string;
    booking_id: string;
    resident_id: string;
    reason_vi: string;
    confirmed: boolean;
  }): Promise<CancelBookingResult>;

  listMyReceipts(resident_id: string): Promise<ReceiptRecord[]>;

  savePendingAction(action: PendingAction): Promise<void>;
  /** Lấy VÀ xoá hành động chờ (một lần dùng); null nếu không có hoặc đã hết hạn. */
  takePendingAction(conversation_id: string): Promise<PendingAction | null>;
}

/** Sinh idempotency_key tất định ở CALLER: hash của (conversation_id, facility_id, slot_start, property_id). */
export function idempotencyKeyFor(parts: { conversation_id: string; facility_id: string; slot_start: string; property_id: string }): string {
  return `idem:${parts.conversation_id}:${parts.facility_id}:${parts.slot_start}:${parts.property_id}`;
}
