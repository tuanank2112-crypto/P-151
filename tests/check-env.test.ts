// tests/check-env.test.ts — G31, OP-M11, P04-C9: hàm thuần
// `checkGoldenConcurrency` (scripts/check_env.mjs) chặn cứng khoảng [3,5],
// KHÔNG tự kẹp về biên (không được trả ok:true cho giá trị ngoài khoảng).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGoldenConcurrency, checkRequiredEnv } from "../scripts/check_env.mjs";

test("GOLDEN_CONCURRENCY=9 (trên biên) ⇒ ok:false, không kẹp về 5", () => {
  const r = checkGoldenConcurrency("9");
  assert.equal(r.ok, false);
  assert.equal(r.value, 9); // KHÔNG bị kẹp về 5
  assert.match(r.reason, /ngoài khoảng 3–5/);
});

test("GOLDEN_CONCURRENCY=1 (dưới biên) ⇒ ok:false, không kẹp về 3", () => {
  const r = checkGoldenConcurrency("1");
  assert.equal(r.ok, false);
  assert.equal(r.value, 1); // KHÔNG bị kẹp về 3
});

test("GOLDEN_CONCURRENCY=3 (biên dưới hợp lệ) ⇒ ok:true", () => {
  const r = checkGoldenConcurrency("3");
  assert.equal(r.ok, true);
  assert.equal(r.value, 3);
});

test("GOLDEN_CONCURRENCY=5 (biên trên hợp lệ) ⇒ ok:true", () => {
  const r = checkGoldenConcurrency("5");
  assert.equal(r.ok, true);
  assert.equal(r.value, 5);
});

test("GOLDEN_CONCURRENCY=4 (mặc định) ⇒ ok:true", () => {
  const r = checkGoldenConcurrency("4");
  assert.equal(r.ok, true);
  assert.equal(r.value, 4);
});

test("GOLDEN_CONCURRENCY=abc (không phải số nguyên) ⇒ ok:false", () => {
  const r = checkGoldenConcurrency("abc");
  assert.equal(r.ok, false);
});

test("GOLDEN_CONCURRENCY=4.5 (không nguyên) ⇒ ok:false", () => {
  const r = checkGoldenConcurrency("4.5");
  assert.equal(r.ok, false);
});

test("checkRequiredEnv: đủ 6 biến ⇒ missing rỗng", () => {
  const env = {
    DATABASE_URL: "x",
    GEMINI_API_KEY: "x",
    SESSION_SECRET: "x",
    RETRIEVAL_MODE: "hybrid",
    SEED_RESIDENT_PASSWORD: "x",
    SEED_BQL_PASSWORD: "x",
  };
  const r = checkRequiredEnv(env);
  assert.equal(r.total, 6);
  assert.equal(r.present, 6);
  assert.deepEqual(r.missing, []);
});

test("checkRequiredEnv: thiếu GEMINI_API_KEY ⇒ liệt kê đúng tên, không in giá trị biến khác", () => {
  const env = {
    DATABASE_URL: "x",
    SESSION_SECRET: "x",
    RETRIEVAL_MODE: "hybrid",
    SEED_RESIDENT_PASSWORD: "x",
    SEED_BQL_PASSWORD: "x",
  };
  const r = checkRequiredEnv(env);
  assert.equal(r.present, 5);
  assert.deepEqual(r.missing, ["GEMINI_API_KEY"]);
});
