// tests/memory.test.ts — H06 W4: bất biến BB-11 ("một câu hỏi ⇒ đúng một
// answer_turns, kể cả khi từ chối/ném lỗi") và R4 ("lịch sử hội thoại bền
// qua phiên"). CHẠY THẬT trên Postgres — trên mock, các hàm ghi của
// DataStore là no-op có ghi chú (Đ24, `lib/adapters/store-mock.ts`), nên
// bất biến này không đo được ở đó.
//
// Tự nạp `.env.local` giống quy ước `scripts/_batch.mjs::loadLocalEnv()`
// (Đ26) — để `npm test` (không có `--env-file`) vẫn thấy được `DATABASE_URL`
// mà không cần nhớ thêm cờ dòng lệnh.
//
// Đếm bằng `scripts/_pg.mjs::makeSql` (KHÔNG import `pg` thẳng trong
// `tests/`) — `answer_turns`/`conversations`/`messages` không có API đếm
// trong `DataStore` (chủ đích: DataStore chỉ phơi thao tác vận hành, không
// phơi truy vấn tuỳ ý). `scripts/` nằm ngoài phạm vi quét của
// `check_adapter_boundary.sh` (chỉ quét `app/` và `lib/`, BB-07), và
// `scripts/sql.mjs` đã dùng đúng driver này cho việc đếm dòng qua CLI.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { makeSql } from "../scripts/_pg.mjs";
import { __setTransportForTesting } from "../lib/adapters/model.ts";
import { __resetDataStoreForTesting, getDataStore } from "../lib/adapters/db.ts";
import { runTurn } from "../lib/pipeline/index.ts";
import type { Principal } from "../lib/types.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.DATA_BACKEND = "postgres";
__resetDataStoreForTesting();

// resident@demo.local — seed cố định (db/migrations + scripts/seed_users.mjs).
// Đo tại chỗ 2026-09-21: `select id from users where email='resident@demo.local'`.
const RESIDENT: Principal = {
  user_id: "86e44c36-0914-4630-ac0e-4b9995d4c7e6",
  role: "resident",
  resident_id: "R-0001",
  owned_property_ids: ["S1.120817"],
  property_type: ["apartment"],
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}
function httpErrorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    text: async () => JSON.stringify({ error: { code: status, message } }),
    json: async () => ({ error: { code: status, message } }),
  } as unknown as Response;
}
function geminiText(obj: unknown): Response {
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
/** Trả `Response` theo mảng, LẶP LẠI phần tử cuối khi hết mảng (như
 *  `tests/pipeline-order.test.ts`) — dùng để giữ một lỗi HTTP xảy ra ở
 *  MỌI lần thử lại, không chỉ lần đầu. */
function sequentialFetch(responses: Response[]) {
  let i = 0;
  return async () => {
    const r = responses[Math.min(i, responses.length - 1)]!;
    i++;
    return r;
  };
}

type Sql = ReturnType<typeof makeSql>;

async function countAnswerTurns(sql: Sql, conversationId: string): Promise<number> {
  const rows = (await sql(
    "select count(*)::int as count from answer_turns where conversation_id = $1",
    [conversationId]
  )) as unknown as Array<{ count: number }>;
  return Number(rows[0]?.count ?? 0);
}

test.afterEach(() => {
  __setTransportForTesting(null);
});

test("BB-11: nhánh escalate (risk gate ở chặng 5, KHÔNG ném lỗi, KHÔNG chạm A2/A3) ghi đúng MỘT answer_turns", async () => {
  const sql = makeSql(process.env.DATABASE_URL!);
  try {
    const store = await getDataStore();
    const conv = await store.createConversation(RESIDENT.user_id);
    const before = await countAnswerTurns(sql, conv.id);

    // Chặng 5 (risk, `hitsRiskKeyword`) khớp trên CHÍNH VĂN BẢN câu hỏi gốc
    // (lib/pipeline/index.ts), không phụ thuộc dữ liệu tri thức/retrieval —
    // nên chỉ cần đúng MỘT lời gọi A1, tất định trên cả mock lẫn Postgres.
    __setTransportForTesting({
      fetch: sequentialFetch([geminiText(classifierBody())]),
      sleep: async () => {},
    });

    const result = await runTurn({
      conversation_id: conv.id,
      question_vi: "Tôi muốn khởi kiện đòi bồi thường vì căn hộ bị hư hỏng.",
      principal: RESIDENT,
    });
    assert.equal(result.decision, "escalate");
    assert.equal(result.reason_code, "legal_or_compensation_escalation");

    const after = await countAnswerTurns(sql, conv.id);
    assert.equal(after - before, 1, "escalate phải ghi đúng 1 answer_turns (BB-11, P02-C10)");

    const rows = (await sql(
      "select decision, reason_code, lifecycle_state from answer_turns where conversation_id = $1",
      [conv.id]
    )) as unknown as Array<{ decision: string; reason_code: string; lifecycle_state: string }>;
    assert.equal(rows[0]!.decision, "escalate");
    assert.equal(rows[0]!.lifecycle_state, "escalated");
    assert.ok(rows[0]!.reason_code, "reason_code không được rỗng khi escalate");
  } finally {
    await sql.end();
  }
});

test("BB-11: nhánh NÉM LỖI (429 hết retry ở A2) vẫn ghi đúng MỘT answer_turns, lifecycle_state=failed", async () => {
  const sql = makeSql(process.env.DATABASE_URL!);
  try {
    const store = await getDataStore();
    const conv = await store.createConversation(RESIDENT.user_id);
    const before = await countAnswerTurns(sql, conv.id);

    // A1 trả bình thường (đi tới chặng draft), A2 luôn 429 — kể cả các lần
    // thử lại (sequentialFetch lặp phần tử cuối) — hết 3 lần thử thì
    // `withUpstreamRetry` ném `UpstreamRateLimited` (lib/adapters/model.ts).
    __setTransportForTesting({
      fetch: sequentialFetch([
        geminiText(classifierBody()),
        httpErrorResponse(429, "quota exceeded (test)"),
      ]),
      sleep: async () => {}, // bỏ backoff thật để test nhanh
    });

    await assert.rejects(
      () =>
        runTurn({
          conversation_id: conv.id,
          question_vi: "Cấp thẻ cư dân lần đầu mất bao lâu?",
          principal: RESIDENT,
        }),
      { name: "UpstreamRateLimited" }
    );

    const after = await countAnswerTurns(sql, conv.id);
    assert.equal(after - before, 1, "nhánh ném lỗi vẫn phải ghi đúng 1 answer_turns (BB-11, P02-C10)");

    const rows = (await sql(
      "select decision, reason_code, lifecycle_state from answer_turns where conversation_id = $1",
      [conv.id]
    )) as unknown as Array<{ decision: string; reason_code: string; lifecycle_state: string }>;
    assert.equal(rows[0]!.decision, "escalate");
    assert.equal(rows[0]!.reason_code, "system_error");
    assert.equal(rows[0]!.lifecycle_state, "failed");
  } finally {
    await sql.end();
  }
});

test("R4/W3: hai messages mỗi lượt (hỏi + đáp) khi decision=answer, user_message_id khớp answer_turns", async () => {
  const sql = makeSql(process.env.DATABASE_URL!);
  try {
    const store = await getDataStore();
    const conv = await store.createConversation(RESIDENT.user_id);

    __setTransportForTesting({
      fetch: sequentialFetch([
        geminiText(classifierBody()),
        geminiText({
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
        }),
        geminiText({
          claims: [
            {
              claim_vi: "Thẻ cấp trong 3 ngày làm việc",
              verdict: "supported",
              supporting_section_id: "CARD-NEW-02",
            },
          ],
          faithfulness: 1,
        }),
      ]),
      sleep: async () => {},
    });

    const result = await runTurn({
      conversation_id: conv.id,
      question_vi: "Cấp thẻ cư dân lần đầu mất bao lâu?",
      principal: RESIDENT,
    });
    assert.equal(result.decision, "answer");

    const messages = (await sql(
      "select id, role, content_vi from messages where conversation_id = $1 order by created_at asc",
      [conv.id]
    )) as unknown as Array<{ id: string; role: string; content_vi: string }>;
    assert.equal(messages.length, 2, "đúng 1 message user + 1 message assistant mỗi lượt trả lời");
    assert.equal(messages[0]!.role, "user");
    assert.equal(messages[1]!.role, "assistant");
    assert.equal(messages[1]!.content_vi, result.answer_vi);

    const turns = (await sql(
      "select user_message_id, assistant_message_id from answer_turns where conversation_id = $1",
      [conv.id]
    )) as unknown as Array<{ user_message_id: string; assistant_message_id: string | null }>;
    assert.equal(turns.length, 1);
    assert.equal(turns[0]!.user_message_id, messages[0]!.id);
    assert.equal(turns[0]!.assistant_message_id, messages[1]!.id);
  } finally {
    await sql.end();
  }
});

test("W3: conversation_id do route tạo (createConversation) và hội thoại đọc lại được nguyên vẹn (getConversationOwner + listMessages)", async () => {
  const sql = makeSql(process.env.DATABASE_URL!);
  try {
    const store = await getDataStore();
    const conv = await store.createConversation(RESIDENT.user_id);

    const owner = await store.getConversationOwner(conv.id);
    assert.equal(owner, RESIDENT.user_id);

    const strangerOwner = await store.getConversationOwner("00000000-0000-4000-8000-999999999999");
    assert.equal(strangerOwner, null, "conversation_id không tồn tại ⇒ null (ConversationNotOwned ở route)");

    await store.appendMessage(conv.id, "user", "câu hỏi 1");
    await store.appendMessage(conv.id, "assistant", "đáp 1");
    const msgs = await store.listMessages(conv.id);
    assert.equal(msgs.length, 2);
    assert.deepEqual(
      msgs.map((m) => m.role),
      ["user", "assistant"]
    );
  } finally {
    await sql.end();
  }
});
