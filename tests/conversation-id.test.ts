// tests/conversation-id.test.ts — R13 (Đ37): `conversation_id` phải là
// uuid, và cùng nhãn phải nối lại ĐÚNG cuộc hội thoại cũ (bộ chạy Golden có
// `--resume`, SPEC-P02 §7 + Đ26). CHẠY THẬT trên Postgres cho phần tích
// hợp — `conversations.id`/`answer_turns.conversation_id`/`users.id` chỉ có
// ý nghĩa uuid thật ở đó; phần thuần (hàm băm/kiểm hình dạng) không cần DB.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { makeSql } from "../scripts/_pg.mjs";
import { __setTransportForTesting } from "../lib/adapters/model.ts";
import {
  __resetDataStoreForTesting,
  conversationIdFromLabel,
  getDataStore,
  isValidUuid,
} from "../lib/adapters/db.ts";
import { runTurn } from "../lib/pipeline/index.ts";
import type { Principal } from "../lib/types.ts";
import { deleteConversations } from "./_pg-cleanup.ts";

// H17 W2 (G37): gom `conversation_id` các test tích hợp tạo ra thật trên
// Postgres, xoá hết ở cuối file — cascade tự xoá messages/answer_turns
// (db/migrations/004). Phần "thuần" (conversationIdFromLabel/isValidUuid)
// không chạm DB nên không cần gom.
const createdConversationIds: string[] = [];
test.after(async () => {
  if (createdConversationIds.length === 0) return;
  const sql = makeSql(process.env.DATABASE_URL!);
  try {
    await deleteConversations(sql, createdConversationIds);
  } finally {
    await sql.end();
  }
});

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.DATA_BACKEND = "postgres";
__resetDataStoreForTesting();

// R14 mục 6 — KHÔNG hardcode uuid snapshot của `resident@demo.local`:
// `db/migrations/002_users.sql:14` là `DEFAULT gen_random_uuid()`, id đổi
// sau mỗi lần seed lại. Tra SỐNG qua `findUserByEmail()`, giống
// `scripts/_fixtures.mjs`.
const residentStore = await getDataStore();
const residentUser = await residentStore.findUserByEmail("resident@demo.local");
if (!residentUser) {
  throw new Error(
    "Seed thiếu tài khoản resident@demo.local — chạy `npm run db:seed:users` trước khi test."
  );
}

const RESIDENT: Principal = {
  user_id: residentUser.id,
  role: "resident",
  resident_id: "R-0001",
  owned_property_ids: ["S1.120817"],
  property_type: ["apartment"],
};

// ── Phần thuần: conversationIdFromLabel / isValidUuid ───────────────────────

test("conversationIdFromLabel: TẤT ĐỊNH — cùng nhãn luôn ra cùng uuid (mọi lần gọi)", () => {
  const a = conversationIdFromLabel("golden-faq-S03");
  const b = conversationIdFromLabel("golden-faq-S03");
  const c = conversationIdFromLabel("golden-faq-S03");
  assert.equal(a, b);
  assert.equal(b, c);
});

test("conversationIdFromLabel: khác nhãn ra khác uuid", () => {
  const a = conversationIdFromLabel("golden-faq-S03");
  const b = conversationIdFromLabel("golden-faq-S04");
  const c = conversationIdFromLabel("golden-safety-S03"); // khác cả tiền tố
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(b, c);
});

test("conversationIdFromLabel: output đúng hình dạng uuid Postgres chấp nhận (isValidUuid)", () => {
  for (const label of ["golden-faq-S03", "trace-sample", "probe-defects-DEF-01-1", ""]) {
    const id = conversationIdFromLabel(label);
    assert.equal(isValidUuid(id), true, `"${id}" (từ nhãn "${label}") phải là uuid hợp lệ`);
  }
});

test("Đ37 — nhãn dạng chữ THÔ (đúng lớp lỗi từng làm insert vỡ trên Postgres thật) KHÔNG phải uuid hợp lệ", () => {
  assert.equal(isValidUuid("golden-faq-S03"), false);
  assert.equal(isValidUuid("trace-sample"), false);
  assert.equal(isValidUuid("probe-defects-DEF-01-1"), false);
  assert.equal(isValidUuid("demo-resident-0001"), false);
});

// ── Phần tích hợp thật trên Postgres ─────────────────────────────────────

test("Đ37/Đ43 (thật, Postgres): appendMessage với conversation_id dạng chữ THÔ ném đúng lỗi uuid TRƯỚC khi chạm DB — mọi lệnh ghi phải qua conversationIdFromLabel() trước", async () => {
  const store = await getDataStore();
  await assert.rejects(
    () => store.appendMessage("golden-faq-uuid-red-test", "user", "câu hỏi test"),
    (err: Error) => {
      assert.match(err.message, /không phải uuid hợp lệ/i);
      return true;
    }
  );
});

test("Đ37/Đ43 (thật, Postgres): insertAnswerTurn với conversation_id dạng chữ THÔ cũng ném — cổng canh KHÔNG chỉ ở appendMessage", async () => {
  const store = await getDataStore();
  await assert.rejects(
    () =>
      store.insertAnswerTurn({
        conversation_id: "golden-faq-uuid-red-test-2",
        user_message_id: crypto.randomUUID(),
        assistant_message_id: null,
        question_vi: "câu hỏi test",
        detected_intent: null,
        lifecycle_state: "failed",
        decision: "escalate",
        reason_code: "system_error",
        confidence: 0,
        gate_triggered: null,
        citations: [],
        claims: [],
        latency_ms: 0,
        is_golden_run: false,
        golden_case_id: null,
      }),
    (err: Error) => {
      assert.match(err.message, /không phải uuid hợp lệ/i);
      return true;
    }
  );
});

test("Đ43 (thật, mock): appendMessage/insertAnswerTurn với conversation_id dạng chữ THÔ cũng ném ở kho MOCK — mock phải khó tính đúng bằng Postgres, đây là cơ chế đã sinh ra G26 (R14 mục 4)", async () => {
  const prevBackend = process.env.DATA_BACKEND;
  process.env.DATA_BACKEND = "mock";
  __resetDataStoreForTesting();
  try {
    const mockStore = await getDataStore();
    assert.equal(mockStore.backend, "mock");
    await assert.rejects(
      () => mockStore.appendMessage("c1", "user", "câu hỏi test"),
      (err: Error) => {
        assert.match(err.message, /không phải uuid hợp lệ/i);
        return true;
      }
    );
    await assert.rejects(
      () =>
        mockStore.insertAnswerTurn({
          conversation_id: "c1",
          user_message_id: crypto.randomUUID(),
          assistant_message_id: null,
          question_vi: "câu hỏi test",
          detected_intent: null,
          lifecycle_state: "failed",
          decision: "escalate",
          reason_code: "system_error",
          confidence: 0,
          gate_triggered: null,
          citations: [],
          claims: [],
          latency_ms: 0,
          is_golden_run: false,
          golden_case_id: null,
        }),
      (err: Error) => {
        assert.match(err.message, /không phải uuid hợp lệ/i);
        return true;
      }
    );
  } finally {
    process.env.DATA_BACKEND = prevBackend;
    __resetDataStoreForTesting();
  }
});

test("Đ37 (thật, Postgres): runTurn() với conversation_id = conversationIdFromLabel(nhãn) — CHƯA từng có createConversation() — vẫn ghi được trọn vẹn (createConversationIfMissing tự tạo hàng conversations)", async () => {
  const sql = makeSql(process.env.DATABASE_URL!);
  try {
    const label = `golden-faq-uuid-e2e-${Date.now()}`; // nhãn mới tinh, chưa ai tạo hội thoại
    const conversationId = conversationIdFromLabel(label);
    assert.equal(isValidUuid(conversationId), true);
    createdConversationIds.push(conversationId);

    __setTransportForTesting({
      fetch: async () =>
        ({
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        intent: "unsupported",
                        is_emergency: false,
                        is_legal_or_compensation: false,
                        target_subjects: { resident_ids: [], property_ids: [] },
                        missing_required_fields: [],
                        clarify_question_vi: null,
                        normalized_query_vi: "câu hỏi ngoài phạm vi",
                      }),
                    },
                  ],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
          }),
        }) as unknown as Response,
      sleep: async () => {},
    });

    const result = await runTurn({
      conversation_id: conversationId,
      question_vi: "Câu hỏi không thuộc 5 intent hỗ trợ.",
      principal: RESIDENT,
    });
    assert.equal(result.decision, "escalate");
    assert.equal(result.reason_code, "unsupported_intent");

    const convRows = (await sql("select id, user_id from conversations where id = $1", [
      conversationId,
    ])) as unknown as Array<{ id: string; user_id: string }>;
    assert.equal(convRows.length, 1, "phải tự tạo đúng 1 hàng conversations (createConversationIfMissing)");
    assert.equal(convRows[0]!.user_id, RESIDENT.user_id);

    const turnRows = (await sql(
      "select count(*)::int as count from answer_turns where conversation_id = $1",
      [conversationId]
    )) as unknown as Array<{ count: number }>;
    assert.equal(turnRows[0]!.count, 1);
  } finally {
    __setTransportForTesting(null);
    await sql.end();
  }
});

test("Đ37 (thật, Postgres) — TẤT ĐỊNH qua 'resume': gọi runTurn() HAI LẦN với CÙNG nhãn ⇒ CÙNG conversation_id, messages nối tiếp (không đẻ hội thoại mới)", async () => {
  const sql = makeSql(process.env.DATABASE_URL!);
  try {
    const label = `golden-faq-uuid-resume-${Date.now()}`;
    const idFirstCall = conversationIdFromLabel(label);
    const idSecondCall = conversationIdFromLabel(label); // mô phỏng lượt --resume gọi lại
    assert.equal(idFirstCall, idSecondCall, "cùng nhãn phải ra cùng uuid giữa hai lượt chạy");
    createdConversationIds.push(idFirstCall); // idSecondCall === idFirstCall, một id là đủ

    const unsupportedFetch = async () =>
      ({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      intent: "unsupported",
                      is_emergency: false,
                      is_legal_or_compensation: false,
                      target_subjects: { resident_ids: [], property_ids: [] },
                      missing_required_fields: [],
                      clarify_question_vi: null,
                      normalized_query_vi: "câu hỏi ngoài phạm vi",
                    }),
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 },
        }),
      }) as unknown as Response;

    __setTransportForTesting({ fetch: unsupportedFetch, sleep: async () => {} });
    await runTurn({
      conversation_id: idFirstCall,
      question_vi: "Câu hỏi lượt 1.",
      principal: RESIDENT,
    });
    __setTransportForTesting({ fetch: unsupportedFetch, sleep: async () => {} });
    await runTurn({
      conversation_id: idSecondCall,
      question_vi: "Câu hỏi lượt 2 (mô phỏng --resume, cùng nhãn).",
      principal: RESIDENT,
    });
    __setTransportForTesting(null);

    const convRows = (await sql("select count(*)::int as count from conversations where id = $1", [
      idFirstCall,
    ])) as unknown as Array<{ count: number }>;
    assert.equal(convRows[0]!.count, 1, "CHỈ đúng 1 hàng conversations cho cùng nhãn — không đẻ hội thoại mới");

    const msgRows = (await sql(
      "select count(*)::int as count from messages where conversation_id = $1",
      [idFirstCall]
    )) as unknown as Array<{ count: number }>;
    assert.equal(msgRows[0]!.count, 2, "2 lượt hỏi ⇒ 2 messages user, NỐI TIẾP cùng một hội thoại");
  } finally {
    __setTransportForTesting(null);
    await sql.end();
  }
});
