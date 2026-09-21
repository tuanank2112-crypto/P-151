#!/usr/bin/env node
// scripts/sql.mjs — dùng: node scripts/sql.mjs "select count(*) from documents"
// Bản thay thế `psql -c` (OPERATIONS.md §6) — máy dev không có psql.
//
// CẤM chạy script này trong gói P01a: cần DATABASE_URL, chủ tịch chưa cấp.
import { makeSql } from "./_pg.mjs";

const q = process.argv[2];
if (!q) {
  console.error('usage: node scripts/sql.mjs "<sql>"');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL chưa được cấu hình. Xem specs/OPERATIONS.md §3.");
  process.exit(2);
}

const sql = makeSql(process.env.DATABASE_URL);
try {
  const rows = await sql(q);
  if (rows.length === 0) {
    console.log("(0 rows)");
  } else {
    console.log(Object.keys(rows[0]).join(" | "));
    rows.forEach((r) => console.log(Object.values(r).join(" | ")));
  }
  process.exit(0);
} catch (e) {
  console.error(`SQL_ERROR: ${e.message}`);
  process.exit(1);
}
