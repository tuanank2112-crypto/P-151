import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLexicalQuery, buildTsQueryExpr, DEFAULT_TOP_K } from "../lib/retrieval/query.ts";

test("buildLexicalQuery sinh chuỗi SQL có ts_rank_cd(..., 32) — cờ chuẩn hoá bắt buộc (C-05)", () => {
  const { text, params } = buildLexicalQuery("bể bơi mở cửa mấy giờ");
  assert.match(
    text,
    /ts_rank_cd\(c\.tsv, to_tsquery\('simple', public\.immutable_unaccent\(\$1\)\), 32\)/
  );
  // Đ25 — hàm chuẩn hoá dấu phải TRÙNG hàm sinh `chunks.tsv` ở
  // `db/migrations/003_knowledge.sql`, nếu không tsquery và tsvector chuẩn hoá
  // khác nhau và WHERE lặng lẽ không khớp gì. `unaccent()` trần KHÔNG dùng được
  // trong cột GENERATED (nó là STABLE, không IMMUTABLE).
  assert.doesNotMatch(text, /[^.]\bunaccent\(/);
  assert.equal(params[0], "bể | bơi | mở | cửa | mấy | giờ");
  assert.equal(params[1], DEFAULT_TOP_K);
});

// ── G22 (Đ32) — AND giết hết kết quả, phải là OR ──────────────────────────
// Đo trên DB thật 2026-09-21: `plainto_tsquery` nối AND ⇒ truy vấn đã chuẩn
// hoá của A1 ("điều kiện trẻ em dưới 12 tuổi sử dụng bể bơi") trả 0 dòng, dù
// "trẻ em bể bơi" trả 2 dòng. Mọi câu hỏi đi qua A1 đều thành
// `no_eligible_source` — RAG trông như không có tài liệu.

test("G22 ĐỎ — SQL KHÔNG được dùng plainto_tsquery (ngữ nghĩa AND)", () => {
  const { text } = buildLexicalQuery("điều kiện trẻ em dưới 12 tuổi sử dụng bể bơi");
  assert.doesNotMatch(
    text,
    /plainto_tsquery/,
    "plainto_tsquery đòi chunk chứa ĐỦ mọi từ — truy vấn dài của A1 sẽ không khớp gì"
  );
});

test("buildTsQueryExpr nối các từ bằng toán tử OR", () => {
  assert.equal(buildTsQueryExpr("trẻ em bể bơi"), "trẻ | em | bể | bơi");
});

test("buildTsQueryExpr giữ dấu thanh (để immutable_unaccent bỏ dấu cho CẢ HAI phía)", () => {
  assert.match(buildTsQueryExpr("giờ mở cửa"), /giờ/);
});

test("buildTsQueryExpr loại mọi toán tử tsquery đến từ người dùng — không mở đường injection", () => {
  const expr = buildTsQueryExpr("bể & bơi | !xoá <-> (a:b) 'x'");
  assert.doesNotMatch(expr, /[&!<>():']/, `còn sót toán tử: ${expr}`);
  assert.equal(expr, "bể | bơi | xoá | a | b | x");
});

test("buildTsQueryExpr trả chuỗi rỗng khi không còn từ nào — caller coi là tập rỗng", () => {
  assert.equal(buildTsQueryExpr("   ??? !!!  "), "");
  assert.equal(buildTsQueryExpr(""), "");
});

test("buildLexicalQuery nhận topK tuỳ chỉnh", () => {
  const { params } = buildLexicalQuery("phí quản lý", 3);
  assert.equal(params[1], 3);
});
