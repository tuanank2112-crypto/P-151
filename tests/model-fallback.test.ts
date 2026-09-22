// tests/model-fallback.test.ts — G34/Đ47: chuỗi model dự phòng cho từng agent.
//
// Canh ba bất biến, bằng transport giả (không gọi mạng, không chờ backoff):
//   1. Model chính 429 ⇒ nhảy sang model kế NGAY (không backoff), kết quả ghi
//      đúng `model` đã dùng — pipeline dựa vào đó để in chặng (R6).
//   2. Chuỗi chỉ có MỘT model ⇒ hành vi cũ giữ nguyên: 429 dai dẳng ⇒ ném
//      `UpstreamRateLimited` sau đủ retry (Golden S14 / Đ45 dựa vào điều này).
//   3. Lỗi KHÔNG phải 429/503 ở model chính (ContractDrift) ⇒ KHÔNG đổi model —
//      đổi model không chữa được lỗi đó và sẽ che nguyên nhân thật.
//
// Từng ĐỎ: gỡ `canFallOver` trong `callGeminiChain` ⇒ ca 1 fail (ném 429).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  __setTransportForTesting,
  agentModelChain,
  runRetriever,
  UpstreamRateLimited,
  ContractDriftError,
} from "../lib/adapters/model.ts";

const VALID_RETRIEVER_BODY = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              draft_vi: "Bể bơi mở cửa 6h–21h.",
              citations: [
                {
                  document_id: "OCP1-POOL-RULES-001",
                  section_id: "POOL-HOURS-01",
                  document_title_vi: "Nội quy bể bơi",
                  heading_vi: "Giờ mở cửa",
                  snippet_vi: "Bể bơi mở cửa 6h–21h.",
                },
              ],
              refused: false,
              refusal_note_vi: null,
            }),
          },
        ],
      },
      finishReason: "STOP",
    },
  ],
  usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 9 },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const INPUT = {
  normalized_query_vi: "giờ mở cửa bể bơi",
  intent: "I-03" as const,
  eligible_chunks: [
    {
      chunk_id: "c1",
      section_id: "POOL-HOURS-01",
      document_id: "OCP1-POOL-RULES-001",
      content_vi: "Bể bơi mở cửa 6h–21h.",
      score: 0.9,
    },
  ],
};

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  return fn().finally(() => {
    for (const k of Object.keys(vars)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });
}

test("agentModelChain — MODEL_A2 dạng danh sách phẩy được tách và kiểm từng phần tử", async () => {
  await withEnv({ MODEL_A2: " gemini-3.6-flash , gemini-2.5-flash " }, async () => {
    assert.deepEqual(agentModelChain("A2"), ["gemini-3.6-flash", "gemini-2.5-flash"]);
  });
  await withEnv({ MODEL_A2: undefined }, async () => {
    assert.deepEqual(agentModelChain("A2"), ["gemini-3.5-flash"]);
  });
  await withEnv({ MODEL_A2: "gemini-3.6-flash,gemini-3.7-flash" }, async () => {
    assert.throws(() => agentModelChain("A2"), /FORBIDDEN_MODELS/);
  });
});

test("chuỗi 2 model — model chính 429 ⇒ dùng model kế NGAY, không backoff, `model` trả về đúng", async () => {
  const urls: string[] = [];
  let slept = 0;
  __setTransportForTesting({
    fetch: async (url) => {
      const u = String(url);
      urls.push(u);
      if (u.includes("gemini-3.6-flash")) return jsonResponse({ error: { message: "quota" } }, 429);
      return jsonResponse(VALID_RETRIEVER_BODY);
    },
    sleep: async () => {
      slept++;
    },
  });
  try {
    await withEnv({ MODEL_A2: "gemini-3.6-flash,gemini-2.5-flash", GEMINI_API_KEY: "test-key" }, async () => {
      const r = await runRetriever(INPUT);
      assert.equal(r.model, "gemini-2.5-flash");
      assert.equal(r.output.refused, false);
      assert.equal(urls.length, 2, "đúng 2 lời gọi: 1 lần 429 ở model chính, 1 lần 200 ở model kế");
      assert.equal(slept, 0, "model không phải cuối KHÔNG được backoff trước khi nhảy");
    });
  } finally {
    __setTransportForTesting(null);
  }
});

test("chuỗi 1 model — 429 dai dẳng ⇒ vẫn ném UpstreamRateLimited sau đủ retry (hành vi cũ, Đ45)", async () => {
  let calls = 0;
  __setTransportForTesting({
    fetch: async () => {
      calls++;
      return jsonResponse({ error: { message: "quota" } }, 429);
    },
    sleep: async () => {},
  });
  try {
    await withEnv({ MODEL_A2: "gemini-3.6-flash", GEMINI_API_KEY: "test-key" }, async () => {
      await assert.rejects(() => runRetriever(INPUT), UpstreamRateLimited);
      assert.equal(calls, 3, "1 lần đầu + 2 retry, như trước khi có chuỗi");
    });
  } finally {
    __setTransportForTesting(null);
  }
});

test("lỗi KHÔNG phải 429/503 ở model chính (JSON vỡ) ⇒ KHÔNG đổi model", async () => {
  const urls: string[] = [];
  __setTransportForTesting({
    fetch: async (url) => {
      urls.push(String(url));
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: "{" }] }, finishReason: "STOP" }],
        usageMetadata: {},
      });
    },
    sleep: async () => {},
  });
  try {
    await withEnv({ MODEL_A2: "gemini-3.6-flash,gemini-2.5-flash", GEMINI_API_KEY: "test-key" }, async () => {
      await assert.rejects(() => runRetriever(INPUT), ContractDriftError);
      assert.ok(
        urls.every((u) => u.includes("gemini-3.6-flash")),
        "mọi lời gọi đều ở model chính — không được lén nhảy sang model kế"
      );
    });
  } finally {
    __setTransportForTesting(null);
  }
});
