// tests/_fake-simbackend.ts — backend cư dân GIẢ cho test nhánh hành động (H20).
//
// KHÔNG phải cài đặt sản phẩm: cài đặt thật (`PostgresSimBackend` /
// `MemorySimBackend`) thuộc gói H19 và nằm ở `lib/simbackend/`. File này chỉ
// dựng đúng đủ hành vi để đo pipeline, và quan trọng nhất là GHI LẠI THỨ TỰ
// lời gọi — bất biến "đọc chính sách trước khi ghi" (BB-03, VC-10) chỉ kiểm
// được bằng thứ tự, không kiểm được bằng kết quả cuối.
//
// Tên file bắt đầu bằng `_` nên `scripts/run_tests.mjs` (lọc `*.test.ts`)
// không chạy nó như một bộ test.

import type {
  BlockingReason,
  BookingPolicy,
  BookingRecord,
  CancelBookingResult,
  CreateBookingResult,
  FacilitySummary,
  PendingAction,
  ReceiptRecord,
  SimBackend,
  SlotCalendarEntry,
} from "../lib/simbackend/contract.ts";
import { SimBackendError } from "../lib/simbackend/contract.ts";

export const FAKE_NOW_2339 = "2026-09-20T23:39:00+07:00";
export const FAKE_SLOT_START = "2026-09-21T09:00:00+07:00";
export const FAKE_SLOT_END = "2026-09-21T10:00:00+07:00";
export const FAKE_INTAKE_REOPEN = "2026-09-21T08:30:00+07:00";

export const PINGPONG: FacilitySummary = {
  facility_id: "FAC-PINGPONG",
  facility_name_vi: "Sân bóng bàn",
  zone: "Zone A",
  is_bookable: true,
  has_authoritative_rules: true,
  aliases_vi: ["sân bóng bàn", "bóng bàn", "pingpong"],
};

export function fakeSlot(overrides: Partial<SlotCalendarEntry> = {}): SlotCalendarEntry {
  return {
    slot_start: FAKE_SLOT_START,
    slot_end: FAKE_SLOT_END,
    capacity_total: 4,
    capacity_remaining: 3,
    status: "open",
    ...overrides,
  };
}

export const INTAKE_CLOSED_REASON: BlockingReason = {
  code: "intake_closed",
  human_message_vi: "Ngoài giờ nhận đăng ký.",
  is_permanent: false,
  next_valid_at: FAKE_INTAKE_REOPEN,
  remediation_hint_vi: "Gửi lại trong giờ nhận đăng ký.",
};

/**
 * Policy mẫu. Giờ HOẠT ĐỘNG cố ý đặt 06:00–22:00, KHÁC HẲN cửa nhận đăng ký
 * 08:30–17:30, để test BB-02 có cái mà bắt: nếu câu trả lời lỡ nhắc 06:00 hay
 * 22:00 thì đúng là đã gộp hai trục thời gian (SPEC-P05 §2.2).
 */
export function fakePolicy(overrides: Partial<BookingPolicy> = {}): BookingPolicy {
  return {
    facility_id: PINGPONG.facility_id,
    facility_name_vi: PINGPONG.facility_name_vi,
    zone: PINGPONG.zone,
    policy_version: "v1",
    source_document_id: "PINGPONG-RULES-001",
    source_section_id: "PP-INTAKE-01",
    has_authoritative_rules: true,
    server_time: FAKE_NOW_2339,
    timezone: "Asia/Ho_Chi_Minh",
    intake_windows: [{ days_of_week: [0, 1, 2, 3, 4, 5, 6], start_time: "08:30", end_time: "17:30" }],
    intake_open_now: false,
    next_intake_open_at: FAKE_INTAKE_REOPEN,
    next_intake_close_at: "2026-09-21T17:30:00+07:00",
    operating_hours: [{ days_of_week: [0, 1, 2, 3, 4, 5, 6], open_time: "06:00", close_time: "22:00" }],
    operating_now: true,
    closure_dates: [],
    is_bookable: true,
    slot_granularity_minutes: 60,
    slot_calendar: [fakeSlot()],
    min_lead_time_minutes: 0,
    max_advance_days: 7,
    max_active_bookings: 3,
    max_bookings_per_week: 5,
    quota_used: 0,
    quota_remaining: 5,
    quota_resets_at: "2026-09-28T00:00:00+07:00",
    min_age: null,
    requires_adult_supervision_under_age: null,
    is_cancellable: true,
    cancel_deadline_before_slot_minutes: 60,
    blocking_reasons: [],
    allowed_actions_now: ["amenity.check_eligibility", "amenity.create_booking"],
    idempotency_supported: true,
    idempotency_key_ttl_seconds: 3600,
    duplicate_booking_behavior: "reject",
    ...overrides,
  };
}

export function fakeBooking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    booking_id: "BK-0001",
    facility_id: PINGPONG.facility_id,
    facility_name_vi: PINGPONG.facility_name_vi,
    resident_id: "R-0001",
    property_id: "S1.120817",
    slot_start: FAKE_SLOT_START,
    slot_end: FAKE_SLOT_END,
    party_size: 1,
    state: "confirmed",
    idempotency_key: "idem:x",
    receipt_code: "RC-AAAA1111",
    created_at: FAKE_NOW_2339,
    cancelled_at: null,
    cancel_receipt_code: null,
    ...overrides,
  };
}

export interface FakeSimBackendOptions {
  now?: string;
  facility?: FacilitySummary | null;
  policy?: BookingPolicy;
  eligible?: boolean;
  eligibilityBlocking?: BlockingReason[];
  createResult?: CreateBookingResult;
  /** Lỗi ném ra ở `createBooking` — dùng cho WriteTimeout / QuotaExceeded. */
  createThrows?: SimBackendError;
  cancelResult?: CancelBookingResult;
  cancelThrows?: SimBackendError;
  bookingDetail?: BookingRecord;
  detailThrows?: SimBackendError;
  bookings?: BookingRecord[];
}

export class FakeSimBackend implements SimBackend {
  readonly backend = "mock" as const;
  /** Thứ tự tên lệnh đã gọi — bằng chứng cho BB-03 / VC-10. */
  readonly calls: string[] = [];
  readonly createInputs: Array<Record<string, unknown>> = [];
  readonly cancelInputs: Array<Record<string, unknown>> = [];
  readonly savedPending: PendingAction[] = [];
  private pending: PendingAction | null = null;
  private readonly o: FakeSimBackendOptions;

  constructor(options: FakeSimBackendOptions = {}) {
    this.o = options;
  }

  /** Số lần gọi một lệnh — `calls` giữ nguyên thứ tự, hàm này đếm. */
  countOf(name: string): number {
    return this.calls.filter((c) => c === name).length;
  }

  now(): Date {
    return new Date(this.o.now ?? FAKE_NOW_2339);
  }

  async listFacilities(): Promise<FacilitySummary[]> {
    this.calls.push("listFacilities");
    return this.o.facility ? [this.o.facility] : [PINGPONG];
  }

  async resolveFacility(_hintVi: string): Promise<FacilitySummary | null> {
    this.calls.push("resolveFacility");
    return this.o.facility === undefined ? PINGPONG : this.o.facility;
  }

  async getFacilityDetail(_id: string): Promise<FacilitySummary | null> {
    this.calls.push("getFacilityDetail");
    return this.o.facility === undefined ? PINGPONG : this.o.facility;
  }

  async getBookingPolicy(): Promise<BookingPolicy> {
    this.calls.push("getBookingPolicy");
    return this.o.policy ?? fakePolicy();
  }

  async getAvailability(): Promise<SlotCalendarEntry[]> {
    this.calls.push("getAvailability");
    return [fakeSlot()];
  }

  async checkEligibility(): Promise<{
    eligible: boolean;
    blocking_reasons: BlockingReason[];
    params_fingerprint: string;
  }> {
    this.calls.push("checkEligibility");
    return {
      eligible: this.o.eligible ?? true,
      blocking_reasons: this.o.eligibilityBlocking ?? [],
      params_fingerprint: "fp-test",
    };
  }

  async listMyBookings(): Promise<BookingRecord[]> {
    this.calls.push("listMyBookings");
    return this.o.bookings ?? [];
  }

  async getBookingDetail(): Promise<BookingRecord> {
    this.calls.push("getBookingDetail");
    if (this.o.detailThrows) throw this.o.detailThrows;
    return this.o.bookingDetail ?? fakeBooking();
  }

  async createBooking(input: Record<string, unknown>): Promise<CreateBookingResult> {
    this.calls.push("createBooking");
    this.createInputs.push(input);
    if (this.o.createThrows) throw this.o.createThrows;
    return (
      this.o.createResult ?? {
        ok: true,
        booking_id: "BK-0001",
        receipt_code: "RC-AAAA1111",
        undo_capability_id: "amenity.cancel_booking",
        duplicate: false,
      }
    );
  }

  async cancelBooking(input: Record<string, unknown>): Promise<CancelBookingResult> {
    this.calls.push("cancelBooking");
    this.cancelInputs.push(input);
    if (this.o.cancelThrows) throw this.o.cancelThrows;
    return this.o.cancelResult ?? { ok: true, receipt_code: "RC-BBBB2222", undo_capability_id: null };
  }

  async listMyReceipts(): Promise<ReceiptRecord[]> {
    this.calls.push("listMyReceipts");
    return [];
  }

  async savePendingAction(action: PendingAction): Promise<void> {
    this.calls.push("savePendingAction");
    this.savedPending.push(action);
    this.pending = action;
  }

  async takePendingAction(): Promise<PendingAction | null> {
    this.calls.push("takePendingAction");
    const p = this.pending;
    this.pending = null; // một lần dùng
    return p;
  }
}

export { SimBackendError };
