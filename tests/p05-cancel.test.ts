// tests/p05-cancel.test.ts — P05-M9 (SPEC-P05-Action-Layer.md §5.2, §6, §10):
// `confirmed=false` ⇒ `SimBackendError('IrreversibleUnconfirmed')`
// (`action_irreversible_requires_confirmation`, mã B2). Huỷ THÀNH CÔNG
// (confirmed=true) ⇒ biên nhận huỷ có `undo_capability_id = null`, biên
// nhận GỐC (tạo) được cập nhật `undone_by` trỏ đúng biên nhận huỷ.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { MemorySimBackend, PostgresSimBackend } from "../lib/simbackend/index.ts";
import { SimBackendError } from "../lib/simbackend/contract.ts";
import { FIXED_SIM_NOW, PROPERTY_ID, RESIDENT_ID, cleanupFacility, closePool, futureSlotIso, getSql, randomSessionId } from "./_p05-helpers.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.SIM_NOW = FIXED_SIM_NOW;

const FACILITY_ID = "FAC-BADMINTON";

test("P05-M9 (mock): confirmed=false ⇒ IrreversibleUnconfirmed; confirmed=true ⇒ undo_capability_id=null + undone_by trỏ đúng", async () => {
  const backend = new MemorySimBackend();
  const resident_id = "R-MOCK-CANCEL";
  const createSession = randomSessionId("cancel-mock-create");
  const slot_start = futureSlotIso(2, 9);
  const slot_end = futureSlotIso(2, 10);
  const createInput = {
    session_id: createSession,
    facility_id: FACILITY_ID,
    resident_id,
    property_id: PROPERTY_ID,
    slot_start,
    slot_end,
    party_size: 2,
    idempotency_key: `idem:${createSession}`,
  };
  await backend.checkEligibility(createInput);
  const created = await backend.createBooking(createInput);
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("unreachable");

  const cancelSession = randomSessionId("cancel-mock-cancel");
  await backend.getBookingDetail({ session_id: cancelSession, booking_id: created.booking_id, resident_id });

  await assert.rejects(
    () =>
      backend.cancelBooking({
        session_id: cancelSession,
        booking_id: created.booking_id,
        resident_id,
        reason_vi: "Đổi ý",
        confirmed: false,
      }),
    (err: unknown) => {
      assert.ok(err instanceof SimBackendError);
      assert.equal(err.kind, "IrreversibleUnconfirmed");
      assert.equal(err.reason_code, "action_irreversible_requires_confirmation");
      return true;
    }
  );

  // Precheck (get_booking_detail) đã dùng ở trên rồi — lượt 2 xác nhận cần
  // precheck LẠI theo đúng luồng thật (agent gọi get_booking_detail trước
  // mỗi lần thử cancel_booking); gọi lại cho hợp lệ.
  await backend.getBookingDetail({ session_id: cancelSession, booking_id: created.booking_id, resident_id });
  const cancelled = await backend.cancelBooking({
    session_id: cancelSession,
    booking_id: created.booking_id,
    resident_id,
    reason_vi: "Đổi ý",
    confirmed: true,
  });
  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) throw new Error("unreachable");
  assert.equal(cancelled.undo_capability_id, null, "huỷ KHÔNG hoàn tác được (§5.2)");

  const receipts = await backend.listMyReceipts(resident_id);
  const cancelReceipt = receipts.find((r) => r.receipt_code === cancelled.receipt_code)!;
  assert.equal(cancelReceipt.undo_capability_id, null);
  const originalReceipt = receipts.find((r) => r.receipt_code === created.receipt_code)!;
  assert.equal(originalReceipt.undone_by, cancelled.receipt_code, "biên nhận gốc phải trỏ undone_by sang biên nhận huỷ");
});

test("P05-M9 (postgres): confirmed=false ⇒ IrreversibleUnconfirmed; confirmed=true ⇒ undo_capability_id=null + undone_by trỏ đúng", async () => {
  const sql = getSql();
  const backend = new PostgresSimBackend();
  const createSession = randomSessionId("cancel-pg-create");
  const cancelSession = randomSessionId("cancel-pg-cancel");
  const slot_start = futureSlotIso(6, 9);
  const slot_end = futureSlotIso(6, 10);
  try {
    const createInput = {
      session_id: createSession,
      facility_id: FACILITY_ID,
      resident_id: RESIDENT_ID,
      property_id: PROPERTY_ID,
      slot_start,
      slot_end,
      party_size: 2,
      idempotency_key: `idem:${createSession}`,
    };
    await backend.checkEligibility(createInput);
    const created = await backend.createBooking(createInput);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error("unreachable");

    await backend.getBookingDetail({ session_id: cancelSession, booking_id: created.booking_id, resident_id: RESIDENT_ID });
    await assert.rejects(
      () =>
        backend.cancelBooking({
          session_id: cancelSession,
          booking_id: created.booking_id,
          resident_id: RESIDENT_ID,
          reason_vi: "Đổi ý",
          confirmed: false,
        }),
      (err: unknown) => {
        assert.ok(err instanceof SimBackendError);
        assert.equal(err.kind, "IrreversibleUnconfirmed");
        assert.equal(err.reason_code, "action_irreversible_requires_confirmation");
        return true;
      }
    );

    await backend.getBookingDetail({ session_id: cancelSession, booking_id: created.booking_id, resident_id: RESIDENT_ID });
    const cancelled = await backend.cancelBooking({
      session_id: cancelSession,
      booking_id: created.booking_id,
      resident_id: RESIDENT_ID,
      reason_vi: "Đổi ý",
      confirmed: true,
    });
    assert.equal(cancelled.ok, true);
    if (!cancelled.ok) throw new Error("unreachable");
    assert.equal(cancelled.undo_capability_id, null);

    const rows = await sql(
      `select r.receipt_code, r.undo_capability_id, r.undone_by, r2.receipt_code as undone_by_code
         from receipts r
         join bookings b on b.id = r.booking_id
         left join receipts r2 on r2.id = r.undone_by
        where b.id = $1
        order by r.created_at asc`,
      [created.booking_id]
    );
    const typedRows = rows as unknown as Array<{ receipt_code: string; undo_capability_id: string | null; undone_by: string | null; undone_by_code: string | null }>;
    const createRow = typedRows.find((r) => r.receipt_code === created.receipt_code)!;
    const cancelRow = typedRows.find((r) => r.receipt_code === cancelled.receipt_code)!;
    assert.equal(cancelRow.undo_capability_id, null, "biên nhận huỷ: undo_capability_id=null (§5.2, postgres)");
    assert.equal(createRow.undone_by_code, cancelled.receipt_code, "biên nhận gốc: undone_by trỏ đúng biên nhận huỷ (postgres)");

    // P05-M9 (số đo toàn cục): 0 biên nhận HUỶ nào lại có undo_capability_id khác null.
    const globalCheck = await sql(
      `select count(*)::int as n from receipts where action = 'cancel' and undo_capability_id is not null`
    );
    assert.equal((globalCheck as unknown as Array<{ n: number }>)[0]!.n, 0);
  } finally {
    await cleanupFacility(sql, FACILITY_ID, [createSession, cancelSession]);
    await closePool();
  }
});
