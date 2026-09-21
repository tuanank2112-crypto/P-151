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
  | "AuthzError";

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
  return sql<ReviewQueueRow>(
    `SELECT r.id AS review_id, r.answer_turn_id, r.state, a.question_vi,
            a.reason_code, r.original_draft_vi, r.edited_draft_vi, a.citations,
            r.created_at
     FROM review_queue r
     JOIN answer_turns a ON a.id = r.answer_turn_id
     ${where}
     ORDER BY r.created_at DESC`,
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
