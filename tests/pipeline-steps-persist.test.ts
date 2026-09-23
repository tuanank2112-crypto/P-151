// tests/pipeline-steps-persist.test.ts — H25 (2026-09-23): xong khi của W2/W6.
//
// Trước gói này, `AnswerTurnInput` không mang `pipeline_steps` (SPEC-P02
// §5.3/§8, BB-08, R6) lẫn bốn tín hiệu Đ07 + histogram (§7/W6), nên câu
// INSERT luôn dùng DEFAULT — SO đo 2026-09-23 trên Supabase: 0/512 dòng
// `answer_turns` có `pipeline_steps` khác `[]`, 0/512 có `s3_faithfulness`
// khác 0. Bộ test này chứng minh `runTurn()` giờ TRUYỀN đủ giá trị thật ở
// MỌI nhánh, đọc lại qua kho mock (`__getMockAnswerTurnsForTesting`) cho
// (a)/(b)/(c), và qua Postgres thật cho (d) — mâu thuẫn nguồn chỉ dựng được
// từ dữ liệu Golden thật (VC-04), không mock được.
//
// KHÔNG gọi model thật: A1/A2/A3 đi qua transport giả
// (`__setTransportForTesting`), giống mẫu `tests/pipeline-order.test.ts` và
// `tests/p05-pipeline-action.test.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { makeSql } from "../scripts/_pg.mjs";
import { __setTransportForTesting, EMPTY_ACTION_REQUEST } from "../lib/adapters/model.ts";
import { conversationIdFromLabel, __resetDataStoreForTesting, getDataStore } from "../lib/adapters/db.ts";
import { runTurn, assertStepOrder } from "../lib/pipeline/index.ts";
import { __setSimBackendForTesting } from "../lib/simbackend/index.ts";
import {
  __getMockAnswerTurnsForTesting,
  __resetMockAnswerTurnsForTesting,
} from "../lib/adapters/store-mock.ts";
import { FakeSimBackend, FAKE_SLOT_START, fakePolicy } from "./_fake-simbackend.ts";
import { deleteConversations } from "./_pg-cleanup.ts";
import type { ActionRequest, Principal } from "../lib/types.ts";

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

test.beforeEach(() => {
  process.env.DATA_BACKEND = "mock";
  __resetDataStoreForTesting();
  __resetMockAnswerTurnsForTesting();
});
test.afterEach(() => {
  __setTransportForTesting(null);
  __setSimBackendForTesting(null);
});

// ── (a) escalate SỚM ở safety ────────────────────────────────────────────
test("H25 W2 (a): escalate sớm ở safety ⇒ mock answer_turns có pipeline_steps=[validate,safety], s1..s4/histogram giữ mặc định 0/0/0/false/{}", async () => {
  __setTransportForTesting({
    fetch: sequentialFetch([classifierBody({ is_emergency: true })]),
    sleep: async () => {},
  });

  const result = await runTurn({
    conversation_id: conversationIdFromLabel("h25-a"),
    question_vi: "Có người ngất xỉu ở sảnh, cần giúp gấp!",
    principal: RESIDENT,
  });
  assert.equal(result.decision, "escalate");

  const rows = __getMockAnswerTurnsForTesting();
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assert.deepEqual(
    row.pipeline_steps.map((s) => s.step),
    ["validate", "safety"]
  );
  assert.equal(row.s1_retrieval_top1, 0);
  assert.equal(row.s2_eligible_ratio, 0);
  assert.equal(row.s3_faithfulness, 0);
  assert.equal(row.s4_conflict, false);
  assert.deepEqual(row.rejection_histogram, {});
});

// ── (b) answer đầy đủ ────────────────────────────────────────────────────
test("H25 W2/W6 (b): answer đầy đủ ⇒ mock answer_turns có draft+verify với model/ms số, s1/s2 trong [0,1], s3=faithfulness thật>0, s4=false, histogram là object", async () => {
  __setTransportForTesting({
    fetch: sequentialFetch([
      classifierBody(),
      {
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
      },
      {
        claims: [{ claim_vi: "Thẻ cấp trong 3 ngày làm việc", verdict: "supported", supporting_section_id: "CARD-NEW-02" }],
        faithfulness: 1,
      },
    ]),
    sleep: async () => {},
  });

  const result = await runTurn({
    conversation_id: conversationIdFromLabel("h25-b"),
    question_vi: "Cấp thẻ cư dân lần đầu mất bao lâu?",
    principal: RESIDENT,
  });
  assert.equal(result.decision, "answer");

  const rows = __getMockAnswerTurnsForTesting();
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assertStepOrder(row.pipeline_steps);
  const steps = row.pipeline_steps.map((s) => s.step);
  assert.ok(steps.includes("draft"), "phải có chặng draft");
  assert.ok(steps.includes("verify"), "phải có chặng verify");
  for (const s of row.pipeline_steps) {
    if (s.step === "draft" || s.step === "verify") {
      assert.ok(typeof s.model === "string" && s.model.length > 0, `chặng ${s.step} phải có model`);
      assert.ok(typeof s.ms === "number", `chặng ${s.step} phải có ms là số`);
    }
  }
  assert.ok(row.s1_retrieval_top1 >= 0 && row.s1_retrieval_top1 <= 1, "s1 phải trong [0,1]");
  assert.ok(row.s2_eligible_ratio >= 0 && row.s2_eligible_ratio <= 1, "s2 phải trong [0,1]");
  // claim giả 1/1 supported ⇒ faithfulness = 1 > 0 — giá trị A3 THẬT, không phải 0 cứng.
  assert.equal(row.s3_faithfulness, 1);
  assert.equal(row.s4_conflict, false);
  assert.equal(typeof row.rejection_histogram, "object");
});

// ── (c) nhánh action ─────────────────────────────────────────────────────
test("H25 W2/W6 (c): nhánh action ⇒ mock answer_turns có chặng 'action', s1..s4/histogram giữ mặc định 0/0/0/false/{} (chưa qua eligibility)", async () => {
  const backend = new FakeSimBackend({ policy: fakePolicy({ blocking_reasons: [] }) });
  __setSimBackendForTesting(backend);
  const action: Partial<ActionRequest> = {
    capability: "amenity.create_booking",
    facility_hint_vi: "sân bóng bàn",
    slot_start: FAKE_SLOT_START,
    party_size: 1,
  };
  __setTransportForTesting({
    fetch: async () =>
      geminiText({
        intent: "I-03",
        is_emergency: false,
        is_legal_or_compensation: false,
        target_subjects: { resident_ids: [], property_ids: [] },
        missing_required_fields: [],
        clarify_question_vi: null,
        normalized_query_vi: "đặt sân bóng bàn",
        action: { ...EMPTY_ACTION_REQUEST, ...action },
      }),
    sleep: async () => {},
  });

  const result = await runTurn({
    conversation_id: conversationIdFromLabel("h25-c"),
    question_vi: "Đặt giúp tôi sân bóng bàn 9 giờ sáng mai.",
    principal: RESIDENT,
    now: new Date("2026-09-20T10:00:00+07:00"),
  });
  assert.equal(result.decision, "action");

  const rows = __getMockAnswerTurnsForTesting();
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assert.ok(row.pipeline_steps.map((s) => s.step).includes("action"), "phải có chặng action");
  assert.equal(row.s1_retrieval_top1, 0);
  assert.equal(row.s2_eligible_ratio, 0);
  assert.equal(row.s3_faithfulness, 0);
  assert.equal(row.s4_conflict, false);
  assert.deepEqual(row.rejection_histogram, {});
});

// ── W3: chứng minh đỏ ─────────────────────────────────────────────────────
// Xem `planning/01_2026-09-20_resident-agent-v1/evidence/h25-pipeline-steps/
// red.txt` / `green.txt` — tạm bỏ `pipeline_steps` khỏi câu INSERT Postgres
// (để DEFAULT) làm ca (b) ở trên đỏ (không áp dụng cho ca (b) này vì nó đọc
// kho MOCK; bằng chứng đỏ thật dùng script round-trip Postgres ở W4, xem
// `pg_roundtrip.txt`).

// ── (d) conflict — CHẠY THẬT trên Postgres (VC-04: mâu thuẫn là SQL tất định) ──
loadLocalEnv();
const hasDb = Boolean(process.env.DATABASE_URL);
if (hasDb) {
  requireEnv(["DATABASE_URL"]);

  const CONFLICT_SECTION_IDS = new Set(["BBQ-CAP-01", "BLD-AMEN-07"]);
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

  test("H25 W6 (d, thật, Postgres, DEF-03): G1_conflict ⇒ answer_turns.s4_conflict=true, pipeline_steps dừng đúng ở eligibility", async () => {
    process.env.DATA_BACKEND = "postgres";
    __resetDataStoreForTesting();
    // R14 mục 6 — id thật của `resident@demo.local` (uuid), KHÔNG hardcode
    // (seed lại đổi id) và KHÔNG dùng nhãn chữ "u1" (Đ37: cột uuid từ chối).
    const pgStore = await getDataStore();
    const residentUser = await pgStore.findUserByEmail("resident@demo.local");
    if (!residentUser) {
      throw new Error(
        "Seed thiếu tài khoản resident@demo.local — chạy `npm run db:seed:users` trước khi test."
      );
    }
    const conflictResident: Principal = {
      user_id: residentUser.id,
      role: "resident",
      resident_id: "R-0001",
      owned_property_ids: ["S1.120817"],
      property_type: ["apartment"],
    };
    __setTransportForTesting({
      fetch: async () =>
        geminiText(
          classifierBody({
            intent: "I-03",
            normalized_query_vi: "Vườn BBQ cho tối đa bao nhiêu người một lượt?",
          })
        ),
      sleep: async () => {},
    });

    const conversationId = crypto.randomUUID();
    createdConversationIds.push(conversationId);
    const result = await runTurn({
      conversation_id: conversationId,
      question_vi: "Vườn BBQ cho tối đa bao nhiêu người một lượt?",
      principal: conflictResident,
    });
    assert.equal(result.decision, "escalate");
    assert.equal(result.gate_triggered, "G1_conflict");
    for (const cit of result.citations) {
      assert.ok(CONFLICT_SECTION_IDS.has(cit.section_id));
    }

    const sql = makeSql(process.env.DATABASE_URL!);
    try {
      const rows = (await sql(
        "select s4_conflict, pipeline_steps from answer_turns where conversation_id = $1",
        [conversationId]
      )) as unknown as Array<{ s4_conflict: boolean; pipeline_steps: Array<{ step: string }> }>;
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.s4_conflict, true);
      assert.deepEqual(
        rows[0]!.pipeline_steps.map((s) => s.step),
        ["validate", "safety", "intent", "context", "risk", "retrieval", "eligibility"]
      );
    } finally {
      await sql.end();
    }
    process.env.DATA_BACKEND = "mock";
    __resetDataStoreForTesting();
  });
} else {
  test("H25 W6 (d): bỏ qua — thiếu DATABASE_URL (test cần Postgres thật, VC-04)", () => {
    assert.ok(true);
  });
}
