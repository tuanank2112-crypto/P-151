import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLexicalQuery, DEFAULT_TOP_K } from "../lib/retrieval/query.ts";

test("buildLexicalQuery sinh chuỗi SQL có ts_rank_cd(..., 32) — cờ chuẩn hoá bắt buộc (C-05)", () => {
  const { text, params } = buildLexicalQuery("bể bơi mở cửa mấy giờ");
  assert.match(text, /ts_rank_cd\(c\.tsv, plainto_tsquery\('simple', unaccent\(\$1\)\), 32\)/);
  assert.equal(params[0], "bể bơi mở cửa mấy giờ");
  assert.equal(params[1], DEFAULT_TOP_K);
});

test("buildLexicalQuery nhận topK tuỳ chỉnh", () => {
  const { params } = buildLexicalQuery("phí quản lý", 3);
  assert.equal(params[1], 3);
});
