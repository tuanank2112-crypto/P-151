// lib/simbackend/guard.ts — HỢP ĐỒNG BB-03 (SPEC-P05-Action-Layer.md §2.1) +
// hai trục thời gian BB-02 (§2.2). File THUẦN (không mở connection DB,
// BB-07) — MemorySimBackend/PostgresSimBackend ở index.ts gọi vào đây.
//
// `lib/simbackend/` là backend cư dân mô phỏng do chúng ta tự viết (Đ02).
// Mọi tên trường/hằng số ở đây là hợp đồng tự định nghĩa, không phải mô tả
// API thật của Vinhomes, và không có lời gọi mạng nào ra ngoài.

import { createHash } from "node:crypto";
import { SimBackendError, type BlockingReason, type OperatingWindow, type TimeWindow } from "./contract.ts";

// ── BB-03 — đọc chính sách trước khi ghi ────────────────────────────────

/** SHA-256 của `(facility_id, slot_start, slot_end, property_id)` — precheck
 *  cho một khung giờ khác KHÔNG tính là đã precheck cho khung giờ này. */
export function paramsFingerprint(parts: {
  facility_id: string;
  slot_start: string;
  slot_end: string;
  property_id: string;
}): string {
  return createHash("sha256")
    .update(`${parts.facility_id}|${parts.slot_start}|${parts.slot_end}|${parts.property_id}`)
    .digest("hex");
}

/** Precheck của `cancel_booking` không có slot — vân tay theo `booking_id`. */
export function cancelFingerprint(booking_id: string): string {
  return createHash("sha256").update(`cancel|${booking_id}`).digest("hex");
}

/** Ném `SimBackendError('PrecheckMissing')` khi `(session_id, capability_id,
 *  params_fingerprint)` chưa từng được ghi vào `precheck_log` trong phiên
 *  hiện tại. Bản thân hàm không chạm DB — caller tự tra rồi truyền kết quả
 *  vào, giữ file này THUẦN và test được không cần Postgres. */
export function assertPrechecked(
  hasPrecheck: boolean,
  session_id: string,
  capability_id: string
): void {
  if (!hasPrecheck) {
    throw new SimBackendError(
      "PrecheckMissing",
      `Chưa precheck đúng fingerprint cho session="${session_id}" capability="${capability_id}" (BB-03).`
    );
  }
}

// ── BB-02 — hai trục thời gian, tuyệt đối không gộp ─────────────────────
//
// `intake_windows` ràng buộc t_submit (lúc GỬI). `operating_hours` ràng
// buộc t_slot (lúc DÙNG). Giờ Việt Nam cố định UTC+7, không DST — quy đổi
// bằng cách cộng offset rồi đọc các trường UTC của kết quả, để kết quả
// KHÔNG phụ thuộc timezone của máy chạy Node.

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface IctParts {
  dow: number; // 0 = CN … 6 = T7, khớp Date.getUTCDay() sau khi cộng offset
  minutesOfDay: number; // 0..1439
  y: number;
  m: number; // 0-based
  d: number;
}

export function toIctParts(date: Date): IctParts {
  const shifted = new Date(date.getTime() + ICT_OFFSET_MS);
  return {
    dow: shifted.getUTCDay(),
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
  };
}

/** `"08:30"` → 510 (phút kể từ 00:00). */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Dựng lại một Date (UTC thật) từ ngày-giờ ICT `(y, m, d, minutesOfDay)`. */
/**
 * `Date` → ISO-8601 CÓ offset `+07:00` (contract nhóm 2: "ISO-8601 có offset",
 * timezone Asia/Ho_Chi_Minh). CẤM trả `toISOString()` trần cho các trường
 * thời gian của policy: hậu tố `Z` làm A1/pipeline in "16:39" thay vì "23:39"
 * (lỗi đo được 2026-09-23 khi chạy demo_2339 — SO vá).
 */
export function toIctIso(date: Date): string {
  const shifted = new Date(date.getTime() + ICT_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 19)}+07:00`;
}

export function ictToUtcDate(y: number, m: number, d: number, minutesOfDay: number): Date {
  const asIfUtc = Date.UTC(y, m, d, Math.floor(minutesOfDay / 60), minutesOfDay % 60);
  return new Date(asIfUtc - ICT_OFFSET_MS);
}

interface NormalizedWindow {
  days_of_week: number[];
  startMin: number;
  endMin: number;
}

function normalizeIntake(windows: readonly TimeWindow[]): NormalizedWindow[] {
  return windows.map((w) => ({
    days_of_week: w.days_of_week,
    startMin: hmToMinutes(w.start_time),
    endMin: hmToMinutes(w.end_time),
  }));
}

function normalizeOperating(windows: readonly OperatingWindow[]): NormalizedWindow[] {
  return windows.map((w) => ({
    days_of_week: w.days_of_week,
    startMin: hmToMinutes(w.open_time),
    endMin: hmToMinutes(w.close_time),
  }));
}

function isWithin(now: Date, windows: NormalizedWindow[]): boolean {
  const { dow, minutesOfDay } = toIctParts(now);
  return windows.some(
    (w) => w.days_of_week.includes(dow) && minutesOfDay >= w.startMin && minutesOfDay < w.endMin
  );
}

/** `t_submit`: có đang trong cửa nhận đăng ký ngay LÚC GỌI (`now`) không. */
export function isIntakeOpenNow(now: Date, intake_windows: readonly TimeWindow[]): boolean {
  return isWithin(now, normalizeIntake(intake_windows));
}

/** `t_slot`: có đang trong giờ hoạt động ngay LÚC GỌI (`now`) không. Tính
 *  HOÀN TOÀN ĐỘC LẬP với `isIntakeOpenNow` — không dùng chung biểu thức,
 *  không suy ra bên này từ bên kia (BB-02). */
export function isOperatingNow(now: Date, operating_hours: readonly OperatingWindow[]): boolean {
  return isWithin(now, normalizeOperating(operating_hours));
}

/** Mốc ISO gần nhất (≥ `now`) mà cửa nhận đăng ký MỞ, quét tới 8 ngày tới.
 *  `null` khi `intake_windows` rỗng (không có cửa nhận đăng ký nào). */
export function nextIntakeOpenAt(now: Date, intake_windows: readonly TimeWindow[]): string | null {
  const windows = normalizeIntake(intake_windows);
  if (windows.length === 0) return null;
  const base = toIctParts(now);
  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const dow = (base.dow + dayOffset) % 7;
    for (const w of windows.filter((x) => x.days_of_week.includes(dow)).sort((a, b) => a.startMin - b.startMin)) {
      const candidate = ictToUtcDate(base.y, base.m, base.d + dayOffset, w.startMin);
      if (candidate.getTime() > now.getTime()) return toIctIso(candidate);
      // dayOffset=0 và now đã ở TRONG cửa (giữa startMin và endMin): không
      // phải "mở tiếp theo", bỏ qua candidate này ở ngày hôm nay.
    }
  }
  return null;
}

/** Mốc ISO cửa nhận đăng ký ĐANG mở sẽ đóng — `null` nếu hiện KHÔNG mở. */
export function nextIntakeCloseAt(now: Date, intake_windows: readonly TimeWindow[]): string | null {
  const windows = normalizeIntake(intake_windows);
  const base = toIctParts(now);
  const active = windows.find(
    (w) => w.days_of_week.includes(base.dow) && base.minutesOfDay >= w.startMin && base.minutesOfDay < w.endMin
  );
  if (!active) return null;
  return ictToUtcDate(base.y, base.m, base.d, active.endMin).toISOString();
}

/** Dựng một `BlockingReason` chuẩn (SPEC-P05 §3.1). */
export function blockingReason(input: {
  code: BlockingReason["code"];
  human_message_vi: string;
  is_permanent?: boolean;
  next_valid_at?: string | null;
  remediation_hint_vi: string;
}): BlockingReason {
  return {
    code: input.code,
    human_message_vi: input.human_message_vi,
    is_permanent: input.is_permanent ?? false,
    next_valid_at: input.next_valid_at ?? null,
    remediation_hint_vi: input.remediation_hint_vi,
  };
}
