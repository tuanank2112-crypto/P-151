import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePropertyTypeArray } from "../lib/adapters/db.ts";
import {
  l2normalize,
  l2norm,
  EMBEDDING_MODEL,
  EMBEDDING_DIMS,
  GEMINI_BASE,
  MAX_CONCURRENCY,
  FORBIDDEN_MODELS,
  CLASSIFIER_RESPONSE_SCHEMA,
  RETRIEVER_RESPONSE_SCHEMA,
  VERIFIER_RESPONSE_SCHEMA,
  ClassifierOutputSchema,
  RetrieverOutputSchema,
  VerifierOutputSchema,
} from "../lib/adapters/model.ts";

test("l2normalize: vector chưa chuẩn hoá (|v|≈0.4345 ở 384 chiều, Đ20) trở thành |v|=1", () => {
  // Mô phỏng một vector 384 chiều có độ dài 0.4345 (số đo thật, so-cm9-cm11.txt).
  const dims = 384;
  const raw = Array.from({ length: dims }, () => 1);
  const target = 0.434527;
  const scale = target / l2norm(raw);
  const scaled = raw.map((x) => x * scale);
  assert.ok(Math.abs(l2norm(scaled) - target) < 1e-6, "fixture phải có |v|≈0.4345 trước khi chuẩn hoá");

  const normalized = l2normalize(scaled);
  const normAfter = l2norm(normalized);
  assert.ok(Math.abs(normAfter - 1) < 1e-9, `norm_after_l2 phải = 1.0000, được ${normAfter}`);
});

test("l2normalize: vector 0 trả về nguyên vẹn, không chia cho 0", () => {
  const zero = [0, 0, 0];
  assert.deepEqual(l2normalize(zero), zero);
});

test("hằng số embedding khớp 01-CONTRACTS §4.3 (Đ18)", () => {
  assert.equal(EMBEDDING_MODEL, "gemini-embedding-001");
  assert.equal(EMBEDDING_DIMS, 384);
  assert.equal(GEMINI_BASE, "https://generativelanguage.googleapis.com/v1beta");
});

test("MAX_CONCURRENCY giới hạn song song ra Gemini API (Đ19)", () => {
  assert.equal(MAX_CONCURRENCY, 4);
});

test("FORBIDDEN_MODELS liệt kê đúng hai model cấm (Đ17, C-09), KHÔNG nằm trong SupportedModel dùng thật", () => {
  assert.deepEqual([...FORBIDDEN_MODELS].sort(), ["gemini-3.7-flash", "gemini-3.8-flash"]);
});

test("schema-parity (T-PARITY, R12): responseSchema.required khớp khoá Zod cho cả 3 agent", () => {
  assert.deepEqual(
    [...CLASSIFIER_RESPONSE_SCHEMA.required].sort(),
    Object.keys(ClassifierOutputSchema.shape).sort()
  );
  assert.deepEqual(
    [...RETRIEVER_RESPONSE_SCHEMA.required].sort(),
    Object.keys(RetrieverOutputSchema.shape).sort()
  );
  assert.deepEqual(
    [...VERIFIER_RESPONSE_SCHEMA.required].sort(),
    Object.keys(VerifierOutputSchema.shape).sort()
  );
});

test("ĐỎ R12 (đã chạy tay, xem report): xoá một khoá khỏi required phải làm test trên fail — kiểm ngược bằng mảng cố ý thiếu", () => {
  const brokenRequired = CLASSIFIER_RESPONSE_SCHEMA.required.filter((k) => k !== "intent");
  assert.notDeepEqual([...brokenRequired].sort(), Object.keys(ClassifierOutputSchema.shape).sort());
});

// ── G23 (Đ29) — mảng ENUM từ `pg` về dưới dạng CHUỖI, không phải mảng ──────
// Trục khác hẳn các ca trên: không mock transport, chỉ ép đúng hình dạng dữ
// liệu mà driver thật trả về. Để nguyên chuỗi thì E-6 thành phép so chuỗi con.
test("parsePropertyTypeArray — chuỗi Postgres '{apartment}' thành mảng đúng 1 phần tử", () => {
  const out = parsePropertyTypeArray("{apartment}");
  assert.ok(Array.isArray(out), "phải là mảng, không phải chuỗi");
  assert.deepEqual(out, ["apartment"]);
  assert.equal(out.length, 1);
});

test("parsePropertyTypeArray — nhiều phần tử, có khoảng trắng và dấu nháy", () => {
  assert.deepEqual(parsePropertyTypeArray('{apartment, "villa" ,commercial}'), [
    "apartment",
    "villa",
    "commercial",
  ]);
});

test("parsePropertyTypeArray — mảng rỗng, null, giá trị lạ đều ra []", () => {
  assert.deepEqual(parsePropertyTypeArray("{}"), []);
  assert.deepEqual(parsePropertyTypeArray(null), []);
  assert.deepEqual(parsePropertyTypeArray("{khong_ton_tai}"), []);
});

test("parsePropertyTypeArray — mảng JS (đường Postgres đã parse sẵn) giữ nguyên", () => {
  assert.deepEqual(parsePropertyTypeArray(["villa"]), ["villa"]);
});

test("G23 ĐỎ — bẫy chuỗi con: chuỗi thô khớp nhầm, mảng đã chuẩn hoá thì không", () => {
  const raw = "{commercial}";
  // Đây chính là phép so mà `scopeMatches()` chạy ở E-6.
  assert.equal(raw.includes("al"), true, "chuỗi thô khớp nhầm mảnh 'al' của 'commercial'");
  assert.equal(parsePropertyTypeArray(raw).includes("al" as never), false);
  assert.equal(parsePropertyTypeArray(raw).includes("apartment"), false);
});
