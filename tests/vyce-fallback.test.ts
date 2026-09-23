// tests/vyce-fallback.test.ts — Đ53: Vyce CHỈ là fallback sau khi cả chuỗi
// Gemini 429/503; output Vyce vẫn qua Zod (lệch ⇒ ContractDriftError, không
// xanh giả — lý do Đ22 từng bác Vyce). Transport giả, không gọi mạng.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  __internal,
  __setTransportForTesting,
  ContractDriftError,
  UpstreamRateLimited,
  runClassifier,
} from "../lib/adapters/model.ts";

const SCHEMA = { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } }, required: ["ok"] };

function fakeTransport(vyceContent: string) {
  const calls: string[] = [];
  const f = (async (url: string | URL) => {
    const u = String(url);
    if (u.includes("generativelanguage.googleapis.com")) {
      calls.push("gemini");
      return new Response("quota", { status: 429 });
    }
    calls.push("vyce");
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: vyceContent }, finish_reason: "stop" }],
        usage: { prompt_tokens: 11, completion_tokens: 7 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;
  __setTransportForTesting({ fetch: f, sleep: async () => {} });
  return calls;
}

function setEnv(vyce: boolean) {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.MODEL_A1 = "gemini-3.5-flash-lite,gemini-2.5-flash";
  if (vyce) {
    process.env.VYCE_API_KEY = "test-vyce";
    process.env.MODEL_FALLBACK_VYCE = "claude-sonnet-4-6";
  } else {
    delete process.env.VYCE_API_KEY;
    process.env.MODEL_FALLBACK_VYCE = "claude-sonnet-4-6";
  }
}

afterEach(() => {
  __setTransportForTesting(null);
  delete process.env.MODEL_FALLBACK_VYCE;
  delete process.env.VYCE_API_KEY;
});

test("Đ53 (a) cả chuỗi Gemini 429 ⇒ gọi Vyce, trả model có tiền tố vyce:, JSON bóc khỏi rào ```", async () => {
  setEnv(true);
  const calls = fakeTransport('```json\n{"ok": true}\n```');
  const r = await __internal.callGeminiChain("A1", "sys", { q: 1 }, SCHEMA, 100);
  assert.equal(r.model, "vyce:claude-sonnet-4-6");
  assert.deepEqual(JSON.parse(r.raw), { ok: true });
  assert.equal(r.input_tokens, 11);
  assert.equal(r.output_tokens, 7);
  assert.equal(calls.filter((c) => c === "vyce").length, 1);
  assert.ok(calls.indexOf("vyce") > calls.lastIndexOf("gemini"), "Vyce chỉ được gọi SAU Gemini");
});

test("Đ53 (b) Vyce trả văn xuôi ⇒ ContractDriftError qua Zod (không xanh giả — Đ22)", async () => {
  setEnv(true);
  fakeTransport("Thế nào, tôi sẽ trả lời bạn một cách rõ ràng.");
  await assert.rejects(
    () => runClassifier({} as never),
    (e: unknown) => e instanceof ContractDriftError
  );
});

test("Đ53 (c) thiếu VYCE_API_KEY ⇒ KHÔNG gọi Vyce, ném 429 như cũ", async () => {
  setEnv(false);
  const calls = fakeTransport('{"ok": true}');
  await assert.rejects(
    () => __internal.callGeminiChain("A1", "sys", {}, SCHEMA, 100),
    (e: unknown) => e instanceof UpstreamRateLimited
  );
  assert.equal(calls.filter((c) => c === "vyce").length, 0);
});

test("Đ53 (d) lỗi bơm có chủ đích (forceUpstreamError) KHÔNG được Vyce chữa", async () => {
  setEnv(true);
  const calls = fakeTransport('{"ok": true}');
  await assert.rejects(
    () => __internal.callGeminiChain("A1", "sys", {}, SCHEMA, 100, "429"),
    (e: unknown) => e instanceof UpstreamRateLimited
  );
  assert.equal(calls.filter((c) => c === "vyce").length, 0);
});

test("Đ53 (e) chủ tịch chốt: DeepSeek SOẠN (A2), Sonnet CHẤM (A3) qua MODEL_FALLBACK_VYCE_A2/_A3", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.MODEL_A2 = "gemini-3.5-flash";
  process.env.MODEL_A3 = "gemini-2.5-flash";
  process.env.VYCE_API_KEY = "test-vyce";
  process.env.MODEL_FALLBACK_VYCE_A2 = "deepseek-v4.1,claude-sonnet-4-6";
  process.env.MODEL_FALLBACK_VYCE_A3 = "claude-sonnet-4-6,deepseek-v4.1";
  fakeTransport('{"ok": true}');
  try {
    const a2 = await __internal.callGeminiChain("A2", "sys", {}, SCHEMA, 100);
    const a3 = await __internal.callGeminiChain("A3", "sys", {}, SCHEMA, 100);
    assert.equal(a2.model, "vyce:deepseek-v4.1");
    assert.equal(a3.model, "vyce:claude-sonnet-4-6");
  } finally {
    delete process.env.MODEL_FALLBACK_VYCE_A2;
    delete process.env.MODEL_FALLBACK_VYCE_A3;
  }
});
