// lib/simbackend/index.ts — `lib/simbackend/` là BACKEND CƯ DÂN MÔ PHỎNG do
// chúng ta tự viết (Đ02). Mọi tên lệnh, trường, mã lỗi ở đây là hợp đồng tự
// định nghĩa — KHÔNG phải API Vinhomes, KHÔNG có lời gọi mạng ra ngoài. Ba
// ảnh trong docs/assets/ chỉ là tư liệu giao diện, không phải đặc tả.
//
// Cài đặt CẢ HAI: `MemorySimBackend` (mock, nạp seed JSON) và
// `PostgresSimBackend` (bảng RIÊNG facilities/bookings/receipts/precheck_log/
// pending_actions — VC-09). `getSimBackend()` chọn theo `DATA_BACKEND`
// (Đ24), y hệt cách `lib/adapters/db.ts::getDataStore()` chọn `DataStore`.
// Mọi truy cập DB đi qua `getSql()` của `lib/adapters/db.ts` (BB-07) — file
// này KHÔNG mở connection Postgres của riêng nó.

import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSql, isValidUuid } from "../adapters/db.ts";
import type { ReasonCode } from "../types.ts";
import {
  CAPABILITIES,
  NON_BOOKABLE_FACILITY_IDS,
  SimBackendError,
  type BlockingReason,
  type BookingPolicy,
  type BookingRecord,
  type CancelBookingResult,
  type CreateBookingResult,
  type FacilitySummary,
  type PendingAction,
  type ReceiptRecord,
  type SimBackend,
  type SlotCalendarEntry,
} from "./contract.ts";

/** Re-export cho H20/H21 (`app/api/actions/undo/logic.ts`, `lib/pipeline/action.ts`):
 *  họ import lỗi runtime từ đúng module chứa `getSimBackend()`, không phải
 *  hai đường import khác nhau cho cùng một hợp đồng. `contract.ts` KHÔNG bị
 *  sửa — đây chỉ là re-export ở file cài đặt (được phép THÊM). */
export { SimBackendError };

import {
  assertPrechecked,
  blockingReason,
  cancelFingerprint,
  hmToMinutes,
  ictToUtcDate,
  isIntakeOpenNow,
  isOperatingNow,
  nextIntakeCloseAt,
  nextIntakeOpenAt,
  paramsFingerprint,
  toIctIso,
  toIctParts,
} from "./guard.ts";

// ── Đồng hồ mô phỏng (Đ48 mục 6, SPEC-P05 §9) ───────────────────────────

/** Tôn trọng `SIM_NOW` (ISO) để diễn cảnh 23:39 — dùng CHUNG cho cả hai backend. */
export function simNow(): Date {
  const raw = process.env.SIM_NOW;
  if (!raw) return new Date();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`SIM_NOW không phải ISO hợp lệ: "${raw}"`);
  }
  return d;
}

function receiptCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `RC-${out}`;
}

// ── Bản ghi facility dùng nội bộ (superset của FacilitySummary) ─────────
interface FacilityRow {
  facility_id: string;
  name_vi: string;
  zone: string;
  is_bookable: boolean;
  has_authoritative_rules: boolean;
  aliases_vi: string[];
  intake_windows: BookingPolicy["intake_windows"];
  operating_hours: BookingPolicy["operating_hours"];
  slot_granularity_minutes: number;
  capacity_per_slot: number;
  min_lead_time_minutes: number;
  max_advance_days: number;
  max_active_bookings: number;
  max_bookings_per_week: number;
  min_age: number | null;
  requires_adult_supervision_under_age: number | null;
  is_cancellable: boolean;
  cancel_deadline_before_slot_minutes: number;
  source_document_id: string | null;
  source_section_id: string | null;
  policy_version: string;
}

function toSummary(f: FacilityRow): FacilitySummary {
  return {
    facility_id: f.facility_id,
    facility_name_vi: f.name_vi,
    zone: f.zone,
    is_bookable: f.is_bookable,
    has_authoritative_rules: f.has_authoritative_rules,
    aliases_vi: f.aliases_vi,
  };
}

/** Không dấu, chữ thường, gộp khoảng trắng — khớp alias TẤT ĐỊNH, không gọi model. */
function normalizeVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Ánh xạ `BlockingReason[]` (không rỗng) → một `ReasonCode` duy nhất cho
 * `CreateBookingResult`/`CancelBookingResult` khi backend từ chối ở bước
 * "tính lại policy" (§5.1 bước 3). Contract/SPEC chỉ ghim rõ một trường hợp
 * (`quota_exceeded` ⇒ `action_quota_exceeded`, P05-M6); các `BlockingCode`
 * còn lại (intake_closed, outside_operating_hours, slot_full, too_early,
 * too_late, under_age, not_bookable, maintenance) không có `ReasonCode`
 * hành động riêng trong tập 15 mã đóng (`lib/types.ts`) — đường thường lệ là
 * `check_eligibility` đã chặn TRƯỚC khi tới đây, nên nhánh này chỉ là lưới
 * an toàn cho race condition. QUYẾT ĐỊNH THỰC THI (không có trong SPEC/hợp
 * đồng, ghi vào report): dùng `unsupported_intent` làm mặc định — "hành
 * động không thực hiện được ngay bây giờ", KHÔNG suy ra caller phải xin lỗi
 * vì lỗi hệ thống.
 */
function blockingReasonsToReasonCode(reasons: BlockingReason[]): ReasonCode {
  if (reasons.some((r) => r.code === "quota_exceeded")) return "action_quota_exceeded";
  return "unsupported_intent";
}

function assertKnownCapability(capability_id: string): void {
  if (!CAPABILITIES.some((c) => c.capability_id === capability_id)) {
    throw new Error(`capability_id không có trong đăng ký: "${capability_id}" (01-CONTRACTS §8.4)`);
  }
}

// ── Tính blocking_reasons + allowed_actions_now (dùng chung 2 backend) ──

function computeBlockingReasons(input: {
  facility: FacilityRow;
  now: Date;
  slot_start?: string | null;
  slot_end?: string | null;
  slotBookedCount: number;
  quotaActiveUsed: number;
  quotaWeekUsed: number;
}): { reasons: BlockingReason[]; intake_open_now: boolean; operating_now: boolean } {
  const { facility: f, now } = input;
  const reasons: BlockingReason[] = [];

  const intakeOpenNow = isIntakeOpenNow(now, f.intake_windows);
  const operatingNow = isOperatingNow(now, f.operating_hours);

  if (!f.is_bookable) {
    reasons.push(
      blockingReason({
        code: "not_bookable",
        human_message_vi: `${f.name_vi} không có mục đặt chỗ.`,
        is_permanent: true,
        remediation_hint_vi: "Tiện ích này chỉ tra cứu nội quy, không đặt chỗ được.",
      })
    );
  }

  if (!intakeOpenNow) {
    reasons.push(
      blockingReason({
        code: "intake_closed",
        human_message_vi: `Ban quản lý hiện không nhận đăng ký cho ${f.name_vi}.`,
        next_valid_at: nextIntakeOpenAt(now, f.intake_windows),
        remediation_hint_vi: "Gửi lại yêu cầu trong cửa nhận đăng ký kế tiếp.",
      })
    );
  }

  if (input.slot_start) {
    const slotDate = new Date(input.slot_start);
    if (!Number.isNaN(slotDate.getTime())) {
      const parts = toIctParts(slotDate);
      const withinOperating = f.operating_hours.some(
        (w) =>
          w.days_of_week.includes(parts.dow) &&
          parts.minutesOfDay >= hmToMinutes(w.open_time) &&
          parts.minutesOfDay < hmToMinutes(w.close_time)
      );
      if (!withinOperating) {
        reasons.push(
          blockingReason({
            code: "outside_operating_hours",
            human_message_vi: `Khung giờ yêu cầu nằm ngoài giờ hoạt động của ${f.name_vi}.`,
            remediation_hint_vi: "Chọn khung giờ trong giờ hoạt động.",
          })
        );
      }

      const leadMinutes = (slotDate.getTime() - now.getTime()) / 60000;
      if (leadMinutes < f.min_lead_time_minutes) {
        reasons.push(
          blockingReason({
            code: "too_early",
            human_message_vi: `Cần đặt trước ít nhất ${f.min_lead_time_minutes} phút so với giờ dùng.`,
            remediation_hint_vi: "Chọn khung giờ xa hơn thời điểm hiện tại.",
          })
        );
      }
      const advanceDays = (slotDate.getTime() - now.getTime()) / (24 * 3600 * 1000);
      if (advanceDays > f.max_advance_days) {
        reasons.push(
          blockingReason({
            code: "too_late",
            human_message_vi: `Chỉ nhận đặt trước tối đa ${f.max_advance_days} ngày.`,
            remediation_hint_vi: "Chọn khung giờ gần hơn.",
          })
        );
      }
    }

    if (f.is_bookable && input.slotBookedCount >= f.capacity_per_slot) {
      reasons.push(
        blockingReason({
          code: "slot_full",
          human_message_vi: `Khung giờ này của ${f.name_vi} đã hết chỗ.`,
          remediation_hint_vi: "Chọn khung giờ khác.",
        })
      );
    }
  }

  const quotaRemaining = Math.min(
    f.max_active_bookings - input.quotaActiveUsed,
    f.max_bookings_per_week - input.quotaWeekUsed
  );
  if (quotaRemaining <= 0) {
    reasons.push(
      blockingReason({
        code: "quota_exceeded",
        human_message_vi: "Đã đạt hạn mức đặt chỗ cho tiện ích này.",
        is_permanent: false,
        remediation_hint_vi: "Huỷ bớt lượt đặt đang có hoặc chờ hạn mức làm mới.",
      })
    );
  }

  return { reasons, intake_open_now: intakeOpenNow, operating_now: operatingNow };
}

function nextMondayMidnightIct(now: Date): string {
  const parts = toIctParts(now);
  const daysUntilMonday = ((8 - parts.dow) % 7) || 7;
  return toIctIso(ictToUtcDate(parts.y, parts.m, parts.d + daysUntilMonday, 0));
}

// ─────────────────────────────────────────────────────────────────────────
// MemorySimBackend — mock (Đ43: KHÔNG được dễ tính hơn Postgres về hình
// dạng dữ liệu). `FACILITY_SEED` bên dưới là bản SAO Y 14 dòng
// `INSERT INTO facilities` của `db/migrations/006_p05_action_layer.sql`
// (cùng giờ giấc, cùng `source_document_id`/`source_section_id`) — mock
// KHÔNG được có tập tiện ích khác Postgres. Đối chiếu bằng
// `scripts/validate_capabilities.mjs`/`validate_policy.mjs`, cả hai chạy
// được trên CẢ HAI backend qua `DATA_BACKEND`.
// ─────────────────────────────────────────────────────────────────────────

// `db/seed/facilities.json` là NGUỒN DỮ LIỆU (BB-10 — chỉ soi app/ và lib/,
// KHÔNG soi db/); nạp qua `readFileSync` giống cách `scripts/seed_users.mjs`
// nạp dữ liệu vận hành, KHÔNG viết literal facility_id/source_document_id
// vào .ts (mã document_id rải trong lib/ sẽ bị `check_no_hardcoded_knowledge.sh`
// báo `matches` khác 0). File JSON này là bản SAO Y phần seed của
// `db/migrations/006_p05_action_layer.sql` §6 — hai bản đối chiếu bằng mắt
// khi sửa; script `scripts/validate_capabilities.mjs`/`validate_policy.mjs`
// chạy được trên CẢ HAI backend qua `DATA_BACKEND` để bắt lệch.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACILITY_SEED: FacilityRow[] = JSON.parse(
  readFileSync(path.join(__dirname, "..", "..", "db", "seed", "facilities.json"), "utf8")
) as FacilityRow[];

interface MemBooking extends BookingRecord {}
interface MemReceipt extends ReceiptRecord {}

export class MemorySimBackend implements SimBackend {
  readonly backend = "mock" as const;
  private facilities: Map<string, FacilityRow>;
  private bookings: MemBooking[] = [];
  private receipts: MemReceipt[] = [];
  private precheckLog: Array<{ session_id: string; capability_id: string; params_fingerprint: string }> = [];
  private pendingActions = new Map<string, PendingAction>();

  constructor(seed: FacilityRow[] = FACILITY_SEED) {
    this.facilities = new Map(seed.map((f) => [f.facility_id, f]));
  }

  now(): Date {
    return simNow();
  }

  async listFacilities(): Promise<FacilitySummary[]> {
    return [...this.facilities.values()]
      .filter((f) => !NON_BOOKABLE_FACILITY_IDS.includes(f.facility_id as (typeof NON_BOOKABLE_FACILITY_IDS)[number]))
      .map(toSummary);
  }

  async resolveFacility(hintVi: string): Promise<FacilitySummary | null> {
    const needle = normalizeVi(hintVi);
    for (const f of this.facilities.values()) {
      if (normalizeVi(f.name_vi) === needle) return toSummary(f);
      if (f.aliases_vi.some((a) => normalizeVi(a) === needle)) return toSummary(f);
    }
    for (const f of this.facilities.values()) {
      if (normalizeVi(f.name_vi).includes(needle) || f.aliases_vi.some((a) => normalizeVi(a).includes(needle))) {
        return toSummary(f);
      }
    }
    return null;
  }

  async getFacilityDetail(facility_id: string): Promise<FacilitySummary | null> {
    const f = this.facilities.get(facility_id);
    return f ? toSummary(f) : null;
  }

  private quotaCounts(resident_id: string, facility_id: string, now: Date): { active: number; week: number } {
    const active = this.bookings.filter(
      (b) => b.resident_id === resident_id && b.facility_id === facility_id && b.state === "confirmed"
    ).length;
    const parts = toIctParts(now);
    const daysSinceMonday = (parts.dow + 6) % 7;
    const weekStart = ictToUtcDate(parts.y, parts.m, parts.d - daysSinceMonday, 0);
    const week = this.bookings.filter(
      (b) =>
        b.resident_id === resident_id &&
        b.facility_id === facility_id &&
        b.state === "confirmed" &&
        new Date(b.created_at).getTime() >= weekStart.getTime()
    ).length;
    return { active, week };
  }

  private buildPolicy(f: FacilityRow, input: {
    resident_id: string;
    property_id: string;
    slot_start?: string | null;
    slot_end?: string | null;
  }): BookingPolicy {
    const now = this.now();
    const slotBookedCount = input.slot_start
      ? this.bookings.filter(
          (b) => b.facility_id === f.facility_id && b.property_id === input.property_id && b.slot_start === input.slot_start && b.state === "confirmed"
        ).length
      : 0;
    const quota = this.quotaCounts(input.resident_id, f.facility_id, now);
    const { reasons, intake_open_now, operating_now } = computeBlockingReasons({
      facility: f,
      now,
      slot_start: input.slot_start,
      slot_end: input.slot_end,
      slotBookedCount,
      quotaActiveUsed: quota.active,
      quotaWeekUsed: quota.week,
    });
    const canCreate = f.is_bookable && reasons.length === 0;
    return {
      facility_id: f.facility_id,
      facility_name_vi: f.name_vi,
      zone: f.zone,
      policy_version: f.policy_version,
      source_document_id: f.source_document_id,
      source_section_id: f.source_section_id,
      has_authoritative_rules: f.has_authoritative_rules,
      server_time: toIctIso(now),
      timezone: "Asia/Ho_Chi_Minh",
      intake_windows: f.intake_windows,
      intake_open_now,
      next_intake_open_at: intake_open_now ? null : nextIntakeOpenAt(now, f.intake_windows),
      next_intake_close_at: intake_open_now ? nextIntakeCloseAt(now, f.intake_windows) : null,
      operating_hours: f.operating_hours,
      operating_now,
      closure_dates: [],
      is_bookable: f.is_bookable,
      slot_granularity_minutes: f.slot_granularity_minutes,
      slot_calendar: [],
      min_lead_time_minutes: f.min_lead_time_minutes,
      max_advance_days: f.max_advance_days,
      max_active_bookings: f.max_active_bookings,
      max_bookings_per_week: f.max_bookings_per_week,
      quota_used: quota.active,
      quota_remaining: Math.max(0, Math.min(f.max_active_bookings - quota.active, f.max_bookings_per_week - quota.week)),
      quota_resets_at: nextMondayMidnightIct(now),
      min_age: f.min_age,
      requires_adult_supervision_under_age: f.requires_adult_supervision_under_age,
      is_cancellable: f.is_cancellable,
      cancel_deadline_before_slot_minutes: f.cancel_deadline_before_slot_minutes,
      blocking_reasons: reasons,
      allowed_actions_now: !f.is_bookable ? [] : canCreate ? ["amenity.check_eligibility", "amenity.create_booking"] : ["amenity.check_eligibility"],
      idempotency_supported: true,
      idempotency_key_ttl_seconds: 600,
      duplicate_booking_behavior: "reject",
    };
  }

  async getBookingPolicy(input: {
    facility_id: string;
    resident_id: string;
    property_id: string;
    slot_start?: string | null;
    slot_end?: string | null;
    party_size?: number | null;
  }): Promise<BookingPolicy> {
    const f = this.facilities.get(input.facility_id);
    if (!f) throw new SimBackendError("NotFound", `facility_id không tồn tại: ${input.facility_id}`);
    return this.buildPolicy(f, input);
  }

  async getAvailability(input: { facility_id: string; from: string; to: string }): Promise<SlotCalendarEntry[]> {
    const f = this.facilities.get(input.facility_id);
    if (!f || !f.is_bookable) return [];
    const from = new Date(input.from);
    const to = new Date(input.to);
    const out: SlotCalendarEntry[] = [];
    const step = f.slot_granularity_minutes * 60_000;
    for (let t = from.getTime(); t < to.getTime(); t += step) {
      const slotStart = new Date(t);
      const slotEnd = new Date(t + step);
      const parts = toIctParts(slotStart);
      const withinOperating = f.operating_hours.some(
        (w) => w.days_of_week.includes(parts.dow) && parts.minutesOfDay >= hmToMinutes(w.open_time) && parts.minutesOfDay < hmToMinutes(w.close_time)
      );
      if (!withinOperating) continue;
      const booked = this.bookings.filter(
        (b) => b.facility_id === f.facility_id && b.slot_start === slotStart.toISOString() && b.state === "confirmed"
      ).length;
      out.push({
        slot_start: toIctIso(slotStart),
        slot_end: toIctIso(slotEnd),
        capacity_total: f.capacity_per_slot,
        capacity_remaining: Math.max(0, f.capacity_per_slot - booked),
        status: booked >= f.capacity_per_slot ? "full" : "open",
      });
    }
    return out;
  }

  async checkEligibility(input: {
    session_id: string;
    facility_id: string;
    resident_id: string;
    property_id: string;
    slot_start: string;
    slot_end: string;
    party_size: number;
  }): Promise<{ eligible: boolean; blocking_reasons: BlockingReason[]; params_fingerprint: string }> {
    const f = this.facilities.get(input.facility_id);
    if (!f) throw new SimBackendError("NotFound", `facility_id không tồn tại: ${input.facility_id}`);
    const policy = this.buildPolicy(f, input);
    const fp = paramsFingerprint(input);
    this.precheckLog.push({ session_id: input.session_id, capability_id: "amenity.create_booking", params_fingerprint: fp });
    await this.writePrecheckLogRow(input.session_id, "amenity.create_booking", fp);
    return { eligible: policy.blocking_reasons.length === 0, blocking_reasons: policy.blocking_reasons, params_fingerprint: fp };
  }

  // no-op override point cho subclass test cần hook — mock giữ nội bộ, không DB.
  protected async writePrecheckLogRow(_session_id: string, _capability_id: string, _fp: string): Promise<void> {}

  async listMyBookings(resident_id: string): Promise<BookingRecord[]> {
    return this.bookings.filter((b) => b.resident_id === resident_id);
  }

  async getBookingDetail(input: { session_id: string; booking_id: string; resident_id: string }): Promise<BookingRecord> {
    const b = this.bookings.find((x) => x.booking_id === input.booking_id);
    if (!b) throw new SimBackendError("NotFound", `booking_id không tồn tại: ${input.booking_id}`);
    if (b.resident_id !== input.resident_id) {
      throw new SimBackendError("Forbidden", "booking không thuộc resident_id đang gọi.");
    }
    const fp = cancelFingerprint(input.booking_id);
    this.precheckLog.push({ session_id: input.session_id, capability_id: "amenity.cancel_booking", params_fingerprint: fp });
    return b;
  }

  private hasPrecheck(session_id: string, capability_id: string, fp: string): boolean {
    return this.precheckLog.some((p) => p.session_id === session_id && p.capability_id === capability_id && p.params_fingerprint === fp);
  }

  async createBooking(input: {
    session_id: string;
    facility_id: string;
    resident_id: string;
    property_id: string;
    slot_start: string;
    slot_end: string;
    party_size: number;
    idempotency_key: string;
  }): Promise<CreateBookingResult> {
    const fp = paramsFingerprint(input);
    assertPrechecked(this.hasPrecheck(input.session_id, "amenity.create_booking", fp), input.session_id, "amenity.create_booking");

    const existing = this.bookings.find((b) => b.idempotency_key === input.idempotency_key);
    if (existing) {
      return { ok: true, booking_id: existing.booking_id, receipt_code: existing.receipt_code, undo_capability_id: "amenity.cancel_booking", duplicate: true };
    }

    const f = this.facilities.get(input.facility_id);
    if (!f) throw new SimBackendError("NotFound", `facility_id không tồn tại: ${input.facility_id}`);

    if ((input as { __forceWriteTimeout?: boolean }).__forceWriteTimeout) {
      throw new SimBackendError("WriteTimeout", "Mô phỏng WriteTimeout (cờ test __forceWriteTimeout).");
    }

    const policy = this.buildPolicy(f, input);
    if (policy.blocking_reasons.length > 0) {
      return { ok: false, reason_code: blockingReasonsToReasonCode(policy.blocking_reasons), blocking_reasons: policy.blocking_reasons };
    }

    const slotTaken = this.bookings.some(
      (b) => b.facility_id === input.facility_id && b.property_id === input.property_id && b.slot_start === input.slot_start && b.state === "confirmed"
    );
    if (slotTaken) {
      throw new SimBackendError("SlotTaken", "Khung giờ vừa bị người khác lấy.");
    }

    const bookingId = randomUUID();
    const code = receiptCode();
    const rec: MemBooking = {
      booking_id: bookingId,
      facility_id: f.facility_id,
      facility_name_vi: f.name_vi,
      resident_id: input.resident_id,
      property_id: input.property_id,
      slot_start: input.slot_start,
      slot_end: input.slot_end,
      party_size: input.party_size,
      state: "confirmed",
      idempotency_key: input.idempotency_key,
      receipt_code: code,
      created_at: new Date().toISOString(),
      cancelled_at: null,
      cancel_receipt_code: null,
    };
    this.bookings.push(rec);
    this.receipts.push({
      receipt_code: code,
      action: "create",
      booking_id: bookingId,
      resident_id: input.resident_id,
      undo_capability_id: "amenity.cancel_booking",
      undone_by: null,
      created_at: rec.created_at,
      summary_vi: `Đặt ${f.name_vi} lúc ${input.slot_start} thành công.`,
    });
    return { ok: true, booking_id: bookingId, receipt_code: code, undo_capability_id: "amenity.cancel_booking", duplicate: false };
  }

  async cancelBooking(input: {
    session_id: string;
    booking_id: string;
    resident_id: string;
    reason_vi: string;
    confirmed: boolean;
  }): Promise<CancelBookingResult> {
    const fp = cancelFingerprint(input.booking_id);
    assertPrechecked(this.hasPrecheck(input.session_id, "amenity.cancel_booking", fp), input.session_id, "amenity.cancel_booking");

    const b = this.bookings.find((x) => x.booking_id === input.booking_id);
    if (!b) throw new SimBackendError("NotFound", `booking_id không tồn tại: ${input.booking_id}`);
    if (b.resident_id !== input.resident_id) throw new SimBackendError("Forbidden", "booking không thuộc resident_id đang gọi.");
    if (b.state === "cancelled") {
      const existingCancel = this.receipts.find((r) => r.booking_id === b.booking_id && r.action === "cancel");
      if (existingCancel) return { ok: true, receipt_code: existingCancel.receipt_code, undo_capability_id: null };
    }

    if (!input.confirmed) {
      throw new SimBackendError("IrreversibleUnconfirmed", "Huỷ chỗ không hoàn tác được, cần xác nhận tường minh (§5.2).");
    }

    const f = this.facilities.get(b.facility_id);
    const deadlineMin = f?.cancel_deadline_before_slot_minutes ?? 0;
    const minutesToSlot = (new Date(b.slot_start).getTime() - this.now().getTime()) / 60000;
    if (minutesToSlot < deadlineMin) {
      return {
        ok: false,
        reason_code: "unsupported_intent",
        blocking_reasons: [
          blockingReason({
            code: "too_late",
            human_message_vi: `Đã quá hạn huỷ (tối thiểu ${deadlineMin} phút trước giờ dùng).`,
            is_permanent: true,
            remediation_hint_vi: "Liên hệ Ban quản lý nếu cần hỗ trợ thêm.",
          }),
        ],
      };
    }

    b.state = "cancelled";
    b.cancelled_at = new Date().toISOString();
    const code = receiptCode();
    b.cancel_receipt_code = code;
    this.receipts.push({
      receipt_code: code,
      action: "cancel",
      booking_id: b.booking_id,
      resident_id: b.resident_id,
      undo_capability_id: null,
      undone_by: null,
      created_at: b.cancelled_at,
      summary_vi: `Huỷ ${b.facility_name_vi} lúc ${b.slot_start}. Lý do: ${input.reason_vi}`,
    });
    const original = this.receipts.find((r) => r.booking_id === b.booking_id && r.action === "create");
    if (original) original.undone_by = code;
    return { ok: true, receipt_code: code, undo_capability_id: null };
  }

  async listMyReceipts(resident_id: string): Promise<ReceiptRecord[]> {
    return this.receipts.filter((r) => r.resident_id === resident_id);
  }

  async savePendingAction(action: PendingAction): Promise<void> {
    this.pendingActions.set(action.conversation_id, action);
  }

  async takePendingAction(conversation_id: string): Promise<PendingAction | null> {
    const a = this.pendingActions.get(conversation_id);
    if (!a) return null;
    this.pendingActions.delete(conversation_id);
    if (new Date(a.expires_at).getTime() < this.now().getTime()) return null;
    return a;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PostgresSimBackend — bảng RIÊNG của P05 (VC-09). Mọi truy vấn qua getSql().
// ─────────────────────────────────────────────────────────────────────────

interface FacilityDbRow {
  facility_id: string;
  name_vi: string;
  zone: string;
  is_bookable: boolean;
  has_authoritative_rules: boolean;
  aliases_vi: string[];
  intake_windows: BookingPolicy["intake_windows"];
  operating_hours: BookingPolicy["operating_hours"];
  slot_granularity_minutes: number;
  capacity_per_slot: number;
  min_lead_time_minutes: number;
  max_advance_days: number;
  max_active_bookings: number;
  max_bookings_per_week: number;
  min_age: number | null;
  requires_adult_supervision_under_age: number | null;
  is_cancellable: boolean;
  cancel_deadline_before_slot_minutes: number;
  source_document_id: string | null;
  source_section_id: string | null;
  policy_version: string;
}

function rowToFacilityRow(r: FacilityDbRow): FacilityRow {
  return { ...r };
}

export class PostgresSimBackend implements SimBackend {
  readonly backend = "postgres" as const;

  now(): Date {
    return simNow();
  }

  private async getFacilityRow(facility_id: string): Promise<FacilityRow | null> {
    const sql = getSql();
    const rows = await sql<FacilityDbRow>(`SELECT * FROM facilities WHERE facility_id = $1`, [facility_id]);
    return rows[0] ? rowToFacilityRow(rows[0]) : null;
  }

  async listFacilities(): Promise<FacilitySummary[]> {
    const sql = getSql();
    const rows = await sql<FacilityDbRow>(
      `SELECT * FROM facilities WHERE is_bookable = true ORDER BY facility_id`
    );
    return rows.map((r) => toSummary(rowToFacilityRow(r)));
  }

  async resolveFacility(hintVi: string): Promise<FacilitySummary | null> {
    const sql = getSql();
    const rows = await sql<FacilityDbRow>(`SELECT * FROM facilities`);
    const needle = normalizeVi(hintVi);
    let exact: FacilityDbRow | null = null;
    let loose: FacilityDbRow | null = null;
    for (const r of rows) {
      if (normalizeVi(r.name_vi) === needle || (r.aliases_vi ?? []).some((a) => normalizeVi(a) === needle)) {
        exact = r;
        break;
      }
      if (!loose && (normalizeVi(r.name_vi).includes(needle) || (r.aliases_vi ?? []).some((a) => normalizeVi(a).includes(needle)))) {
        loose = r;
      }
    }
    const picked = exact ?? loose;
    return picked ? toSummary(rowToFacilityRow(picked)) : null;
  }

  async getFacilityDetail(facility_id: string): Promise<FacilitySummary | null> {
    const f = await this.getFacilityRow(facility_id);
    return f ? toSummary(f) : null;
  }

  private async quotaCounts(resident_id: string, facility_id: string, now: Date): Promise<{ active: number; week: number }> {
    const sql = getSql();
    const parts = toIctParts(now);
    const daysSinceMonday = (parts.dow + 6) % 7;
    const weekStart = ictToUtcDate(parts.y, parts.m, parts.d - daysSinceMonday, 0);
    const rows = await sql<{ active: string; week: string }>(
      `SELECT
         count(*) FILTER (WHERE state = 'confirmed') AS active,
         count(*) FILTER (WHERE state = 'confirmed' AND created_at >= $3) AS week
       FROM bookings WHERE resident_id = $1 AND facility_id = $2`,
      [resident_id, facility_id, weekStart.toISOString()]
    );
    return { active: Number(rows[0]?.active ?? 0), week: Number(rows[0]?.week ?? 0) };
  }

  private async buildPolicy(f: FacilityRow, input: {
    resident_id: string;
    property_id: string;
    slot_start?: string | null;
    slot_end?: string | null;
  }): Promise<BookingPolicy> {
    const now = this.now();
    const sql = getSql();
    let slotBookedCount = 0;
    if (input.slot_start) {
      const rows = await sql<{ n: string }>(
        `SELECT count(*)::text AS n FROM bookings WHERE facility_id = $1 AND property_id = $2 AND slot_start = $3 AND state = 'confirmed'`,
        [f.facility_id, input.property_id, input.slot_start]
      );
      slotBookedCount = Number(rows[0]?.n ?? 0);
    }
    const quota = await this.quotaCounts(input.resident_id, f.facility_id, now);
    const { reasons, intake_open_now, operating_now } = computeBlockingReasons({
      facility: f,
      now,
      slot_start: input.slot_start,
      slot_end: input.slot_end,
      slotBookedCount,
      quotaActiveUsed: quota.active,
      quotaWeekUsed: quota.week,
    });
    const canCreate = f.is_bookable && reasons.length === 0;
    return {
      facility_id: f.facility_id,
      facility_name_vi: f.name_vi,
      zone: f.zone,
      policy_version: f.policy_version,
      source_document_id: f.source_document_id,
      source_section_id: f.source_section_id,
      has_authoritative_rules: f.has_authoritative_rules,
      server_time: toIctIso(now),
      timezone: "Asia/Ho_Chi_Minh",
      intake_windows: f.intake_windows,
      intake_open_now,
      next_intake_open_at: intake_open_now ? null : nextIntakeOpenAt(now, f.intake_windows),
      next_intake_close_at: intake_open_now ? nextIntakeCloseAt(now, f.intake_windows) : null,
      operating_hours: f.operating_hours,
      operating_now,
      closure_dates: [],
      is_bookable: f.is_bookable,
      slot_granularity_minutes: f.slot_granularity_minutes,
      slot_calendar: [],
      min_lead_time_minutes: f.min_lead_time_minutes,
      max_advance_days: f.max_advance_days,
      max_active_bookings: f.max_active_bookings,
      max_bookings_per_week: f.max_bookings_per_week,
      quota_used: quota.active,
      quota_remaining: Math.max(0, Math.min(f.max_active_bookings - quota.active, f.max_bookings_per_week - quota.week)),
      quota_resets_at: nextMondayMidnightIct(now),
      min_age: f.min_age,
      requires_adult_supervision_under_age: f.requires_adult_supervision_under_age,
      is_cancellable: f.is_cancellable,
      cancel_deadline_before_slot_minutes: f.cancel_deadline_before_slot_minutes,
      blocking_reasons: reasons,
      allowed_actions_now: !f.is_bookable ? [] : canCreate ? ["amenity.check_eligibility", "amenity.create_booking"] : ["amenity.check_eligibility"],
      idempotency_supported: true,
      idempotency_key_ttl_seconds: 600,
      duplicate_booking_behavior: "reject",
    };
  }

  async getBookingPolicy(input: {
    facility_id: string;
    resident_id: string;
    property_id: string;
    slot_start?: string | null;
    slot_end?: string | null;
    party_size?: number | null;
  }): Promise<BookingPolicy> {
    const f = await this.getFacilityRow(input.facility_id);
    if (!f) throw new SimBackendError("NotFound", `facility_id không tồn tại: ${input.facility_id}`);
    return this.buildPolicy(f, input);
  }

  async getAvailability(input: { facility_id: string; from: string; to: string }): Promise<SlotCalendarEntry[]> {
    const f = await this.getFacilityRow(input.facility_id);
    if (!f || !f.is_bookable) return [];
    const sql = getSql();
    const from = new Date(input.from);
    const to = new Date(input.to);
    const out: SlotCalendarEntry[] = [];
    const step = f.slot_granularity_minutes * 60_000;
    for (let t = from.getTime(); t < to.getTime(); t += step) {
      const slotStart = new Date(t);
      const slotEnd = new Date(t + step);
      const parts = toIctParts(slotStart);
      const withinOperating = f.operating_hours.some(
        (w) => w.days_of_week.includes(parts.dow) && parts.minutesOfDay >= hmToMinutes(w.open_time) && parts.minutesOfDay < hmToMinutes(w.close_time)
      );
      if (!withinOperating) continue;
      const rows = await sql<{ n: string }>(
        `SELECT count(*)::text AS n FROM bookings WHERE facility_id = $1 AND slot_start = $2 AND state = 'confirmed'`,
        [f.facility_id, slotStart.toISOString()]
      );
      const booked = Number(rows[0]?.n ?? 0);
      out.push({
        slot_start: toIctIso(slotStart),
        slot_end: toIctIso(slotEnd),
        capacity_total: f.capacity_per_slot,
        capacity_remaining: Math.max(0, f.capacity_per_slot - booked),
        status: booked >= f.capacity_per_slot ? "full" : "open",
      });
    }
    return out;
  }

  async checkEligibility(input: {
    session_id: string;
    facility_id: string;
    resident_id: string;
    property_id: string;
    slot_start: string;
    slot_end: string;
    party_size: number;
  }): Promise<{ eligible: boolean; blocking_reasons: BlockingReason[]; params_fingerprint: string }> {
    const f = await this.getFacilityRow(input.facility_id);
    if (!f) throw new SimBackendError("NotFound", `facility_id không tồn tại: ${input.facility_id}`);
    const policy = await this.buildPolicy(f, input);
    const fp = paramsFingerprint(input);
    const sql = getSql();
    await sql(
      `INSERT INTO precheck_log (session_id, capability_id, params_fingerprint) VALUES ($1, $2, $3)`,
      [input.session_id, "amenity.create_booking", fp]
    );
    return { eligible: policy.blocking_reasons.length === 0, blocking_reasons: policy.blocking_reasons, params_fingerprint: fp };
  }

  async listMyBookings(resident_id: string): Promise<BookingRecord[]> {
    const sql = getSql();
    const rows = await sql<{
      id: string;
      facility_id: string;
      property_id: string;
      resident_id: string;
      slot_start: string;
      slot_end: string;
      party_size: number;
      state: "confirmed" | "cancelled";
      idempotency_key: string;
      created_at: string;
      cancelled_at: string | null;
    }>(
      `SELECT id, facility_id, property_id, resident_id, slot_start, slot_end, party_size, state, idempotency_key, created_at, cancelled_at
       FROM bookings WHERE resident_id = $1 ORDER BY created_at DESC`,
      [resident_id]
    );
    const facilityIds = [...new Set(rows.map((r) => r.facility_id))];
    const facilities = new Map<string, FacilityRow>();
    for (const id of facilityIds) {
      const f = await this.getFacilityRow(id);
      if (f) facilities.set(id, f);
    }
    const out: BookingRecord[] = [];
    for (const r of rows) {
      const receiptRows = await sql<{ receipt_code: string; action: string }>(
        `SELECT receipt_code, action FROM receipts WHERE booking_id = $1 ORDER BY created_at ASC`,
        [r.id]
      );
      const create = receiptRows.find((x) => x.action === "create");
      const cancel = receiptRows.find((x) => x.action === "cancel");
      out.push({
        booking_id: r.id,
        facility_id: r.facility_id,
        facility_name_vi: facilities.get(r.facility_id)?.name_vi ?? r.facility_id,
        resident_id: r.resident_id,
        property_id: r.property_id,
        slot_start: new Date(r.slot_start).toISOString(),
        slot_end: new Date(r.slot_end).toISOString(),
        party_size: r.party_size,
        state: r.state,
        idempotency_key: r.idempotency_key,
        receipt_code: create?.receipt_code ?? "",
        created_at: new Date(r.created_at).toISOString(),
        cancelled_at: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : null,
        cancel_receipt_code: cancel?.receipt_code ?? null,
      });
    }
    return out;
  }

  async getBookingDetail(input: { session_id: string; booking_id: string; resident_id: string }): Promise<BookingRecord> {
    if (!isValidUuid(input.booking_id)) {
      throw new SimBackendError("NotFound", `booking_id không đúng hình dạng uuid: ${input.booking_id}`);
    }
    const sql = getSql();
    const rows = await sql<{
      id: string;
      facility_id: string;
      property_id: string;
      resident_id: string;
      slot_start: string;
      slot_end: string;
      party_size: number;
      state: "confirmed" | "cancelled";
      idempotency_key: string;
      created_at: string;
      cancelled_at: string | null;
    }>(
      `SELECT id, facility_id, property_id, resident_id, slot_start, slot_end, party_size, state, idempotency_key, created_at, cancelled_at
       FROM bookings WHERE id = $1`,
      [input.booking_id]
    );
    const r = rows[0];
    if (!r) throw new SimBackendError("NotFound", `booking_id không tồn tại: ${input.booking_id}`);
    if (r.resident_id !== input.resident_id) throw new SimBackendError("Forbidden", "booking không thuộc resident_id đang gọi.");

    const f = await this.getFacilityRow(r.facility_id);
    const receiptRows = await sql<{ receipt_code: string; action: string }>(
      `SELECT receipt_code, action FROM receipts WHERE booking_id = $1 ORDER BY created_at ASC`,
      [r.id]
    );
    const create = receiptRows.find((x) => x.action === "create");
    const cancel = receiptRows.find((x) => x.action === "cancel");

    const fp = cancelFingerprint(input.booking_id);
    await sql(
      `INSERT INTO precheck_log (session_id, capability_id, params_fingerprint) VALUES ($1, $2, $3)`,
      [input.session_id, "amenity.cancel_booking", fp]
    );

    return {
      booking_id: r.id,
      facility_id: r.facility_id,
      facility_name_vi: f?.name_vi ?? r.facility_id,
      resident_id: r.resident_id,
      property_id: r.property_id,
      slot_start: new Date(r.slot_start).toISOString(),
      slot_end: new Date(r.slot_end).toISOString(),
      party_size: r.party_size,
      state: r.state,
      idempotency_key: r.idempotency_key,
      receipt_code: create?.receipt_code ?? "",
      created_at: new Date(r.created_at).toISOString(),
      cancelled_at: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : null,
      cancel_receipt_code: cancel?.receipt_code ?? null,
    };
  }

  /** `receipts.actor_user_id` (SPEC-P05 §4) đòi `users.id` (uuid), nhưng
   *  input của `createBooking`/`cancelBooking` chỉ có `resident_id` (text,
   *  vd "R-0001") — QUYẾT ĐỊNH THỰC THI (không có trong contract/SPEC, ghi
   *  report): tra `users.resident_id = $1` để lấy uuid. Không tìm thấy ⇒
   *  ném lỗi rõ ràng thay vì vỡ NOT NULL constraint khó hiểu. */
  private async actorUserId(resident_id: string): Promise<string> {
    const sql = getSql();
    const rows = await sql<{ id: string }>(`SELECT id FROM users WHERE resident_id = $1`, [resident_id]);
    const row = rows[0];
    if (!row) {
      throw new Error(`Không tìm thấy users.id cho resident_id="${resident_id}" — cần seed user trước khi tạo biên nhận.`);
    }
    return row.id;
  }

  private async hasPrecheck(session_id: string, capability_id: string, fp: string): Promise<boolean> {
    const sql = getSql();
    const rows = await sql<{ n: string }>(
      `SELECT count(*)::text AS n FROM precheck_log WHERE session_id = $1 AND capability_id = $2 AND params_fingerprint = $3`,
      [session_id, capability_id, fp]
    );
    return Number(rows[0]?.n ?? 0) > 0;
  }

  async createBooking(input: {
    session_id: string;
    facility_id: string;
    resident_id: string;
    property_id: string;
    slot_start: string;
    slot_end: string;
    party_size: number;
    idempotency_key: string;
  }): Promise<CreateBookingResult> {
    const fp = paramsFingerprint(input);
    assertPrechecked(await this.hasPrecheck(input.session_id, "amenity.create_booking", fp), input.session_id, "amenity.create_booking");

    const sql = getSql();
    const existingRows = await sql<{ id: string }>(`SELECT id FROM bookings WHERE idempotency_key = $1`, [input.idempotency_key]);
    if (existingRows[0]) {
      const bookingId = existingRows[0].id;
      const receiptRows = await sql<{ receipt_code: string }>(
        `SELECT receipt_code FROM receipts WHERE booking_id = $1 AND action = 'create'`,
        [bookingId]
      );
      return { ok: true, booking_id: bookingId, receipt_code: receiptRows[0]?.receipt_code ?? "", undo_capability_id: "amenity.cancel_booking", duplicate: true };
    }

    const f = await this.getFacilityRow(input.facility_id);
    if (!f) throw new SimBackendError("NotFound", `facility_id không tồn tại: ${input.facility_id}`);

    if ((input as { __forceWriteTimeout?: boolean }).__forceWriteTimeout) {
      await sql(
        `INSERT INTO audit_log (level, actor_id, actor_role, event, payload) VALUES ('warn', NULL, 'system', 'action.write_timeout', $1::jsonb)`,
        [JSON.stringify({ capability_id: "amenity.create_booking", facility_id: input.facility_id, idempotency_key: input.idempotency_key })]
      );
      throw new SimBackendError("WriteTimeout", "Mô phỏng WriteTimeout (cờ test __forceWriteTimeout).");
    }

    const policy = await this.buildPolicy(f, input);
    if (policy.blocking_reasons.length > 0) {
      return { ok: false, reason_code: blockingReasonsToReasonCode(policy.blocking_reasons), blocking_reasons: policy.blocking_reasons };
    }

    const actorUserId = await this.actorUserId(input.resident_id);
    const code = receiptCode();
    try {
      const rows = await sql<{ booking_id: string }>(
        `WITH new_booking AS (
           INSERT INTO bookings (facility_id, property_id, resident_id, slot_start, slot_end, party_size, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id
         ),
         new_receipt AS (
           INSERT INTO receipts (booking_id, receipt_code, action, capability_id, params_json, result_json, actor_user_id, undo_capability_id)
           SELECT id, $8, 'create', 'amenity.create_booking', $9::jsonb, $10::jsonb, $11, 'amenity.cancel_booking'
           FROM new_booking
         )
         SELECT id AS booking_id FROM new_booking`,
        [
          input.facility_id,
          input.property_id,
          input.resident_id,
          input.slot_start,
          input.slot_end,
          input.party_size,
          input.idempotency_key,
          code,
          JSON.stringify({ facility_id: input.facility_id, slot_start: input.slot_start, slot_end: input.slot_end, party_size: input.party_size }),
          JSON.stringify({ receipt_code: code }),
          actorUserId,
        ]
      );
      const bookingId = rows[0]!.booking_id;
      return { ok: true, booking_id: bookingId, receipt_code: code, undo_capability_id: "amenity.cancel_booking", duplicate: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("bookings_idem_uniq")) {
        const rows2 = await sql<{ id: string; receipt_code: string }>(
          `SELECT b.id, r.receipt_code FROM bookings b JOIN receipts r ON r.booking_id = b.id AND r.action = 'create' WHERE b.idempotency_key = $1`,
          [input.idempotency_key]
        );
        if (rows2[0]) {
          return { ok: true, booking_id: rows2[0].id, receipt_code: rows2[0].receipt_code, undo_capability_id: "amenity.cancel_booking", duplicate: true };
        }
      }
      if (msg.includes("bookings_slot_uniq")) {
        throw new SimBackendError("SlotTaken", "Khung giờ vừa bị người khác lấy (UNIQUE INDEX).");
      }
      throw e;
    }
  }

  async cancelBooking(input: {
    session_id: string;
    booking_id: string;
    resident_id: string;
    reason_vi: string;
    confirmed: boolean;
  }): Promise<CancelBookingResult> {
    const fp = cancelFingerprint(input.booking_id);
    assertPrechecked(await this.hasPrecheck(input.session_id, "amenity.cancel_booking", fp), input.session_id, "amenity.cancel_booking");

    const sql = getSql();
    const rows = await sql<{ id: string; facility_id: string; resident_id: string; slot_start: string; state: "confirmed" | "cancelled" }>(
      `SELECT id, facility_id, resident_id, slot_start, state FROM bookings WHERE id = $1`,
      [input.booking_id]
    );
    const b = rows[0];
    if (!b) throw new SimBackendError("NotFound", `booking_id không tồn tại: ${input.booking_id}`);
    if (b.resident_id !== input.resident_id) throw new SimBackendError("Forbidden", "booking không thuộc resident_id đang gọi.");

    if (b.state === "cancelled") {
      const cancelReceipt = await sql<{ receipt_code: string }>(
        `SELECT receipt_code FROM receipts WHERE booking_id = $1 AND action = 'cancel'`,
        [b.id]
      );
      if (cancelReceipt[0]) return { ok: true, receipt_code: cancelReceipt[0].receipt_code, undo_capability_id: null };
    }

    if (!input.confirmed) {
      throw new SimBackendError("IrreversibleUnconfirmed", "Huỷ chỗ không hoàn tác được, cần xác nhận tường minh (§5.2).");
    }

    const f = await this.getFacilityRow(b.facility_id);
    const deadlineMin = f?.cancel_deadline_before_slot_minutes ?? 0;
    const minutesToSlot = (new Date(b.slot_start).getTime() - this.now().getTime()) / 60000;
    if (minutesToSlot < deadlineMin) {
      return {
        ok: false,
        reason_code: "unsupported_intent",
        blocking_reasons: [
          blockingReason({
            code: "too_late",
            human_message_vi: `Đã quá hạn huỷ (tối thiểu ${deadlineMin} phút trước giờ dùng).`,
            is_permanent: true,
            remediation_hint_vi: "Liên hệ Ban quản lý nếu cần hỗ trợ thêm.",
          }),
        ],
      };
    }

    const actorUserId = await this.actorUserId(input.resident_id);
    const code = receiptCode();
    const cancelRows = await sql<{ id: string }>(
      `WITH updated AS (
         UPDATE bookings SET state = 'cancelled', cancelled_at = now() WHERE id = $1
         RETURNING id
       ),
       new_receipt AS (
         INSERT INTO receipts (booking_id, receipt_code, action, capability_id, params_json, result_json, actor_user_id, undo_capability_id)
         SELECT id, $2, 'cancel', 'amenity.cancel_booking', $3::jsonb, $4::jsonb, $5, NULL
         FROM updated
         RETURNING id
       ),
       linked_original AS (
         UPDATE receipts SET undone_by = (SELECT id FROM new_receipt)
         WHERE booking_id = $1 AND action = 'create'
         RETURNING id
       )
       SELECT id FROM new_receipt`,
      [input.booking_id, code, JSON.stringify({ booking_id: input.booking_id, reason_vi: input.reason_vi }), JSON.stringify({ receipt_code: code }), actorUserId]
    );
    void cancelRows;
    return { ok: true, receipt_code: code, undo_capability_id: null };
  }

  async listMyReceipts(resident_id: string): Promise<ReceiptRecord[]> {
    const sql = getSql();
    const rows = await sql<{
      receipt_code: string;
      action: "create" | "cancel";
      booking_id: string;
      undo_capability_id: string | null;
      undone_by: string | null;
      created_at: string;
    }>(
      `SELECT r.receipt_code, r.action, r.booking_id, r.undo_capability_id, r2.receipt_code AS undone_by, r.created_at
       FROM receipts r
       JOIN bookings b ON b.id = r.booking_id
       LEFT JOIN receipts r2 ON r2.id = r.undone_by
       WHERE b.resident_id = $1
       ORDER BY r.created_at DESC`,
      [resident_id]
    );
    return rows.map((r) => ({
      receipt_code: r.receipt_code,
      action: r.action,
      booking_id: r.booking_id,
      resident_id,
      undo_capability_id: r.undo_capability_id as ReceiptRecord["undo_capability_id"],
      undone_by: r.undone_by,
      created_at: new Date(r.created_at).toISOString(),
      summary_vi: r.action === "create" ? "Đặt chỗ thành công." : "Đã huỷ chỗ.",
    }));
  }

  async savePendingAction(action: PendingAction): Promise<void> {
    const sql = getSql();
    await sql(
      `INSERT INTO pending_actions (conversation_id, capability, payload, expires_at)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (conversation_id) DO UPDATE SET capability = EXCLUDED.capability, payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`,
      [action.conversation_id, action.capability, JSON.stringify(action.payload), action.expires_at]
    );
  }

  async takePendingAction(conversation_id: string): Promise<PendingAction | null> {
    const sql = getSql();
    const rows = await sql<{ conversation_id: string; capability: string; payload: unknown; created_at: string; expires_at: string }>(
      `DELETE FROM pending_actions WHERE conversation_id = $1 RETURNING conversation_id, capability, payload, created_at, expires_at`,
      [conversation_id]
    );
    const r = rows[0];
    if (!r) return null;
    if (new Date(r.expires_at).getTime() < this.now().getTime()) return null;
    return {
      conversation_id: r.conversation_id,
      capability: r.capability as PendingAction["capability"],
      payload: r.payload as Record<string, unknown>,
      created_at: new Date(r.created_at).toISOString(),
      expires_at: new Date(r.expires_at).toISOString(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// getSimBackend() — điểm vào DUY NHẤT cho H20/H21 (giống getDataStore()).
// ─────────────────────────────────────────────────────────────────────────

let cachedBackend: SimBackend | null = null;
let cachedBackendKind: "mock" | "postgres" | null = null;
let overrideBackend: SimBackend | null = null;

function backendKind(): "mock" | "postgres" {
  const v = (process.env.DATA_BACKEND ?? "mock").toLowerCase();
  if (v !== "mock" && v !== "postgres") {
    throw new Error(`DATA_BACKEND không hợp lệ: "${v}". Chỉ nhận "mock" | "postgres".`);
  }
  return v;
}

/** Điểm vào DUY NHẤT cho H20 (pipeline) và H21 (UI/script demo) lấy backend
 *  hành động — định tuyến theo `DATA_BACKEND` (Đ24), giống `getDataStore()`. */
export function getSimBackend(): SimBackend {
  if (overrideBackend) return overrideBackend;
  const kind = backendKind();
  if (cachedBackend && cachedBackendKind === kind) return cachedBackend;
  cachedBackend = kind === "postgres" ? new PostgresSimBackend() : new MemorySimBackend();
  cachedBackendKind = kind;
  return cachedBackend;
}

/** CHỈ dùng trong tests/scripts đo (`demo_2339.mjs`, H21 W3): tiêm một
 *  backend giả để đếm lời gọi (`getBookingPolicy` = 1, lệnh ghi = 0…) mà
 *  không cần DB thật. Thêm ngoài `contract.ts` theo yêu cầu của H21 —
 *  ghi vào report. */
export function __setSimBackendForTesting(backend: SimBackend | null): void {
  overrideBackend = backend;
}

/** CHỈ dùng trong tests/: xoá cache để đổi `DATA_BACKEND` giữa các ca test. */
export function __resetSimBackendForTesting(): void {
  cachedBackend = null;
  cachedBackendKind = null;
  overrideBackend = null;
}
