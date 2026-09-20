// lib/adapters/db.ts — FILE DUY NHẤT trong app/ và lib/ được mở connection
// Postgres (BB-07, 00-ARCHITECTURE.md §9). CẤM tạo `lib/db/` hay bất kỳ module
// nào khác import driver Postgres — kiểm bằng
// `scripts/check_adapter_boundary.sh` (W7).
//
// Gói P01a KHÔNG gọi mạng: hàm ở đây chỉ được các route/action gọi lúc chạy
// (runtime), không có lời gọi nào ở top-level module nên `npm run build`
// không cần `DATABASE_URL`.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cachedSql: NeonQueryFunction<false, false> | null = null;

/**
 * Trả về hàm truy vấn Neon, tạo lười (lazy) đúng một lần. Ném lỗi rõ ràng khi
 * thiếu `DATABASE_URL` thay vì để driver ném lỗi khó hiểu.
 */
export function getSql(): NeonQueryFunction<false, false> {
  if (cachedSql) return cachedSql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL chưa được cấu hình. Xem specs/OPERATIONS.md §3."
    );
  }
  cachedSql = neon(url);
  return cachedSql;
}
