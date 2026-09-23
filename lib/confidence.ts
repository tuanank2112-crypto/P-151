// lib/confidence.ts — hợp 4 tín hiệu, 5 cổng escalate (Đ07 🔴, SPEC-P02 §6).
// Thuần, tất định, KHÔNG I/O — dễ unit-test. Cài đặt SAO Y nguyên văn tham
// chiếu ở `SPEC-P02-Agent-Pipeline.md` §6.2.

import type { Decision, ReasonCode } from "./types.ts";
import type { RejectionReason } from "./pipeline/eligibility.ts";

export const W_RETRIEVAL = 0.2;
export const W_ELIGIBILITY = 0.2;
export const W_FAITHFULNESS = 0.6;
export const TAU_ANSWER = 0.62; // ngưỡng khởi điểm — chỉnh được (§6.5)
export const TAU_FAITHFUL = 0.8; // sàn cứng — chỉnh được, nhưng xem §6.5. CẤM đặt = 0 (T-C4).

export function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

export interface DecideTurnSignals {
  retrieval_top1: number;
  eligible_count: number;
  retrieved_count: number;
  faithfulness: number;
  conflict_detected: boolean;
  retriever_refused?: boolean;
  rejection_histogram?: Partial<Record<RejectionReason, number>>;
  /** Lý do loại của chunk xếp hạng 1 (Đ28). Chỉ dùng ở G3. */
  top_rejected_reason?: RejectionReason | null;
  /**
   * Đ41 — chunk xếp hạng 1 có NÓI VỀ chủ đề của câu hỏi này không (đo bằng
   * `queryMentionsDocumentTitle()` ở `lib/pipeline/index.ts`). Chỉ dùng ở G3,
   * và CHỈ để CHẶN mã `source_expired_or_unknown` khi nó sai — không bao giờ
   * tạo ra mã mới.
   *
   * Mặc định `true` (giữ nguyên hành vi Đ28 cho mọi caller chưa truyền).
   * Lý do cần thêm tín hiệu này: `top_rejected_reason` một mình trả lời
   * "nguồn khớp NHẤT có dùng được không", nhưng sau Đ32 truy hồi nối từ bằng
   * `|` nên "khớp nhất" có thể chỉ là khớp mấy từ chung chung ("giờ", "mở",
   * "cửa"). Đo trên Postgres 2026-09-22: câu hỏi sân pickleball kéo chunk
   * hạng 1 là bản nội quy BỂ BƠI đã hết hiệu lực ⇒ G3 báo "tài liệu hết hiệu
   * lực" cho một tiện ích CHƯA BAO GIỜ có tài liệu (Đ41/DEF-01).
   */
  top_rejected_on_topic?: boolean;
}

export interface DecideTurnResult {
  confidence: number;
  decision: Decision;
  reason_code: ReasonCode | null;
  gate: string | null;
  s1: number;
  s2: number;
  s3: number;
}

function r(
  confidence: number,
  decision: Decision,
  reason_code: ReasonCode | null,
  gate: string | null,
  s1: number,
  s2: number,
  s3: number
): DecideTurnResult {
  return { confidence, decision, reason_code, gate, s1, s2: round4(s2), s3 };
}

export function decideTurn(sig: DecideTurnSignals): DecideTurnResult {
  const {
    retrieval_top1: s1,
    eligible_count,
    retrieved_count,
    faithfulness: s3,
    conflict_detected,
    retriever_refused = false,
    rejection_histogram = {},
    top_rejected_reason = null,
    top_rejected_on_topic = true,
  } = sig;
  const s2 = retrieved_count === 0 ? 0 : eligible_count / retrieved_count;
  const confidence = round4(W_RETRIEVAL * s1 + W_ELIGIBILITY * s2 + W_FAITHFULNESS * s3);

  if (conflict_detected) return r(0, "escalate", "source_conflict", "G1_conflict", s1, s2, s3);
  if (eligible_count === 0) {
    const code: ReasonCode =
      (rejection_histogram.expired_or_unknown ?? 0) > 0
        ? "source_expired_or_unknown"
        : "no_eligible_source";
    return r(0, "escalate", code, "G2_zero_eligible", s1, s2, s3);
  }
  if (retriever_refused) {
    // Đ28 — G3 phân biệt bằng CHUNK XẾP HẠNG 1, không bằng histogram. A2 từ
    // chối nghĩa là không nguồn hợp lệ nào trả lời được câu này; nếu nguồn
    // khớp NHẤT lại là tài liệu đã hết hiệu lực thì sự thật là "thông tin
    // nằm trong tài liệu hết hạn", không phải "không có nguồn nào".
    // Đ41 — thêm ĐÚNG MỘT điều kiện cần: chunk hạng 1 phải nói về chủ đề của
    // câu hỏi. Thiếu nó thì "hết hiệu lực" là một lý do BỊA (Đ09) cho tiện
    // ích chưa bao giờ có nguồn có thẩm quyền. Nhánh này chỉ HẠ cấp về mã
    // chung `no_eligible_source`, nên không sinh phát biểu mới nào.
    const code: ReasonCode =
      top_rejected_reason === "expired_or_unknown" && top_rejected_on_topic
        ? "source_expired_or_unknown"
        : "no_eligible_source";
    return r(0, "escalate", code, "G3_retriever_refused", s1, s2, s3);
  }
  if (s3 < TAU_FAITHFUL) {
    // Đ57 — cùng luật Đ28/Đ41 của G3: A3 bác bản nháp VÀ nguồn khớp nhất là
    // tài liệu hết hiệu lực đúng chủ đề ⇒ sự thật là "thông tin nằm trong tài
    // liệu hết hạn" (S04, 2026-09-23 13:32 ra G4 + no_eligible_source).
    const code: ReasonCode =
      top_rejected_reason === "expired_or_unknown" && top_rejected_on_topic
        ? "source_expired_or_unknown"
        : "no_eligible_source";
    return r(confidence, "escalate", code, "G4_faithfulness_floor", s1, s2, s3);
  }
  if (confidence < TAU_ANSWER)
    return r(confidence, "escalate", "no_eligible_source", "G5_tau_answer", s1, s2, s3);
  return r(confidence, "answer", null, null, s1, s2, s3);
}
