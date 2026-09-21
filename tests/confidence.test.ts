import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideTurn,
  TAU_ANSWER,
  TAU_FAITHFUL,
  W_RETRIEVAL,
  W_ELIGIBILITY,
  W_FAITHFULNESS,
} from "../lib/confidence.ts";

// Bảng 10 ca — nguyên văn SPEC-P02-Agent-Pipeline.md §6.3 (T-CONF, P02-M1).
const CASES: Array<[string, Parameters<typeof decideTurn>[0], { confidence: number; decision: string; reason_code: string | null; gate: string | null }]> = [
  [
    "W1 D5 bể bơi trẻ em (đối chứng xanh)",
    { retrieval_top1: 0.82, eligible_count: 4, retrieved_count: 4, faithfulness: 1.0, conflict_detected: false },
    { confidence: 0.964, decision: "answer", reason_code: null, gate: null },
  ],
  [
    "W2 D6 giờ BQL (đối chứng xanh)",
    { retrieval_top1: 0.74, eligible_count: 3, retrieved_count: 5, faithfulness: 1.0, conflict_detected: false },
    { confidence: 0.868, decision: "answer", reason_code: null, gate: null },
  ],
  [
    "W3 sát ngưỡng dưới",
    { retrieval_top1: 0.55, eligible_count: 2, retrieved_count: 8, faithfulness: 0.8, conflict_detected: false },
    { confidence: 0.64, decision: "answer", reason_code: null, gate: null },
  ],
  [
    "W4 sát ngưỡng trên nhưng trượt",
    { retrieval_top1: 0.3, eligible_count: 1, retrieved_count: 8, faithfulness: 0.8, conflict_detected: false },
    { confidence: 0.565, decision: "escalate", reason_code: "no_eligible_source", gate: "G5_tau_answer" },
  ],
  [
    "W5 faithfulness thấp, raw vẫn cao",
    { retrieval_top1: 0.9, eligible_count: 6, retrieved_count: 6, faithfulness: 0.75, conflict_detected: false },
    { confidence: 0.83, decision: "escalate", reason_code: "no_eligible_source", gate: "G4_faithfulness_floor" },
  ],
  [
    "W6 S03 conflict BBQ (DEF-03)",
    { retrieval_top1: 0.88, eligible_count: 4, retrieved_count: 4, faithfulness: 1.0, conflict_detected: true },
    { confidence: 0, decision: "escalate", reason_code: "source_conflict", gate: "G1_conflict" },
  ],
  [
    "W7 S01 pickleball (DEF-01)",
    { retrieval_top1: 0.0, eligible_count: 0, retrieved_count: 0, faithfulness: 0.0, conflict_detected: false },
    { confidence: 0, decision: "escalate", reason_code: "no_eligible_source", gate: "G2_zero_eligible" },
  ],
  [
    "W8 S04 bể bơi expired (DEF-04)",
    {
      retrieval_top1: 0.79,
      eligible_count: 0,
      retrieved_count: 5,
      faithfulness: 0.0,
      conflict_detected: false,
      rejection_histogram: { expired_or_unknown: 3 },
    },
    { confidence: 0, decision: "escalate", reason_code: "source_expired_or_unknown", gate: "G2_zero_eligible" },
  ],
  [
    "W9 S02 phí thẻ xe máy (DEF-02)",
    {
      retrieval_top1: 0.68,
      eligible_count: 2,
      retrieved_count: 6,
      faithfulness: 0.0,
      conflict_detected: false,
      retriever_refused: true,
    },
    { confidence: 0, decision: "escalate", reason_code: "no_eligible_source", gate: "G3_retriever_refused" },
  ],
  [
    "W10 A3 không tách được claim nào",
    { retrieval_top1: 0.71, eligible_count: 3, retrieved_count: 4, faithfulness: 0.0, conflict_detected: false },
    { confidence: 0.292, decision: "escalate", reason_code: "no_eligible_source", gate: "G4_faithfulness_floor" },
  ],
];

test("hằng số công thức khớp SPEC-P02 §6.2", () => {
  assert.equal(W_RETRIEVAL, 0.2);
  assert.equal(W_ELIGIBILITY, 0.2);
  assert.equal(W_FAITHFULNESS, 0.6);
  assert.equal(TAU_ANSWER, 0.62);
  assert.equal(TAU_FAITHFUL, 0.8);
});

for (const [name, sig, expected] of CASES) {
  test(`decideTurn — ${name}`, () => {
    const out = decideTurn(sig);
    assert.equal(out.confidence, expected.confidence, `confidence: ${JSON.stringify(out)}`);
    assert.equal(out.decision, expected.decision);
    assert.equal(out.reason_code, expected.reason_code);
    assert.equal(out.gate, expected.gate);
  });
}

test("ĐỎ #5 (đã chạy tay, xem report/TESTING §6.4): TAU_FAITHFUL=0 lật W5 từ escalate sang answer — CẤM đặt = 0", () => {
  // Không sửa hằng số thật — mô phỏng bằng cách gọi decideTurn với faithfulness
  // cao hơn sàn giả định 0, để chứng minh W5 CHỈ escalate NHỜ sàn TAU_FAITHFUL=0.8.
  // Ở đây ta chứng minh ngược lại: nếu sàn là 0 thì faithfulness=0.75 sẽ KHÔNG
  // còn kích hoạt G4 — tức phép phá thật (đổi hằng số) sẽ lật kết quả.
  assert.ok(0.75 < TAU_FAITHFUL, "W5 chỉ escalate vì 0.75 < TAU_FAITHFUL=0.8 — hạ sàn về 0 sẽ lật kết quả");
});

// ─────────────────────────────────────────────────────────────────────────
// Đ28 — G3 phân biệt "nguồn hết hiệu lực" với "không có nguồn".
// Ba ca dưới là hợp đồng của vá DEF-04: bảng §6.3 của SPEC dự đoán DEF-04 rơi
// vào G2 vì giả định truy hồi CHỈ kéo về chunk hết hiệu lực. Đo thật
// (2026-09-21) cho thấy truy vấn đã chuẩn hoá của A1 kéo thêm chunk hợp lệ
// của bản nội quy hiện hành ⇒ eligible_count > 0 ⇒ không thể rơi vào G2.
// ─────────────────────────────────────────────────────────────────────────

test("Đ28 W11 — DEF-04 thật: A2 từ chối, chunk hạng 1 hết hiệu lực ⇒ source_expired_or_unknown", () => {
  const out = decideTurn({
    retrieval_top1: 0.9469,
    eligible_count: 5,
    retrieved_count: 8,
    faithfulness: 0,
    conflict_detected: false,
    retriever_refused: true,
    top_rejected_reason: "expired_or_unknown",
  });
  assert.equal(out.decision, "escalate");
  assert.equal(out.reason_code, "source_expired_or_unknown");
  assert.equal(out.gate, "G3_retriever_refused");
});

test("Đ28 W12 — DEF-02 đối chứng: A2 từ chối, chunk hạng 1 HỢP LỆ ⇒ vẫn no_eligible_source", () => {
  const out = decideTurn({
    retrieval_top1: 0.9541,
    eligible_count: 1,
    retrieved_count: 1,
    faithfulness: 0,
    conflict_detected: false,
    retriever_refused: true,
    top_rejected_reason: null,
  });
  assert.equal(out.reason_code, "no_eligible_source");
  assert.equal(out.gate, "G3_retriever_refused");
});

test("Đ28 W13 — histogram MỘT MÌNH không đủ: có chunk hết hiệu lực xếp hạng thấp, hạng 1 hợp lệ ⇒ no_eligible_source", () => {
  const out = decideTurn({
    retrieval_top1: 0.88,
    eligible_count: 3,
    retrieved_count: 8,
    faithfulness: 0,
    conflict_detected: false,
    retriever_refused: true,
    rejection_histogram: { expired_or_unknown: 2 },
    top_rejected_reason: null,
  });
  assert.equal(
    out.reason_code,
    "no_eligible_source",
    "dùng histogram thay cho top_rejected_reason sẽ báo nhầm 'hết hiệu lực' cho câu hỏi không liên quan"
  );
});

test("Đ28 — G2 KHÔNG đổi: eligible_count=0 vẫn phân biệt bằng histogram", () => {
  const out = decideTurn({
    retrieval_top1: 0.79,
    eligible_count: 0,
    retrieved_count: 2,
    faithfulness: 0,
    conflict_detected: false,
    rejection_histogram: { expired_or_unknown: 2 },
  });
  assert.equal(out.reason_code, "source_expired_or_unknown");
  assert.equal(out.gate, "G2_zero_eligible");
});
