#!/usr/bin/env node
// scripts/seed_knowledge.mjs — nạp Knowledge Pack (P00, `knowledge/`) vào
// documents/sections/chunks (01-CONTRACTS.md §3, §4.3; OPERATIONS.md §5).
// Idempotent qua `ON CONFLICT ... DO UPDATE`; `--reset` xoá sạch ba bảng rồi
// seed lại (KHÔNG đụng users/conversations/...).
//
// CẤM chạy script này trong gói P01a: cần DATABASE_URL, chủ tịch chưa cấp.
// CHỈ ĐỌC `knowledge/` — không sửa, không ghi lại (CẤM chạm knowledge/**).

import { neon } from "@neondatabase/serverless";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(__dirname, "..", "knowledge");
const SECTIONS_DIR = path.join(KNOWLEDGE_DIR, "sections");

/** Đếm token thô bằng số từ cách nhau khoảng trắng — đủ dùng cho demo, không
 * phải bộ đếm token thật của model nào. */
function estimateTokenCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function loadManifest() {
  const raw = await readFile(path.join(KNOWLEDGE_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw);
}

async function loadSections(documentId) {
  const raw = await readFile(
    path.join(SECTIONS_DIR, `${documentId}.json`),
    "utf8"
  );
  return JSON.parse(raw);
}

async function resetTables(sql) {
  // CASCADE qua sections/chunks nhờ ON DELETE CASCADE ở 003_knowledge.sql.
  await sql("TRUNCATE documents CASCADE");
  console.log("reset: documents, sections, chunks đã xoá sạch");
}

async function upsertDocument(sql, doc) {
  await sql(
    `INSERT INTO documents (
       document_id, title_vi, doc_kind, version, status, effective_status,
       effective_from, effective_to, allowed_for_rag, scope_property,
       supersedes, source_note_vi
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (document_id) DO UPDATE SET
       title_vi = EXCLUDED.title_vi,
       doc_kind = EXCLUDED.doc_kind,
       version = EXCLUDED.version,
       status = EXCLUDED.status,
       effective_status = EXCLUDED.effective_status,
       effective_from = EXCLUDED.effective_from,
       effective_to = EXCLUDED.effective_to,
       allowed_for_rag = EXCLUDED.allowed_for_rag,
       scope_property = EXCLUDED.scope_property,
       supersedes = EXCLUDED.supersedes,
       source_note_vi = EXCLUDED.source_note_vi,
       updated_at = now()`,
    [
      doc.document_id,
      doc.title_vi,
      doc.doc_kind,
      doc.version,
      doc.status,
      doc.effective_status,
      doc.effective_from,
      doc.effective_to,
      doc.allowed_for_rag,
      doc.scope_property,
      doc.supersedes,
      doc.source_note_vi,
    ]
  );
}

async function upsertSection(sql, documentId, section) {
  await sql(
    `INSERT INTO sections (
       section_id, document_id, ordinal, heading_vi, body_vi,
       is_excluded, exclusion_note_vi, conflict_group, intents, facility_ids
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (section_id) DO UPDATE SET
       document_id = EXCLUDED.document_id,
       ordinal = EXCLUDED.ordinal,
       heading_vi = EXCLUDED.heading_vi,
       body_vi = EXCLUDED.body_vi,
       is_excluded = EXCLUDED.is_excluded,
       exclusion_note_vi = EXCLUDED.exclusion_note_vi,
       conflict_group = EXCLUDED.conflict_group,
       intents = EXCLUDED.intents,
       facility_ids = EXCLUDED.facility_ids`,
    [
      section.section_id,
      documentId,
      section.ordinal,
      section.heading_vi,
      section.body_vi,
      section.is_excluded,
      section.exclusion_note_vi,
      section.conflict_group,
      section.intents,
      section.facility_ids,
    ]
  );
}

/**
 * Nhúng vector chỉ khi RETRIEVAL_MODE=hybrid (01-CONTRACTS.md §4.3). Import
 * động để `lexical` (mặc định) không cần tải `@xenova/transformers`.
 * CẤM dùng Claude làm embedding (C-08) — không import `lib/adapters/anthropic.ts`
 * ở đây.
 */
async function embedIfHybrid(text) {
  if (process.env.RETRIEVAL_MODE !== "hybrid") return null;
  const { pipeline } = await import("@xenova/transformers");
  const embedder = await pipeline(
    "feature-extraction",
    "Xenova/multilingual-e5-small"
  );
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

async function upsertChunk(sql, section, documentId, chunkIndex, contentVi) {
  const tokenCount = estimateTokenCount(contentVi);
  const embedding = await embedIfHybrid(contentVi);
  await sql(
    `INSERT INTO chunks (section_id, document_id, chunk_index, content_vi, embedding, token_count)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (section_id, chunk_index) DO UPDATE SET
       content_vi = EXCLUDED.content_vi,
       embedding = EXCLUDED.embedding,
       token_count = EXCLUDED.token_count`,
    [section.section_id, documentId, chunkIndex, contentVi, embedding, tokenCount]
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL chưa được cấu hình. Xem specs/OPERATIONS.md §3.");
    process.exit(2);
  }

  const reset = process.argv.includes("--reset");
  const sql = neon(process.env.DATABASE_URL);
  const manifest = await loadManifest();

  if (reset) {
    await resetTables(sql);
  }

  let documentCount = 0;
  let sectionCount = 0;
  let chunkCount = 0;

  // Một transaction cho toàn bộ seed (OPERATIONS.md §5 "Một transaction").
  const statements = [];
  for (const doc of manifest.documents) {
    statements.push(() => upsertDocument(sql, doc));
    documentCount += 1;
  }

  // documents phải commit trước khi sections/chunks tham chiếu (FK) — chạy
  // tuần tự, không dùng sql.transaction() của neon (chỉ hỗ trợ tagged
  // template, không hỗ trợ vòng lặp thân tuỳ ý).
  for (const step of statements) {
    await step();
  }

  for (const doc of manifest.documents) {
    const sections = await loadSections(doc.document_id);
    for (const section of sections) {
      await upsertSection(sql, doc.document_id, section);
      sectionCount += 1;
      // Một section = một chunk trong vòng 1.0.0 (corpus ngắn, demo).
      await upsertChunk(sql, section, doc.document_id, 0, section.body_vi);
      chunkCount += 1;
    }
  }

  console.log(
    `documents=${documentCount} sections=${sectionCount} chunks=${chunkCount}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(`SEED_ERROR: ${e.message}`);
  process.exit(1);
});
