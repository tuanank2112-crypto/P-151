#!/usr/bin/env node
// scripts/validate_golden.mjs — kiểm quy mô & độ phủ của Golden Dataset (P00 §6, §8).
// Exit 0 = PASS. Exit 1 = có lỗi. Exit 2 = sai cách dùng.
//
// Đường dẫn theo SPEC-P00 §2: evals/golden/*.jsonl.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? ".";
const GDIR = path.join(ROOT, "evals", "golden");
const FAQ_FILE = path.join(GDIR, "golden_faq.jsonl");
const SAFETY_FILE = path.join(GDIR, "golden_safety.jsonl");

const EXPECT_FAQ = 50, EXPECT_FAQ_ANSWERABLE = 40, EXPECT_SAFETY = 16;
const CANONICAL_CODES = [
  "pii_or_account_specific", "legal_or_compensation_escalation", "unsupported_intent",
  "intent_unresolved", "no_eligible_source", "source_conflict",
  "source_expired_or_unknown", "system_error", "emergency_or_life_safety",
  "reviewer_rejected_draft",
];

const errors = [];
const fail = (code, msg) => errors.push(`${code}: ${msg}`);

function readJsonl(p) {
  if (!fs.existsSync(p)) { fail("GoldenCountError", `thiếu file: ${p}`); return []; }
  const lines = fs.readFileSync(p, "utf8").split("\n").map(l => l.trim()).filter(Boolean);
  const rows = [];
  for (const l of lines) {
    try { rows.push(JSON.parse(l)); }
    catch (e) { fail("GoldenCountError", `${p}: dòng lỗi JSON — ${e.message}`); }
  }
  return rows;
}

const faq = readJsonl(FAQ_FILE);
const safety = readJsonl(SAFETY_FILE);

if (faq.length !== EXPECT_FAQ) fail("GoldenCountError", `golden_faq.jsonl = ${faq.length} dòng, expected ${EXPECT_FAQ}`);
if (safety.length !== EXPECT_SAFETY) fail("GoldenCountError", `golden_safety.jsonl = ${safety.length} dòng, expected ${EXPECT_SAFETY}`);

const answerable = faq.filter(r => r.kind === "answerable");
if (answerable.length !== EXPECT_FAQ_ANSWERABLE)
  fail("GoldenCountError", `answerable = ${answerable.length}, expected ${EXPECT_FAQ_ANSWERABLE}`);

// phủ 8 case/intent x 5 intent trong tập answerable
const perIntent = new Map();
for (const r of answerable) perIntent.set(r.intent, (perIntent.get(r.intent) ?? 0) + 1);
for (const intent of ["I-01", "I-02", "I-03", "I-04", "I-05"]) {
  const n = perIntent.get(intent) ?? 0;
  if (n !== 8) fail("CoverageError", `intent ${intent} có ${n} case answerable, expected 8`);
}

// case_id trùng
const seenIds = new Set();
for (const r of [...faq, ...safety]) {
  if (seenIds.has(r.case_id)) fail("GoldenCountError", `case_id trùng: ${r.case_id}`);
  seenIds.add(r.case_id);
}

// phủ 10 mã canonical trong bộ safety
const covered = new Set(safety.map(r => r.expected_reason_code).filter(Boolean));
const missing = CANONICAL_CODES.filter(c => !covered.has(c));
if (missing.length) fail("CoverageError", `thiếu mã canonical trong golden_safety: ${missing.join(", ")}`);

// nguyên tắc chống gian lận: escalate và clarify không thay thế nhau (khai báo đúng expected_decision)
for (const r of safety) {
  if (r.must_not_answer !== true) fail("CoverageError", `${r.case_id}: must_not_answer phải = true`);
}

const codesCovered = CANONICAL_CODES.length - missing.length;
console.log(
  `faq: ${faq.length} (answerable ${answerable.length}) · safety: ${safety.length} · canonical_codes_covered: ${codesCovered}/${CANONICAL_CODES.length}`
);
if (errors.length) { console.log(`errors: ${errors.length}`); errors.forEach(e => console.log(`  ${e}`)); }
process.exit(errors.length ? 1 : 0);
