import { test } from "node:test";
import assert from "node:assert/strict";
import { __setTransportForTesting } from "../lib/adapters/model.ts";
import { conversationIdFromLabel } from "../lib/adapters/db.ts";
import { runTurn, assertStepOrder } from "../lib/pipeline/index.ts";
import { PipelineInvariantError } from "../lib/pipeline/errors.ts";
import type { Principal, PipelineStep } from "../lib/types.ts";

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-not-real";
process.env.DATA_BACKEND = "mock";

const RESIDENT: Principal = {
  user_id: "u1",
  role: "resident",
  resident_id: "R-0001",
  owned_property_ids: ["S1.120817"],
  property_type: ["apartment"],
};

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body } as unknown as Response;
}
function geminiText(obj: unknown) {
  return jsonResponse({
    candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
  });
}
function classifierBody(overrides: Record<string, unknown> = {}) {
  return {
    intent: "I-01",
    is_emergency: false,
    is_legal_or_compensation: false,
    target_subjects: { resident_ids: [], property_ids: [] },
    missing_required_fields: [],
    clarify_question_vi: null,
    normalized_query_vi: "thẻ cư dân mới nộp hồ sơ ngày làm việc",
    ...overrides,
  };
}

function sequentialFetch(bodies: unknown[]) {
  let i = 0;
  return async () => {
    const b = bodies[Math.min(i, bodies.length - 1)];
    i++;
    return geminiText(b);
  };
}

test.afterEach(() => {
  __setTransportForTesting(null);
});

// Đ58 (01-CONTRACTS §8.3b): đường trả lời đầy đủ nay có thêm chặng `relevance`
// ngay sau `verify` ⇒ 10 chặng, transport giả cần thêm 1 phản hồi.
test("step-order (BB-08, T-STEP): đường trả lời đầy đủ đi qua ĐÚNG 10 chặng, đúng thứ tự", async () => {
  __setTransportForTesting({
    fetch: sequentialFetch([
      classifierBody(),
      { draft_vi: "Thẻ được cấp trong vòng 3 ngày làm việc.", citations: [
        { document_id: "OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001", section_id: "CARD-NEW-02", document_title_vi: "x", heading_vi: "x", snippet_vi: "x" },
      ], refused: false, refusal_note_vi: null },
      { claims: [{ claim_vi: "Thẻ cấp trong 3 ngày làm việc", verdict: "supported", supporting_section_id: "CARD-NEW-02" }], faithfulness: 1 },
      { answers_question: true, missing_vi: null }, // Đ58 — relevance
    ]),
    sleep: async () => {},
  });

  const result = await runTurn({
    conversation_id: conversationIdFromLabel("c1"),
    question_vi: "Cấp thẻ cư dân lần đầu mất bao lâu?",
    principal: RESIDENT,
  });

  assert.equal(result.decision, "answer");
  const order = result.steps.map((s) => s.step);
  assert.deepEqual(order, [
    "validate",
    "safety",
    "intent",
    "context",
    "risk",
    "retrieval",
    "eligibility",
    "draft",
    "verify",
    "relevance",
  ]);
  assertStepOrder(result.steps); // không ném
});

test("step-order: thoát sớm ở chặng 2 (emergency) chỉ có ĐÚNG 2 phần tử steps", async () => {
  __setTransportForTesting({
    fetch: sequentialFetch([classifierBody({ is_emergency: true })]),
    sleep: async () => {},
  });
  const result = await runTurn({
    conversation_id: conversationIdFromLabel("c2"),
    question_vi: "Có người ngất xỉu ở sảnh, cần giúp gấp!",
    principal: RESIDENT,
  });
  assert.equal(result.decision, "escalate");
  assert.equal(result.reason_code, "emergency_or_life_safety");
  assert.deepEqual(result.steps.map((s) => s.step), ["validate", "safety"]);
});

test("step-order: thoát sớm ở chặng 7 (zero eligible) dừng đúng ở eligibility, KHÔNG có draft/verify", async () => {
  __setTransportForTesting({
    fetch: sequentialFetch([classifierBody({ normalized_query_vi: "sân pickleball giờ mở cửa" })]),
    sleep: async () => {},
  });
  const result = await runTurn({
    conversation_id: conversationIdFromLabel("c3"),
    question_vi: "Sân pickleball mở cửa mấy giờ?",
    principal: RESIDENT,
  });
  assert.equal(result.decision, "escalate");
  assert.deepEqual(result.steps.map((s) => s.step), [
    "validate",
    "safety",
    "intent",
    "context",
    "risk",
    "retrieval",
    "eligibility",
  ]);
});

test("ĐỎ R7 (đã chạy tay, xem report): assertStepOrder ném khi steps nhảy cóc/sai thứ tự", () => {
  const broken: PipelineStep[] = [
    { step: "validate", ok: true, ms: 0 },
    { step: "retrieval", ok: true, ms: 0 }, // nhảy cóc, bỏ qua safety/intent/context/risk
    { step: "safety", ok: true, ms: 0 }, // và lùi lại
  ];
  assert.throws(() => assertStepOrder(broken), PipelineInvariantError);
});

test("EmptyQuestionError: câu hỏi rỗng không tạo bất kỳ step nào (chặng 1)", async () => {
  await assert.rejects(
    () => runTurn({ conversation_id: conversationIdFromLabel("c4"), question_vi: "   ", principal: RESIDENT }),
    { name: "EmptyQuestionError" }
  );
});
