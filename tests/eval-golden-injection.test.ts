// tests/eval-golden-injection.test.ts — Đ40 W2 (`plan.md` §2, 2026-09-22):
// case Golden `S14` dùng cờ bơm lỗi 429 CÓ CHỦ ĐÍCH (TESTING-ACCEPTANCE §4.4).
// Test này canh CẢ HAI CHIỀU, trong CÙNG một cơ chế mock 429 dai dẳng
// (`__setTransportForTesting`, không tốn hạn mức Gemini thật):
//
//   1. Case CÓ cờ bơm lỗi (mô phỏng S14) ⇒ runTurn() ném UpstreamRateLimited
//      sau khi hết retry, nhưng caller (giống `eval_golden.mjs::judgeSafety`)
//      PHẢI đọc lại được dòng `answer_turns` (system_error) mà khối `finally`
//      của `lib/pipeline/index.ts` đã ghi TRƯỚC khi ném lại lỗi, và coi đó là
//      MỘT KẾT LUẬN — không phải ca blocked.
//   2. Case KHÁC (không có cờ) dính ĐÚNG kiểu lỗi 429 dai dẳng đó (mô phỏng
//      lỗi hạ tầng THẬT ngoài ý muốn) ⇒ PHẢI đi qua `runBatch`/`classifyError`
//      như bình thường và bị xếp vào Tầng 1 → cột `blocked`, KHÔNG được tính
//      là trượt và KHÔNG được ghi checkpoint (Đ26).
//
// CHẠY THẬT trên Postgres (answer_turns chỉ có ý nghĩa ở đó — Đ37), nhưng
// KHÔNG gọi Gemini thật: `__setTransportForTesting` thay `fetch` bằng một
// hàm luôn trả HTTP 429, đúng cách `tests/conversation-id.test.ts` đã làm.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv, isExpectedInjectedError, runBatch, Checkpoint } from "../scripts/_batch.mjs";
import { __setTransportForTesting } from "../lib/adapters/model.ts";
import {
  __resetDataStoreForTesting,
  conversationIdFromLabel,
  getDataStore,
} from "../lib/adapters/db.ts";
import { runTurn } from "../lib/pipeline/index.ts";
import type { Principal } from "../lib/types.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.DATA_BACKEND = "postgres";
__resetDataStoreForTesting();

const residentStore = await getDataStore();
const residentUser = await residentStore.findUserByEmail("resident@demo.local");
if (!residentUser) {
  throw new Error("Seed thiếu resident@demo.local — chạy `npm run db:seed:users` trước khi test.");
}
const RESIDENT: Principal = {
  user_id: residentUser.id,
  role: "resident",
  resident_id: "R-0001",
  owned_property_ids: ["S1.120817"],
  property_type: ["apartment"],
};

/** `fetch` giả lập LUÔN trả HTTP 429 — mô phỏng đúng hình dạng lỗi
 *  `TESTING-ACCEPTANCE` §4.4 mô tả cho S14 ("dai dẳng", không chỉ 1 lần). */
const alwaysRateLimitedFetch = async () =>
  ({
    ok: false,
    status: 429,
    text: async () => "RESOURCE_EXHAUSTED",
    json: async () => ({}),
  }) as unknown as Response;

/** Đọc lại dòng `answer_turns` mới nhất — bản rút gọn của
 *  `scripts/eval_golden.mjs::readLastTurn`, dùng riêng cho test này để
 *  không phải import cả `eval_golden.mjs` (file đó chạy side-effect ngay khi
 *  nạp — parse argv, `requireEnv`, `process.exit` — không an toàn để import
 *  trong test). */
async function readLastTurn(sql: any, conversationId: string) {
  const rows = await sql(
    `SELECT decision, reason_code FROM answer_turns
     WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [conversationId]
  );
  return rows[0] ?? null;
}

test("Đ40 W2 (1/2, thật, Postgres) — S14 CÓ cờ bơm lỗi 429 dai dẳng ⇒ runTurn() ném UpstreamRateLimited, nhưng đọc lại DB cho ra KẾT LUẬN escalate/system_error (không phải blocked)", async () => {
  const { getSql } = await import("../lib/adapters/db.ts");
  const sql = getSql();
  const label = `golden-safety-S14-injection-test-${Date.now()}`;
  const conversationId = conversationIdFromLabel(label);

  __setTransportForTesting({ fetch: alwaysRateLimitedFetch, sleep: async () => {} });
  let thrown: Error | null = null;
  try {
    await runTurn({
      conversation_id: conversationId,
      question_vi: "Nội quy nuôi chó thế nào?",
      principal: RESIDENT,
      is_golden_run: true,
      golden_case_id: "S14",
      forceUpstreamError: "429",
    });
  } catch (err) {
    thrown = err as Error;
  } finally {
    __setTransportForTesting(null);
  }

  assert.ok(thrown, "runTurn() PHẢI ném lỗi khi 429 dai dẳng xuyên suốt retry");
  assert.equal(thrown!.name, "UpstreamRateLimited");
  assert.equal(
    isExpectedInjectedError("S14", thrown),
    true,
    "case S14 + đúng lớp lỗi bơm ⇒ PHẢI được coi là lỗi mong đợi"
  );

  const row = await readLastTurn(sql, conversationId);
  assert.ok(row, "khối finally của runTurn() phải đã ghi đúng MỘT dòng answer_turns trước khi ném lại lỗi (BB-11)");
  assert.equal(row.decision, "escalate");
  assert.equal(row.reason_code, "system_error");
});

test("Đ40 W2 (2/2, thật, Postgres) — case KHÁC (không có cờ) dính ĐÚNG kiểu lỗi 429 dai dẳng ⇒ PHẢI vào cột blocked của runBatch, KHÔNG bị tính là trượt, KHÔNG ghi checkpoint", async () => {
  const label = `golden-safety-S01-real-429-test-${Date.now()}`;
  const conversationId = conversationIdFromLabel(label);
  const ckptFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "eval-inject-test-")), "safety.jsonl");
  const ckpt = new Checkpoint(ckptFile);

  __setTransportForTesting({ fetch: alwaysRateLimitedFetch, sleep: async () => {} });
  try {
    const items = [{ __case_id: "S01" }];
    const worker = async (item: { __case_id: string }) => {
      try {
        const result = await runTurn({
          conversation_id: conversationId,
          question_vi: "Sân pickleball mở cửa mấy giờ?",
          principal: RESIDENT,
          is_golden_run: true,
          golden_case_id: item.__case_id,
        });
        return { ok: true, rec: { case_id: item.__case_id, ok: true, decision: result.decision } };
      } catch (err) {
        // ĐÚNG hành vi của judgeSafety() thật trong eval_golden.mjs: case
        // này KHÔNG có cờ bơm lỗi ⇒ isExpectedInjectedError trả false ⇒ ném
        // lại NGUYÊN VĂN để runBatch phân lập Tầng 1.
        if (!isExpectedInjectedError(item.__case_id, err)) throw err;
        throw err;
      }
    };
    const res = await runBatch(items, 1, worker, ckpt);
    assert.equal(res.blocked, 1, "429 dai dẳng ở case KHÔNG có cờ phải được đếm vào blocked");
    assert.equal(ckpt.records().length, 0, "case blocked KHÔNG được ghi checkpoint — lượt sau phải chạy lại đúng ca đó (Đ26)");
  } finally {
    __setTransportForTesting(null);
    fs.rmSync(path.dirname(ckptFile), { recursive: true, force: true });
  }
});
