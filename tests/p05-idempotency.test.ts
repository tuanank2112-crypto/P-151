// tests/p05-idempotency.test.ts — P05-M4/M5 (SPEC-P05-Action-Layer.md §5.1,
// §10): gọi `createBooking` HAI LẦN cùng `idempotency_key` (sau precheck
// đúng) ⇒ 1 dòng `bookings`, 1 dòng `receipts`, lần 2 trả `duplicate: true`
// và CÙNG `booking_id`/`receipt_code` với lần 1 — KHÔNG tạo bản ghi mới
// (P05-C9: idempotency_key do caller sinh).

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { MemorySimBackend, PostgresSimBackend } from "../lib/simbackend/index.ts";
import { FIXED_SIM_NOW, PROPERTY_ID, RESIDENT_ID, cleanupFacility, closePool, futureSlotIso, getSql, randomSessionId } from "./_p05-helpers.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.SIM_NOW = FIXED_SIM_NOW;

const FACILITY_ID = "FAC-BASKETBALL";

test("P05-M4/M5 (mock): 2 lần cùng idempotency_key ⇒ 1 booking, 1 receipt, lần 2 duplicate:true", async () => {
  const backend = new MemorySimBackend();
  const session_id = randomSessionId("idem-mock");
  const slot_start = futureSlotIso(2, 14);
  const slot_end = futureSlotIso(2, 15);
  const idempotency_key = `idem:${session_id}`;
  const input = {
    session_id,
    facility_id: FACILITY_ID,
    resident_id: "R-MOCK-02",
    property_id: PROPERTY_ID,
    slot_start,
    slot_end,
    party_size: 2,
    idempotency_key,
  };

  await backend.checkEligibility(input);
  const first = await backend.createBooking(input);
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("unreachable");
  assert.equal(first.duplicate, false);

  const second = await backend.createBooking(input);
  assert.equal(second.ok, true);
  if (!second.ok) throw new Error("unreachable");
  assert.equal(second.duplicate, true, "lần 2 cùng key phải trả duplicate:true");
  assert.equal(second.booking_id, first.booking_id, "phải là CÙNG booking_id, không tạo mới");
  assert.equal(second.receipt_code, first.receipt_code);

  const bookings = await backend.listMyBookings("R-MOCK-02");
  assert.equal(bookings.length, 1, "P05-M5: đúng 1 dòng booking sau 2 lần gọi (mock)");
});

test("P05-M4/M5 (postgres): 2 lần cùng idempotency_key ⇒ 1 dòng bookings, 1 dòng receipts", async () => {
  const sql = getSql();
  const backend = new PostgresSimBackend();
  const session_id = randomSessionId("idem-pg");
  const slot_start = futureSlotIso(3, 14);
  const slot_end = futureSlotIso(3, 15);
  const idempotency_key = `idem:${session_id}`;
  const input = {
    session_id,
    facility_id: FACILITY_ID,
    resident_id: RESIDENT_ID,
    property_id: PROPERTY_ID,
    slot_start,
    slot_end,
    party_size: 2,
    idempotency_key,
  };

  try {
    await backend.checkEligibility(input);
    const first = await backend.createBooking(input);
    assert.equal(first.ok, true);
    if (!first.ok) throw new Error("unreachable");
    assert.equal(first.duplicate, false);

    const second = await backend.createBooking(input);
    assert.equal(second.ok, true);
    if (!second.ok) throw new Error("unreachable");
    assert.equal(second.duplicate, true, "lần 2 cùng key phải trả duplicate:true (postgres)");
    assert.equal(second.booking_id, first.booking_id);
    assert.equal(second.receipt_code, first.receipt_code);

    const bookingRows = await sql(`select count(*)::int as n from bookings where facility_id = $1 and idempotency_key = $2`, [
      FACILITY_ID,
      idempotency_key,
    ]);
    assert.equal((bookingRows as unknown as Array<{ n: number }>)[0]!.n, 1, "P05-M5: đúng 1 dòng bookings");

    const receiptRows = await sql(
      `select count(*)::int as n from receipts r join bookings b on b.id = r.booking_id where b.idempotency_key = $1 and r.action = 'create'`,
      [idempotency_key]
    );
    assert.equal((receiptRows as unknown as Array<{ n: number }>)[0]!.n, 1, "đúng 1 dòng receipts action='create'");
  } finally {
    await cleanupFacility(sql, FACILITY_ID, [session_id]);
    await closePool();
  }
});
