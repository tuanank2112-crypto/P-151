#!/usr/bin/env node
// scripts/migrate.mjs — chạy các file db/migrations/*.sql theo thứ tự tên
// file. Dùng cho `npm run db:migrate` (OPERATIONS.md §4 bước 4).
//
// CẤM chạy script này trong gói P01a: cần DATABASE_URL, chủ tịch chưa cấp.
// `--down` chưa có bảng lịch sử migration để đảo ngược trong vòng 1.0.0 —
// in cảnh báo và thoát khác 0 thay vì âm thầm không làm gì.

// Dùng `Pool` (giao thức pg cổ điển qua websocket) chứ không dùng `neon()`
// (hàm truy vấn tham số hoá) vì mỗi file migration chứa NHIỀU câu lệnh SQL —
// giao thức truy vấn mở rộng của `neon()` không chạy được multi-statement.
import { Pool } from "@neondatabase/serverless";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

async function listMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((f) => f.endsWith(".sql")).sort();
}

async function main() {
  const down = process.argv.includes("--down");
  if (down) {
    console.error(
      "db:migrate:down chưa có bảng lịch sử migration trong vòng 1.0.0 — " +
        "rollback thủ công theo OPERATIONS.md §8."
    );
    process.exit(2);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL chưa được cấu hình. Xem specs/OPERATIONS.md §3.");
    process.exit(2);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const files = await listMigrationFiles();
    for (const file of files) {
      const fullPath = path.join(MIGRATIONS_DIR, file);
      const content = await readFile(fullPath, "utf8");
      console.log(`-- applying ${file}`);
      await pool.query(content);
    }
    console.log(`migrations applied: ${files.length}`);
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(`MIGRATE_ERROR: ${e.message}`);
  process.exit(1);
});
