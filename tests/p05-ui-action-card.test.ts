// tests/p05-ui-action-card.test.ts — H21 W1 (SPEC-P05-Action-Layer.md §9): kiểm hàm
// map THUẦN `toActionView` (app/(resident)/chat/action-view.ts) đủ 5 `ActionStatus`
// (lib/types.ts) + nhánh không có `action_result`. Không render React — chỉ kiểm
// view-model đầu ra, đúng cách handoff H21 W1 "xong khi" yêu cầu.

import { test } from "node:test";
import assert from "node:assert/strict";
import { toActionView, formatViDateTime } from "../app/(resident)/chat/action-view.ts";
import type { ActionResult, PublicTurnResult } from "../lib/types.ts";

function baseResult(action_result: ActionResult | null): PublicTurnResult {
  return {
    decision: action_result ? "action" : "answer",
    reason_code: null,
    answer_vi: null,
    clarify_question_vi: null,
    citations: [],
    claims: [],
    steps: [],
    action_result,
  };
}

test("toActionView: không có action_result ⇒ null (lượt hỏi–đáp thường)", () => {
  assert.equal(toActionView(baseResult(null)), null);
});

test("toActionView: status=done ⇒ view kind=done, can_undo theo undo_capability_id", () => {
  const result = baseResult({
    capability: "amenity.create_booking",
    status: "done",
    facility_id: "FAC-PINGPONG",
    facility_name_vi: "Sân bóng bàn",
    slot_start: "2026-09-24T09:00:00+07:00",
    slot_end: "2026-09-24T10:00:00+07:00",
    booking_id: "B-1",
    receipt_code: "RC-AAAAAAAA",
    undo_capability_id: "amenity.cancel_booking",
    blocking_reasons: [],
    next_intake_open_at: null,
    policy_source: null,
    bookings: [],
    write_calls: 1,
  });
  const view = toActionView(result);
  assert.deepEqual(view, {
    kind: "done",
    facility_name_vi: "Sân bóng bàn",
    slot_start_vi: formatViDateTime("2026-09-24T09:00:00+07:00"),
    slot_end_vi: formatViDateTime("2026-09-24T10:00:00+07:00"),
    receipt_code: "RC-AAAAAAAA",
    can_undo: true,
  });
});

test("toActionView: status=done, undo_capability_id=null ⇒ can_undo=false (cancel_booking không hoàn tác được)", () => {
  const result = baseResult({
    capability: "amenity.cancel_booking",
    status: "done",
    facility_id: "FAC-PINGPONG",
    facility_name_vi: "Sân bóng bàn",
    slot_start: "2026-09-24T09:00:00+07:00",
    slot_end: "2026-09-24T10:00:00+07:00",
    booking_id: "B-1",
    receipt_code: "RC-BBBBBBBB",
    undo_capability_id: null,
    blocking_reasons: [],
    next_intake_open_at: null,
    policy_source: null,
    bookings: [],
    write_calls: 1,
  });
  const view = toActionView(result);
  assert.equal(view?.kind, "done");
  if (view?.kind === "done") assert.equal(view.can_undo, false);
});

test("toActionView: status=blocked ⇒ danh sách blocking_reasons + next_intake_open_at giờ Việt", () => {
  const result = baseResult({
    capability: "amenity.create_booking",
    status: "blocked",
    facility_id: "FAC-PINGPONG",
    facility_name_vi: "Sân bóng bàn",
    slot_start: "2026-09-24T09:00:00+07:00",
    slot_end: "2026-09-24T10:00:00+07:00",
    booking_id: null,
    receipt_code: null,
    undo_capability_id: null,
    blocking_reasons: [
      {
        code: "intake_closed",
        human_message_vi: "Bây giờ 23:39, Ban quản lý chỉ nhận đăng ký từ 08:30 đến 17:30.",
        is_permanent: false,
        next_valid_at: "2026-09-21T08:30:00+07:00",
        remediation_hint_vi: "Gửi lại sau 08:30 sáng mai.",
      },
    ],
    next_intake_open_at: "2026-09-21T08:30:00+07:00",
    policy_source: null,
    bookings: [],
    write_calls: 0,
  });
  const view = toActionView(result);
  assert.equal(view?.kind, "blocked");
  if (view?.kind === "blocked") {
    assert.equal(view.reasons.length, 1);
    assert.equal(
      view.reasons[0].message_vi,
      "Bây giờ 23:39, Ban quản lý chỉ nhận đăng ký từ 08:30 đến 17:30."
    );
    assert.equal(view.reasons[0].remediation_vi, "Gửi lại sau 08:30 sáng mai.");
    assert.equal(view.next_intake_open_at_vi, formatViDateTime("2026-09-21T08:30:00+07:00"));
  }
});

test("toActionView: status=needs_confirmation ⇒ dùng clarify_question_vi khi có", () => {
  const result: PublicTurnResult = {
    decision: "clarify",
    reason_code: null,
    answer_vi: null,
    clarify_question_vi: "Anh/chị xác nhận huỷ đặt sân bóng bàn 09:00 sáng mai chứ?",
    citations: [],
    claims: [],
    steps: [],
    action_result: {
      capability: "amenity.cancel_booking",
      status: "needs_confirmation",
      facility_id: "FAC-PINGPONG",
      facility_name_vi: "Sân bóng bàn",
      slot_start: null,
      slot_end: null,
      booking_id: "B-1",
      receipt_code: null,
      undo_capability_id: null,
      blocking_reasons: [],
      next_intake_open_at: null,
      policy_source: null,
      bookings: [],
      write_calls: 0,
    },
  };
  const view = toActionView(result);
  assert.deepEqual(view, {
    kind: "needs_confirmation",
    question_vi: "Anh/chị xác nhận huỷ đặt sân bóng bàn 09:00 sáng mai chứ?",
  });
});

test("toActionView: status=needs_confirmation, thiếu clarify_question_vi ⇒ câu hỏi dự phòng KHÔNG rỗng (NFR-02)", () => {
  const result = baseResult({
    capability: "amenity.cancel_booking",
    status: "needs_confirmation",
    facility_id: null,
    facility_name_vi: null,
    slot_start: null,
    slot_end: null,
    booking_id: "B-1",
    receipt_code: null,
    undo_capability_id: null,
    blocking_reasons: [],
    next_intake_open_at: null,
    policy_source: null,
    bookings: [],
    write_calls: 0,
  });
  const view = toActionView(result);
  assert.equal(view?.kind, "needs_confirmation");
  if (view?.kind === "needs_confirmation") assert.ok(view.question_vi.length > 0);
});

test("toActionView: status=listed ⇒ trả nguyên mảng bookings", () => {
  const result = baseResult({
    capability: "amenity.list_my_bookings",
    status: "listed",
    facility_id: null,
    facility_name_vi: null,
    slot_start: null,
    slot_end: null,
    booking_id: null,
    receipt_code: null,
    undo_capability_id: null,
    blocking_reasons: [],
    next_intake_open_at: null,
    policy_source: null,
    bookings: [
      {
        booking_id: "B-1",
        facility_id: "FAC-PINGPONG",
        facility_name_vi: "Sân bóng bàn",
        slot_start: "2026-09-24T09:00:00+07:00",
        slot_end: "2026-09-24T10:00:00+07:00",
        party_size: 2,
        state: "confirmed",
        receipt_code: "RC-AAAAAAAA",
      },
    ],
    write_calls: 0,
  });
  const view = toActionView(result);
  assert.equal(view?.kind, "listed");
  if (view?.kind === "listed") assert.equal(view.bookings.length, 1);
});

test("toActionView: status=unknown ⇒ cảnh báo KHÔNG gửi lại, trỏ trang Biên nhận, không lộ nội bộ", () => {
  const result = baseResult({
    capability: "amenity.create_booking",
    status: "unknown",
    facility_id: "FAC-PINGPONG",
    facility_name_vi: "Sân bóng bàn",
    slot_start: null,
    slot_end: null,
    booking_id: null,
    receipt_code: null,
    undo_capability_id: null,
    blocking_reasons: [],
    next_intake_open_at: null,
    policy_source: null,
    bookings: [],
    write_calls: 1,
  });
  const view = toActionView(result);
  assert.equal(view?.kind, "unknown");
  if (view?.kind === "unknown") {
    assert.match(view.message_vi, /KHÔNG gửi lại/);
    assert.match(view.message_vi, /Biên nhận/);
    assert.doesNotMatch(view.message_vi, /WriteTimeout|SimBackendError|fixture|SPEC-/i);
  }
});

test("formatViDateTime: ISO hợp lệ ⇒ chuỗi giờ Việt; null/rỗng/không parse được ⇒ null", () => {
  assert.equal(formatViDateTime(null), null);
  assert.equal(formatViDateTime(""), null);
  assert.equal(formatViDateTime("không-phải-iso"), null);
  const formatted = formatViDateTime("2026-09-21T08:30:00+07:00");
  assert.ok(formatted && formatted.length > 0);
});
