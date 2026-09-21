#!/usr/bin/env node
// scripts/migrate.mjs — chạy các file db/migrations/*.sql theo thứ tự tên
// file, MỘT LẦN DUY NHẤT mỗi file (OPERATIONS.md §4 bước 4).
//
// Đ30 (2026-09-21) — trả nợ Đ15: trước đây script chạy LẠI toàn bộ file mỗi
// lượt, nên lượt thứ hai chết ở `CREATE TYPE ... already exists` và không có
// cách nào thêm một migration mới vào một DB đã chạy. Nay có bảng
// `schema_migrations`: mỗi file được ghi nhận sau khi áp dụng, lượt sau bỏ qua.
//
// Cờ:
//   (không cờ)   áp dụng các file CHƯA được ghi nhận, trong MỘT transaction/file
//   --status     chỉ in trạng thái từng file, không ghi gì
//   --baseline   ghi nhận các file là "đã áp dụng" mà KHÔNG chạy chúng. Dùng
//                đúng một lần, cho DB đã được migrate trước khi có bảng lịch
//                sử. CẤM dùng trên DB trống — sẽ đánh dấu khống.
//   --to=<file>  giới hạn --baseline tới file này (bao gồm nó). BẮT BUỘC dùng
//                khi trong thư mục đã có file CHƯA từng chạy trên DB đó, nếu
//                không sẽ đánh dấu khống đúng file mình đang muốn áp dụng.
//   --down       chưa có trong vòng 1.0.0, xem OPERATIONS.md §8.
//
// Dùng `Pool` trực tiếp chứ không dùng `makeSql()` vì mỗi file migration chứa
// NHIỀU câu lệnh SQL — giao thức truy vấn tham số hoá không chạy multi-statement.
import { pg } from "./_pg.mjs";
const { Pool } = pg;
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

const HISTORY_DDL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    text PRIMARY KEY,
    checksum   text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

async function listMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((f) => f.endsWith(".sql")).sort();
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function readAll(files) {
  const out = [];
  for (const file of files) {
    const content = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    out.push({ file, content, checksum: sha256(content) });
  }
  return out;
}

async function main() {
  if (process.argv.includes("--down")) {
    console.error(
      "db:migrate:down chưa có đường lùi đã kiểm chứng trong vòng 1.0.0 — " +
        "rollback thủ công theo OPERATIONS.md §8."
    );
    process.exit(2);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL chưa được cấu hình. Xem specs/OPERATIONS.md §3.");
    process.exit(2);
  }

  const status = process.argv.includes("--status");
  const baseline = process.argv.includes("--baseline");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let applied = 0;
  let skipped = 0;
  try {
    await pool.query(HISTORY_DDL);
    const recorded = new Map(
      (await pool.query("SELECT version, checksum FROM schema_migrations")).rows.map((r) => [
        r.version,
        r.checksum,
      ])
    );
    const migrations = await readAll(await listMigrationFiles());

    if (status) {
      for (const m of migrations) {
        const seen = recorded.get(m.file);
        const mark = !seen ? "CHƯA ÁP DỤNG" : seen === m.checksum ? "đã áp dụng" : "ĐÃ ÁP DỤNG (nội dung file ĐÃ ĐỔI kể từ đó)";
        console.log(`${m.file.padEnd(34)} ${mark}`);
      }
      process.exit(0);
    }

    if (baseline) {
      const toArg = process.argv.find((a) => a.startsWith("--to="));
      const upto = toArg ? toArg.slice("--to=".length) : null;
      if (upto && !migrations.some((m) => m.file === upto)) {
        console.error(`--to=${upto}: không có file này trong db/migrations/`);
        process.exit(2);
      }
      // Nhận một DB đã migrate sẵn: ghi nhận, KHÔNG chạy lại.
      const { rows } = await pool.query(
        "SELECT to_regclass('public.users') IS NOT NULL AS has_users"
      );
      if (!rows[0].has_users) {
        console.error(
          "--baseline từ chối chạy: DB chưa có bảng `users`, tức chưa từng migrate. " +
            "Chạy `npm run db:migrate` không cờ."
        );
        process.exit(2);
      }
      for (const m of migrations) {
        if (upto && m.file > upto) break;
        if (recorded.has(m.file)) {
          skipped++;
          continue;
        }
        await pool.query(
          "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
          [m.file, m.checksum]
        );
        console.log(`-- baseline ${m.file} (ghi nhận, KHÔNG chạy)`);
        applied++;
      }
      console.log(`baseline: ${applied} ghi nhận · ${skipped} đã có sẵn`);
      process.exit(0);
    }

    for (const m of migrations) {
      const seen = recorded.get(m.file);
      if (seen) {
        if (seen !== m.checksum) {
          console.warn(
            `-- CẢNH BÁO ${m.file}: đã áp dụng nhưng nội dung file đã đổi kể từ đó. ` +
              "Migration đã chạy KHÔNG được sửa — thêm file mới thay vì sửa file cũ."
          );
        }
        skipped++;
        continue;
      }
      console.log(`-- applying ${m.file}`);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(m.content);
        await client.query(
          "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
          [m.file, m.checksum]
        );
        await client.query("COMMIT");
        applied++;
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`${m.file}: ${e.message}`);
      } finally {
        client.release();
      }
    }
    console.log(`migrations applied: ${applied} · skipped: ${skipped}`);
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(`MIGRATE_ERROR: ${e.message}`);
  process.exit(1);
});
