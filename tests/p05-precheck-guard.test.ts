// tests/p05-precheck-guard.test.ts — P05-M3 (SPEC-P05-Action-Layer.md §10,
// BB-03): gọi `createBooking` mà CHƯA gọi `checkEligibility` (precheck) ⇒
// `SimBackendError('PrecheckMissing')` (`reason_code = action_authorization_missing`),
// và KHÔNG có dòng `bookings` nào được tạo. Chạy trên CẢ HAI backend.
//
// `lib/simbackend/` là backend cư dân mô phỏng do chúng ta tự viết (Đ02),
// không phải API thật, không gọi mạng ra ngoài.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { MemorySimBackend, PostgresSimBackend } from "../lib/simbackend/index.ts";
import { SimBackendError } from "../lib/simbackend/contract.ts";
import { FIXED_SIM_NOW, PROPERTY_ID, RESIDENT_ID, cleanupFacility, closePool, futureSlotIso, getSql, randomSessionId } from "./_p05-helpers.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.SIM_NOW = FIXED_SIM_NOW;

const FACILITY_ID = "FAC-TENNIS";

test("P05-M3 (mock): createBooking không precheck ⇒ PrecheckMissing, 0 booking được tạo", async () => {
  const backend = new MemorySimBackend();
  const session_id = randomSessionId("precheck-mock");
  const slot_start = futureSlotIso(2);
  const slot_end = futureSlotIso(2, 11);

  await assert.rejects(
    () =>
      backend.createBooking({
        session_id,
        facility_id: FACILITY_ID,
        resident_id: "R-MOCK-01",
        property_id: PROPERTY_ID,
        slot_start,
        slot_end,
        party_size: 2,
        idempotency_key: `idem:${session_id}`,
      }),
    (err: unknown) => {
      assert.ok(err instanceof SimBackendError);
      assert.equal(err.kind, "PrecheckMissing");
      assert.equal(err.reason_code, "action_authorization_missing");
      return true;
    }
  );

  const bookings = await backend.listMyBookings("R-MOCK-01");
  assert.equal(bookings.length, 0, "chưa precheck thì KHÔNG được tạo booking nào (mock)");
});

test("P05-M3 (postgres): createBooking không precheck ⇒ PrecheckMissing, 0 dòng bookings", async () => {
  const sql = getSql();
  const backend = new PostgresSimBackend();
  const session_id = randomSessionId("precheck-pg");
  const slot_start = futureSlotIso(3);
  const slot_end = futureSlotIso(3, 11);
  try {
    await assert.rejects(
      () =>
        backend.createBooking({
          session_id,
          facility_id: FACILITY_ID,
          resident_id: RESIDENT_ID,
          property_id: PROPERTY_ID,
          slot_start,
          slot_end,
          party_size: 2,
          idempotency_key: `idem:${session_id}`,
        }),
      (err: unknown) => {
        assert.ok(err instanceof SimBackendError);
        assert.equal(err.kind, "PrecheckMissing");
        assert.equal(err.reason_code, "action_authorization_missing");
        return true;
      }
    );

    const rows = await sql(`select count(*)::int as n from bookings where facility_id = $1 and resident_id = $2`, [
      FACILITY_ID,
      RESIDENT_ID,
    ]);
    assert.equal((rows as unknown as Array<{ n: number }>)[0]!.n, 0, "chưa precheck thì KHÔNG được tạo booking nào (postgres)");
  } finally {
    await cleanupFacility(sql, FACILITY_ID, [session_id]);
    await closePool();
  }
});
