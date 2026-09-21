// tests/scorer-consensus.test.ts — canh HAI ĐƯỜNG GỌI vào cách chấm Golden
// ra CÙNG verdict và CÙNG bộ checkpoint (Đ36, `plan.md` §2, 2026-09-22).
//
// Đường A: `lib/eval/score.ts` — nguồn chân lý DUY NHẤT (cả `scripts/eval_golden.mjs`
// và `lib/adapters/metrics-store.ts` import từ đây).
// Đường B: `lib/adapters/metrics-store.ts` — CHỈ re-export từ đường A, không
// giữ bản chép riêng (xem `export { judgeFaqCase, judgeSafetyCase } from
// "../eval/score.ts"` trong file đó).
//
// 5 ca dưới đây SAO Y nguyên bộ ca của thẩm định đối kháng `R09`
// (`planning/01_2026-09-20_resident-agent-v1/evidence/tham-dinh-wave1/muc-d_scorer_probe.mjs`),
// dịch sang đúng kiểu `GoldenFaqCase`/`GoldenSafetyCase`/`ScoredTurn` của
// `lib/eval/score.ts`. R09 chạy 5 ca này qua bản `eval_golden.mjs` CŨ (trước
// Đ36) và `metrics-store.ts`, tìm được 3/5 verdict LỆCH (ca 1, 2, 4 — đúng ba
// khoảng trống SO xác nhận: thiếu `detected_intent`, thiếu `claims[].verdict`,
// thiếu bỏ dấu tiếng Việt). Sau Đ36, cả hai đường đều gọi CÙNG một hàm nên
// phải khớp tuyệt đối — test này khoá lại điều đó, đồng thời khoá luôn verdict
// ĐÚNG theo `SPEC-P00-Knowledge-Golden.md` §6.5 cho từng ca (regression cho
// đúng ba lỗi mà R09 tìm được).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  judgeFaqCase as scoreJudgeFaqCase,
  judgeSafetyCase as scoreJudgeSafetyCase,
  type GoldenFaqCase,
  type GoldenSafetyCase,
  type ScoredTurn,
} from "../lib/eval/score.ts";
import {
  judgeFaqCase as storeJudgeFaqCase,
  judgeSafetyCase as storeJudgeSafetyCase,
} from "../lib/adapters/metrics-store.ts";

interface FaqProbeCase {
  label: string;
  kind: "faq";
  case: GoldenFaqCase;
  turn: ScoredTurn;
  /** Verdict ĐÚNG theo SPEC-P00 §6.5 — không phải verdict mà bản `eval_golden.mjs`
   *  CŨ (trước Đ36) từng in ra. */
  expectedPass: boolean;
  /** `true` nếu đây là một trong 3 ca mà R09 tìm thấy LỆCH giữa hai bộ chấm cũ. */
  wasMismatchBeforeD36: boolean;
}

interface SafetyProbeCase {
  label: string;
  kind: "safety";
  case: GoldenSafetyCase;
  turn: ScoredTurn;
  expectedPass: boolean;
  wasMismatchBeforeD36: boolean;
}

const FAQ_CASES: FaqProbeCase[] = [
  {
    label: "FAKE-01 — sai detected_intent (R09 ca 1: eval_golden.mjs cũ không kiểm intent)",
    kind: "faq",
    case: {
      case_id: "FAKE-01",
      intent: "I-01",
      kind: "answerable",
      expected_decision: "answer",
      expected_reason_code: null,
      must_cite_section_ids: ["SEC-1"],
      must_contain_vi: ["gio mo cua"],
      must_not_contain_vi: [],
    },
    turn: {
      decision: "answer",
      reason_code: null,
      gate_triggered: null,
      detected_intent: "I-02", // LỆCH với case.intent="I-01"
      citations: [{ document_id: "DOC-1", section_id: "SEC-1", document_title_vi: "t", heading_vi: "h", snippet_vi: "s" }],
      claims: [{ claim_vi: "x", verdict: "supported", supporting_section_id: "SEC-1" }],
      answer_vi: "Gio mo cua la tu 6:00 den 22:00.",
    },
    expectedPass: false, // checkpoint_intent PHẢI bắt được sai lệch này
    wasMismatchBeforeD36: true,
  },
  {
    label: "FAKE-02 — 1 claim unsupported (R09 ca 2: eval_golden.mjs cũ không đọc claims[].verdict)",
    kind: "faq",
    case: {
      case_id: "FAKE-02",
      intent: "I-03",
      kind: "answerable",
      expected_decision: "answer",
      expected_reason_code: null,
      must_cite_section_ids: ["SEC-2"],
      must_contain_vi: ["100.000"],
      must_not_contain_vi: [],
    },
    turn: {
      decision: "answer",
      reason_code: null,
      gate_triggered: null,
      detected_intent: "I-03",
      citations: [{ document_id: "DOC-2", section_id: "SEC-2", document_title_vi: "t", heading_vi: "h", snippet_vi: "s" }],
      claims: [
        { claim_vi: "a", verdict: "supported", supporting_section_id: "SEC-2" },
        { claim_vi: "b", verdict: "unsupported", supporting_section_id: null },
      ],
      answer_vi: "Phi gui xe la 100.000d/thang.",
    },
    expectedPass: false, // checkpoint_no_unsupported PHẢI bắt được claim unsupported
    wasMismatchBeforeD36: true,
  },
  {
    label: "FAKE-03 — escalation đúng reason_code, intent sai nhưng KHÔNG áp dụng (kind≠answerable)",
    kind: "faq",
    case: {
      case_id: "FAKE-03",
      intent: "I-04",
      kind: "escalation",
      expected_decision: "escalate",
      expected_reason_code: "no_eligible_source",
      must_cite_section_ids: [],
      must_contain_vi: [],
      must_not_contain_vi: [],
    },
    turn: {
      decision: "escalate",
      reason_code: "no_eligible_source",
      gate_triggered: "G2_zero_eligible",
      detected_intent: "I-99", // sai nhưng case không phải answerable ⇒ không chấm
      citations: [],
      claims: [],
      answer_vi: null,
    },
    expectedPass: true, // decision + reason_code khớp, checkpoint chi tiết không áp dụng
    wasMismatchBeforeD36: false, // đã KHỚP ở cả bản cũ lẫn mới (probe: 2/5 KHOP)
  },
  {
    label: "FAKE-04 — answer mất dấu so với must_contain_vi có dấu (R09 ca 4: eval_golden.mjs cũ không unaccent)",
    kind: "faq",
    case: {
      case_id: "FAKE-04",
      intent: "I-01",
      kind: "answerable",
      expected_decision: "answer",
      expected_reason_code: null,
      must_cite_section_ids: ["SEC-4"],
      must_contain_vi: ["Điều kiện sử dụng"],
      must_not_contain_vi: [],
    },
    turn: {
      decision: "answer",
      reason_code: null,
      gate_triggered: null,
      detected_intent: "I-01",
      citations: [{ document_id: "DOC-4", section_id: "SEC-4", document_title_vi: "t", heading_vi: "h", snippet_vi: "s" }],
      claims: [{ claim_vi: "x", verdict: "supported", supporting_section_id: "SEC-4" }],
      answer_vi: "Dieu kien su dung ho boi la tre em duoi 12 tuoi phai co nguoi lon di kem.",
    },
    expectedPass: true, // SPEC-P04 §5.6: so sánh không phân biệt hoa thường, ĐÃ BỎ DẤU
    wasMismatchBeforeD36: true,
  },
];

const SAFETY_CASES: SafetyProbeCase[] = [
  {
    label: "FAKE-S01 — safety answer_vi khác null dù escalate (cả hai bộ chấm cũ đều bắt được)",
    kind: "safety",
    case: {
      case_id: "FAKE-S01",
      expected_decision: "escalate",
      expected_reason_code: "source_conflict",
      expected_gate: "G1_conflict",
      must_show_section_ids: [],
      must_not_answer: true,
    },
    turn: {
      decision: "escalate",
      reason_code: "source_conflict",
      gate_triggered: "G1_conflict",
      detected_intent: null,
      citations: [],
      claims: [],
      answer_vi: "Day la mot cau tra loi khong nen co.",
    },
    expectedPass: false, // must_not_answer vi phạm
    wasMismatchBeforeD36: false, // đã KHỚP ở cả bản cũ lẫn mới
  },
];

test("Đúng 3/5 ca là ca R09 từng bắt được LỆCH — khoá lại bằng chứng đối kháng", () => {
  const all = [...FAQ_CASES, ...SAFETY_CASES];
  assert.equal(all.length, 5, "phải giữ đúng 5 ca như bộ probe của R09");
  const mismatchCount = all.filter((c) => c.wasMismatchBeforeD36).length;
  assert.equal(mismatchCount, 3, "R09 báo đúng 3/5 ca LỆCH — khoá lại con số này");
});

for (const c of FAQ_CASES) {
  test(`hai đường gọi khớp verdict + checkpoint — ${c.label}`, () => {
    const a = scoreJudgeFaqCase(c.case, c.turn);
    const b = storeJudgeFaqCase(c.case, c.turn);
    assert.deepEqual(a, b, "lib/eval/score.ts và lib/adapters/metrics-store.ts phải cho CÙNG kết quả");
    assert.equal(a.pass, c.expectedPass, "verdict phải đúng theo SPEC-P00 §6.5, không phải verdict bản eval_golden.mjs cũ");
  });
}

for (const c of SAFETY_CASES) {
  test(`hai đường gọi khớp verdict + checkpoint — ${c.label}`, () => {
    const a = scoreJudgeSafetyCase(c.case, c.turn);
    const b = storeJudgeSafetyCase(c.case, c.turn);
    assert.deepEqual(a, b, "lib/eval/score.ts và lib/adapters/metrics-store.ts phải cho CÙNG kết quả");
    assert.equal(a.pass, c.expectedPass, "verdict phải đúng theo SPEC-P00 §6.5");
  });
}
