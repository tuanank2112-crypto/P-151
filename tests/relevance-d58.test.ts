// tests/relevance-d58.test.ts — Đ58 (01-CONTRACTS §8.3b, SPEC-P02 bảng cổng G3).
//
// Ca gốc (Golden 2026-09-23 13:46, S02/F-ESC-02): hỏi "phí làm lại thẻ xe máy",
// A2 đáp phí thẻ CƯ DÂN, A3 chấm faithfulness 1.0 — đúng nguồn, sai câu hỏi.
// Đ58 thêm lời gọi RIÊNG `relevance` (câu hỏi + bản nháp, KHÔNG evidence) sau
// `verify`, CHỈ khi lượt sắp `answer`; `answers_question=false` ⇒ G3.
//
// KHÔNG gọi model thật: transport giả ĐỊNH TUYẾN theo hình dạng payload (không
// theo thứ tự lời gọi) để đếm được từng loại lời gọi và soi payload A3/relevance.

import { test } from "node:test";
import assert from "node:assert/strict";
import { __setTransportForTesting } from "../lib/adapters/model.ts";
import { conversationIdFromLabel, __resetDataStoreForTesting } from "../lib/adapters/db.ts";
import { runTurn, assertStepOrder } from "../lib/pipeline/index.ts";
import {
  __getMockAnswerTurnsForTesting,
  __resetMockAnswerTurnsForTesting,
} from "../lib/adapters/store-mock.ts";
import type { Principal } from "../lib/types.ts";

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-not-real";
process.env.DATA_BACKEND = "mock";

const RESIDENT: Principal = {
  user_id: "u1",
  role: "resident",
  resident_id: "R-0001",
  owned_property_ids: ["S1.120817"],
  property_type: ["apartment"],
};

function geminiText(obj: unknown): Response {
  const body = {
    candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
  };
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body } as unknown as Response;
}

const CLASSIFIER = {
  intent: "I-01",
  is_emergency: false,
  is_legal_or_compensation: false,
  target_subjects: { resident_ids: [], property_ids: [] },
  missing_required_fields: [],
  clarify_question_vi: null,
  normalized_query_vi: "thẻ cư dân mới nộp hồ sơ ngày làm việc",
};
const A2_DRAFT = {
  draft_vi: "Thẻ được cấp trong vòng 3 ngày làm việc.",
  citations: [
    {
      document_id: "OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001",
      section_id: "CARD-NEW-02",
      document_title_vi: "x",
      heading_vi: "x",
      snippet_vi: "x",
    },
  ],
  refused: false,
  refusal_note_vi: null,
};
const A3_SUPPORTED = {
  claims: [{ claim_vi: "Thẻ cấp trong 3 ngày làm việc", verdict: "supported", supporting_section_id: "CARD-NEW-02" }],
  faithfulness: 1,
};
const A3_UNSUPPORTED = {
  claims: [{ claim_vi: "Thẻ cấp trong 3 ngày làm việc", verdict: "unsupported", supporting_section_id: null }],
  faithfulness: 0,
};

type Kind = "classifier" | "retriever" | "verifier" | "relevance";
interface Recorder {
  counts: Record<Kind, number>;
  payloads: Record<Kind, Record<string, unknown>[]>;
}

/** Định tuyến theo payload: A2 có `eligible_chunks`, A3 có `evidence`,
 *  relevance có `question_vi`+`draft_vi` mà không `evidence`; còn lại là A1. */
function routedTransport(a3: unknown, relevance: unknown): Recorder {
  const rec: Recorder = {
    counts: { classifier: 0, retriever: 0, verifier: 0, relevance: 0 },
    payloads: { classifier: [], retriever: [], verifier: [], relevance: [] },
  };
  __setTransportForTesting({
    fetch: async (_url: unknown, init?: { body?: unknown }) => {
      const req = JSON.parse(String(init?.body ?? "{}"));
      const payload = JSON.parse(req.contents?.[0]?.parts?.[0]?.text ?? "{}") as Record<string, unknown>;
      let kind: Kind;
      if ("eligible_chunks" in payload) kind = "retriever";
      else if ("evidence" in payload) kind = "verifier";
      else if ("draft_vi" in payload && "question_vi" in payload) kind = "relevance";
      else kind = "classifier";
      rec.counts[kind]++;
      rec.payloads[kind].push(payload);
      const out = kind === "classifier" ? CLASSIFIER : kind === "retriever" ? A2_DRAFT : kind === "verifier" ? a3 : relevance;
      return geminiText(out);
    },
    sleep: async () => {},
  } as Parameters<typeof __setTransportForTesting>[0]);
  return rec;
}

test.beforeEach(() => {
  process.env.DATA_BACKEND = "mock";
  __resetDataStoreForTesting();
  __resetMockAnswerTurnsForTesting();
});
test.afterEach(() => {
  __setTransportForTesting(null);
});

test("Đ58 (a): A3 1.0 + relevance false ⇒ escalate G3/no_eligible_source, s3_faithfulness giữ 1, step relevance sau verify", async () => {
  const rec = routedTransport(A3_SUPPORTED, {
    answers_question: false,
    missing_vi: "hỏi thời hạn cấp thẻ xe máy, bản nháp đáp thẻ cư dân",
  });
  const result = await runTurn({
    conversation_id: conversationIdFromLabel("d58-a"),
    question_vi: "Cấp thẻ cư dân lần đầu mất bao lâu?",
    principal: RESIDENT,
  });
  assert.equal(rec.counts.verifier, 1, "tiền đề: A3 phải chạy đúng 1 lần");
  assert.equal(rec.counts.relevance, 1, "relevance phải được gọi đúng 1 lần");
  assert.equal(result.decision, "escalate");
  assert.equal(result.gate_triggered, "G3_retriever_refused");
  assert.equal(result.reason_code, "no_eligible_source");
  assert.equal(result.answer_vi, null, "không được lộ bản nháp sai câu hỏi");

  const rows = __getMockAnswerTurnsForTesting();
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assert.equal(row.s3_faithfulness, 1, "faithfulness giữ số thật của A3 (§8.3b, BB-06)");
  assertStepOrder(row.pipeline_steps);
  const names = row.pipeline_steps.map((s) => s.step);
  assert.ok(names.includes("relevance"), "phải có chặng relevance");
  assert.equal(names.indexOf("relevance"), names.indexOf("verify") + 1, "relevance đứng NGAY sau verify");
  const rel = row.pipeline_steps.find((s) => s.step === "relevance")!;
  assert.ok(typeof rel.model === "string" && rel.model.length > 0, "relevance phải ghi model (R6)");
  assert.equal(typeof rel.ms, "number");
  assert.equal(rel.input_tokens, 10);
  assert.equal(rel.output_tokens, 10);
  assert.equal(rel.note, "hỏi thời hạn cấp thẻ xe máy, bản nháp đáp thẻ cư dân");
});

test("Đ58 (b): relevance true ⇒ answer như cũ, có step relevance", async () => {
  const rec = routedTransport(A3_SUPPORTED, { answers_question: true, missing_vi: null });
  const result = await runTurn({
    conversation_id: conversationIdFromLabel("d58-b"),
    question_vi: "Cấp thẻ cư dân lần đầu mất bao lâu?",
    principal: RESIDENT,
  });
  assert.equal(result.decision, "answer");
  assert.equal(result.gate_triggered, null);
  assert.equal(result.answer_vi, A2_DRAFT.draft_vi);
  assert.equal(rec.counts.relevance, 1);
  const names = result.steps.map((s) => s.step);
  assert.deepEqual(names.slice(-2), ["verify", "relevance"]);
  assert.equal(result.steps.at(-1)!.ok, true);
  assert.equal(__getMockAnswerTurnsForTesting()[0]!.s3_faithfulness, 1);
});

test("Đ58 (c): lượt escalate ở G4 ⇒ KHÔNG gọi relevance", async () => {
  const rec = routedTransport(A3_UNSUPPORTED, { answers_question: true, missing_vi: null });
  const result = await runTurn({
    conversation_id: conversationIdFromLabel("d58-c"),
    question_vi: "Cấp thẻ cư dân lần đầu mất bao lâu?",
    principal: RESIDENT,
  });
  assert.equal(result.gate_triggered, "G4_faithfulness_floor", "tiền đề: phải rơi G4");
  assert.equal(rec.counts.verifier, 1);
  assert.equal(rec.counts.relevance, 0, "lượt đã escalate không được tốn lời gọi relevance");
  assert.ok(!result.steps.some((s) => s.step === "relevance"));
});

test("Đ58 (d): VC-03 — runVerifier KHÔNG nhận question_vi; relevance KHÔNG nhận evidence", async () => {
  const rec = routedTransport(A3_SUPPORTED, { answers_question: true, missing_vi: null });
  await runTurn({
    conversation_id: conversationIdFromLabel("d58-d"),
    question_vi: "Cấp thẻ cư dân lần đầu mất bao lâu?",
    principal: RESIDENT,
  });
  assert.equal(rec.payloads.verifier.length, 1);
  const v = rec.payloads.verifier[0]!;
  assert.deepEqual(Object.keys(v).sort(), ["draft_vi", "evidence"], "A3 chỉ được thấy draft_vi + evidence (VC-03)");
  assert.ok(!JSON.stringify(v).includes("Cấp thẻ cư dân lần đầu mất bao lâu"), "câu hỏi gốc lọt vào A3");
  assert.ok(!JSON.stringify(v).includes(CLASSIFIER.normalized_query_vi), "câu hỏi chuẩn hoá lọt vào A3");
  assert.equal(rec.payloads.relevance.length, 1);
  assert.deepEqual(
    Object.keys(rec.payloads.relevance[0]!).sort(),
    ["draft_vi", "question_vi"],
    "relevance chỉ được thấy câu hỏi + bản nháp (§8.3b)"
  );
  assert.equal(rec.payloads.relevance[0]!.question_vi, CLASSIFIER.normalized_query_vi);
});
