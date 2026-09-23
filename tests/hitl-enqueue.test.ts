// tests/hitl-enqueue.test.ts — H16 W1: `insertAnswerTurn` (Postgres) phải
// enqueue đúng SPEC-P03 §3.1 ("mọi answer_turn có decision='escalate' ⇒ một
// dòng review_queue pending, cùng transaction") và tôn trọng vùng cấm
// P03-C3 (CẤM đưa decision='answer' vào hàng đợi) cùng quyết định chốt bởi
// SO ở handoff H16 §3 W1: golden run (`is_golden_run=true`) KHÔNG enqueue.
//
// CHẠY THẬT trên Postgres — nạp env như `tests/memory.test.ts`. Đếm bằng
// `scripts/_pg.mjs::makeSql` (KHÔNG import `pg` thẳng trong `tests/`, giống
// quy ước `tests/memory.test.ts`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { makeSql } from "../scripts/_pg.mjs";
import { __resetDataStoreForTesting, getDataStore } from "../lib/adapters/db.ts";
import type { AnswerTurnInput } from "../lib/adapters/db.ts";
import { isReviewRowLocked, sortReviewQueueRows } from "../app/(bql)/review/queue-logic.ts";
import type { ReviewQueueRow } from "../lib/adapters/bql-store.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.DATA_BACKEND = "postgres";
__resetDataStoreForTesting();

type Sql = ReturnType<typeof makeSql>;

function baseInput(overrides: Partial<AnswerTurnInput> & { conversation_id: string; user_message_id: string }): AnswerTurnInput {
  return {
    assistant_message_id: null,
    question_vi: "Câu hỏi đo H16 W1.",
    detected_intent: null,
    lifecycle_state: "escalated",
    decision: "escalate",
    reason_code: "no_eligible_source",
    confidence: 0,
    gate_triggered: null,
    citations: [],
    claims: [],
    latency_ms: 1,
    is_golden_run: false,
    golden_case_id: null,
    // H25 W1/W6 — không quan tâm nội dung ở test này, giá trị rỗng hợp lệ.
    pipeline_steps: [],
    s1_retrieval_top1: 0,
    s2_eligible_ratio: 0,
    s3_faithfulness: 0,
    s4_conflict: false,
    rejection_histogram: {},
    ...overrides,
  };
}

async function reviewQueueRowsFor(sql: Sql, conversationId: string) {
  return (await sql(
    `select r.id, r.answer_turn_id, r.state, r.original_draft_vi
       from review_queue r
       join answer_turns a on a.id = r.answer_turn_id
      where a.conversation_id = $1`,
    [conversationId]
  )) as unknown as Array<{
    id: string;
    answer_turn_id: string;
    state: string;
    original_draft_vi: string;
  }>;
}

test("H16 W1: decision='escalate' + is_golden_run=false ⇒ đúng 1 dòng review_queue pending trỏ đúng answer_turn_id", async () => {
  const sql = makeSql(process.env.DATABASE_URL!);
  try {
    const store = await getDataStore();
    const conv = await store.createConversation("86e44c36-0914-4630-ac0e-4b9995d4c7e6");
    try {
      const userMsg = await store.appendMessage(conv.id, "user", "câu hỏi test H16");
      const turn = await store.insertAnswerTurn(
        baseInput({ conversation_id: conv.id, user_message_id: userMsg.id })
      );

      const rows = await reviewQueueRowsFor(sql, conv.id);
      assert.equal(rows.length, 1, "escalate không-golden phải tạo đúng 1 dòng review_queue");
      assert.equal(rows[0]!.answer_turn_id, turn.id);
      assert.equal(rows[0]!.state, "pending");
      assert.match(
        rows[0]!.original_draft_vi,
        /^\[Từ chối tự động · no_eligible_source\] /,
        "original_draft_vi phải có tiền tố [Từ chối tự động · <reason_code>] (SPEC-P03 §3.1)"
      );
    } finally {
      await sql("delete from conversations where id = $1", [conv.id]);
    }
  } finally {
    await sql.end();
  }
});

test("H16 W1 (P03-C3): decision='answer' ⇒ 0 dòng review_queue", async () => {
  const sql = makeSql(process.env.DATABASE_URL!);
  try {
    const store = await getDataStore();
    const conv = await store.createConversation("86e44c36-0914-4630-ac0e-4b9995d4c7e6");
    try {
      const userMsg = await store.appendMessage(conv.id, "user", "câu hỏi test H16 answer");
      await store.insertAnswerTurn(
        baseInput({
          conversation_id: conv.id,
          user_message_id: userMsg.id,
          decision: "answer",
          lifecycle_state: "answered",
          reason_code: null,
        })
      );

      const rows = await reviewQueueRowsFor(sql, conv.id);
      assert.equal(rows.length, 0, "decision='answer' KHÔNG được vào hàng đợi duyệt (P03-C3)");
    } finally {
      await sql("delete from conversations where id = $1", [conv.id]);
    }
  } finally {
    await sql.end();
  }
});

test("H16 W1 (chốt SO): decision='escalate' + is_golden_run=true ⇒ 0 dòng review_queue", async () => {
  const sql = makeSql(process.env.DATABASE_URL!);
  try {
    const store = await getDataStore();
    const conv = await store.createConversation("86e44c36-0914-4630-ac0e-4b9995d4c7e6");
    try {
      const userMsg = await store.appendMessage(conv.id, "user", "câu hỏi test H16 golden");
      await store.insertAnswerTurn(
        baseInput({
          conversation_id: conv.id,
          user_message_id: userMsg.id,
          is_golden_run: true,
          golden_case_id: "golden-h16-w1",
        })
      );

      const rows = await reviewQueueRowsFor(sql, conv.id);
      assert.equal(rows.length, 0, "golden run KHÔNG được vào hàng đợi HITL thật (handoff H16 §3 W1)");
    } finally {
      await sql("delete from conversations where id = $1", [conv.id]);
    }
  } finally {
    await sql.end();
  }
});

// ── H16 W3 — logic sắp xếp/khoá (thuần JS, không chạm DB) ──────────────────

function row(overrides: Partial<ReviewQueueRow> & { review_id: string }): ReviewQueueRow {
  return {
    answer_turn_id: `answer-${overrides.review_id}`,
    state: "pending",
    question_vi: "q",
    reason_code: null,
    original_draft_vi: "d",
    edited_draft_vi: null,
    citations: [],
    created_at: "2026-09-23T00:00:00.000Z",
    ...overrides,
  };
}

test("H16 W3: isReviewRowLocked — chỉ 'pending' là chưa khoá, ba trạng thái cuối đều khoá (SPEC-P03 §3.3)", () => {
  assert.equal(isReviewRowLocked("pending"), false);
  assert.equal(isReviewRowLocked("approved"), true);
  assert.equal(isReviewRowLocked("edited_approved"), true);
  assert.equal(isReviewRowLocked("rejected"), true);
});

test("H16 W3: sortReviewQueueRows — pending trước, mới nhất trước trong mỗi nhóm (SPEC-P03 §3.5)", () => {
  const rows: ReviewQueueRow[] = [
    row({ review_id: "old-resolved", state: "approved", created_at: "2026-09-20T00:00:00.000Z" }),
    row({ review_id: "new-pending", state: "pending", created_at: "2026-09-23T00:00:00.000Z" }),
    row({ review_id: "old-pending", state: "pending", created_at: "2026-09-21T00:00:00.000Z" }),
    row({ review_id: "new-resolved", state: "rejected", created_at: "2026-09-22T00:00:00.000Z" }),
  ];
  const sorted = sortReviewQueueRows(rows).map((r) => r.review_id);
  assert.deepEqual(sorted, ["new-pending", "old-pending", "new-resolved", "old-resolved"]);
  assert.deepEqual(
    rows.map((r) => r.review_id),
    ["old-resolved", "new-pending", "old-pending", "new-resolved"],
    "sortReviewQueueRows KHÔNG được sửa mảng đầu vào"
  );
});
