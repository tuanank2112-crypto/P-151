// lib/adapters/bql-store.ts — TẠO MỚI theo luật §2 handoff H07: mọi truy vấn
// của gói P03 (console BQL: vòng đời tài liệu R7 + hàng đợi HITL R8) nằm ở
// ĐÂY. Nằm trong lib/adapters/ nên hợp lệ với BB-07, nhưng CHỈ dùng getSql()
// của lib/adapters/db.ts — CẤM tự `new pg.Pool` (không import "pg" ở đây).
//
// BB-10: không hardcode tri thức — mọi nội dung tài liệu đọc từ bảng
// documents/sections lúc chạy. P02-C8: mọi lệnh ghi ở đây có hiệu lực NGAY
// với retrieval vì DataStore (db.ts) đọc thẳng các bảng này, không cache.

import { getSql } from "./db.ts";
import type {
  DocStatus,
  EffectiveStatus,
  ReasonCode,
  ReviewState,
} from "../types.ts";
import type { SessionPayload } from "../auth/session.ts";

// ─────────────────────────────────────────────────────────────────────────
// 0. Phân quyền — dùng chung cho mọi Server Action của gói (E5 AuthzError,
//    00-ARCHITECTURE.md §8). Hàm THUẦN, không chạm DB — action gọi nó TRƯỚC
//    khi đọc/ghi, không chỉ dựa vào app/(bql)/layout.tsx vì Server Action có
//    thể bị gọi trực tiếp, bỏ qua vòng render trang.
// ─────────────────────────────────────────────────────────────────────────

export type AuthzVerdict = { ok: true } | { ok: false; http_status: 401 | 403 };

export function checkBqlAuthz(session: SessionPayload | null): AuthzVerdict {
  if (!session) return { ok: false, http_status: 401 };
  if (session.role !== "bql") return { ok: false, http_status: 403 };
  return { ok: true };
}

/** H16 W2 — email hiển thị trên thanh nav BQL. `SessionPayload` chỉ giữ
 *  `user_id` (`lib/auth/session.ts`), nên tra ngược sang `email` ở đây thay
 *  vì mở rộng payload cookie (ngoài phạm vi gói này). `null` khi không tìm
 *  thấy — layout tự chọn cách hiển thị rỗng, không ném lỗi vỡ trang. */
export async function getUserEmail(userId: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId]);
  return rows[0]?.email ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Vòng đời tài liệu [R7] — SPEC-P03 §2
// ─────────────────────────────────────────────────────────────────────────

export interface DocumentConsoleRow {
  document_id: string;
  title_vi: string;
  doc_kind: string;
  version: string;
  status: DocStatus;
  effective_status: EffectiveStatus;
  effective_to: string | null;
  allowed_for_rag: boolean;
  section_count: number;
}

/** Danh sách đủ tài liệu cho màn `/documents` (W1). */
export async function listDocumentsForConsole(): Promise<DocumentConsoleRow[]> {
  const sql = getSql();
  const rows = await sql<
    Omit<DocumentConsoleRow, "section_count"> & { section_count: string | number }
  >(
    `SELECT d.document_id, d.title_vi, d.doc_kind, d.version, d.status,
            d.effective_status, d.effective_to, d.allowed_for_rag,
            count(s.section_id) AS section_count
     FROM documents d
     LEFT JOIN sections s ON s.document_id = d.document_id
     GROUP BY d.document_id, d.title_vi, d.doc_kind, d.version, d.status,
              d.effective_status, d.effective_to, d.allowed_for_rag
     ORDER BY d.document_id`
  );
  return rows.map((r) => ({ ...r, section_count: Number(r.section_count) }));
}

export type DocumentErrorCode =
  | "NotFound"
  | "InvalidDateRange"
  | "MissingExclusionNote"
  | "AuthzError"
  | "MissingField"
  | "BodyLength"
  | "DuplicateId"
  | "DuplicateSectionId"
  | "ChunkingFailed";

export interface DocumentError {
  code: DocumentErrorCode;
  message_vi: string;
}

function docErr(code: DocumentErrorCode, message_vi: string): { ok: false; error: DocumentError } {
  return { ok: false, error: { code, message_vi } };
}

/** SPEC-P03 §2.2 `setDocumentStatus` — Draft/Approved/Deprecated (cổng E-1). */
export async function setDocumentStatus(input: {
  document_id: string;
  status: DocStatus;
}): Promise<{ ok: true; reindexed: boolean } | { ok: false; error: DocumentError }> {
  const sql = getSql();
  const rows = await sql<{ document_id: string }>(
    `UPDATE documents SET status = $2, updated_at = now()
     WHERE document_id = $1 RETURNING document_id`,
    [input.document_id, input.status]
  );
  if (rows.length === 0) {
    return docErr("NotFound", `Không tìm thấy tài liệu "${input.document_id}".`);
  }
  // Không có hàng đợi reindex nền trong 1.0.0 (P03-C6 áp cho chunk hoá; đổi
  // status không chunk lại) — cổng eligibility đọc thẳng bảng ngay lượt sau.
  return { ok: true, reindexed: false };
}

/** SPEC-P03 §2.2 `setEffectiveStatus` — Current/Expired/Unknown (cổng E-2). */
export async function setEffectiveStatus(input: {
  document_id: string;
  effective_status: EffectiveStatus;
  effective_to: string | null;
}): Promise<{ ok: true } | { ok: false; error: DocumentError }> {
  if (
    input.effective_status === "Current" &&
    input.effective_to !== null
  ) {
    // Không phải lỗi cứng theo SPEC, nhưng "Current" kèm hạn hết hiệu lực là
    // dữ liệu tự mâu thuẫn — chặn ở đây rẻ hơn để nó lọt xuống DB.
    return docErr(
      "InvalidDateRange",
      'Tài liệu "Current" thì không được đặt effective_to.'
    );
  }
  const sql = getSql();
  const rows = await sql<{ document_id: string }>(
    `UPDATE documents SET effective_status = $2, effective_to = $3, updated_at = now()
     WHERE document_id = $1 RETURNING document_id`,
    [input.document_id, input.effective_status, input.effective_to]
  );
  if (rows.length === 0) {
    return docErr("NotFound", `Không tìm thấy tài liệu "${input.document_id}".`);
  }
  return { ok: true };
}

export interface SectionConsoleRow {
  section_id: string;
  heading_vi: string;
  is_excluded: boolean;
  exclusion_note_vi: string | null;
}

/** H26 W1 — danh sách mục của MỘT tài liệu cho panel loại mục khỏi RAG
 *  (SPEC-P03 §2.2 `setSectionExcluded`). Đúng một SELECT, theo `ordinal`. */
export async function listSectionsForConsole(document_id: string): Promise<SectionConsoleRow[]> {
  const sql = getSql();
  return sql<SectionConsoleRow>(
    `SELECT section_id, heading_vi, is_excluded, exclusion_note_vi
     FROM sections
     WHERE document_id = $1
     ORDER BY ordinal`,
    [document_id]
  );
}

/** SPEC-P03 §2.2 `setSectionExcluded` — cổng E-4. */
export async function setSectionExcluded(input: {
  section_id: string;
  is_excluded: boolean;
  exclusion_note_vi: string | null;
}): Promise<{ ok: true } | { ok: false; error: DocumentError }> {
  if (input.is_excluded && !input.exclusion_note_vi?.trim()) {
    return docErr(
      "MissingExclusionNote",
      "Loại mục khỏi RAG bắt buộc ghi lý do."
    );
  }
  const sql = getSql();
  const rows = await sql<{ section_id: string }>(
    `UPDATE sections SET is_excluded = $2, exclusion_note_vi = $3
     WHERE section_id = $1 RETURNING section_id`,
    [input.section_id, input.is_excluded, input.exclusion_note_vi]
  );
  if (rows.length === 0) {
    return docErr("NotFound", `Không tìm thấy mục "${input.section_id}".`);
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// 1.1 — Upload tài liệu mới + Đổi version [R7] — SPEC-P03 §2.2, §2.3, §2.4
//       (H09/Đ35: gói nối tiếp H07 — H07 chỉ giao phần đổi status)
// ─────────────────────────────────────────────────────────────────────────

/**
 * SPEC-P03 §2.4 — chunk hoá theo CÂU, không cắt giữa câu, mục tiêu 250–400
 * ký tự, KHÔNG chồng lấn, section ngắn hơn 250 ký tự giữ nguyên một chunk.
 */
export function chunkSection(bodyVi: string): string[] {
  const text = bodyVi.trim();
  if (text.length === 0) return [];
  if (text.length < 250) return [text];

  const sentences =
    text
      .match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [text];

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > 400 && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
    if (current.length >= 250 && current.length <= 400) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const DOC_KINDS = ["rules", "guide", "fee_schedule", "directory"] as const;
const SCOPE_VALUES = ["apartment", "villa", "commercial"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface UploadSectionInput {
  section_id: string;
  ordinal: number;
  heading_vi: string;
  body_vi: string;
  intents: string[];
  facility_ids: string[];
  conflict_group: string | null;
}

export interface UploadDocumentInput {
  document_id: string;
  title_vi: string;
  doc_kind: (typeof DOC_KINDS)[number];
  version: string;
  scope_property: Array<(typeof SCOPE_VALUES)[number]>;
  effective_from: string;
  effective_to: string | null;
  sections: UploadSectionInput[];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * "Chỉ nhận đúng hình dạng dữ liệu của knowledge/" (luật §3 handoff nối
 * tiếp) — kiểm THUẦN, không chạm DB, đúng hình dạng `knowledge/manifest.json`
 * + `knowledge/sections/*.json`. Trả lỗi tử tế theo từng trường thiếu/sai,
 * KHÔNG ghi nửa vời — caller CHỈ được gọi INSERT sau khi hàm này trả `ok:true`.
 */
export function validateUploadDocumentShape(
  raw: unknown
): { ok: true; value: UploadDocumentInput } | { ok: false; error: DocumentError } {
  if (typeof raw !== "object" || raw === null) {
    return docErr("MissingField", "Dữ liệu tài liệu không đúng hình dạng (thiếu object gốc).");
  }
  const r = raw as Record<string, unknown>;

  if (!isNonEmptyString(r.document_id)) return docErr("MissingField", "Thiếu document_id.");
  if (!isNonEmptyString(r.title_vi)) return docErr("MissingField", "Thiếu title_vi.");
  if (typeof r.doc_kind !== "string" || !(DOC_KINDS as readonly string[]).includes(r.doc_kind)) {
    return docErr("MissingField", `doc_kind phải là một trong: ${DOC_KINDS.join(", ")}.`);
  }
  if (!isNonEmptyString(r.version)) return docErr("MissingField", "Thiếu version.");
  if (
    !Array.isArray(r.scope_property) ||
    r.scope_property.some((s) => typeof s !== "string" || !(SCOPE_VALUES as readonly string[]).includes(s))
  ) {
    return docErr("MissingField", `scope_property phải là mảng con của: ${SCOPE_VALUES.join(", ")}.`);
  }
  if (!isNonEmptyString(r.effective_from) || !DATE_RE.test(r.effective_from)) {
    return docErr("MissingField", "effective_from phải có dạng YYYY-MM-DD.");
  }
  if (
    r.effective_to !== null &&
    r.effective_to !== undefined &&
    (typeof r.effective_to !== "string" || !DATE_RE.test(r.effective_to))
  ) {
    return docErr("MissingField", "effective_to phải là null hoặc YYYY-MM-DD.");
  }
  if (!Array.isArray(r.sections) || r.sections.length === 0) {
    return docErr("MissingField", "sections phải là mảng khác rỗng.");
  }

  const sections: UploadSectionInput[] = [];
  for (let i = 0; i < r.sections.length; i += 1) {
    const raw2 = r.sections[i];
    if (typeof raw2 !== "object" || raw2 === null) {
      return docErr("MissingField", `sections[${i}] không đúng hình dạng.`);
    }
    const s = raw2 as Record<string, unknown>;
    if (!isNonEmptyString(s.section_id)) return docErr("MissingField", `sections[${i}].section_id thiếu.`);
    if (typeof s.ordinal !== "number" || !Number.isInteger(s.ordinal)) {
      return docErr("MissingField", `sections[${i}].ordinal phải là số nguyên.`);
    }
    if (!isNonEmptyString(s.heading_vi)) {
      return docErr("MissingField", `sections[${i}].heading_vi thiếu.`);
    }
    if (typeof s.body_vi !== "string" || s.body_vi.length < 60 || s.body_vi.length > 900) {
      return docErr(
        "BodyLength",
        `sections[${i}] ("${String(s.section_id)}") body_vi phải trong [60, 900] ký tự (SPEC-P03 §4).`
      );
    }
    if (!Array.isArray(s.intents) || s.intents.some((x) => typeof x !== "string")) {
      return docErr("MissingField", `sections[${i}].intents phải là mảng chuỗi.`);
    }
    if (!Array.isArray(s.facility_ids) || s.facility_ids.some((x) => typeof x !== "string")) {
      return docErr("MissingField", `sections[${i}].facility_ids phải là mảng chuỗi.`);
    }
    if (s.conflict_group !== null && s.conflict_group !== undefined && typeof s.conflict_group !== "string") {
      return docErr("MissingField", `sections[${i}].conflict_group phải là null hoặc chuỗi.`);
    }
    sections.push({
      section_id: s.section_id as string,
      ordinal: s.ordinal as number,
      heading_vi: s.heading_vi as string,
      body_vi: s.body_vi as string,
      intents: s.intents as string[],
      facility_ids: s.facility_ids as string[],
      conflict_group: (s.conflict_group as string | null | undefined) ?? null,
    });
  }

  const seen = new Set<string>();
  for (const s of sections) {
    if (seen.has(s.section_id)) {
      return docErr("DuplicateSectionId", `section_id "${s.section_id}" trùng trong cùng lượt gửi lên.`);
    }
    seen.add(s.section_id);
  }

  return {
    ok: true,
    value: {
      document_id: r.document_id as string,
      title_vi: r.title_vi as string,
      doc_kind: r.doc_kind as UploadDocumentInput["doc_kind"],
      version: r.version as string,
      scope_property: r.scope_property as UploadDocumentInput["scope_property"],
      effective_from: r.effective_from as string,
      effective_to: (r.effective_to ?? null) as string | null,
      sections,
    },
  };
}

interface ChunkRow {
  section_id: string;
  chunk_index: number;
  content_vi: string;
  token_count: number;
}

/** Chunk hoá toàn bộ sections; `ok:false` ngay khi một section chunk hoá ra
 *  mảng rỗng (P03-C: CẤM tài liệu 0 chunk) — KHÔNG ghi gì trước khi biết chắc
 *  chunk hoá cả lô đều ổn (§4 `DocumentError.ChunkingFailed`). */
function chunkAllSections(
  sections: readonly UploadSectionInput[]
): { ok: true; rows: ChunkRow[] } | { ok: false; error: DocumentError } {
  const rows: ChunkRow[] = [];
  for (const section of sections) {
    const pieces = chunkSection(section.body_vi);
    if (pieces.length === 0) {
      return docErr("ChunkingFailed", `Section "${section.section_id}" chunk hoá ra mảng rỗng.`) as {
        ok: false;
        error: DocumentError;
      };
    }
    pieces.forEach((content, idx) => {
      rows.push({
        section_id: section.section_id,
        chunk_index: idx,
        content_vi: content,
        token_count: Math.max(1, Math.round(content.length / 4)),
      });
    });
  }
  return { ok: true, rows };
}

/**
 * SPEC-P03 §2.2 `uploadDocument`. Nhận `unknown` (dữ liệu từ Server Action
 * chưa đảm bảo hình dạng) — TỰ kiểm hình dạng bằng
 * `validateUploadDocumentShape()` TRƯỚC khi chạm DB (luật §3 gói nối tiếp).
 * Ghi document + sections + chunks trong ĐÚNG MỘT câu SQL (nhiều CTE) — một
 * statement Postgres = một giao dịch ngầm định, atomic, không cần lộ thêm
 * API transaction ở `db.ts` (ngoài phạm vi sửa, xem "Câu hỏi mở" ở report).
 */
export async function uploadDocument(
  rawInput: unknown
): Promise<{ ok: true; document_id: string; chunks_created: number } | { ok: false; error: DocumentError }> {
  const validated = validateUploadDocumentShape(rawInput);
  if (!validated.ok) return validated;
  const input = validated.value;

  if (input.effective_to !== null && input.effective_to < input.effective_from) {
    return docErr("InvalidDateRange", "effective_to phải >= effective_from.");
  }

  const sql = getSql();

  const existingDoc = await sql<{ document_id: string }>(
    `SELECT document_id FROM documents WHERE document_id = $1`,
    [input.document_id]
  );
  if (existingDoc.length > 0) {
    return docErr("DuplicateId", `document_id "${input.document_id}" đã tồn tại.`);
  }

  const sectionIds = input.sections.map((s) => s.section_id);
  const existingSections = await sql<{ section_id: string }>(
    `SELECT section_id FROM sections WHERE section_id = ANY($1)`,
    [sectionIds]
  );
  if (existingSections.length > 0) {
    return docErr(
      "DuplicateSectionId",
      `section_id đã tồn tại: ${existingSections.map((s) => s.section_id).join(", ")}.`
    );
  }

  const chunked = chunkAllSections(input.sections);
  if (!chunked.ok) return chunked;

  const rows = await sql<{ document_id: string; chunks_created: string }>(
    `WITH new_doc AS (
       INSERT INTO documents (
         document_id, title_vi, doc_kind, version, status, effective_status,
         effective_from, effective_to, allowed_for_rag, scope_property,
         supersedes, source_note_vi
       )
       VALUES ($1, $2, $3, $4, 'Approved', 'Current', $5, $6, true, $7::text[],
               NULL, 'Tài liệu mô phỏng do Ban quản lý tạo qua console (P03).')
       RETURNING document_id
     ),
     new_sections AS (
       INSERT INTO sections (section_id, document_id, ordinal, heading_vi, body_vi, intents, facility_ids, conflict_group)
       SELECT
         elem->>'section_id',
         (SELECT document_id FROM new_doc),
         (elem->>'ordinal')::int,
         elem->>'heading_vi',
         elem->>'body_vi',
         COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(elem->'intents') x), '{}'),
         COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(elem->'facility_ids') x), '{}'),
         NULLIF(elem->>'conflict_group', '')
       FROM jsonb_array_elements($8::jsonb) elem
       RETURNING section_id
     ),
     new_chunks AS (
       INSERT INTO chunks (section_id, document_id, chunk_index, content_vi, token_count)
       SELECT
         elem->>'section_id',
         (SELECT document_id FROM new_doc),
         (elem->>'chunk_index')::int,
         elem->>'content_vi',
         (elem->>'token_count')::int
       FROM jsonb_array_elements($9::jsonb) elem
       RETURNING id
     )
     SELECT
       (SELECT document_id FROM new_doc) AS document_id,
       (SELECT count(*) FROM new_chunks)::text AS chunks_created`,
    [
      input.document_id,
      input.title_vi,
      input.doc_kind,
      input.version,
      input.effective_from,
      input.effective_to,
      input.scope_property,
      JSON.stringify(input.sections),
      JSON.stringify(chunked.rows),
    ]
  );

  const row = rows[0];
  return { ok: true, document_id: row.document_id, chunks_created: Number(row.chunks_created) };
}

/**
 * SPEC-P03 §2.3 `newDocumentVersion` — đúng 4 việc, đúng thứ tự, MỘT giao
 * dịch (xem ghi chú atomic ở `uploadDocument`).
 *
 * CÂU HỎI MỞ (SPEC không nói, không tự chế — ghi rõ để người quyết):
 * SPEC chỉ liệt {base_document_id, new_document_id, version, sections} làm
 * input, nhưng bảng `documents` bắt buộc `title_vi`/`doc_kind`/`scope_property`/
 * `allowed_for_rag`/`source_note_vi`/`effective_from` NOT NULL. Cách diễn giải
 * đã CHỌN ở đây: bản mới KẾ THỪA các trường đó từ bản gốc (`base_document_id`),
 * chỉ đổi `document_id`/`version`/`sections`/`effective_from = current_date`/
 * `effective_to = NULL`. Đây là suy luận hợp lý nhất từ "tạo bản KẾ TIẾP",
 * nhưng SPEC-P03 §2.3 không nói tường minh — người duyệt xác nhận lại.
 * `actor_id` cũng KHÔNG có trong chữ ký SPEC gốc (chỉ có ở `approveAnswer`
 * v.v.) — thêm vào đây theo đúng tiền lệ đã ✅ DUYỆT ở gói H07 (reviewer_id)
 * vì `audit_log.actor_id` cần một giá trị, và §2.3 bước 4 bắt buộc ghi
 * `document.version_created` vào `audit_log`.
 */
export async function newDocumentVersion(input: {
  base_document_id: string;
  new_document_id: string;
  version: string;
  sections: UploadSectionInput[];
  actor_id: string | null;
}): Promise<{ ok: true; superseded: string } | { ok: false; error: DocumentError }> {
  if (!Array.isArray(input.sections) || input.sections.length === 0) {
    return docErr("MissingField", "sections phải là mảng khác rỗng.");
  }
  for (let i = 0; i < input.sections.length; i += 1) {
    const s = input.sections[i];
    if (!isNonEmptyString(s.section_id)) return docErr("MissingField", `sections[${i}].section_id thiếu.`);
    if (typeof s.body_vi !== "string" || s.body_vi.length < 60 || s.body_vi.length > 900) {
      return docErr(
        "BodyLength",
        `sections[${i}] ("${s.section_id}") body_vi phải trong [60, 900] ký tự.`
      );
    }
  }
  const seenNew = new Set<string>();
  for (const s of input.sections) {
    if (seenNew.has(s.section_id)) {
      return docErr("DuplicateSectionId", `section_id "${s.section_id}" trùng trong cùng lượt tạo version.`);
    }
    seenNew.add(s.section_id);
  }

  const sql = getSql();

  const base = await sql<{
    document_id: string;
    title_vi: string;
    doc_kind: string;
    scope_property: string[];
    allowed_for_rag: boolean;
    source_note_vi: string;
  }>(
    `SELECT document_id, title_vi, doc_kind, scope_property, allowed_for_rag, source_note_vi
     FROM documents WHERE document_id = $1`,
    [input.base_document_id]
  );
  if (base.length === 0) {
    return docErr("NotFound", `Không tìm thấy tài liệu gốc "${input.base_document_id}".`);
  }
  const baseDoc = base[0];

  const existingNewId = await sql<{ document_id: string }>(
    `SELECT document_id FROM documents WHERE document_id = $1`,
    [input.new_document_id]
  );
  if (existingNewId.length > 0) {
    return docErr("DuplicateId", `document_id "${input.new_document_id}" đã tồn tại.`);
  }

  const sectionIds = input.sections.map((s) => s.section_id);
  const existingSections = await sql<{ section_id: string }>(
    `SELECT section_id FROM sections WHERE section_id = ANY($1)`,
    [sectionIds]
  );
  if (existingSections.length > 0) {
    return docErr(
      "DuplicateSectionId",
      `section_id đã tồn tại: ${existingSections.map((s) => s.section_id).join(", ")}.`
    );
  }

  const chunked = chunkAllSections(input.sections);
  if (!chunked.ok) return chunked;

  let rows: Array<{ new_document_id: string; old_updated: string }>;
  try {
    rows = await sql<{ new_document_id: string; old_updated: string }>(
      `WITH new_doc AS (
         INSERT INTO documents (
           document_id, title_vi, doc_kind, version, status, effective_status,
           effective_from, effective_to, allowed_for_rag, scope_property,
           supersedes, source_note_vi
         )
         SELECT $1, $2, $3, $4, 'Approved', 'Current', current_date, NULL, $5, $6::text[], $7, $8
         WHERE EXISTS (SELECT 1 FROM documents WHERE document_id = $7)
         RETURNING document_id
       ),
       old_doc AS (
         UPDATE documents
         SET effective_status = 'Expired',
             effective_to = current_date - 1,
             updated_at = now()
         WHERE document_id = $7 AND EXISTS (SELECT 1 FROM new_doc)
         RETURNING document_id
       ),
       new_sections AS (
         INSERT INTO sections (section_id, document_id, ordinal, heading_vi, body_vi, intents, facility_ids, conflict_group)
         SELECT
           elem->>'section_id',
           (SELECT document_id FROM new_doc),
           (elem->>'ordinal')::int,
           elem->>'heading_vi',
           elem->>'body_vi',
           COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(elem->'intents') x), '{}'),
           COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(elem->'facility_ids') x), '{}'),
           NULLIF(elem->>'conflict_group', '')
         FROM jsonb_array_elements($9::jsonb) elem
         RETURNING section_id
       ),
       new_chunks AS (
         INSERT INTO chunks (section_id, document_id, chunk_index, content_vi, token_count)
         SELECT
           elem->>'section_id',
           (SELECT document_id FROM new_doc),
           (elem->>'chunk_index')::int,
           elem->>'content_vi',
           (elem->>'token_count')::int
         FROM jsonb_array_elements($10::jsonb) elem
         RETURNING id
       ),
       audit AS (
         INSERT INTO audit_log (level, actor_id, actor_role, event, payload)
         SELECT 'info', $11::uuid, 'bql', 'document.version_created',
                jsonb_build_object('base_document_id', $7::text, 'new_document_id', $1::text)
         WHERE EXISTS (SELECT 1 FROM old_doc)
         RETURNING id
       )
       SELECT
         (SELECT document_id FROM new_doc) AS new_document_id,
         (SELECT count(*) FROM old_doc)::text AS old_updated`,
      [
        input.new_document_id,
        baseDoc.title_vi,
        baseDoc.doc_kind,
        input.version,
        baseDoc.allowed_for_rag,
        baseDoc.scope_property,
        input.base_document_id,
        baseDoc.source_note_vi,
        JSON.stringify(input.sections),
        JSON.stringify(chunked.rows),
        input.actor_id,
      ]
    );
  } catch {
    // Race hiếm: base_document_id biến mất giữa lúc pre-check (trên) và lúc
    // ghi. `new_doc` CTE có `WHERE EXISTS`, nên khi đó nó không trả dòng nào
    // ⇒ `new_sections` chèn `document_id = NULL` ⇒ vi phạm NOT NULL ⇒ TOÀN
    // BỘ statement bị Postgres rollback (một statement = một giao dịch) —
    // không có document mồ côi nào được tạo. Ánh xạ về NotFound cho gọn.
    return docErr("NotFound", `Tài liệu gốc "${input.base_document_id}" biến mất giữa lúc xử lý.`);
  }

  const row = rows[0];
  if (!row || row.old_updated !== "1") {
    return docErr("NotFound", `Không đổi được trạng thái tài liệu gốc "${input.base_document_id}".`);
  }

  return { ok: true, superseded: input.base_document_id };
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Hàng đợi HITL [R8] — SPEC-P03 §3
// ─────────────────────────────────────────────────────────────────────────

export interface ReviewQueueRow {
  review_id: string;
  answer_turn_id: string;
  state: ReviewState;
  question_vi: string;
  reason_code: ReasonCode | null;
  original_draft_vi: string;
  edited_draft_vi: string | null;
  citations: unknown;
  created_at: string;
}

/** Hàng đợi CHỈ chứa lượt bị escalate (P03-C3) — JOIN answer_turns đã đảm
 *  bảo điều đó vì review_queue chỉ có dòng khi runTurn tạo nó lúc escalate.
 *  Trả mảng RỖNG khi chưa có lượt nào — KHÔNG crash, KHÔNG NaN (luật §3 W3). */
export async function listReviewQueue(
  filter: { reason_code?: ReasonCode; state?: ReviewState } = {}
): Promise<ReviewQueueRow[]> {
  const sql = getSql();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.reason_code) {
    params.push(filter.reason_code);
    conditions.push(`a.reason_code = $${params.length}`);
  }
  if (filter.state) {
    params.push(filter.state);
    conditions.push(`r.state = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  // H16 W3 — pending trước (còn việc phải làm), mới nhất trước trong mỗi
  // nhóm. `(r.state = 'pending')` là boolean: `true` (pending) sắp trước
  // `false` khi ORDER BY ... DESC.
  return sql<ReviewQueueRow>(
    `SELECT r.id AS review_id, r.answer_turn_id, r.state, a.question_vi,
            a.reason_code, r.original_draft_vi, r.edited_draft_vi, a.citations,
            r.created_at
     FROM review_queue r
     JOIN answer_turns a ON a.id = r.answer_turn_id
     ${where}
     ORDER BY (r.state = 'pending') DESC, r.created_at DESC`,
    params
  );
}

export type ReviewErrorCode =
  | "AlreadyResolved"
  | "EmptyEdit"
  | "EmptyRejectReason"
  | "AuthzError";

export interface ReviewError {
  code: ReviewErrorCode;
  message_vi: string;
}

type ReviewResult = { ok: true } | { ok: false; error: ReviewError };

function reviewErr(code: ReviewErrorCode, message_vi: string): ReviewResult {
  return { ok: false, error: { code, message_vi } };
}

/** Ném khi `state` đã tuyệt đối (khác `pending`, §3.3). Máy trạng thái THUẦN,
 *  không chạm DB — test W3 canh trực tiếp hàm này. */
export class ReviewTransitionError extends Error {}

export function assertPendingTransition(current: ReviewState): void {
  if (current !== "pending") {
    throw new ReviewTransitionError(
      `AlreadyResolved: trạng thái hiện tại là "${current}", không có đường quay lại "pending".`
    );
  }
}

/** SPEC-P03 §3.2 `approveAnswer`. Điều kiện đua canh bằng chính câu UPDATE
 *  (`WHERE state = 'pending'`, §3.4) — không tách make hai lượt đọc-rồi-ghi. */
export async function approveAnswer(input: {
  review_id: string;
  reviewer_id: string;
}): Promise<ReviewResult> {
  const sql = getSql();
  const rows = await sql<{ id: string }>(
    `UPDATE review_queue SET state = 'approved', reviewer_id = $2, resolved_at = now()
     WHERE id = $1 AND state = 'pending' RETURNING id`,
    [input.review_id, input.reviewer_id]
  );
  if (rows.length === 0) return reviewErr("AlreadyResolved", "Lượt này đã được xử lý trước đó.");
  return { ok: true };
}

/** SPEC-P03 §3.2 `editAndApprove`. Giữ nguyên `original_draft_vi` (P03-C5). */
export async function editAndApprove(input: {
  review_id: string;
  reviewer_id: string;
  edited_draft_vi: string;
}): Promise<ReviewResult> {
  const edited = input.edited_draft_vi.trim();
  if (edited.length < 10) return reviewErr("EmptyEdit", "Bản sửa cần tối thiểu 10 ký tự.");
  const sql = getSql();
  const rows = await sql<{ id: string }>(
    `UPDATE review_queue SET state = 'edited_approved', reviewer_id = $2,
            edited_draft_vi = $3, resolved_at = now()
     WHERE id = $1 AND state = 'pending' RETURNING id`,
    [input.review_id, input.reviewer_id, edited]
  );
  if (rows.length === 0) return reviewErr("AlreadyResolved", "Lượt này đã được xử lý trước đó.");
  return { ok: true };
}

/** SPEC-P03 §3.2 `rejectAnswer`. Ghi thêm `answer_turns.reason_code =
 *  'reviewer_rejected_draft'` (A10, bảng §3.3). */
export async function rejectAnswer(input: {
  review_id: string;
  reviewer_id: string;
  reject_reason_vi: string;
}): Promise<ReviewResult> {
  const reason = input.reject_reason_vi.trim();
  if (reason.length < 10) {
    return reviewErr("EmptyRejectReason", "Lý do từ chối cần tối thiểu 10 ký tự.");
  }
  const sql = getSql();
  const rows = await sql<{ id: string; answer_turn_id: string }>(
    `UPDATE review_queue SET state = 'rejected', reviewer_id = $2,
            reject_reason_vi = $3, resolved_at = now()
     WHERE id = $1 AND state = 'pending' RETURNING id, answer_turn_id`,
    [input.review_id, input.reviewer_id, reason]
  );
  if (rows.length === 0) return reviewErr("AlreadyResolved", "Lượt này đã được xử lý trước đó.");
  await sql(
    `UPDATE answer_turns SET reason_code = 'reviewer_rejected_draft' WHERE id = $1`,
    [rows[0].answer_turn_id]
  );
  return { ok: true };
}
