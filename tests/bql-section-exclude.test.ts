// tests/bql-section-exclude.test.ts — H26 W4: SPEC-P03 §2.2 `setSectionExcluded`
// (cổng E-4 `lib/pipeline/eligibility.ts`).
//
// (a) `is_excluded=true` + note rỗng ⇒ `MissingExclusionNote`, KHÔNG chạm DB
//     (store trả lỗi TRƯỚC câu SQL — không cần Postgres cho ca này).
// (b) chạy thật trên Postgres: loại một mục có sẵn rồi đưa lại trong
//     `try/finally`, đọc lại `is_excluded` đúng, LUÔN khôi phục trạng thái
//     gốc (đọc giá trị gốc trước khi đổi) — không để lại dữ liệu đổi trong DB
//     (luật §4 handoff H26).
//
// Bằng chứng ĐỎ (luật §3 handoff): đã chạy lại ca (a) sau khi tạm thời bỏ
// điều kiện chặn note rỗng trong `setSectionExcluded`
// (`lib/adapters/bql-store.ts`), dán output đỏ vào
// evidence/h26-section-exclude/red.txt trước khi phục hồi mã gốc.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { setSectionExcluded } from "../lib/adapters/bql-store.ts";
import { getSql } from "../lib/adapters/db.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);

test("setSectionExcluded: is_excluded=true + note rỗng ⇒ MissingExclusionNote, không chạm DB", async () => {
  const result = await setSectionExcluded({
    section_id: "__H26-KHONG-TON-TAI__",
    is_excluded: true,
    exclusion_note_vi: "   ",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "MissingExclusionNote");
  }
});

test("setSectionExcluded (Postgres thật): loại rồi đưa lại một mục, khôi phục nguyên trạng", async () => {
  const sql = getSql();
  const SECTION_ID = "POOL-SAFE-03";
  const before = await sql<{ is_excluded: boolean; exclusion_note_vi: string | null }>(
    `SELECT is_excluded, exclusion_note_vi FROM sections WHERE section_id = $1`,
    [SECTION_ID]
  );
  assert.equal(before.length, 1, `Seed thiếu mục ${SECTION_ID} — chạy npm run db:seed:knowledge`);
  const original = before[0];

  try {
    const excluded = await setSectionExcluded({
      section_id: SECTION_ID,
      is_excluded: true,
      exclusion_note_vi: "H26 W4 — loại tạm để test, sẽ khôi phục ngay",
    });
    assert.equal(excluded.ok, true);

    const afterExclude = await sql<{ is_excluded: boolean; exclusion_note_vi: string | null }>(
      `SELECT is_excluded, exclusion_note_vi FROM sections WHERE section_id = $1`,
      [SECTION_ID]
    );
    assert.equal(afterExclude[0]?.is_excluded, true);
    assert.equal(afterExclude[0]?.exclusion_note_vi, "H26 W4 — loại tạm để test, sẽ khôi phục ngay");

    const restored = await setSectionExcluded({
      section_id: SECTION_ID,
      is_excluded: false,
      exclusion_note_vi: null,
    });
    assert.equal(restored.ok, true);

    const afterRestore = await sql<{ is_excluded: boolean; exclusion_note_vi: string | null }>(
      `SELECT is_excluded, exclusion_note_vi FROM sections WHERE section_id = $1`,
      [SECTION_ID]
    );
    assert.equal(afterRestore[0]?.is_excluded, false);
    assert.equal(afterRestore[0]?.exclusion_note_vi, null);
  } finally {
    // Khôi phục nguyên trạng gốc bất kể assert ở trên có ném lỗi hay không.
    await sql(
      `UPDATE sections SET is_excluded = $2, exclusion_note_vi = $3 WHERE section_id = $1`,
      [SECTION_ID, original.is_excluded, original.exclusion_note_vi]
    );
  }
});
