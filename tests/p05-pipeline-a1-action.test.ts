// tests/p05-pipeline-a1-action.test.ts — H20 W1: hợp đồng A1 có thêm trường
// `action` (Đ48, 01-CONTRACTS §8.1 mở rộng).
//
// KHÔNG gọi model thật: transport giả qua `__setTransportForTesting`, đúng mẫu
// `tests/pii-other-party.test.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  __setTransportForTesting,
  runClassifier,
  ClassifierOutputSchema,
  CLASSIFIER_RESPONSE_SCHEMA,
  EMPTY_ACTION_REQUEST,
} from "../lib/adapters/model.ts";
import { conversationIdFromLabel } from "../lib/adapters/db.ts";
import { runTurn } from "../lib/pipeline/index.ts";
import { __setSimBackendForTesting } from "../lib/simbackend/index.ts";
import { FakeSimBackend, FAKE_SLOT_START, fakeBooking } from "./_fake-simbackend.ts";
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

const SIM_NOW_2339 = new Date("2026-09-20T23:39:00+07:00");

function geminiText(obj: unknown): Response {
  const body = {
    candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
  };
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

function classifierBody(overrides: Record<string, unknown> = {}) {
  return {
    intent: "I-03",
    is_emergency: false,
    is_legal_or_compensation: false,
    target_subjects: { resident_ids: [], property_ids: [] },
    missing_required_fields: [],
    clarify_question_vi: null,
    normalized_query_vi: "đặt sân bóng bàn 9 giờ sáng mai",
    ...overrides,
  };
}

function actionBody(overrides: Record<string, unknown> = {}) {
  return { ...EMPTY_ACTION_REQUEST, ...overrides };
}

test.afterEach(() => {
  __setTransportForTesting(null);
  __setSimBackendForTesting(null);
});

// ─────────────────────────────────────────────────────────────────────────
// Hợp đồng schema
// ─────────────────────────────────────────────────────────────────────────

test("W1 schema-parity: `action` có mặt ở CẢ Zod lẫn responseSchema.required", () => {
  assert.ok(Object.keys(ClassifierOutputSchema.shape).includes("action"));
  assert.ok(CLASSIFIER_RESPONSE_SCHEMA.required.includes("action"));
  assert.deepEqual(
    [...CLASSIFIER_RESPONSE_SCHEMA.required].sort(),
    Object.keys(ClassifierOutputSchema.shape).sort()
  );
});

test("W1 tương thích ngược: A1 KHÔNG trả `action` ⇒ Zod điền mặc định không-hành-động", () => {
  const parsed = ClassifierOutputSchema.parse(classifierBody());
  assert.deepEqual(parsed.action, { ...EMPTY_ACTION_REQUEST });
  assert.equal(parsed.action.capability, null);
  assert.equal(parsed.action.confirmed, false);
});

test("W1 tập đóng capability: giá trị lạ bị Zod chặn, không lọt vào pipeline", () => {
  const bad = classifierBody({ action: actionBody({ capability: "billing.pay_invoice" }) });
  assert.equal(ClassifierOutputSchema.safeParse(bad).success, false);
});

test("W1 prompt A1 nêu đủ 3 capability, quy tắc null cho câu hỏi và mốc server_time", () => {
  const requests: Array<{ body: string }> = [];
  __setTransportForTesting({
    fetch: async (_url: unknown, init: unknown) => {
      requests.push({ body: String((init as { body: string }).body) });
      return geminiText(classifierBody({ action: actionBody() }));
    },
    sleep: async () => {},
  });
  return runClassifier({
    question_vi: "Đặt giúp tôi sân bóng bàn 9 giờ sáng mai.",
    conversation_tail: [],
    principal_summary: { owned_property_ids: ["S1.120817"], property_type: ["apartment"] },
    server_time: "2026-09-20T23:39:00+07:00",
  }).then(() => {
    const sent = requests[0]!.body;
    const system = JSON.parse(sent).systemInstruction.parts[0].text as string;
    for (const cap of [
      "amenity.create_booking",
      "amenity.cancel_booking",
      "amenity.list_my_bookings",
    ]) {
      assert.ok(system.includes(cap), `prompt phải nêu ${cap}`);
    }
    assert.ok(system.includes("server_time"), "prompt phải bảo A1 quy đổi theo server_time");
    assert.ok(
      system.includes("action.capability = null"),
      "prompt phải nói rõ câu HỎI thì capability = null"
    );
    // `server_time` phải thật sự được GỬI ĐI, có offset +07:00 chứ không phải 'Z'.
    assert.ok(sent.includes("2026-09-20T23:39:00+07:00"));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Ba câu: đặt / huỷ / hỏi nội quy ⇒ đúng capability và đúng nhánh pipeline
// ─────────────────────────────────────────────────────────────────────────

test("W1 câu ĐẶT ⇒ capability=create_booking, pipeline đi nhánh action (không retrieval)", async () => {
  const backend = new FakeSimBackend();
  __setSimBackendForTesting(backend);
  __setTransportForTesting({
    fetch: async () =>
      geminiText(
        classifierBody({
          action: actionBody({
            capability: "amenity.create_booking",
            facility_hint_vi: "sân bóng bàn",
            slot_start: FAKE_SLOT_START,
            party_size: 1,
          }),
        })
      ),
    sleep: async () => {},
  });

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("a1-create"),
    question_vi: "Đặt giúp tôi sân bóng bàn 9 giờ sáng mai.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "action");
  const steps = r.steps.map((s) => s.step);
  assert.deepEqual(steps, ["validate", "safety", "intent", "context", "risk", "action"]);
  assert.ok(!steps.includes("retrieval"), "lượt hành động KHÔNG đi retrieval");
});

test("W1 câu HUỶ ⇒ capability=cancel_booking, lượt 1 hỏi xác nhận (B2)", async () => {
  const backend = new FakeSimBackend({ bookingDetail: fakeBooking() });
  __setSimBackendForTesting(backend);
  __setTransportForTesting({
    fetch: async () =>
      geminiText(
        classifierBody({
          normalized_query_vi: "huỷ chỗ sân bóng bàn",
          action: actionBody({ capability: "amenity.cancel_booking", booking_ref: "BK-0001" }),
        })
      ),
    sleep: async () => {},
  });

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("a1-cancel"),
    question_vi: "Huỷ giúp tôi chỗ BK-0001.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "clarify");
  assert.equal(r.reason_code, "action_irreversible_requires_confirmation");
  assert.equal(r.action_result?.status, "needs_confirmation");
});

test("W1 câu HỎI NỘI QUY ⇒ capability=null, pipeline đi retrieval như cũ", async () => {
  const backend = new FakeSimBackend();
  __setSimBackendForTesting(backend);
  __setTransportForTesting({
    fetch: async () =>
      geminiText(
        classifierBody({
          normalized_query_vi: "pickleball" /* Đ59b: "sân"/"giờ" nay khớp TIÊU ĐỀ "Giờ hoạt động Sân chơi trẻ em" ở mock — dùng từ chắc chắn vắng trong kho để giữ ca zero-eligible */,
          action: actionBody(), // capability = null
        })
      ),
    sleep: async () => {},
  });

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("a1-ask"),
    question_vi: "Sân bóng bàn mở cửa mấy giờ?",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.ok(r.steps.map((s) => s.step).includes("retrieval"), "câu hỏi phải đi retrieval");
  assert.equal(
    r.steps.find((s) => s.step === "action"),
    undefined,
    "câu hỏi KHÔNG được chạm nhánh action"
  );
  assert.equal(backend.calls.length, 0, "câu hỏi KHÔNG gọi backend hành động lần nào");
});
