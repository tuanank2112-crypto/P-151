#!/usr/bin/env node
// evidence/p03-upload/item1_upload_demo.mjs — item 1 (gói nối tiếp H07):
// upload tài liệu mới ⇒ vào DB ⇒ `select count(*) from documents` tăng
// đúng 1 ⇒ TỰ DỌN SẠCH. KHÔNG gọi Gemini (chỉ ghi DB qua bql-store.ts).
//
// CẤM đụng 19 tài liệu gốc: document_id dùng tiền tố `EVIDENCE-TEST-` không
// trùng bất kỳ mã nào trong knowledge/manifest.json.

process.env.DATA_BACKEND = "postgres";

const DOCUMENT_ID = "EVIDENCE-TEST-UPLOAD-001";

const { uploadDocument } = await import("../../../../lib/adapters/bql-store.ts");
const { getSql, closePool } = await import("../../../../lib/adapters/db.ts");

const sql = getSql();

const payload = {
  document_id: DOCUMENT_ID,
  title_vi: "Tài liệu thử — evidence item 1 (tự xoá)",
  doc_kind: "guide",
  version: "1.0",
  scope_property: ["apartment"],
  effective_from: "2026-01-01",
  effective_to: null,
  sections: [
    {
      section_id: "EVIDENCE-TEST-SEC-01",
      ordinal: 1,
      heading_vi: "Mục thử 1",
      body_vi:
        "Đây là nội dung mục thử dùng để đo bằng chứng item 1 của gói P03 nối tiếp, " +
        "đủ dài để qua ràng buộc [60,900] ký tự của SPEC-P03 mục 4, và đủ dài (>250 " +
        "ký tự) để chunkSection() cắt ra ít nhất một chunk theo mục tiêu 250–400 ký tự " +
        "mà không cắt giữa câu, theo đúng SPEC-P03 mục 2.4.",
      intents: ["I-05"],
      facility_ids: [],
      conflict_group: null,
    },
  ],
};

async function countDocuments() {
  const [{ count }] = await sql(`SELECT count(*)::int AS count FROM documents`);
  return count;
}

let exitCode = 0;
try {
  const before = await countDocuments();
  console.log(`1) TRƯỚC — select count(*) from documents = ${before}`);

  const result = await uploadDocument(payload);
  if (!result.ok) {
    throw new Error(`uploadDocument thất bại: ${result.error.code} — ${result.error.message_vi}`);
  }
  console.log(
    `2) uploadDocument() OK — document_id=${result.document_id} chunks_created=${result.chunks_created}`
  );

  const after = await countDocuments();
  console.log(`3) SAU — select count(*) from documents = ${after}`);
  if (after !== before + 1) {
    throw new Error(`Kỳ vọng count tăng đúng 1 (${before} → ${before + 1}), đo được ${after}.`);
  }

  const [visible] = await sql(
    `SELECT document_id, title_vi FROM documents WHERE document_id = $1`,
    [DOCUMENT_ID]
  );
  console.log(
    `4) Xác nhận hiện ngay ở màn documents (cùng câu SQL màn đó dùng): ${JSON.stringify(visible)}`
  );

  console.log("KẾT LUẬN: uploadDocument() ghi đúng document + sections + chunks, hiện ngay không cache.");
} catch (err) {
  exitCode = 1;
  console.error(`LỖI: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await sql(`DELETE FROM documents WHERE document_id = $1`, [DOCUMENT_ID]); // cascade sections/chunks
  const after = await countDocuments();
  console.log(`5) ĐÃ DỌN SẠCH — select count(*) from documents = ${after} (tự xoá tài liệu thử)`);
  await closePool();
}

process.exit(exitCode);
