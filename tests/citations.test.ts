import { test } from "node:test";
import assert from "node:assert/strict";
import { __setTransportForTesting } from "../lib/adapters/model.ts";
import { conversationIdFromLabel } from "../lib/adapters/db.ts";
import { runTurn } from "../lib/pipeline/index.ts";
import { PipelineInvariantError } from "../lib/pipeline/errors.ts";
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

test("citation (BB-04, P02-C6, T-CITE, R6): A2 bịa section_id lạ ⇒ PipelineInvariantError, KHÔNG lọc im lặng", async () => {
  __setTransportForTesting({
    fetch: sequentialFetch([
      classifierBody(),
      {
        draft_vi: "Bịa một câu trả lời.",
        citations: [
          { document_id: "OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001", section_id: "SECTION-KHONG-TON-TAI", document_title_vi: "x", heading_vi: "x", snippet_vi: "x" },
        ],
        refused: false,
        refusal_note_vi: null,
      },
    ]),
    sleep: async () => {},
  });

  await assert.rejects(
    () =>
      runTurn({
        conversation_id: conversationIdFromLabel("cit1"),
        question_vi: "Cấp thẻ cư dân lần đầu mất bao lâu?",
        principal: RESIDENT,
      }),
    (err: Error) => {
      assert.ok(err instanceof PipelineInvariantError);
      assert.match(err.message, /section_id lạ/);
      return true;
    }
  );
});

test("citation: decision=answer nhưng A3 khiến citations rỗng KHÔNG THỂ xảy ra vì A2 citations giữ nguyên — kiểm bất biến BB-04 khi A2 trả citations=[] và vẫn không refuse", async () => {
  __setTransportForTesting({
    fetch: sequentialFetch([
      classifierBody(),
      { draft_vi: "Trả lời không trích dẫn.", citations: [], refused: false, refusal_note_vi: null },
      { claims: [], faithfulness: 0 },
    ]),
    sleep: async () => {},
  });

  // faithfulness=0 (không claim nào) sẽ escalate ở G4 TRƯỚC khi chạm tới kiểm
  // tra citations=[] cho decision=answer — đây chính là ca biên W10 của §6.3.
  // Ta xác nhận nó escalate đúng, KHÔNG lọt qua thành answer rỗng-căn-cứ.
  const result = await runTurn({
    conversation_id: conversationIdFromLabel("cit2"),
    question_vi: "Cấp thẻ cư dân lần đầu mất bao lâu?",
    principal: RESIDENT,
  });
  assert.equal(result.decision, "escalate");
  assert.equal(result.gate_triggered, "G4_faithfulness_floor");
});
