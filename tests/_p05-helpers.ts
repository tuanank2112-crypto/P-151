// tests/_p05-helpers.ts — trợ giúp DÙNG CHUNG cho `tests/p05-*.test.ts` (H19
// W3, SPEC-P05-Action-Layer.md §10). KHÔNG phải file test (không có đuôi
// `.test.ts` nên `scripts/run_tests.mjs` không tự chạy nó) — cùng quy ước
// tiền tố `_` với `scripts/_batch.mjs`/`scripts/_pg.mjs`.
//
// `lib/simbackend/` là backend cư dân mô phỏng do chúng ta tự viết (Đ02).
// Không có lời gọi mạng nào ra ngoài — mọi thứ dưới đây chạy trên Postgres
// thật của dự án.
//
// G-P05-01 (đo 2026-09-23, chạy TOÀN BỘ `npm test` cùng lúc): dùng
// `scripts/_pg.mjs::makeSql()` riêng cho mỗi test MỞ THÊM một pool Postgres
// bên cạnh pool mà `PostgresSimBackend` đã mở qua `getSql()` của
// `lib/adapters/db.ts` — hai pool cùng lúc trên `node --test` chạy 38 file
// (nhiều file cùng chạm Postgres) đẩy số kết nối vượt trần
// `pool_size: 15` của Supabase pooler ("max clients reached in session
// mode"), làm rớt cả những test KHÔNG liên quan (vd `tests/memory.test.ts`).
// Khắc phục: dùng LẠI `getSql()` — CÙNG pool (tối đa 3 kết nối, cache theo
// tiến trình) mà `PostgresSimBackend` đang dùng — cho mọi câu SQL kiểm tra
// trong test, và đóng bằng `closePool()` (không mở `makeSql()` thứ hai).
import { closePool, getSql, type SqlFn } from "../lib/adapters/db.ts";

export const RESIDENT_ID = "R-0001"; // seed_users.mjs — users.resident_id thật, có users.id
export const PROPERTY_ID = "S1.120817"; // seed_users.mjs — owned_property_ids[0] của R-0001

/**
 * `SIM_NOW` CỐ ĐỊNH cho mọi test W3 KHÔNG tự nói về trục thời gian (mọi test
 * trừ `p05-policy-time-axes.test.ts`, nơi SIM_NOW chính là biến độc lập
 * đang được đo). 10:00 ICT, giữa mọi cửa intake/operating trong seed —
 * KHÔNG phụ thuộc giờ chạy thật của máy CI/dev (BB-02: test phải tất định).
 * Mỗi test file set `process.env.SIM_NOW = FIXED_SIM_NOW` ở đầu file, TRƯỚC
 * khi tạo backend — `node --test` chạy mỗi file test trong tiến trình con
 * riêng nên không rò rỉ sang file khác.
 */
export const FIXED_SIM_NOW = "2026-06-01T10:00:00+07:00";

export { getSql, closePool };
export type Sql = SqlFn;

/** Xoá sạch mọi dấu vết (bookings/receipts/precheck_log) mà một test Postgres
 *  tự tạo cho MỘT facility_id — gọi trong `finally`, đúng luật "Postgres tự
 *  dọn" của handoff H19 §3 W3. Thứ tự XOÁ: receipts trước (FK receipts →
 *  bookings không có CASCADE), rồi bookings, rồi precheck_log theo session. */
export async function cleanupFacility(sql: Sql, facility_id: string, session_ids: string[] = []): Promise<void> {
  await sql(
    `DELETE FROM receipts WHERE booking_id IN (SELECT id FROM bookings WHERE facility_id = $1 AND resident_id = $2)`,
    [facility_id, RESIDENT_ID]
  );
  await sql(`DELETE FROM bookings WHERE facility_id = $1 AND resident_id = $2`, [facility_id, RESIDENT_ID]);
  for (const sid of session_ids) {
    await sql(`DELETE FROM precheck_log WHERE session_id = $1`, [sid]);
  }
}

export async function cleanupPendingAction(sql: Sql, conversation_id: string): Promise<void> {
  await sql(`DELETE FROM pending_actions WHERE conversation_id = $1`, [conversation_id]);
}

/** Slot ISO an toàn: `daysFromNow` ngày kể từ `FIXED_SIM_NOW` (KHÔNG kể từ
 *  giờ thật của máy chạy — BB-02, tất định), giờ ICT do `hourIct` chọn. */
export function futureSlotIso(daysFromNow: number, hourIct = 10): string {
  const base = new Date(FIXED_SIM_NOW);
  const ms = base.getTime() + daysFromNow * 24 * 3600 * 1000;
  const d = new Date(ms);
  const utcHour = (hourIct - 7 + 24) % 24;
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.toISOString();
}

export function randomSessionId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
