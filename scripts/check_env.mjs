#!/usr/bin/env node
// scripts/check_env.mjs — OP-M3, OP-M11, G31 (specs/OPERATIONS.md §3/§10/§13,
// specs/SPEC-P04-Eval-Dashboard.md P04-C9, 00-ARCHITECTURE.md BB-09 lân cận).
//
// Không cờ: kiểm đủ 6 biến môi trường BẮT BUỘC theo bảng §3 của OPERATIONS.md
// (cột "Bắt buộc" = ✅): DATABASE_URL, GEMINI_API_KEY, SESSION_SECRET,
// RETRIEVAL_MODE, SEED_RESIDENT_PASSWORD, SEED_BQL_PASSWORD. KHÔNG in giá trị
// — chỉ in tên biến còn thiếu (OP-C6/OP-C13).
//
// Cờ `--reject-out-of-range NAME=VALUE`: hiện tại chỉ hỗ trợ
// `GOLDEN_CONCURRENCY` — chặn cứng khoảng [3,5] nguyên (OP-C5, P04-C9).
// Ngoài khoảng hoặc không phải số nguyên ⇒ exit 1, KHÔNG tự kẹp về biên.
//
// Mã thoát: 0 đạt · 1 trượt (thiếu biến, hoặc giá trị ngoài khoảng) ·
// 2 sai tham số (cờ không hợp lệ) · 3 không dùng ở script này.

import { loadLocalEnv } from "./_batch.mjs";

loadLocalEnv();

const REQUIRED_VARS = [
  "DATABASE_URL",
  "GEMINI_API_KEY",
  "SESSION_SECRET",
  "RETRIEVAL_MODE",
  "SEED_RESIDENT_PASSWORD",
  "SEED_BQL_PASSWORD",
];

/** Khoảng hợp lệ cho GOLDEN_CONCURRENCY (OP-C5, P04-C9): nguyên, đóng [3,5]. */
export const GOLDEN_CONCURRENCY_MIN = 3;
export const GOLDEN_CONCURRENCY_MAX = 5;

/**
 * Kiểm một giá trị GOLDEN_CONCURRENCY có nằm trong khoảng hợp lệ không.
 * Hàm THUẦN, tách riêng để test import được (không đụng process.env/exit).
 * @param {string} rawValue chuỗi giá trị (từ env hoặc CLI)
 * @returns {{ ok: true, value: number } | { ok: false, value: number | null, reason: string }}
 */
export function checkGoldenConcurrency(rawValue) {
  const n = Number(rawValue);
  if (!Number.isInteger(n)) {
    return {
      ok: false,
      value: Number.isFinite(n) ? n : null,
      reason: `GOLDEN_CONCURRENCY=${rawValue} không phải số nguyên (OP-C5, P04-C9)`,
    };
  }
  if (n < GOLDEN_CONCURRENCY_MIN || n > GOLDEN_CONCURRENCY_MAX) {
    return {
      ok: false,
      value: n,
      reason: `GOLDEN_CONCURRENCY=${n} ngoài khoảng ${GOLDEN_CONCURRENCY_MIN}–${GOLDEN_CONCURRENCY_MAX} (OP-C5, P04-C9)`,
    };
  }
  return { ok: true, value: n };
}

/** Kiểm danh sách biến bắt buộc có mặt trong `env`. Không in giá trị. */
export function checkRequiredEnv(env, required = REQUIRED_VARS) {
  const missing = required.filter((k) => !env[k]);
  return { total: required.length, present: required.length - missing.length, missing };
}

function main() {
  const args = process.argv.slice(2);
  const rejectFlagIdx = args.findIndex((a) => a === "--reject-out-of-range");

  if (rejectFlagIdx !== -1) {
    const pair = args[rejectFlagIdx + 1];
    if (!pair || !pair.includes("=")) {
      console.error("usage: node scripts/check_env.mjs --reject-out-of-range NAME=VALUE");
      process.exit(2);
    }
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);

    if (name !== "GOLDEN_CONCURRENCY") {
      console.error(`--reject-out-of-range chỉ hỗ trợ GOLDEN_CONCURRENCY, nhận: ${name}`);
      process.exit(2);
    }

    const result = checkGoldenConcurrency(value);
    if (!result.ok) {
      console.error(result.reason);
      process.exit(1);
    }
    console.log(`GOLDEN_CONCURRENCY=${result.value} trong khoảng ${GOLDEN_CONCURRENCY_MIN}–${GOLDEN_CONCURRENCY_MAX}`);
    process.exit(0);
  }

  // Không cờ: kiểm biến bắt buộc theo OPERATIONS.md §3.
  const { total, present, missing } = checkRequiredEnv(process.env);
  if (missing.length > 0) {
    console.error(`required: ${present}/${total} present · thiếu: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`required: ${present}/${total} present`);
  process.exit(0);
}

// Chỉ chạy khi gọi trực tiếp (không chạy khi `eval_golden.mjs` import hàm
// thuần `checkGoldenConcurrency` từ file này).
import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
