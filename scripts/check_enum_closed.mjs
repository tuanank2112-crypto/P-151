#!/usr/bin/env node
// scripts/check_enum_closed.mjs — G16, C-M2, BB-09
// (TESTING-ACCEPTANCE.md §4.2/§7.2, 01-CONTRACTS.md §2/§10, 00-ARCHITECTURE.md
// §"BB-09 — Enum reason code là đóng").
//
// Chứng minh HAI điều bằng máy, trong MỘT transaction luôn ROLLBACK:
//   1. `REASON_CODES` (lib/types.ts) và enum `reason_code` thật trong Postgres
//      là CÙNG một tập 15 mã (không lệch, không thiếu, không thừa).
//   2. Postgres THẬT SỰ từ chối một mã lạ khi INSERT vào cột kiểu
//      `reason_code` của bảng `answer_turns` — không phải suy luận, không
//      phải mock. Đây là loại test dễ viết sai thành luôn xanh (TESTING §4.2).
//
// Mã thoát: 0 = enum khớp + Postgres từ chối mã lạ · 1 = lệch/không bị từ
// chối · 2 = sai tham số/thiếu biến môi trường · 3 = chưa kết luận được
// (không tới được DB).
//
// VÙNG CẤM: KHÔNG để lại dữ liệu trong DB — mọi INSERT nằm trong transaction
// và luôn ROLLBACK ở `finally`, kể cả khi script ném lỗi giữa chừng.

import { pg } from "./_pg.mjs";
import { loadLocalEnv, requireEnv } from "./_batch.mjs";
import { REASON_CODES } from "../lib/types.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);

const INVALID_CODE = "khong_ton_tai_xyz";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error(`chưa kết luận được: không kết nối được DB — ${e.message}`);
    process.exit(3);
  }

  let exitCode = 3;
  let line = "";

  try {
    await client.query("BEGIN");

    // 1. Đối chiếu tập enum TS ↔ DB.
    const { rows } = await client.query("SELECT enum_range(NULL::reason_code) AS r");
    const dbCodes = rows[0].r.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
    const tsSet = new Set(REASON_CODES);
    const dbSet = new Set(dbCodes);
    const match =
      tsSet.size === dbSet.size && [...tsSet].every((c) => dbSet.has(c));

    // 2. Thử INSERT mã lạ vào cột reason_code thật của answer_turns, kỳ vọng
    //    Postgres ném `invalid input value for enum reason_code`.
    let rejected = false;
    let rejectDetail = "";
    try {
      const u = await client.query(
        "INSERT INTO users (email, password_hash, role, display_name) VALUES ($1, 'x', 'resident', 'g16-tmp') RETURNING id",
        [`g16-${Date.now()}-${Math.random().toString(36).slice(2)}@tmp.local`]
      );
      const c = await client.query(
        "INSERT INTO conversations (user_id) VALUES ($1) RETURNING id",
        [u.rows[0].id]
      );
      const m = await client.query(
        "INSERT INTO messages (conversation_id, role, content_vi) VALUES ($1, 'user', 'g16-tmp') RETURNING id",
        [c.rows[0].id]
      );
      await client.query(
        `INSERT INTO answer_turns (conversation_id, user_message_id, question_vi, lifecycle_state, decision, reason_code)
         VALUES ($1, $2, 'g16-tmp', 'failed', 'escalate', $3)`,
        [c.rows[0].id, m.rows[0].id, INVALID_CODE]
      );
    } catch (e) {
      rejected = /invalid input value for enum reason_code/.test(e.message);
      rejectDetail = e.message;
    }

    if (rejected && match) {
      exitCode = 0;
      line = `rejected: invalid input value for enum reason_code · enum_ts=${tsSet.size} · enum_db=${dbSet.size} · match: ${match}`;
    } else {
      exitCode = 1;
      const why = rejected
        ? ""
        : ` · KHÔNG bị từ chối đúng cách (${rejectDetail || "Postgres không ném lỗi"})`;
      line = `rejected: ${rejected} · enum_ts=${tsSet.size} · enum_db=${dbSet.size} · match: ${match}${why}`;
    }
  } catch (e) {
    exitCode = 3;
    line = `chưa kết luận được: ${e.message}`;
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      // đã rollback hoặc connection hỏng — không phải lỗi cần chặn thoát
    }
    client.release();
    await pool.end();
  }

  if (exitCode === 0) {
    console.log(line);
  } else {
    console.error(line);
  }
  process.exit(exitCode);
}

await main();
