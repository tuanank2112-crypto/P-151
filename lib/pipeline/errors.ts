// lib/pipeline/errors.ts — lớp lỗi cấp pipeline (00-ARCHITECTURE.md §8,
// SPEC-P02 §9). Lớp lỗi tầng nhà cung cấp (Upstream*/ContractDriftError)
// sống trong `lib/adapters/model.ts` (BB-07) — file này CHỈ định nghĩa lỗi
// KHÔNG liên quan tới việc gọi mạng.

/** E1 — vi phạm BB-04/BB-08/BB-11. Ném ra, không nuốt. */
export class PipelineInvariantError extends Error {
  constructor(detail: string) {
    super(`PipelineInvariantError: ${detail}`);
    this.name = "PipelineInvariantError";
  }
}

/** E3 — pgvector/FTS index thiếu hoặc lỗi cấu hình DataStore. Không retry. */
export class RetrievalError extends Error {
  constructor(detail: string) {
    super(`RetrievalError: ${detail}`);
    this.name = "RetrievalError";
  }
}

/** E6 — truy vấn chạm dữ liệu chủ sở hữu khác (Đ06). Chặn TRƯỚC khi chạm DB. */
export class OwnershipViolation extends Error {
  constructor(detail: string) {
    super(`OwnershipViolation: ${detail}`);
    this.name = "OwnershipViolation";
  }
}

/** Chặng 1 — câu hỏi rỗng/quá dài. HTTP 400, KHÔNG tạo answer_turns. */
export class EmptyQuestionError extends Error {
  constructor(detail: string) {
    super(`EmptyQuestionError: ${detail}`);
    this.name = "EmptyQuestionError";
  }
}
