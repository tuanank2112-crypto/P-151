#!/usr/bin/env node
// evidence/p03-upload/item2_version_demo.mjs — item 2 (gói nối tiếp H07):
// đổi version ⇒ truy hồi (tầng SQL, KHÔNG gọi Gemini) lấy bản MỚI, không
// lấy bản CŨ. SPEC-P03 §2.3.
//
// CẤM đụng 19 tài liệu gốc: dựng một tài liệu BASE riêng bằng uploadDocument
// (tiền tố EVIDENCE-TEST-), version nó, rồi xoá CẢ HAI ở cuối (cascade xoá
// sections/chunks). Không đọc/ghi bất kỳ document_id nào thuộc knowledge/manifest.json.

process.env.DATA_BACKEND = "postgres";

const BASE_ID = "EVIDENCE-TEST-VERSION-BASE-001";
const NEW_ID = "EVIDENCE-TEST-VERSION-NEXT-001";
const TSQUERY_EXPR = "hoi | dong | thu | nghiem | phien | ban"; // khớp cả body base lẫn version mới

const { uploadDocument, newDocumentVersion } = await import(
  "../../../../lib/adapters/bql-store.ts"
);
const { getSql, closePool } = await import("../../../../lib/adapters/db.ts");

const sql = getSql();

const basePayload = {
  document_id: BASE_ID,
  title_vi: "Tài liệu BASE thử — evidence item 2 (tự xoá)",
  doc_kind: "guide",
  version: "1.0",
  scope_property: ["apartment"],
  effective_from: "2026-01-01",
  effective_to: null,
  sections: [
    {
      section_id: "EVIDENCE-TEST-VERBASE-SEC-01",
      ordinal: 1,
      heading_vi: "Nội dung phiên bản BASE",
      body_vi:
        "Đây là nội dung phiên bản BASE dùng để đo bằng chứng item 2 hội đồng thử nghiệm " +
        "gói P03 nối tiếp, đủ dài để qua ràng buộc [60,900] ký tự của SPEC-P03 mục 4, và " +
        "chứa từ khoá riêng biệt BASEMARKERTOKEN để truy hồi phân biệt được với bản mới.",
      intents: ["I-05"],
      facility_ids: [],
      conflict_group: null,
    },
  ],
};

const newVersionSections = [
  {
    section_id: "EVIDENCE-TEST-VERNEXT-SEC-01",
    ordinal: 1,
    heading_vi: "Nội dung phiên bản MỚI",
    body_vi:
      "Đây là nội dung phiên bản MỚI dùng để đo bằng chứng item 2 hội đồng thử nghiệm " +
      "gói P03 nối tiếp, đủ dài để qua ràng buộc [60,900] ký tự của SPEC-P03 mục 4, và " +
      "chứa từ khoá riêng biệt NEXTMARKERTOKEN để truy hồi phân biệt được với bản cũ.",
    intents: ["I-05"],
    facility_ids: [],
    conflict_group: null,
  },
];

async function topDocForMarker(marker) {
  const rows = await sql(
    `SELECT c.document_id, d.effective_status,
            round(ts_rank_cd(c.tsv, to_tsquery('simple', public.immutable_unaccent($1)), 32)::numeric, 4) AS score
     FROM chunks c
     JOIN documents d ON d.document_id = c.document_id
     WHERE c.tsv @@ to_tsquery('simple', public.immutable_unaccent($1))
       AND c.document_id IN ($2, $3)
     ORDER BY score DESC
     LIMIT 1`,
    [marker, BASE_ID, NEW_ID]
  );
  return rows[0] ?? null;
}

let exitCode = 0;
try {
  const baseResult = await uploadDocument(basePayload);
  if (!baseResult.ok) {
    throw new Error(`uploadDocument (base) thất bại: ${baseResult.error.code} — ${baseResult.error.message_vi}`);
  }
  console.log(`1) Đã tạo tài liệu BASE thử: ${baseResult.document_id}`);

  const beforeVersion = await topDocForMarker("basemarkertoken");
  console.log(
    `2) TRƯỚC đổi version — truy vấn "BASEMARKERTOKEN" trả về document_id=${beforeVersion?.document_id ?? "—"}`
  );
  if (beforeVersion?.document_id !== BASE_ID) {
    throw new Error(`Bước 2 KHÔNG như kỳ vọng: cần document_id=${BASE_ID} trước khi version.`);
  }

  const versionResult = await newDocumentVersion({
    base_document_id: BASE_ID,
    new_document_id: NEW_ID,
    version: "2.0",
    sections: newVersionSections,
    actor_id: null,
  });
  if (!versionResult.ok) {
    throw new Error(`newDocumentVersion thất bại: ${versionResult.error.code} — ${versionResult.error.message_vi}`);
  }
  console.log(`3) newDocumentVersion() OK — superseded=${versionResult.superseded}`);

  const afterVersionOld = await topDocForMarker("basemarkertoken");
  const afterVersionNew = await topDocForMarker("nextmarkertoken");
  console.log(
    `4) SAU đổi version — truy vấn "NEXTMARKERTOKEN" trả về document_id=${afterVersionNew?.document_id ?? "—"} ` +
      `(kỳ vọng ${NEW_ID}); truy vấn "BASEMARKERTOKEN" vẫn còn TÌM THẤY ở bản cũ document_id=${afterVersionOld?.document_id ?? "—"} ` +
      `nhưng effective_status=${afterVersionOld?.effective_status ?? "—"} (kỳ vọng Expired, nên KHÔNG eligible nữa)`
  );
  if (afterVersionNew?.document_id !== NEW_ID) {
    throw new Error(`Bước 4 KHÔNG như kỳ vọng: truy hồi phải LẤY BẢN MỚI (${NEW_ID}), không phải bản cũ.`);
  }
  if (afterVersionOld?.effective_status !== "Expired") {
    throw new Error(`Bước 4 KHÔNG như kỳ vọng: bản cũ ${BASE_ID} phải chuyển effective_status=Expired.`);
  }

  const [baseRow] = await sql(
    `SELECT status, allowed_for_rag, supersedes FROM documents WHERE document_id = $1`,
    [BASE_ID]
  );
  const [newRow] = await sql(
    `SELECT status, effective_status, supersedes FROM documents WHERE document_id = $1`,
    [NEW_ID]
  );
  console.log(
    `5) Kiểm P03-C2 (CẤM allowed_for_rag=false cho bản cũ): base.status=${baseRow.status} ` +
      `base.allowed_for_rag=${baseRow.allowed_for_rag} · new.supersedes=${newRow.supersedes} (kỳ vọng ${BASE_ID})`
  );
  if (baseRow.allowed_for_rag !== true || baseRow.status !== "Approved") {
    throw new Error("Bước 5 KHÔNG như kỳ vọng: P03-C2 vi phạm (bản cũ bị đổi status/allowed_for_rag).");
  }
  if (newRow.supersedes !== BASE_ID) {
    throw new Error(`Bước 5 KHÔNG như kỳ vọng: new.supersedes phải là "${BASE_ID}".`);
  }

  console.log(
    "KẾT LUẬN: đổi version — truy hồi lấy bản MỚI, bản CŨ chuyển Expired (không eligible ở cổng E-2), " +
      "P03-C2 giữ nguyên (bản cũ vẫn Approved + allowed_for_rag=true)."
  );
} catch (err) {
  exitCode = 1;
  console.error(`LỖI: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await sql(`DELETE FROM documents WHERE document_id = ANY($1)`, [[BASE_ID, NEW_ID]]); // cascade
  const remaining = await sql(
    `SELECT document_id FROM documents WHERE document_id = ANY($1)`,
    [[BASE_ID, NEW_ID]]
  );
  console.log(`6) ĐÃ DỌN SẠCH — còn lại trong DB: ${JSON.stringify(remaining.map((r) => r.document_id))}`);
  await closePool();
}

process.exit(exitCode);
