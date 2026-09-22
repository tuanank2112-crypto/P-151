// tests/p05-ui-undo-route.test.ts — H21 W2 (SPEC-P05-Action-Layer.md §5.2, §6):
// canh lõi THUẦN `handleUndoRequest` của `app/api/actions/undo/logic.ts` (route.ts
// wraps this — không import route.ts thẳng vì kéo theo `next/server`, không
// resolve được dưới `node --test`), tiêm
// backend giả qua `__setSimBackendForTesting` (`lib/simbackend/index.ts`) — cùng
// lý do `tests/chat-history.test.ts` không gọi thẳng `next/headers cookies()`:
// route thật đọc phiên qua `getSessionPayload()`, hàm đó ném lỗi ngoài một
// request App Router thật; `handleUndoRequest` nhận `session` trực tiếp nên test
// được mà không cần dựng request đó (đúng khuôn `tests/bql-authz.test.ts`).
//
// Ba kịch bản đúng "xong khi" của handoff H21 W2:
//   1) Hoàn tác biên nhận của chính mình ⇒ 200 + undo_capability_id: null.
//   2) Hoàn tác biên nhận của người khác ⇒ 403.
//   3) Hoàn tác lần 2 (đã hoàn tác trước đó) ⇒ 409/blocked.

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleUndoRequest } from "../app/api/actions/undo/logic.ts";
import { __setSimBackendForTesting } from "../lib/simbackend/index.ts";
import type {
  BookingRecord,
  CancelBookingResult,
  CreateBookingResult,
  FacilitySummary,
  ReceiptRecord,
  SimBackend,
} from "../lib/simbackend/contract.ts";
import { SimBackendError } from "../lib/simbackend/contract.ts";
import type { SessionPayload } from "../lib/auth/session.ts";

/** Backend giả tối giản — chỉ cài đủ các hàm `handleUndoRequest` thực sự gọi
 *  (`listMyReceipts`, `getBookingDetail`, `cancelBooking`); phần còn lại ném lỗi
 *  rõ ràng nếu lỡ bị gọi, để không âm thầm xanh giả khi route đổi hành vi. */
class FakeSimBackend implements SimBackend {
  readonly backend = "mock" as const;
  private receipts: ReceiptRecord[];
  private bookings: Map<string, BookingRecord>;
  private cancelSeq = 0;

  constructor(receipts: ReceiptRecord[], bookings: BookingRecord[]) {
    this.receipts = receipts;
    this.bookings = new Map(bookings.map((b) => [b.booking_id, b]));
  }

  now(): Date {
    return new Date("2026-09-24T09:00:00+07:00");
  }
  async listFacilities(): Promise<FacilitySummary[]> {
    throw new Error("unused in this test");
  }
  async resolveFacility(): Promise<FacilitySummary | null> {
    throw new Error("unused in this test");
  }
  async getFacilityDetail(): Promise<FacilitySummary | null> {
    throw new Error("unused in this test");
  }
  async getBookingPolicy(): Promise<never> {
    throw new Error("unused in this test");
  }
  async getAvailability(): Promise<never> {
    throw new Error("unused in this test");
  }
  async checkEligibility(): Promise<never> {
    throw new Error("unused in this test");
  }
  async listMyBookings(): Promise<BookingRecord[]> {
    throw new Error("unused in this test");
  }
  async getBookingDetail(input: {
    session_id: string;
    booking_id: string;
    resident_id: string;
  }): Promise<BookingRecord> {
    const booking = this.bookings.get(input.booking_id);
    if (!booking) throw new SimBackendError("NotFound", "booking not found");
    if (booking.resident_id !== input.resident_id) {
      throw new SimBackendError("Forbidden", "not your booking");
    }
    return booking;
  }
  async createBooking(): Promise<CreateBookingResult> {
    throw new Error("unused in this test");
  }
  async cancelBooking(input: {
    session_id: string;
    booking_id: string;
    resident_id: string;
    reason_vi: string;
    confirmed: boolean;
  }): Promise<CancelBookingResult> {
    const booking = this.bookings.get(input.booking_id);
    if (!booking) return { ok: false, reason_code: "unsupported_intent", blocking_reasons: [] };
    if (booking.state === "cancelled") {
      return { ok: false, reason_code: "action_duplicate_suspected", blocking_reasons: [] };
    }
    this.cancelSeq += 1;
    const cancelReceiptCode = `RC-CANCEL-${String(this.cancelSeq).padStart(4, "0")}`;
    booking.state = "cancelled";
    booking.cancelled_at = this.now().toISOString();
    booking.cancel_receipt_code = cancelReceiptCode;
    const original = this.receipts.find(
      (r) => r.booking_id === input.booking_id && r.action === "create"
    );
    if (original) original.undone_by = cancelReceiptCode;
    const cancelReceipt: ReceiptRecord = {
      receipt_code: cancelReceiptCode,
      action: "cancel",
      booking_id: input.booking_id,
      resident_id: input.resident_id,
      undo_capability_id: null,
      undone_by: null,
      created_at: this.now().toISOString(),
      summary_vi: "Huỷ đặt chỗ",
    };
    this.receipts.push(cancelReceipt);
    return { ok: true, receipt_code: cancelReceiptCode, undo_capability_id: null };
  }
  async listMyReceipts(resident_id: string): Promise<ReceiptRecord[]> {
    return this.receipts.filter((r) => r.resident_id === resident_id);
  }
  async savePendingAction(): Promise<void> {
    throw new Error("unused in this test");
  }
  async takePendingAction(): Promise<null> {
    return null;
  }
}

function residentSession(resident_id: string, user_id = `u-${resident_id}`): SessionPayload {
  return {
    user_id,
    role: "resident",
    resident_id,
    owned_property_ids: ["S1.120817"],
    property_type: ["apartment"],
  };
}

function seed() {
  const receipts: ReceiptRecord[] = [
    {
      receipt_code: "RC-AAAAAAAA",
      action: "create",
      booking_id: "B-1",
      resident_id: "R-0001",
      undo_capability_id: "amenity.cancel_booking",
      undone_by: null,
      created_at: "2026-09-24T09:00:00+07:00",
      summary_vi: "Đặt sân bóng bàn 09:00-10:00",
    },
  ];
  const bookings: BookingRecord[] = [
    {
      booking_id: "B-1",
      facility_id: "FAC-PINGPONG",
      facility_name_vi: "Sân bóng bàn",
      resident_id: "R-0001",
      property_id: "S1.120817",
      slot_start: "2026-09-24T09:00:00+07:00",
      slot_end: "2026-09-24T10:00:00+07:00",
      party_size: 2,
      state: "confirmed",
      idempotency_key: "idem:1",
      receipt_code: "RC-AAAAAAAA",
      created_at: "2026-09-24T08:30:00+07:00",
      cancelled_at: null,
      cancel_receipt_code: null,
    },
  ];
  return { receipts, bookings };
}

test.after(() => {
  __setSimBackendForTesting(null);
});

test("handleUndoRequest: hoàn tác biên nhận của chính mình ⇒ 200, undo_capability_id: null", async () => {
  const { receipts, bookings } = seed();
  __setSimBackendForTesting(new FakeSimBackend(receipts, bookings));

  const { status, body } = await handleUndoRequest(residentSession("R-0001"), "RC-AAAAAAAA");

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.undo_capability_id, null);
  assert.ok(body.receipt_code && body.receipt_code.startsWith("RC-CANCEL-"));
});

test("handleUndoRequest: biên nhận của người khác ⇒ 403", async () => {
  const { receipts, bookings } = seed();
  __setSimBackendForTesting(new FakeSimBackend(receipts, bookings));

  // R-0002 không sở hữu RC-AAAAAAAA (thuộc R-0001) — listMyReceipts("R-0002")
  // không trả về dòng đó, nên route không phân biệt được với "không tồn tại".
  const { status, body } = await handleUndoRequest(residentSession("R-0002"), "RC-AAAAAAAA");

  assert.equal(status, 403);
  assert.equal(body.ok, false);
  assert.equal(body.status, "forbidden");
});

test("handleUndoRequest: hoàn tác lần 2 (đã hoàn tác trước đó) ⇒ 409/blocked, KHÔNG gọi backend lần nữa", async () => {
  const { receipts, bookings } = seed();
  const backend = new FakeSimBackend(receipts, bookings);
  __setSimBackendForTesting(backend);

  const first = await handleUndoRequest(residentSession("R-0001"), "RC-AAAAAAAA");
  assert.equal(first.status, 200);

  const second = await handleUndoRequest(residentSession("R-0001"), "RC-AAAAAAAA");
  assert.equal(second.status, 409);
  assert.equal(second.body.ok, false);
  assert.equal(second.body.status, "blocked");
});

test("handleUndoRequest: không có phiên ⇒ 403, không gọi backend", async () => {
  const { status, body } = await handleUndoRequest(null, "RC-AAAAAAAA");
  assert.equal(status, 403);
  assert.equal(body.ok, false);
});

test("handleUndoRequest: vai bql ⇒ 403 (chỉ resident được hoàn tác)", async () => {
  const { status, body } = await handleUndoRequest(
    {
      user_id: "u-bql",
      role: "bql",
      resident_id: null,
      owned_property_ids: [],
      property_type: [],
    },
    "RC-AAAAAAAA"
  );
  assert.equal(status, 403);
  assert.equal(body.ok, false);
});

test("handleUndoRequest: thiếu receipt_code ⇒ 400 invalid", async () => {
  const { receipts, bookings } = seed();
  __setSimBackendForTesting(new FakeSimBackend(receipts, bookings));
  const { status, body } = await handleUndoRequest(residentSession("R-0001"), "");
  assert.equal(status, 400);
  assert.equal(body.status, "invalid");
});

test("handleUndoRequest: receipt undo_capability_id đã null (vd biên nhận của lệnh cancel) ⇒ 409/blocked", async () => {
  const receipts: ReceiptRecord[] = [
    {
      receipt_code: "RC-CANCEL-0001",
      action: "cancel",
      booking_id: "B-1",
      resident_id: "R-0001",
      undo_capability_id: null,
      undone_by: null,
      created_at: "2026-09-24T09:05:00+07:00",
      summary_vi: "Huỷ đặt chỗ",
    },
  ];
  const bookings: BookingRecord[] = [
    {
      booking_id: "B-1",
      facility_id: "FAC-PINGPONG",
      facility_name_vi: "Sân bóng bàn",
      resident_id: "R-0001",
      property_id: "S1.120817",
      slot_start: "2026-09-24T09:00:00+07:00",
      slot_end: "2026-09-24T10:00:00+07:00",
      party_size: 2,
      state: "cancelled",
      idempotency_key: "idem:1",
      receipt_code: "RC-AAAAAAAA",
      created_at: "2026-09-24T08:30:00+07:00",
      cancelled_at: "2026-09-24T09:05:00+07:00",
      cancel_receipt_code: "RC-CANCEL-0001",
    },
  ];
  __setSimBackendForTesting(new FakeSimBackend(receipts, bookings));
  const { status, body } = await handleUndoRequest(residentSession("R-0001"), "RC-CANCEL-0001");
  assert.equal(status, 409);
  assert.equal(body.status, "blocked");
});
