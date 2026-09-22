// tests/p05-write-timeout.test.ts — P05-M10 (SPEC-P05-Action-Layer.md §7,
// §10): mô phỏng `WriteTimeout` bằng cờ TEST-ONLY `__forceWriteTimeout`
// (KHÔNG có trong `contract.ts` — đọc runtime qua ép kiểu, không đổi hợp
// đồng, xem ghi chú trong `lib/simbackend/index.ts::createBooking`) ⇒
// `SimBackendError('WriteTimeout')` (`action_partial_execution_unknown`),
// KHÔNG có dòng `bookings` nào được tạo (0 retry — backend không tự gọi
// lại), và có đúng 1 dòng `audit_log` mức `warn` (postgres; mock không có
// audit_log thật — SPEC-P05 §7 chỉ đòi hỏi ở đường Postgres, nơi bảng đó
// tồn tại, xem `db/migrations/004_operational.sql`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { MemorySimBackend, PostgresSimBackend } from "../lib/simbackend/index.ts";
import { SimBackendError } from "../lib/simbackend/contract.ts";
import { FIXED_SIM_NOW, PROPERTY_ID, RESIDENT_ID, cleanupFacility, closePool, futureSlotIso, getSql, randomSessionId } from "./_p05-helpers.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.SIM_NOW = FIXED_SIM_NOW;

const FACILITY_ID = "FAC-SALT-LAKE";

test("P05-M10 (mock): __forceWriteTimeout ⇒ WriteTimeout, 0 retry, 0 dòng bookings", async () => {
  const backend = new MemorySimBackend();
  const resident_id = "R-MOCK-WT";
  const session_id = randomSessionId("wt-mock");
  const slot_start = futureSlotIso(1, 9);
  const slot_end = futureSlotIso(1, 10);
  const input = {
    session_id,
    facility_id: FACILITY_ID,
    resident_id,
    property_id: PROPERTY_ID,
    slot_start,
    slot_end,
    party_size: 2,
    idempotency_key: `idem:${session_id}`,
    __forceWriteTimeout: true,
  };
  await backend.checkEligibility(input);

  let calls = 0;
  const realCreate = backend.createBooking.bind(backend);
  backend.createBooking = (i) => {
    calls++;
    return realCreate(i);
  };

  await assert.rejects(
    () => backend.createBooking(input as never),
    (err: unknown) => {
      assert.ok(err instanceof SimBackendError);
      assert.equal(err.kind, "WriteTimeout");
      assert.equal(err.reason_code, "action_partial_execution_unknown");
      return true;
    }
  );
  assert.equal(calls, 1, "0 retry — đúng 1 lời gọi createBooking");

  const bookings = await backend.listMyBookings(resident_id);
  assert.equal(bookings.length, 0, "WriteTimeout KHÔNG được để lại booking mồ côi");
});

test("P05-M10 (postgres): __forceWriteTimeout ⇒ WriteTimeout, 0 dòng bookings, 1 dòng audit_log mức warn", async () => {
  const sql = getSql();
  const backend = new PostgresSimBackend();
  const session_id = randomSessionId("wt-pg");
  const slot_start = futureSlotIso(7, 9);
  const slot_end = futureSlotIso(7, 10);
  const idempotency_key = `idem:${session_id}`;
  try {
    const input = {
      session_id,
      facility_id: FACILITY_ID,
      resident_id: RESIDENT_ID,
      property_id: PROPERTY_ID,
      slot_start,
      slot_end,
      party_size: 2,
      idempotency_key,
      __forceWriteTimeout: true,
    };
    await backend.checkEligibility(input);

    const auditBefore = await sql(`select count(*)::int as n from audit_log where event = 'action.write_timeout'`);
    const nBefore = (auditBefore as unknown as Array<{ n: number }>)[0]!.n;

    let calls = 0;
    const realCreate = backend.createBooking.bind(backend);
    backend.createBooking = (i) => {
      calls++;
      return realCreate(i);
    };

    await assert.rejects(
      () => backend.createBooking(input as never),
      (err: unknown) => {
        assert.ok(err instanceof SimBackendError);
        assert.equal(err.kind, "WriteTimeout");
        assert.equal(err.reason_code, "action_partial_execution_unknown");
        return true;
      }
    );
    assert.equal(calls, 1, "0 retry (postgres)");

    const bookingRows = await sql(`select count(*)::int as n from bookings where idempotency_key = $1`, [idempotency_key]);
    assert.equal((bookingRows as unknown as Array<{ n: number }>)[0]!.n, 0, "WriteTimeout KHÔNG để lại booking mồ côi (postgres)");

    const auditAfter = await sql(
      `select level, event from audit_log where event = 'action.write_timeout' order by created_at desc limit 1`
    );
    const typedAfter = auditAfter as unknown as Array<{ level: string; event: string }>;
    const nAfter = (
      await sql(`select count(*)::int as n from audit_log where event = 'action.write_timeout'`)
    )[0] as unknown as { n: number };
    assert.equal(nAfter.n, nBefore + 1, "đúng 1 dòng audit_log mới cho lần WriteTimeout này");
    assert.equal(typedAfter[0]!.level, "warn", "audit_log phải ở mức warn (§7)");
  } finally {
    await sql(`delete from audit_log where event = 'action.write_timeout' and payload->>'idempotency_key' = $1`, [
      idempotency_key,
    ]);
    await cleanupFacility(sql, FACILITY_ID, [session_id]);
    await closePool();
  }
});
