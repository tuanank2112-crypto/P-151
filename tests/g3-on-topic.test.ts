// tests/g3-on-topic.test.ts — Đ41 W1 (`S01`/`DEF-01`): cổng `G3` chỉ được nói
// "tài liệu hết hiệu lực" khi chunk hạng 1 THẬT SỰ nói về chủ đề câu hỏi.
//
// Tại sao cần thêm một tín hiệu nữa sau Đ28: `top_rejected_reason` một mình
// trả lời "nguồn khớp NHẤT có dùng được không". Sau Đ32, truy hồi nối từ bằng
// `|` nên "khớp nhất" có thể chỉ là khớp mấy từ chung chung. Đo trên Postgres
// thật 2026-09-22: câu hỏi *"Sân pickleball mở cửa mấy giờ?"* kéo chunk hạng 1
// là `POOL24-BAN-02` của bản nội quy BỂ BƠI đã hết hiệu lực ⇒ `G3` báo "tài
// liệu hết hiệu lực" cho một tiện ích CHƯA BAO GIỜ có nguồn có thẩm quyền
// (`FAC-PICKLEBALL`, `has_authoritative_rules = false` — `SPEC-P00` §4). Đó là
// bịa một lý do (Đ09).
//
// Bộ test này canh HAI CHIỀU TRONG CÙNG MỘT LƯỢT CHẠY — điều kiện nghiệm thu
// của H13: `DEF-01` phải ra `no_eligible_source` VÀ `DEF-04` phải giữ
// `source_expired_or_unknown`. Ba trục độc lập:
//   T1 — logic thuần `decideTurn()`, số đo lấy nguyên từ lượt đo Postgres.
//   T2 — dữ liệu thật: tiêu đề tài liệu ĐỌC TỪ kho (không gõ tay chuỗi tiêu đề).
//   T3 — end-to-end `runTurn()` qua kho mock, A1/A2 bơm bằng transport giả
//        (KHÔNG gọi model — hạn mức Gemini đã cạn).

import { test } from "node:test";
import assert from "node:assert/strict";
import { __setTransportForTesting } from "../lib/adapters/model.ts";
import { conversationIdFromLabel, getDataStore } from "../lib/adapters/db.ts";
import { decideTurn } from "../lib/confidence.ts";
import { applyEligibility } from "../lib/pipeline/eligibility.ts";
import { queryMentionsDocumentTitle, runTurn } from "../lib/pipeline/index.ts";
import { retrieve, TOP_K } from "../lib/pipeline/retrieval.ts";
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
const NOW = new Date("2026-09-22T00:00:00.000Z");

const S01_QUESTION = "Sân pickleball mở cửa mấy giờ?";
const S04_QUESTION = "Bể bơi mở cửa từ mấy giờ đến mấy giờ?";

// ─────────────────────────────────────────────────────────────────────────
// T1 — logic thuần. Số đo nguyên văn từ lượt đo Postgres 2026-09-22
// (`evidence/s01-s06/postgres_g3_signals.txt`).
// ─────────────────────────────────────────────────────────────────────────

test("Đ41 T1a — DEF-01: chunk hạng 1 hết hiệu lực nhưng LỆCH chủ đề ⇒ no_eligible_source", () => {
  const out = decideTurn({
    retrieval_top1: 0.375, // POOL24-BAN-02, đo trên Postgres
    eligible_count: 6,
    retrieved_count: 8,
    faithfulness: 0,
    conflict_detected: false,
    retriever_refused: true,
    top_rejected_reason: "expired_or_unknown",
    top_rejected_on_topic: false,
  });
  assert.equal(out.decision, "escalate");
  assert.equal(
    out.reason_code,
    "no_eligible_source",
    "nói 'tài liệu hết hiệu lực' cho tiện ích chưa bao giờ có tài liệu là bịa lý do (Đ09)"
  );
  assert.equal(out.gate, "G3_retriever_refused");
});

test("Đ41 T1b — DEF-04 KHÔNG được đổi: chunk hạng 1 hết hiệu lực và ĐÚNG chủ đề ⇒ source_expired_or_unknown", () => {
  const out = decideTurn({
    retrieval_top1: 0.5, // POOL24-HOURS-01, đo trên Postgres
    eligible_count: 6,
    retrieved_count: 8,
    faithfulness: 0,
    conflict_detected: false,
    retriever_refused: true,
    top_rejected_reason: "expired_or_unknown",
    top_rejected_on_topic: true,
  });
  assert.equal(out.reason_code, "source_expired_or_unknown");
  assert.equal(out.gate, "G3_retriever_refused");
});

test("Đ41 T1c — tương thích ngược: KHÔNG truyền top_rejected_on_topic thì giữ nguyên Đ28", () => {
  const out = decideTurn({
    retrieval_top1: 0.9469,
    eligible_count: 5,
    retrieved_count: 8,
    faithfulness: 0,
    conflict_detected: false,
    retriever_refused: true,
    top_rejected_reason: "expired_or_unknown",
  });
  assert.equal(out.reason_code, "source_expired_or_unknown");
});

test("Đ41 T1d — tín hiệu mới KHÔNG được sinh mã: lệch chủ đề mà chunk hạng 1 hợp lệ vẫn là no_eligible_source", () => {
  const out = decideTurn({
    retrieval_top1: 0.375,
    eligible_count: 3,
    retrieved_count: 8,
    faithfulness: 0,
    conflict_detected: false,
    retriever_refused: true,
    rejection_histogram: { expired_or_unknown: 2 },
    top_rejected_reason: null,
    top_rejected_on_topic: false,
  });
  assert.equal(out.reason_code, "no_eligible_source");
});

test("Đ41 T1e — G2 KHÔNG bị tín hiệu mới chạm tới (vùng cấm: Đ41 chỉ sửa G3)", () => {
  const out = decideTurn({
    retrieval_top1: 0.79,
    eligible_count: 0,
    retrieved_count: 2,
    faithfulness: 0,
    conflict_detected: false,
    rejection_histogram: { expired_or_unknown: 2 },
    top_rejected_on_topic: false,
  });
  assert.equal(out.gate, "G2_zero_eligible");
  assert.equal(out.reason_code, "source_expired_or_unknown");
});

// ─────────────────────────────────────────────────────────────────────────
// T2 — trục DỮ LIỆU THẬT: tiêu đề tài liệu lấy TỪ KHO, không gõ tay. Nếu
// `knowledge/` đổi tiêu đề bản nội quy bể bơi thì test này phải đỏ, chứ không
// được xanh vì một chuỗi hằng đã chép sẵn.
// ─────────────────────────────────────────────────────────────────────────

test("Đ41 T2 — tiêu đề tài liệu hết hiệu lực đọc từ kho: pickleball KHÔNG chung từ, bể bơi CÓ", async () => {
  const retrieved = await retrieve("giờ mở cửa bể bơi", TOP_K);
  assert.ok(retrieved.length > 0, "truy hồi rỗng — kho mock không nạp được knowledge/");
  const elig = await applyEligibility(retrieved, RESIDENT, NOW);
  assert.equal(
    elig.top_rejected_reason,
    "expired_or_unknown",
    "tiền đề của ca này: chunk hạng 1 phải là chunk đã hết hiệu lực"
  );

  const store = await getDataStore();
  const topDocumentId = retrieved[0]!.document_id;
  const documents = await store.getDocumentMeta([topDocumentId]);
  const titleVi = documents.get(topDocumentId)?.title_vi ?? "";
  assert.ok(titleVi.length > 0, `tài liệu ${topDocumentId} không có title_vi`);

  // Chiều DEF-01 — mọi biến thể chuẩn hoá đã đo của câu hỏi pickleball.
  for (const q of [
    S01_QUESTION,
    "giờ mở cửa sân pickleball",
    "sân pickleball giờ mở cửa",
    "sân pickleball mở cửa mấy giờ",
    "pickleball mở cửa mấy giờ",
  ]) {
    assert.equal(
      queryMentionsDocumentTitle(q, titleVi),
      false,
      `"${q}" không nói về "${titleVi}" — không được dùng tài liệu này làm lý do "hết hiệu lực"`
    );
  }

  // Chiều DEF-04 — mọi biến thể chuẩn hoá đã đo của câu hỏi bể bơi.
  for (const q of [
    S04_QUESTION,
    "giờ mở cửa bể bơi",
    "bể bơi giờ mở cửa",
    "thời gian mở cửa bể bơi",
    "bể bơi mở cửa mấy giờ",
    "gio mo cua be boi", // gõ không dấu vẫn phải khớp
  ]) {
    assert.equal(
      queryMentionsDocumentTitle(q, titleVi),
      true,
      `"${q}" nói đúng chủ đề "${titleVi}" — phải giữ mã source_expired_or_unknown`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────
// T3 — end-to-end `runTurn()`, KHÔNG gọi model. Hai lượt chỉ khác nhau ĐÚNG
// một thứ: câu hỏi/truy vấn nói về chủ đề của tài liệu hết hiệu lực hay không.
// Cả hai lượt đều đi qua đúng cổng `G3_retriever_refused` trên kho mock.
// Điểm mock (Đ24) KHÔNG chuyển được sang Postgres — ở đây chỉ cần hình dạng
// cổng, còn số đo thật nằm ở `evidence/s01-s06/postgres_g3_signals.txt`.
// ─────────────────────────────────────────────────────────────────────────

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

function classifierBody(normalizedQueryVi: string) {
  return {
    intent: "I-03",
    is_emergency: false,
    is_legal_or_compensation: false,
    target_subjects: { resident_ids: [], property_ids: [] },
    missing_required_fields: [],
    clarify_question_vi: null,
    normalized_query_vi: normalizedQueryVi,
  };
}

const A2_REFUSED = {
  draft_vi: "",
  citations: [],
  refused: true,
  refusal_note_vi: "Không có nguồn hợp lệ trả lời được câu này.",
};

function stubA1A2(normalizedQueryVi: string) {
  const bodies: unknown[] = [classifierBody(normalizedQueryVi), A2_REFUSED];
  let i = 0;
  __setTransportForTesting({
    fetch: async () => geminiText(bodies[Math.min(i++, bodies.length - 1)]),
    sleep: async () => {},
  });
}

test.afterEach(() => {
  __setTransportForTesting(null);
});

test("Đ41 T3a — end-to-end DEF-01: A2 từ chối, chunk hạng 1 hết hiệu lực LỆCH chủ đề ⇒ no_eligible_source", async () => {
  // "giờ mở cửa sân" là dạng chuẩn hoá làm kho MOCK trả đúng hình dạng G3:
  // retrieved=8, eligible=6, chunk hạng 1 = bản nội quy bể bơi đã hết hiệu lực.
  stubA1A2("giờ mở cửa sân");
  const result = await runTurn({
    conversation_id: conversationIdFromLabel("d41-def01"),
    question_vi: S01_QUESTION,
    principal: RESIDENT,
    now: NOW,
  });
  assert.equal(result.gate_triggered, "G3_retriever_refused", "tiền đề: phải rơi đúng cổng G3");
  assert.equal(result.decision, "escalate");
  assert.equal(result.reason_code, "no_eligible_source");
  assert.deepEqual(result.citations, []);
});

test("Đ41 T3b — end-to-end DEF-04 vẫn XANH: cùng cổng G3, đúng chủ đề ⇒ source_expired_or_unknown", async () => {
  stubA1A2("giờ mở cửa bể bơi");
  const result = await runTurn({
    conversation_id: conversationIdFromLabel("d41-def04"),
    question_vi: S04_QUESTION,
    principal: RESIDENT,
    now: NOW,
  });
  assert.equal(result.gate_triggered, "G3_retriever_refused", "tiền đề: phải rơi đúng cổng G3");
  assert.equal(result.decision, "escalate");
  assert.equal(
    result.reason_code,
    "source_expired_or_unknown",
    "vá DEF-01 KHÔNG được làm đỏ DEF-04 — hai ca phải xanh CÙNG LÚC (H13 §3 W1)"
  );
});
