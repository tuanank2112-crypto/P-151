import { test } from "node:test";
import assert from "node:assert/strict";
import {
  __setTransportForTesting,
  __internal,
  CLASSIFIER_RESPONSE_SCHEMA,
} from "../lib/adapters/model.ts";

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-not-real";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

function httpErrorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    text: async () => message,
    json: async () => ({ error: { message } }),
  } as unknown as Response;
}

const VALID_CLASSIFIER_BODY = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              intent: "I-03",
              is_emergency: false,
              is_legal_or_compensation: false,
              target_subjects: { resident_ids: [], property_ids: [] },
              missing_required_fields: [],
              clarify_question_vi: null,
              normalized_query_vi: "test",
            }),
          },
        ],
      },
      finishReason: "STOP",
    },
  ],
  usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
};

test.after(() => {
  __setTransportForTesting(null);
});

test("backoff: HTTP 429 retry rồi thành công (E2, backoff 2s→8s+jitter)", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  __setTransportForTesting({
    fetch: async () => {
      calls++;
      if (calls === 1) return httpErrorResponse(429, "You exceeded your current quota");
      return jsonResponse(VALID_CLASSIFIER_BODY);
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  const result = await __internal.callGemini(
    "gemini-3.5-flash-lite",
    "sys",
    { q: 1 },
    CLASSIFIER_RESPONSE_SCHEMA,
    2048
  );

  assert.equal(calls, 2, "phải retry đúng 1 lần rồi thành công (2 lần gọi tổng)");
  assert.equal(sleeps.length, 1);
  assert.ok(sleeps[0] >= 2000 && sleeps[0] <= 2500, `backoff 429 phải bắt đầu ở 2s + jitter, được ${sleeps[0]}ms`);
  const parsed = JSON.parse(result.raw);
  assert.equal(parsed.intent, "I-03");
});

test("backoff: HTTP 503 retry rồi thành công — Y NHƯ 429, KHÔNG gộp vào 5xx retry nhanh (E2b, Đ19)", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  __setTransportForTesting({
    fetch: async () => {
      calls++;
      if (calls === 1) return httpErrorResponse(503, "high demand");
      return jsonResponse(VALID_CLASSIFIER_BODY);
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  const result = await __internal.callGemini(
    "gemini-3.5-flash-lite",
    "sys",
    { q: 1 },
    CLASSIFIER_RESPONSE_SCHEMA,
    2048
  );

  assert.equal(calls, 2);
  assert.equal(sleeps.length, 1);
  assert.ok(
    sleeps[0] >= 2000 && sleeps[0] <= 2500,
    `503 phải dùng CÙNG backoff 2s→8s như 429, KHÔNG phải 1s→3s của 5xx khác — được ${sleeps[0]}ms`
  );
  const parsed = JSON.parse(result.raw);
  assert.equal(parsed.intent, "I-03");
});

test("backoff: HTTP 401 KHÔNG retry (E2d, UpstreamAuthError, CẤM in khoá)", async () => {
  let calls = 0;
  __setTransportForTesting({
    fetch: async () => {
      calls++;
      return httpErrorResponse(401, "invalid api key AIzaSySECRET");
    },
    sleep: async () => {},
  });

  await assert.rejects(
    () => __internal.callGemini("gemini-3.5-flash-lite", "sys", {}, CLASSIFIER_RESPONSE_SCHEMA, 2048),
    (err: Error) => {
      assert.equal(err.name, "UpstreamAuthError");
      assert.ok(!err.message.includes("AIzaSy"), "thông báo lỗi CẤM chứa khoá");
      return true;
    }
  );
  assert.equal(calls, 1, "401 KHÔNG được retry");
});

test("backoff: content blocked KHÔNG retry, escalate ngay (E2e)", async () => {
  let calls = 0;
  __setTransportForTesting({
    fetch: async () => {
      calls++;
      return jsonResponse({ promptFeedback: { blockReason: "SAFETY" } });
    },
    sleep: async () => {},
  });

  await assert.rejects(
    () => __internal.callGemini("gemini-3.5-flash-lite", "sys", {}, CLASSIFIER_RESPONSE_SCHEMA, 2048),
    { name: "UpstreamContentBlocked" }
  );
  assert.equal(calls, 1, "content blocked KHÔNG được retry — cùng input cho cùng kết quả");
});

test("backoff: finishReason khác STOP ⇒ ContractDriftError, retry ĐÚNG 1 lần (E7)", async () => {
  let calls = 0;
  __setTransportForTesting({
    fetch: async () => {
      calls++;
      if (calls <= 2) {
        return jsonResponse({
          candidates: [{ content: { parts: [{ text: "{" }] }, finishReason: "MAX_TOKENS" }],
          usageMetadata: {},
        });
      }
      return jsonResponse(VALID_CLASSIFIER_BODY);
    },
    sleep: async () => {},
  });

  await assert.rejects(
    () => __internal.callGemini("gemini-3.5-flash-lite", "sys", {}, CLASSIFIER_RESPONSE_SCHEMA, 2048),
    { name: "ContractDriftError" }
  );
  assert.equal(calls, 2, "ContractDriftError chỉ được retry ĐÚNG 1 lần (tổng 2 lần gọi)");
});
