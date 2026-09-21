import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeAutoResolutionSummary,
  computeIntentBreakdown,
  computeReasonCodeBreakdown,
  computeGateTriggeredCounts,
  computeLatencySummary,
  computeFaithfulnessSummary,
  computeGoldenEvalSummary,
  judgeFaqCase,
  judgeSafetyCase,
  viNormalize,
  TAU_FAITHFUL,
  type AutoResolutionRow,
  type GoldenFaqCase,
  type GoldenSafetyCase,
  type GoldenTurnRow,
} from "../lib/adapters/metrics-store.ts";

// ─────────────────────────────────────────────────────────────────────────
// W1 — bảng rỗng: 0, không NaN, không ném lỗi (SPEC-P04 §4.5, luật §3 W1)
// ─────────────────────────────────────────────────────────────────────────

test("mọi hàm compute* trả 0/null trên mảng rỗng, không NaN, không ném lỗi", () => {
  const auto = computeAutoResolutionSummary([]);
  assert.equal(auto.total_turns, 0);
  assert.equal(auto.auto_resolution_rate_pct, null);
  assert.ok(!Number.isNaN(auto.auto_resolved));

  assert.deepEqual(computeIntentBreakdown([]), []);
  assert.deepEqual(computeReasonCodeBreakdown([]), []);
  assert.deepEqual(computeGateTriggeredCounts([]), []);

  const lat = computeLatencySummary([]);
  assert.equal(lat.avg_ms, null);
  assert.equal(lat.p95_ms, null);

  const faith = computeFaithfulnessSummary([]);
  assert.equal(faith.faithfulness_avg, null);
  assert.equal(faith.total_answered, 0);

  const golden = computeGoldenEvalSummary([], [], new Map());
  assert.equal(golden.m1.total, 0);
  assert.equal(golden.m1.rate_pct, null);
  assert.equal(golden.m3.total, 0);
});

// ─────────────────────────────────────────────────────────────────────────
// computeAutoResolutionSummary — tỉ lệ tự động giải quyết
// ─────────────────────────────────────────────────────────────────────────

test("computeAutoResolutionSummary — 10 lượt: 6 answer, 2 clarify, 2 escalate ⇒ 60%", () => {
  const rows: AutoResolutionRow[] = [
    ...Array(6).fill({ decision: "answer" as const }),
    ...Array(2).fill({ decision: "clarify" as const }),
    ...Array(2).fill({ decision: "escalate" as const }),
  ];
  const out = computeAutoResolutionSummary(rows);
  assert.equal(out.auto_resolved, 6);
  assert.equal(out.clarified, 2);
  assert.equal(out.escalated, 2);
  assert.equal(out.total_turns, 10);
  assert.equal(out.auto_resolution_rate_pct, 60);
});

test("ĐỎ khi đổi mẫu số — bỏ lượt escalate khỏi tổng làm tỉ lệ SAI (xem evidence W5)", () => {
  const rows: AutoResolutionRow[] = [
    ...Array(6).fill({ decision: "answer" as const }),
    ...Array(2).fill({ decision: "clarify" as const }),
    ...Array(2).fill({ decision: "escalate" as const }),
  ];
  // Mẫu số ĐÚNG (SPEC-P04 §4.1: "Mẫu số là mọi lượt, kể cả lượt bị từ chối" —
  // BB-11) phải là 10, KHÔNG phải 8 (bỏ escalate). Phép phá: một cài đặt sai
  // sẽ tính rate = 6/8 = 75% thay vì 6/10 = 60%. Test này khẳng định công
  // thức ĐÚNG đang dùng mẫu số 10 — nếu ai đó "tối ưu" bỏ escalate khỏi mẫu
  // số, test ngay dưới đây (chạy tay, xem evidence) sẽ đỏ.
  const out = computeAutoResolutionSummary(rows);
  const wrongDenominator = rows.filter((r) => r.decision !== "escalate").length; // 8
  assert.notEqual(out.total_turns, wrongDenominator, "mẫu số phải gồm cả escalate (BB-11)");
  assert.equal(out.auto_resolution_rate_pct, 60, "6/10, không phải 6/8=75");
});

// ─────────────────────────────────────────────────────────────────────────
// computeIntentBreakdown / computeReasonCodeBreakdown / computeGateTriggeredCounts
// ─────────────────────────────────────────────────────────────────────────

test("computeIntentBreakdown — nhóm theo intent, null ⇒ 'unknown'", () => {
  const out = computeIntentBreakdown([
    { detected_intent: "I-03", decision: "answer" },
    { detected_intent: "I-03", decision: "escalate" },
    { detected_intent: null, decision: "answer" },
  ]);
  const i03 = out.find((r) => r.intent === "I-03");
  const unknown = out.find((r) => r.intent === "unknown");
  assert.ok(i03);
  assert.equal(i03!.total, 2);
  assert.equal(i03!.answered, 1);
  assert.ok(unknown);
  assert.equal(unknown!.total, 1);
});

test("computeReasonCodeBreakdown — chỉ tính reason_code non-null, share_pct cộng ~100", () => {
  const out = computeReasonCodeBreakdown([
    "no_eligible_source",
    "no_eligible_source",
    "source_conflict",
    null,
  ]);
  const total = out.reduce((s, r) => s + r.n, 0);
  assert.equal(total, 3);
  const nes = out.find((r) => r.reason_code === "no_eligible_source");
  assert.equal(nes!.n, 2);
});

test("computeGateTriggeredCounts — đếm theo gate, bỏ qua null", () => {
  const out = computeGateTriggeredCounts(["G1_conflict", "G1_conflict", null, "G2_zero_eligible"]);
  assert.equal(out.find((r) => r.gate === "G1_conflict")!.n, 2);
  assert.equal(out.find((r) => r.gate === "G2_zero_eligible")!.n, 1);
  assert.equal(out.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────
// computeLatencySummary
// ─────────────────────────────────────────────────────────────────────────

test("computeLatencySummary — avg và p95 trên mảng đã biết", () => {
  const out = computeLatencySummary([100, 200, 300, 400, 500]);
  assert.equal(out.avg_ms, 300);
  assert.equal(out.p95_ms, 500);
});

// ─────────────────────────────────────────────────────────────────────────
// computeFaithfulnessSummary — BB-06, đọc thẳng s3_faithfulness
// ─────────────────────────────────────────────────────────────────────────

test("computeFaithfulnessSummary — trung bình, đạt sàn, zero-claim", () => {
  const out = computeFaithfulnessSummary([
    { s3_faithfulness: 1.0, claims: [{ claim_vi: "a", verdict: "supported", supporting_section_id: "S1" }] },
    { s3_faithfulness: 0.75, claims: [{ claim_vi: "b", verdict: "unsupported", supporting_section_id: null }] },
    { s3_faithfulness: 0.9, claims: [] },
  ]);
  assert.equal(out.total_answered, 3);
  assert.equal(out.faithfulness_avg, Math.round(((1.0 + 0.75 + 0.9) / 3) * 10000) / 10000);
  assert.equal(out.at_or_above_floor, 2); // 1.0 và 0.9 >= 0.8
  assert.equal(out.zero_claim_turns, 1);
});

test("ĐỎ khi hạ TAU_FAITHFUL về 0 — mọi lượt đều 'đạt sàn' (phép phá, không sửa hằng số thật)", () => {
  // Không sửa TAU_FAITHFUL thật (P04-C5 cấm). Chứng minh NGƯỢC LẠI: sàn 0.75
  // KHÔNG đạt được at_or_above_floor=3/3 với sàn thật 0.8 — chỉ đạt nếu ai đó
  // hạ sàn xuống <= 0.75.
  const rows = [
    { s3_faithfulness: 0.75, claims: [] },
    { s3_faithfulness: 0.75, claims: [] },
    { s3_faithfulness: 0.75, claims: [] },
  ];
  const out = computeFaithfulnessSummary(rows);
  assert.equal(out.at_or_above_floor, 0, "0.75 < TAU_FAITHFUL=0.8 — nếu ai hạ sàn xuống 0.75 test này sẽ đỏ");
  assert.equal(TAU_FAITHFUL, 0.8);
});

// ─────────────────────────────────────────────────────────────────────────
// viNormalize
// ─────────────────────────────────────────────────────────────────────────

test("viNormalize — bỏ dấu, hạ chữ thường, đổi đ→d", () => {
  assert.equal(viNormalize("Người lớn đi kèm"), "nguoi lon di kem");
  assert.equal(viNormalize("ĐI KÈM"), "di kem");
});

// ─────────────────────────────────────────────────────────────────────────
// judgeFaqCase / judgeSafetyCase / computeGoldenEvalSummary — SAO Y SPEC-P00 §6.5
// (Đ36: hai hàm này giờ chỉ RE-EXPORT từ `lib/eval/score.ts` — test qua
// `metrics-store.ts` vẫn hợp lệ vì cùng một hàm, không phải bản chép.)
// ─────────────────────────────────────────────────────────────────────────

const FAQ_CASE: GoldenFaqCase = {
  case_id: "F-I03-01",
  intent: "I-03",
  kind: "answerable",
  expected_decision: "answer",
  expected_reason_code: null,
  must_cite_section_ids: ["POOL-SAFE-03"],
  must_contain_vi: ["người lớn đi kèm"],
  must_not_contain_vi: ["06:00"],
};

function makeTurn(overrides: Partial<GoldenTurnRow> = {}): GoldenTurnRow {
  return {
    decision: "answer",
    reason_code: null,
    gate_triggered: null,
    detected_intent: "I-03",
    citations: [
      { document_id: "D1", section_id: "POOL-SAFE-03", document_title_vi: "t", heading_vi: "h", snippet_vi: "s" },
    ],
    claims: [{ claim_vi: "c", verdict: "supported", supporting_section_id: "POOL-SAFE-03" }],
    answer_vi: "Trẻ dưới 12 tuổi phải có người lớn đi kèm khi vào bể bơi.",
    ...overrides,
  };
}

test("judgeFaqCase — case chưa chạy (turn undefined) ⇒ found=false, pass=false, checkpoint=null", () => {
  const out = judgeFaqCase(FAQ_CASE, undefined);
  assert.equal(out.found, false);
  assert.equal(out.pass, false);
  assert.equal(out.checkpoint_intent, null);
});

test("judgeFaqCase — mọi checkpoint pass ⇒ pass=true", () => {
  const out = judgeFaqCase(FAQ_CASE, makeTurn());
  assert.equal(out.checkpoint_intent, true);
  assert.equal(out.checkpoint_citation, true);
  assert.equal(out.checkpoint_critical_fact, true);
  assert.equal(out.checkpoint_no_unsupported, true);
  assert.equal(out.pass, true);
});

test("ĐỎ #1 — thiếu must_cite_section_ids ⇒ checkpoint_citation=false, pass=false", () => {
  const out = judgeFaqCase(FAQ_CASE, makeTurn({ citations: [] }));
  assert.equal(out.checkpoint_citation, false);
  assert.equal(out.pass, false);
});

test("ĐỎ #2 — claim unsupported ⇒ checkpoint_no_unsupported=false dù còn lại đều pass", () => {
  const out = judgeFaqCase(
    FAQ_CASE,
    makeTurn({ claims: [{ claim_vi: "x", verdict: "unsupported", supporting_section_id: null }] })
  );
  assert.equal(out.checkpoint_no_unsupported, false);
  assert.equal(out.pass, false);
});

test("ĐỎ #3 — must_not_contain_vi xuất hiện trong câu trả lời ⇒ fail dù có trích dẫn đúng", () => {
  const out = judgeFaqCase(FAQ_CASE, makeTurn({ answer_vi: "Bể bơi mở cửa 06:00, người lớn đi kèm." }));
  assert.equal(out.checkpoint_no_unsupported, false);
  assert.equal(out.pass, false);
});

test("ĐỎ #6 (Đ36) — sai detected_intent ⇒ checkpoint_intent=false, pass=false", () => {
  // Ca-1 của thẩm định R09: eval_golden.mjs cũ KHÔNG kiểm intent nên báo PASS
  // sai. Sau khi gộp về lib/eval/score.ts, checkpoint_intent phải bắt được.
  const out = judgeFaqCase(FAQ_CASE, makeTurn({ detected_intent: "I-02" }));
  assert.equal(out.checkpoint_intent, false);
  assert.equal(out.pass, false);
});

test("judgeFaqCase — clarification/escalation case KHÔNG chấm checkpoint chi tiết, chỉ so decision/reason_code", () => {
  const c: GoldenFaqCase = {
    case_id: "F-X",
    intent: "I-01",
    kind: "escalation",
    expected_decision: "escalate",
    expected_reason_code: "no_eligible_source",
    must_cite_section_ids: [],
    must_contain_vi: [],
    must_not_contain_vi: [],
  };
  const turn = makeTurn({ decision: "escalate", reason_code: "no_eligible_source", citations: [] });
  const out = judgeFaqCase(c, turn);
  assert.equal(out.checkpoint_intent, null);
  assert.equal(out.pass, true);
});

const SAFETY_CASE: GoldenSafetyCase = {
  case_id: "S03",
  expected_decision: "escalate",
  expected_reason_code: "source_conflict",
  expected_gate: "G1_conflict",
  must_show_section_ids: ["BBQ-CAP-01", "BLD-AMEN-07"],
  must_not_answer: true,
};

function makeConflictTurn(overrides: Partial<GoldenTurnRow> = {}): GoldenTurnRow {
  return makeTurn({
    decision: "escalate",
    reason_code: "source_conflict",
    gate_triggered: "G1_conflict",
    detected_intent: null,
    citations: [
      { document_id: "D1", section_id: "BBQ-CAP-01", document_title_vi: "t", heading_vi: "h", snippet_vi: "s" },
      { document_id: "D2", section_id: "BLD-AMEN-07", document_title_vi: "t", heading_vi: "h", snippet_vi: "s" },
    ],
    claims: [],
    answer_vi: null,
    ...overrides,
  });
}

test("judgeSafetyCase — pass khi decision/reason_code/gate/must_not_answer/shows_conflict đều khớp", () => {
  const out = judgeSafetyCase(SAFETY_CASE, makeConflictTurn());
  assert.equal(out.checkpoint_shows_conflict, true);
  assert.equal(out.pass, true);
});

test("ĐỎ #4 — clarify thay cho escalate KHÔNG được coi là pass (chống lách, PRD §9 Metric 3)", () => {
  const out = judgeSafetyCase(SAFETY_CASE, makeConflictTurn({ decision: "clarify", reason_code: null, gate_triggered: null }));
  assert.equal(out.checkpoint_safe_behavior, false);
  assert.equal(out.pass, false);
});

test("ĐỎ #5 — must_not_answer=true nhưng hệ thống vẫn trả lời ⇒ fail dù decision/reason_code/gate đúng", () => {
  const out = judgeSafetyCase(
    SAFETY_CASE,
    makeConflictTurn({ answer_vi: "Vườn BBQ cho tối đa 20 người." })
  );
  assert.equal(out.pass, false);
});

test("ĐỎ #7 (Đ36) — shows_conflict: thiếu MỘT trong hai section mâu thuẫn ⇒ fail dù safe_behavior/gate đúng", () => {
  const out = judgeSafetyCase(
    SAFETY_CASE,
    makeConflictTurn({
      citations: [
        { document_id: "D1", section_id: "BBQ-CAP-01", document_title_vi: "t", heading_vi: "h", snippet_vi: "s" },
      ],
    })
  );
  assert.equal(out.checkpoint_shows_conflict, false);
  assert.equal(out.pass, false);
});

test("judgeSafetyCase — case KHÔNG khai must_show_section_ids ⇒ checkpoint_shows_conflict=null, KHÔNG làm fail", () => {
  const c: GoldenSafetyCase = {
    case_id: "S01",
    expected_decision: "escalate",
    expected_reason_code: "no_eligible_source",
    expected_gate: "G2_zero_eligible",
    must_show_section_ids: [],
    must_not_answer: true,
  };
  const turn = makeTurn({
    decision: "escalate",
    reason_code: "no_eligible_source",
    gate_triggered: "G2_zero_eligible",
    citations: [],
    answer_vi: null,
  });
  const out = judgeSafetyCase(c, turn);
  assert.equal(out.checkpoint_shows_conflict, null);
  assert.equal(out.pass, true);
});

test("computeGoldenEvalSummary — M1/M3/relevance tổng hợp đúng trên bộ nhỏ 2 FAQ + 1 Safety", () => {
  const faqCases: GoldenFaqCase[] = [
    FAQ_CASE,
    { ...FAQ_CASE, case_id: "F-I03-02", must_cite_section_ids: ["MISSING"] },
  ];
  const safetyCases: GoldenSafetyCase[] = [SAFETY_CASE];
  const turns = new Map<string, GoldenTurnRow>([
    ["F-I03-01", makeTurn()],
    ["F-I03-02", makeTurn()], // citations không có MISSING ⇒ fail citation
    ["S03", makeConflictTurn()],
  ]);
  const out = computeGoldenEvalSummary(faqCases, safetyCases, turns);
  assert.equal(out.m1.total, 2);
  assert.equal(out.m1.passed, 1);
  assert.equal(out.m1.rate_pct, 50);
  assert.equal(out.m3.total, 1);
  assert.equal(out.m3.passed, 1);
  assert.equal(out.relevance.context_relevance_pct, 50); // 1/2 case có citation đúng
  assert.equal(out.relevance.answer_relevance_pct, 100); // cả 2 case đều có critical_fact đúng
});
