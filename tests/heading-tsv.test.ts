// tests/heading-tsv.test.ts — Đ59 / G53 (H30): tiêu đề mục vào chỉ mục tìm kiếm.
//
// Ba thứ được canh:
//  1. Kho mock cộng điểm khớp tiêu đề ⇒ câu hỏi khớp gần nguyên văn tiêu đề
//     "Khung giờ được phép chuyển đồ" đưa MOVE-TIME-03 vào top TOP_K (trước Đ59:
//     hạng 13 trên Postgres thật, ngoài top 8 ở mock).
//  2. Migration 007 dựng `tsv` = tiêu đề trọng số A || nội dung trọng số mặc định
//     (CẤM setweight cho nội dung — giữ điểm câu không khớp tiêu đề như cũ),
//     bỏ dấu bằng `public.immutable_unaccent` (G18).
//  3. MỌI câu `INSERT INTO chunks` trong lib/ và scripts/ ghi `heading_vi`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMockDataStore } from "../lib/adapters/store-mock.ts";
import { DEFAULT_TOP_K } from "../lib/retrieval/query.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Đ59 mock: 'Khung giờ nào được phép chuyển đồ ra vào Tòa nhà?' ⇒ MOVE-TIME-03 trong top 8", async () => {
  const store = createMockDataStore();
  const rows = await store.searchLexical("Khung giờ nào được phép chuyển đồ ra vào Tòa nhà?", DEFAULT_TOP_K);
  const ids = rows.map((r) => r.section_id);
  assert.ok(ids.includes("MOVE-TIME-03"), `MOVE-TIME-03 không có trong top ${DEFAULT_TOP_K}: ${ids.join(",")}`);
  for (const r of rows) assert.ok(r.score > 0 && r.score < 1, `score ngoài (0,1): ${r.score}`);
});

// Ghi chú: CONS-TIME-03 ("Thi công sửa chữa căn hộ … khung giờ nào?") KHÔNG canh ở
// mock — bộ lọc "từ khoá IDF cao" của mock loại nó trước khi tính điểm (ngoài phạm
// vi H30). Trên Postgres thật nó lên hạng 1 sau 007 (evidence/h30-heading-tsv/after.txt).

test("Đ59 migration 007: tsv = heading (A) || content (mặc định), dùng immutable_unaccent", () => {
  const sql = readFileSync(path.join(ROOT, "db/migrations/007_chunk_heading_tsv.sql"), "utf8");
  const code = sql.replace(/--.*$/gm, "");
  assert.match(code, /ADD COLUMN IF NOT EXISTS heading_vi text NOT NULL DEFAULT ''/);
  assert.match(code, /UPDATE chunks c\s+SET heading_vi = s\.heading_vi\s+FROM sections s/);
  assert.match(
    code,
    /setweight\(to_tsvector\('simple', public\.immutable_unaccent\(heading_vi\)\), 'A'\)\s*\|\|\s*to_tsvector\('simple', public\.immutable_unaccent\(content_vi\)\)/
  );
  assert.doesNotMatch(code, /setweight\([^)]*content_vi/, "CẤM setweight cho nội dung");
  assert.doesNotMatch(code, /[^.]\bunaccent\(/, "G18: chỉ dùng public.immutable_unaccent");
  assert.match(code, /CREATE INDEX chunks_tsv_idx ON chunks USING gin\(tsv\)/);
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

test("Đ59: mọi INSERT INTO chunks trong lib/ và scripts/ đều ghi heading_vi", () => {
  const files = [...walk(path.join(ROOT, "lib")), ...walk(path.join(ROOT, "scripts"))];
  let found = 0;
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(/INSERT INTO chunks\s*\(([^)]*)\)/g)) {
      found += 1;
      assert.match(m[1], /\bheading_vi\b/, `${path.relative(ROOT, f)}: INSERT INTO chunks thiếu heading_vi`);
    }
  }
  assert.ok(found >= 3, `chỉ thấy ${found} câu INSERT INTO chunks (kỳ vọng ≥ 3)`);
});
