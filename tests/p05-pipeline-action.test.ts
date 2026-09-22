// tests/p05-pipeline-action.test.ts — H20 W2: chặng `action` trong `runTurn()`
// (Đ48, SPEC-P05 §2/§7/§9).
//
// KHÔNG gọi model thật và KHÔNG gọi backend thật: A1 qua transport giả
// (`__setTransportForTesting`), backend hành động qua `__setSimBackendForTesting`
// với `tests/_fake-simbackend.ts`.
//
// Mỗi ca dưới đây đã được kiểm ngược bằng cách cố tình làm hỏng cài đặt — xem
// `evidence/h20-pipeline-action/` và bảng "bộ đo từng ĐỎ" trong report R23.

import { test } from "node:test";
import assert from "node:assert/strict";
import { __setTransportForTesting, EMPTY_ACTION_REQUEST } from "../lib/adapters/model.ts";
import { conversationIdFromLabel } from "../lib/adapters/db.ts";
import { runTurn, assertStepOrder } from "../lib/pipeline/index.ts";
import {
  __setActionAuditSinkForTesting,
  blockedMessageVi,
  clockVi,
  dateVi,
  toVnIso,
  type ActionAuditRecord,
} from "../lib/pipeline/action.ts";
import { __setSimBackendForTesting } from "../lib/simbackend/index.ts";
import { SimBackendError } from "../lib/simbackend/contract.ts";
import {
  __getMockReviewQueueForTesting,
  __resetMockReviewQueueForTesting,
} from "../lib/adapters/store-mock.ts";
import {
  FakeSimBackend,
  FAKE_INTAKE_REOPEN,
  FAKE_SLOT_START,
  INTAKE_CLOSED_REASON,
  fakeBooking,
  fakePolicy,
} from "./_fake-simbackend.ts";
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

/** Cảnh 23:39 của SPEC-P05 §9 — giờ máy chủ mô phỏng. */
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

function a1Says(action: Partial<ActionRequest>, extra: Record<string, unknown> = {}) {
  return {
    intent: "I-03",
    is_emergency: false,
    is_legal_or_compensation: false,
    target_subjects: { resident_ids: [], property_ids: [] },
    missing_required_fields: [],
    clarify_question_vi: null,
    normalized_query_vi: "đặt sân bóng bàn",
    action: { ...EMPTY_ACTION_REQUEST, ...action },
    ...extra,
  };
}

function useA1(action: Partial<ActionRequest>, extra: Record<string, unknown> = {}) {
  __setTransportForTesting({
    fetch: async () => geminiText(a1Says(action, extra)),
    sleep: async () => {},
  });
}

const CREATE_ACTION: Partial<ActionRequest> = {
  capability: "amenity.create_booking",
  facility_hint_vi: "sân bóng bàn",
  slot_start: FAKE_SLOT_START,
  party_size: 1,
};

test.afterEach(() => {
  __setTransportForTesting(null);
  __setSimBackendForTesting(null);
  __setActionAuditSinkForTesting(null);
});

// ─────────────────────────────────────────────────────────────────────────
// (a) Đặt thành công — thứ tự gọi backend là bất biến, không phải tình cờ
// ─────────────────────────────────────────────────────────────────────────

test("(a) đặt thành công ⇒ decision=action, status=done, write_calls=1, thứ tự backend ĐÚNG", async () => {
  const backend = new FakeSimBackend({ policy: fakePolicy({ blocking_reasons: [] }) });
  __setSimBackendForTesting(backend);
  useA1(CREATE_ACTION);

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-a"),
    question_vi: "Đặt giúp tôi sân bóng bàn 9 giờ sáng mai.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "action");
  assert.equal(r.action_result?.status, "done");
  assert.equal(r.action_result?.write_calls, 1);
  assert.equal(r.action_result?.receipt_code, "RC-AAAA1111");
  assert.equal(r.action_result?.undo_capability_id, "amenity.cancel_booking");

  // BB-03 / VC-10 — đọc chính sách TRƯỚC, precheck, rồi mới ghi. Đúng ba lệnh
  // sau `resolveFacility`, đúng thứ tự này, không lệnh ghi nào bị lãng phí.
  assert.deepEqual(backend.calls, [
    "resolveFacility",
    "getBookingPolicy",
    "checkEligibility",
    "createBooking",
  ]);
  assert.equal(backend.countOf("getBookingPolicy"), 1, "getBookingPolicy đúng MỘT lần (§3)");
  assert.equal(backend.countOf("createBooking"), 1);

  // `idempotency_key` do CALLER sinh (P05-C9) — phải có mặt và tất định.
  const key = backend.createInputs[0]!.idempotency_key as string;
  assert.ok(key && key.startsWith("idem:"), `idempotency_key phải do caller sinh, được: ${key}`);

  // Lượt hành động KHÔNG hứa nguồn nào (BB-01) và KHÔNG đi retrieval.
  assert.deepEqual(r.citations, []);
  assert.deepEqual(r.claims, []);
  assert.deepEqual(r.steps.map((s) => s.step), [
    "validate",
    "safety",
    "intent",
    "context",
    "risk",
    "action",
  ]);
  assertStepOrder(r.steps);
  assert.ok(r.answer_vi?.includes("RC-AAAA1111"), "biên nhận phải có trong câu trả lời");
});

// ─────────────────────────────────────────────────────────────────────────
// (b) Cảnh 23:39 — chặn mà KHÔNG ghi, và KHÔNG nói giờ hoạt động (BB-02)
// ─────────────────────────────────────────────────────────────────────────

test("(b) SIM_NOW=23:39 + policy intake_closed ⇒ blocked, write_calls=0, nêu 08:30, CẤM nói giờ hoạt động", async () => {
  const backend = new FakeSimBackend({
    policy: fakePolicy({ intake_open_now: false, blocking_reasons: [INTAKE_CLOSED_REASON] }),
  });
  __setSimBackendForTesting(backend);
  useA1(CREATE_ACTION);

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-b"),
    question_vi: "Đặt giúp tôi sân bóng bàn 9 giờ sáng mai.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "action");
  assert.equal(r.action_result?.status, "blocked");
  assert.equal(r.action_result?.write_calls, 0, "bị chặn thì KHÔNG lệnh ghi nào được phát");
  assert.equal(backend.countOf("createBooking"), 0);
  assert.equal(backend.countOf("checkEligibility"), 0);
  assert.equal(backend.countOf("getBookingPolicy"), 1, "đúng MỘT lần đọc chính sách (P05-M8)");

  const answer = r.answer_vi ?? "";
  assert.ok(answer.includes("23:39"), "phải nói giờ hiện tại");
  assert.ok(answer.includes("08:30"), "phải nêu mốc nhận đăng ký / mốc gửi lại");

  // BB-02 — giờ HOẠT ĐỘNG của fake policy là 06:00–22:00. Câu trả lời lộ một
  // trong hai mốc đó nghĩa là đã suy giờ mở cửa từ chính sách nhận đăng ký.
  assert.ok(!answer.includes("06:00"), "CẤM nói giờ mở cửa (BB-02)");
  assert.ok(!answer.includes("22:00"), "CẤM nói giờ đóng cửa (BB-02)");
  assert.ok(!/mở cửa|đóng cửa|giờ hoạt động/i.test(answer), "CẤM nhắc giờ hoạt động (BB-02)");

  assert.equal(r.action_result?.next_intake_open_at, FAKE_INTAKE_REOPEN);
  // Lượt `action` vẫn là lượt đã giải quyết được việc nói chuyện với cư dân,
  // nhưng KHÔNG hứa nguồn nào.
  assert.deepEqual(r.citations, []);
});

test("(b') blockedMessageVi dựng từ IntakeFacts — kiểu KHÔNG chứa operating_hours", () => {
  const p = fakePolicy({ blocking_reasons: [INTAKE_CLOSED_REASON] });
  const msg = blockedMessageVi(p, [INTAKE_CLOSED_REASON], FAKE_SLOT_START);
  assert.ok(msg.includes("23:39"));
  assert.ok(msg.includes("08:30"));
  assert.ok(msg.includes("17:30"), "cửa nhận đăng ký là 08:30–17:30");
  assert.ok(msg.includes("Slot 09:00"), "slot còn chỗ thì nói còn chỗ (§9 bước 4)");
  assert.ok(!msg.includes("06:00") && !msg.includes("22:00"));
});

// ─────────────────────────────────────────────────────────────────────────
// (c) Huỷ — hai lượt, không tự xác nhận hộ (B2)
// ─────────────────────────────────────────────────────────────────────────

test("(c) huỷ: lượt 1 clarify B2 + savePendingAction, lượt 2 confirmed ⇒ done", async () => {
  const backend = new FakeSimBackend({ bookingDetail: fakeBooking() });
  __setSimBackendForTesting(backend);
  const conversation = conversationIdFromLabel("p05-c");

  // ── Lượt 1: cư dân bảo huỷ ──────────────────────────────────────────
  useA1({ capability: "amenity.cancel_booking", booking_ref: "BK-0001" });
  const t1 = await runTurn({
    conversation_id: conversation,
    question_vi: "Huỷ giúp tôi chỗ BK-0001.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(t1.decision, "clarify");
  assert.equal(t1.reason_code, "action_irreversible_requires_confirmation");
  assert.equal(t1.action_result?.status, "needs_confirmation");
  assert.ok(t1.clarify_question_vi?.includes("xác nhận"), "phải HỎI, không tự làm");
  assert.equal(backend.countOf("cancelBooking"), 0, "CẤM tự xác nhận hộ (SPEC-P05 §7)");
  assert.equal(backend.countOf("savePendingAction"), 1);
  // Precheck của cancel là getBookingDetail, gọi TRƯỚC khi lưu chờ (BB-03).
  assert.deepEqual(backend.calls, ["getBookingDetail", "savePendingAction"]);
  assert.equal(backend.savedPending[0]!.capability, "amenity.cancel_booking");
  assert.equal(backend.savedPending[0]!.payload.booking_id, "BK-0001");

  // ── Lượt 2: cư dân xác nhận ─────────────────────────────────────────
  useA1({ confirmed: true });
  const t2 = await runTurn({
    conversation_id: conversation,
    question_vi: "Ừ, xác nhận huỷ.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(t2.decision, "action");
  assert.equal(t2.action_result?.status, "done");
  assert.equal(t2.action_result?.receipt_code, "RC-BBBB2222");
  assert.equal(backend.countOf("cancelBooking"), 1);
  assert.equal(backend.cancelInputs[0]!.confirmed, true);
  // §5.2 — huỷ KHÔNG hoàn tác được.
  assert.equal(t2.action_result?.undo_capability_id, null);
});

test("(c') xác nhận khi KHÔNG còn hành động chờ ⇒ hỏi lại, KHÔNG gọi lệnh ghi nào", async () => {
  const backend = new FakeSimBackend();
  __setSimBackendForTesting(backend);
  useA1({ confirmed: true });

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-c2"),
    question_vi: "Ừ, đồng ý.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "clarify");
  assert.equal(backend.countOf("cancelBooking"), 0);
  assert.equal(backend.countOf("createBooking"), 0);
});

// ─────────────────────────────────────────────────────────────────────────
// (d) WriteTimeout — dòng nguy hiểm nhất bảng §7. CẤM RETRY.
// ─────────────────────────────────────────────────────────────────────────

test("(d) WriteTimeout ⇒ status=unknown, createBooking gọi ĐÚNG 1 lần, có audit warn", async () => {
  const audits: ActionAuditRecord[] = [];
  __setActionAuditSinkForTesting((r) => audits.push(r));
  const backend = new FakeSimBackend({
    createThrows: new SimBackendError("WriteTimeout", "backend không phản hồi kịp"),
  });
  __setSimBackendForTesting(backend);
  useA1(CREATE_ACTION);

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-d"),
    question_vi: "Đặt giúp tôi sân bóng bàn 9 giờ sáng mai.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "action");
  assert.equal(r.action_result?.status, "unknown");
  assert.equal(r.reason_code, "action_partial_execution_unknown");
  // Bất biến sống còn: gọi lại là đặt chỗ hai lần (P05-C10).
  assert.equal(backend.countOf("createBooking"), 1, "CẤM RETRY WriteTimeout");
  assert.equal(audits.length, 1, "phải để lại đúng một dòng audit mức warn (§7)");
  assert.equal(audits[0]!.level, "warn");
  assert.equal(audits[0]!.event, "action.write_timeout");
  assert.ok(r.answer_vi?.includes("không") || r.answer_vi?.includes("chưa"), "phải nói thật là chưa rõ");
});

test("(d') QuotaExceeded ⇒ blocked mã B1, KHÔNG thử lại lệnh ghi", async () => {
  const backend = new FakeSimBackend({
    createThrows: new SimBackendError("QuotaExceeded", "hết hạn mức"),
  });
  __setSimBackendForTesting(backend);
  useA1(CREATE_ACTION);

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-d2"),
    question_vi: "Đặt giúp tôi sân bóng bàn 9 giờ sáng mai.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "action");
  assert.equal(r.action_result?.status, "blocked");
  assert.equal(r.reason_code, "action_quota_exceeded");
  assert.equal(backend.countOf("createBooking"), 1, "CẤM thử lại (§7)");
});

test("(d'') Forbidden ⇒ escalate pii_or_account_specific, KHÔNG phải lỗi hành động", async () => {
  const backend = new FakeSimBackend({
    detailThrows: new SimBackendError("Forbidden", "chỗ đặt không thuộc cư dân này"),
  });
  __setSimBackendForTesting(backend);
  useA1({ capability: "amenity.cancel_booking", booking_ref: "BK-9999" });
  // BB-11 đo được: kho mock chỉ "enqueue" một dòng cho MỖI `insertAnswerTurn`
  // có `decision='escalate'`. Đếm hàng đợi chính là đếm số dòng `answer_turns`
  // của lượt này — đây là cách duy nhất đo BB-11 trên nền mock mà không phải
  // sửa `lib/adapters/store-mock.ts` (ngoài phạm vi H20).
  __resetMockReviewQueueForTesting();

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-d3"),
    question_vi: "Huỷ giúp tôi chỗ BK-9999.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "escalate");
  assert.equal(r.reason_code, "pii_or_account_specific");
  assert.equal(backend.countOf("cancelBooking"), 0);
  assert.equal(
    __getMockReviewQueueForTesting().length,
    1,
    "nhánh action thoát bằng escalate vẫn ghi ĐÚNG MỘT dòng answer_turns (BB-11)"
  );
});

// ─────────────────────────────────────────────────────────────────────────
// (e) Không hồi quy đường hỏi–đáp thường
// ─────────────────────────────────────────────────────────────────────────

test("(e) câu hỏi nội quy thường vẫn đi retrieval, KHÔNG chạm backend hành động", async () => {
  const backend = new FakeSimBackend();
  __setSimBackendForTesting(backend);
  useA1({}, { normalized_query_vi: "sân pickleball giờ mở cửa" });

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-e"),
    question_vi: "Sân pickleball mở cửa mấy giờ?",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  const steps = r.steps.map((s) => s.step);
  assert.ok(steps.includes("retrieval"));
  assert.ok(!steps.includes("action"));
  assert.equal(backend.calls.length, 0);
  assertStepOrder(r.steps);
});

// ─────────────────────────────────────────────────────────────────────────
// Thiếu dữ kiện ⇒ HỎI, không đoán; và các lệnh đọc
// ─────────────────────────────────────────────────────────────────────────

test("thiếu tiện ích (resolveFacility null) ⇒ clarify, KHÔNG đọc chính sách, KHÔNG ghi", async () => {
  const backend = new FakeSimBackend({ facility: null });
  __setSimBackendForTesting(backend);
  useA1({ capability: "amenity.create_booking", facility_hint_vi: "cái sân kia", party_size: 1 });

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-f"),
    question_vi: "Đặt giúp tôi cái sân kia.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "clarify");
  assert.deepEqual(backend.calls, ["resolveFacility"]);
});

test("thiếu slot_start ⇒ clarify TRƯỚC khi đọc chính sách", async () => {
  const backend = new FakeSimBackend();
  __setSimBackendForTesting(backend);
  useA1({ capability: "amenity.create_booking", facility_hint_vi: "sân bóng bàn", party_size: 1 });

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-g"),
    question_vi: "Đặt giúp tôi sân bóng bàn.",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "clarify");
  assert.equal(backend.countOf("getBookingPolicy"), 0);
  assert.equal(backend.countOf("createBooking"), 0);
});

test("list_my_bookings ⇒ status=listed, write_calls=0", async () => {
  const backend = new FakeSimBackend({ bookings: [fakeBooking()] });
  __setSimBackendForTesting(backend);
  useA1({ capability: "amenity.list_my_bookings" });

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-h"),
    question_vi: "Tôi đang giữ những chỗ nào?",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "action");
  assert.equal(r.action_result?.status, "listed");
  assert.equal(r.action_result?.write_calls, 0);
  assert.equal(r.action_result?.bookings.length, 1);
  assert.deepEqual(backend.calls, ["listMyBookings"]);
});

// ─────────────────────────────────────────────────────────────────────────
// Lưới an toàn phía trên vẫn thắng nhánh hành động
// ─────────────────────────────────────────────────────────────────────────

test("khẩn cấp thắng tuyệt đối: có capability vẫn KHÔNG vào nhánh hành động", async () => {
  const backend = new FakeSimBackend();
  __setSimBackendForTesting(backend);
  useA1(CREATE_ACTION, { is_emergency: true });

  const r = await runTurn({
    conversation_id: conversationIdFromLabel("p05-i"),
    question_vi: "Có người ngất ở sân bóng bàn, đặt sân giúp tôi!",
    principal: RESIDENT,
    now: SIM_NOW_2339,
  });

  assert.equal(r.decision, "escalate");
  assert.equal(r.reason_code, "emergency_or_life_safety");
  assert.equal(backend.calls.length, 0, "không lệnh backend nào được gọi");
});

// ─────────────────────────────────────────────────────────────────────────
// Thời gian — cảnh 23:39 hỏng nếu quy về UTC
// ─────────────────────────────────────────────────────────────────────────

test("toVnIso trả offset +07:00, KHÔNG phải 'Z' — nếu là Z thì A1 lệch 7 tiếng", () => {
  const iso = toVnIso(SIM_NOW_2339);
  assert.ok(iso.endsWith("+07:00"), `được: ${iso}`);
  assert.ok(!iso.endsWith("Z"));
  assert.equal(clockVi(iso), "23:39");
  assert.equal(dateVi(iso), "20/09");
});

test("clockVi đọc giờ ĐÃ ở múi của chuỗi, không quy về UTC", () => {
  assert.equal(clockVi("2026-09-21T09:00:00+07:00"), "09:00");
  assert.equal(dateVi("2026-09-21T09:00:00+07:00"), "21/09");
});
