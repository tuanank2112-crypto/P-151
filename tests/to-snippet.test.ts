// tests/to-snippet.test.ts — Đ42 (R14 mục 1+2+3): `toSnippet()` phải giữ
// đúng hợp đồng `Citation.snippet_vi ≤ 300 ký tự` (01-CONTRACTS.md:514,
// nhắc lại :816). Trước bản vá này hàm sai HAI kiểu (301 ký tự khi không có
// dấu câu; 1–2 ký tự khi dấu câu nằm quá gần đầu chuỗi), và bộ test cũ
// (`tests/conflict-citations.test.ts`) KHÔNG canh được vì dữ liệu seed
// DEF-03 dài tối đa 200 ký tự ⇒ nhánh cắt chưa bao giờ chạy (R14 mục 3).
//
// CHỦ ĐỘNG dùng input tự dựng ở đây, KHÔNG dùng dữ liệu seed — đó chính là
// lý do assertion cũ rỗng nghĩa. Gọi THẲNG `toSnippet` (thuần, không cần
// DB/model) — không phải phần thuần.

import { test } from "node:test";
import assert from "node:assert/strict";
import { toSnippet } from "../lib/pipeline/index.ts";

test("toSnippet: ≤300 ký tự giữ nguyên, không đổi", () => {
  const input = "a".repeat(250);
  assert.equal(toSnippet(input), input);
  assert.equal(toSnippet(input).length, 250);
});

test("toSnippet: >300 ký tự, KHÔNG có dấu câu ⇒ cắt cứng kèm '…', đúng 300 ký tự (không phải 301)", () => {
  const input = "a".repeat(330); // không có . ? !
  const out = toSnippet(input);
  assert.equal(out.length, 300, `phải đúng 300 ký tự, được ${out.length}`);
  assert.ok(out.endsWith("…"));
});

test("toSnippet: dấu câu nằm SAU sàn 80 ⇒ cắt theo câu tại dấu câu đó", () => {
  // Câu đầu dài 150 ký tự (> sàn 80), kết bằng dấu chấm ở vị trí 149.
  const firstSentence = "a".repeat(149) + ".";
  const rest = "b".repeat(200); // đủ dài để tổng > 300
  const input = firstSentence + rest;
  const out = toSnippet(input);
  assert.equal(out, firstSentence, "phải cắt đúng tại dấu chấm của câu đầu");
  assert.ok(out.length <= 300);
});

test("toSnippet: dấu câu nằm TRƯỚC sàn 80 (vd văn bản đánh số '1. ...') ⇒ KHÔNG cắt theo câu, cắt cứng kèm '…' — không được trả về '1.' (2 ký tự)", () => {
  const input = "1." + "c".repeat(400); // dấu chấm ở vị trí 1, xa dưới sàn 80
  const out = toSnippet(input);
  assert.notEqual(out, "1.", "KHÔNG được trả về snippet 2 ký tự vô nghĩa");
  assert.ok(out.length > 80, `snippet phải dài hơn sàn 80, được ${out.length} ký tự: "${out}"`);
  assert.equal(out.length, 300);
  assert.ok(out.endsWith("…"));
});

test("toSnippet: chỉ MỘT dấu chấm ở vị trí 0 ('.' + 500 ký tự) ⇒ KHÔNG được trả về '.' (1 ký tự)", () => {
  const input = "." + "d".repeat(500);
  const out = toSnippet(input);
  assert.notEqual(out, ".", "KHÔNG được trả về snippet 1 ký tự vô nghĩa");
  assert.equal(out.length, 300);
});

test("toSnippet: đúng 300 ký tự ⇒ giữ nguyên (biên dưới của nhánh cắt)", () => {
  const input = "e".repeat(300);
  const out = toSnippet(input);
  assert.equal(out, input);
  assert.equal(out.length, 300);
});

test("toSnippet: đúng 301 ký tự, không dấu câu ⇒ cắt cứng còn đúng 300 ký tự (KHÔNG phải 301 — bug đã vá)", () => {
  const input = "f".repeat(301);
  const out = toSnippet(input);
  assert.equal(out.length, 300, `phải đúng 300 ký tự, được ${out.length} (bug cũ trả 301)`);
  assert.ok(out.endsWith("…"));
});
