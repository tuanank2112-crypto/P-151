// tests/conflict-citations.test.ts — R13 (Đ38): lượt escalate với gate
// `G1_conflict` PHẢI trả các section thuộc `conflict_group` đã phát hiện
// dưới dạng `citations` — SPEC-P02 §6.4 hứa "đây là hai nguồn để anh/chị
// đối chiếu", nên `citations` KHÔNG được rỗng. Các đường escalate KHÁC vẫn
// giữ `citations: []` (không hứa nguồn nào thì không nợ gì, Đ38).
//
// CHẠY THẬT trên Postgres — cần retrieval/eligibility thật để dựng đúng
// `conflict_groups`, không mock được ở tầng này (VC-04: mâu thuẫn là SQL/
// logic tất định, không phải LLM).
//
// Dữ liệu: DEF-03 (`evals/golden/expected_defects.json`, ca Safety S03,
// `evals/golden/golden_safety.jsonl`) — cặp section `BBQ-CAP-01` (tài liệu
// `OCP1-BBQ-GARDEN-RULES-001`) và `BLD-AMEN-07` (tài liệu
// `OCP1-BUILDING-RULES-001`), cùng `conflict_group = "CG-BBQ-CAPACITY"`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { __setTransportForTesting } from "../lib/adapters/model.ts";
import { __resetDataStoreForTesting, getDataStore } from "../lib/adapters/db.ts";
import { runTurn } from "../lib/pipeline/index.ts";
import type { Principal } from "../lib/types.ts";
import { makeSql } from "../scripts/_pg.mjs";
import { deleteConversations } from "./_pg-cleanup.ts";

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

function geminiText(obj: unknown): Response {
  const body = {
    candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
  };
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body } as unknown as Response;
}
function classifierBody(overrides: Record<string, unknown> = {}) {
  return {
    intent: "I-03",
    is_emergency: false,
    is_legal_or_compensation: false,
    target_subjects: { resident_ids: [], property_ids: [] },
    missing_required_fields: [],
    clarify_question_vi: null,
    normalized_query_vi: "Vườn BBQ cho tối đa bao nhiêu người một lượt?",
    ...overrides,
  };
}

const CONFLICT_SECTION_IDS = new Set(["BBQ-CAP-01", "BLD-AMEN-07"]);

test.afterEach(() => {
  __setTransportForTesting(null);
});

// H17 W2 (G37): gom `conversation_id` mỗi test tạo ra (runTurn tự tạo hàng
// `conversations` — createConversationIfMissing, Đ37), xoá hết ở cuối file.
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

test("Đ38 (thật, Postgres, DEF-03): G1_conflict trả >= 2 citations, mọi section_id thuộc đúng conflict_group CG-BBQ-CAPACITY", async () => {
  __setTransportForTesting({
    fetch: async () => geminiText(classifierBody()),
    sleep: async () => {},
  });

  const conversationId = crypto.randomUUID();
  createdConversationIds.push(conversationId);
  const result = await runTurn({
    conversation_id: conversationId,
    question_vi: "Vườn BBQ cho tối đa bao nhiêu người một lượt?",
    principal: RESIDENT,
  });

  assert.equal(result.decision, "escalate");
  assert.equal(result.reason_code, "source_conflict");
  assert.equal(result.gate_triggered, "G1_conflict");

  assert.ok(
    result.citations.length >= 2,
    `G1_conflict phải trả >= 2 citations (Đ38), được ${result.citations.length}`
  );
  for (const cit of result.citations) {
    assert.ok(
      CONFLICT_SECTION_IDS.has(cit.section_id),
      `citation section_id "${cit.section_id}" phải thuộc conflict_group CG-BBQ-CAPACITY (${[...CONFLICT_SECTION_IDS].join(",")})`
    );
    // Citation phải có đủ trường bắt buộc, không phải bản rỗng (01-CONTRACTS §7).
    assert.ok(cit.document_id.length > 0);
    assert.ok(cit.document_title_vi.length > 0, "document_title_vi không được rỗng");
    assert.ok(cit.heading_vi.length > 0, "heading_vi không được rỗng");
    assert.ok(cit.snippet_vi.length > 0 && cit.snippet_vi.length <= 300, "snippet_vi phải 1..300 ký tự");
  }
  // Đúng cặp DEF-03 — cả hai section đều có mặt, không thiếu một bên.
  const gotSectionIds = new Set(result.citations.map((c) => c.section_id));
  assert.equal(gotSectionIds.has("BBQ-CAP-01"), true);
  assert.equal(gotSectionIds.has("BLD-AMEN-07"), true);
});

test("Đ38 — đối chứng: escalate KHÁC gate (chặng 5 — risk/hard-block pháp lý, KHÔNG chạm retrieval/A2/A3) vẫn giữ citations=[] — không hứa nguồn thì không nợ gì", async () => {
  // Chặng 5 (`hitsRiskKeyword`) khớp trên CHÍNH VĂN BẢN câu hỏi gốc, dừng
  // TRƯỚC retrieval — nên chỉ cần đúng MỘT lời gọi A1, tất định, không phụ
  // thuộc dữ liệu tri thức (giống `tests/memory.test.ts`, ca "risk gate").
  __setTransportForTesting({
    fetch: async () => geminiText(classifierBody()),
    sleep: async () => {},
  });

  const conversationId = crypto.randomUUID();
  createdConversationIds.push(conversationId);
  const result = await runTurn({
    conversation_id: conversationId,
    question_vi: "Tôi muốn khởi kiện đòi bồi thường vì căn hộ bị hư hỏng.",
    principal: RESIDENT,
  });

  assert.equal(result.decision, "escalate");
  assert.equal(result.reason_code, "legal_or_compensation_escalation");
  assert.notEqual(result.gate_triggered, "G1_conflict", "ca đối chứng này KHÔNG được rơi vào nhánh conflict");
  assert.deepEqual(result.citations, [], "đường escalate khác G1_conflict phải giữ nguyên citations=[] (Đ38)");
});
