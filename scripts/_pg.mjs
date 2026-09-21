// scripts/_pg.mjs — driver Postgres dùng chung cho các script vận hành CLI
// (`migrate`, `seed_*`, `sql`, `dump_schema`). Đ25.
//
// Vì sao tồn tại: `lib/adapters/db.ts` là file DUY NHẤT được mở connection
// TRONG `app/` và `lib/` (BB-07) — `scripts/` nằm ngoài phạm vi đó và không
// import được file `.ts` trong mọi ngữ cảnh, nên gom về đây một chỗ thay vì
// rải `new pg.Pool(...)` khắp 5 script. Chữ ký `sql(text, params)` giữ y hệt
// bản cũ chạy trên `@neondatabase/serverless` để không script nào phải đổi
// thân hàm.
//
// Đ25 — `pg` nói chuyện được với MỌI Postgres chuẩn (Supabase, Neon, tự dựng).
// Với script CLI chạy một lần rồi thoát thì nối cổng trực tiếp (`5432`) hay
// pooler (`6543`) đều được; đường phục vụ request trên serverless thì BẮT BUỘC
// pooler — xem chú thích `getSql()` trong `lib/adapters/db.ts`.

import pg from "pg";

/**
 * Tạo hàm truy vấn `sql(text, params) -> rows`, kèm `sql.end()` để đóng pool.
 * @param {string} url chuỗi kết nối Postgres
 */
export function makeSql(url) {
  const pool = new pg.Pool({
    connectionString: url,
    max: 3,
    connectionTimeoutMillis: 15_000,
  });
  const sql = async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows;
  };
  sql.end = () => pool.end();
  sql.pool = pool;
  return sql;
}

export { pg };
