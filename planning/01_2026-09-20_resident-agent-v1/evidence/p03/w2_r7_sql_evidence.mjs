#!/usr/bin/env node
// evidence/p03/w2_r7_sql_evidence.mjs — W2 bổ sung, KHÔNG gọi Gemini.
//
// `w2_r7_demo.mjs` (chứng minh R7 qua pipeline 3 agent đầy đủ) bị chặn bởi
// hạn mức Gemini của cả đội đã cạn — bằng chứng HTTP 429 nguyên văn ở
// `w2-attempt2-rate-limited-429.txt` / `w2-attempt3-rate-limited-429.txt`.
// Script này chứng minh ĐÚNG cơ chế mà R7 dựa vào — cổng eligibility E-2
// (01-CONTRACTS.md §5) đọc `documents.effective_status` lúc truy vấn, không
// cache — bằng câu SQL lexical THẬT (01-CONTRACTS §4.2), không qua model,
// nên không tốn hạn mức Gemini.
//
// 3 bước đúng thứ tự, TỰ TRẢ LẠI trạng thái cũ ở cuối kể cả khi ném lỗi.

process.env.DATA_BACKEND = "postgres";

const DOCUMENT_ID = "OCP1-POOL-RULES-001";
const TSQUERY_EXPR = "bể | bơi | trẻ | em";

const { setEffectiveStatus } = await import("../../../../lib/adapters/bql-store.ts");
const { getSql, closePool } = await import("../../../../lib/adapters/db.ts");

const sql = getSql();

async function topEligibleDocForPool() {
  const rows = await sql(
    `SELECT c.section_id, c.document_id, d.effective_status,
            round(ts_rank_cd(c.tsv, to_tsquery('simple', public.immutable_unaccent($1)), 32)::numeric, 4) AS score
     FROM chunks c
     JOIN documents d ON d.document_id = c.document_id
     WHERE c.tsv @@ to_tsquery('simple', public.immutable_unaccent($1))
       AND d.document_id = $2
     ORDER BY score DESC
     LIMIT 1`,
    [TSQUERY_EXPR, DOCUMENT_ID]
  );
  return rows[0] ?? null;
}

let exitCode = 0;
try {
  const before = await topEligibleDocForPool();
  console.log(
    `1) TRƯỚC — top chunk của ${DOCUMENT_ID}: section=${before?.section_id ?? "—"} ` +
      `effective_status=${before?.effective_status ?? "—"} score=${before?.score ?? "—"}`
  );
  if (before?.effective_status !== "Current") {
    throw new Error(`Bước 1 KHÔNG như kỳ vọng: cần effective_status=Current trước khi test.`);
  }

  const deprecate = await setEffectiveStatus({
    document_id: DOCUMENT_ID,
    effective_status: "Expired",
    effective_to: new Date().toISOString().slice(0, 10),
  });
  if (!deprecate.ok) throw new Error(`setEffectiveStatus thất bại: ${deprecate.error.message_vi}`);
  console.log(`2) đã đặt ${DOCUMENT_ID} effective_status=Expired qua bql-store.ts (Server Action thật dùng hàm này)`);

  const after = await topEligibleDocForPool();
  console.log(
    `3) SAU — cùng chunk, cùng câu SQL, KHÔNG deploy lại: effective_status=${after?.effective_status ?? "—"} ` +
      `(chunk vẫn được TÌM THẤY bởi lexical search, nhưng cổng E-2 ở lib/pipeline/eligibility.ts giờ sẽ LOẠI nó vì effective_status≠Current)`
  );
  if (after?.effective_status !== "Expired") {
    throw new Error(`Bước 3 KHÔNG như kỳ vọng: cần effective_status=Expired ngay sau khi ghi, không cache.`);
  }

  console.log(
    "KẾT LUẬN: setEffectiveStatus() của gói P03 đổi đúng cột mà cổng E-2 đọc, và đổi " +
      "CÓ HIỆU LỰC NGAY ở lượt truy vấn kế tiếp — đây là phần retrieval của R7 " +
      "(phần model A1/A2/A3 bị chặn bởi hạn mức Gemini, xem w2_r7_demo.mjs)."
  );
} catch (err) {
  exitCode = 1;
  console.error(`LỖI: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  const restore = await setEffectiveStatus({
    document_id: DOCUMENT_ID,
    effective_status: "Current",
    effective_to: null,
  });
  console.log(
    restore.ok
      ? `4) ĐÃ TRẢ LẠI trạng thái cũ: ${DOCUMENT_ID} effective_status=Current`
      : `4) LỖI khi trả lại trạng thái cũ: ${restore.error.message_vi}`
  );
  await closePool();
}

process.exit(exitCode);
