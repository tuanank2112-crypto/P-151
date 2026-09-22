// tests/p05-quota.test.ts — P05-M6 (SPEC-P05-Action-Layer.md §10, §7):
// `quota_remaining = 0` ⇒ `createBooking` trả `action_quota_exceeded`, và
// KHÔNG retry nào xảy ra (backend không tự gọi lại — chỉ có đúng N lời gọi
// `createBooking` mà test tự thực hiện, không hơn).

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { MemorySimBackend, PostgresSimBackend } from "../lib/simbackend/index.ts";
import { FIXED_SIM_NOW, PROPERTY_ID, RESIDENT_ID, cleanupFacility, closePool, futureSlotIso, getSql, randomSessionId } from "./_p05-helpers.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.SIM_NOW = FIXED_SIM_NOW;

// max_active_bookings = 3, max_bookings_per_week = 5 (db/seed/facilities.json)
const FACILITY_ID = "FAC-VOLLEYBALL";

test("P05-M6 (mock): quota_remaining=0 ⇒ action_quota_exceeded, không retry", async () => {
  const backend = new MemorySimBackend();
  const resident_id = "R-MOCK-QUOTA";
  let createBookingCalls = 0;
  const realCreate = backend.createBooking.bind(backend);
  backend.createBooking = (input) => {
    createBookingCalls++;
    return realCreate(input);
  };

  // Lấp đầy max_active_bookings=3.
  for (let i = 0; i < 3; i++) {
    const session_id = randomSessionId(`quota-mock-${i}`);
    const slot_start = futureSlotIso(1, 8 + i);
    const slot_end = futureSlotIso(1, 9 + i);
    const input = {
      session_id,
      facility_id: FACILITY_ID,
      resident_id,
      property_id: PROPERTY_ID,
      slot_start,
      slot_end,
      party_size: 2,
      idempotency_key: `idem:${session_id}`,
    };
    await backend.checkEligibility(input);
    const r = await backend.createBooking(input);
    assert.equal(r.ok, true, `booking ${i} phải thành công (chưa vượt quota)`);
  }

  // Lần thứ 4 phải bị chặn bởi quota.
  const session_id = randomSessionId("quota-mock-4");
  const slot_start = futureSlotIso(1, 15);
  const slot_end = futureSlotIso(1, 16);
  const input4 = {
    session_id,
    facility_id: FACILITY_ID,
    resident_id,
    property_id: PROPERTY_ID,
    slot_start,
    slot_end,
    party_size: 2,
    idempotency_key: `idem:${session_id}`,
  };
  await backend.checkEligibility(input4);
  const blocked = await backend.createBooking(input4);
  assert.equal(blocked.ok, false);
  if (blocked.ok) throw new Error("unreachable");
  assert.equal(blocked.reason_code, "action_quota_exceeded");
  assert.ok(blocked.blocking_reasons.some((r) => r.code === "quota_exceeded"));
  assert.equal(createBookingCalls, 4, "đúng 4 lời gọi createBooking — KHÔNG có retry ngầm nào");
});

test("P05-M6 (postgres): quota_remaining=0 ⇒ action_quota_exceeded", async () => {
  const sql = getSql();
  const backend = new PostgresSimBackend();
  const sessionIds: string[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      const session_id = randomSessionId(`quota-pg-${i}`);
      sessionIds.push(session_id);
      const slot_start = futureSlotIso(4, 8 + i);
      const slot_end = futureSlotIso(4, 9 + i);
      const input = {
        session_id,
        facility_id: FACILITY_ID,
        resident_id: RESIDENT_ID,
        property_id: PROPERTY_ID,
        slot_start,
        slot_end,
        party_size: 2,
        idempotency_key: `idem:${session_id}`,
      };
      await backend.checkEligibility(input);
      const r = await backend.createBooking(input);
      assert.equal(r.ok, true, `booking ${i} phải thành công (postgres)`);
    }

    const session_id4 = randomSessionId("quota-pg-4");
    sessionIds.push(session_id4);
    const slot_start4 = futureSlotIso(4, 15);
    const slot_end4 = futureSlotIso(4, 16);
    const input4 = {
      session_id: session_id4,
      facility_id: FACILITY_ID,
      resident_id: RESIDENT_ID,
      property_id: PROPERTY_ID,
      slot_start: slot_start4,
      slot_end: slot_end4,
      party_size: 2,
      idempotency_key: `idem:${session_id4}`,
    };
    await backend.checkEligibility(input4);
    const blocked = await backend.createBooking(input4);
    assert.equal(blocked.ok, false);
    if (blocked.ok) throw new Error("unreachable");
    assert.equal(blocked.reason_code, "action_quota_exceeded");
    assert.ok(blocked.blocking_reasons.some((r) => r.code === "quota_exceeded"));

    const rows = await sql(`select count(*)::int as n from bookings where facility_id = $1 and resident_id = $2`, [
      FACILITY_ID,
      RESIDENT_ID,
    ]);
    assert.equal((rows as unknown as Array<{ n: number }>)[0]!.n, 3, "chỉ 3 booking được tạo, lần thứ 4 bị chặn hoàn toàn");
  } finally {
    await cleanupFacility(sql, FACILITY_ID, sessionIds);
    await closePool();
  }
});
