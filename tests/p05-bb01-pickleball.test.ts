// tests/p05-bb01-pickleball.test.ts — P05-M7 phần backend (BB-01, SPEC-P05
// §2.3, §10): đặt `FAC-PICKLEBALL` THÀNH CÔNG (is_bookable=true), nhưng
// policy trả `has_authoritative_rules: false` và `source_document_id: null`
// — hai quyền TÁCH RỜI: đặt được chỗ KHÔNG đồng nghĩa được phép giải thích
// nội quy của nó (agent tầng trên phải tự chặn phát biểu quy định dựa vào
// cờ này — phần "hỏi nội quy ⇒ no_eligible_source" thuộc RAG/A2, ngoài
// phạm vi backend P05, xem SPEC-P00 §4).

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLocalEnv, requireEnv } from "../scripts/_batch.mjs";
import { MemorySimBackend, PostgresSimBackend } from "../lib/simbackend/index.ts";
import { FIXED_SIM_NOW, PROPERTY_ID, RESIDENT_ID, cleanupFacility, closePool, futureSlotIso, getSql, randomSessionId } from "./_p05-helpers.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.SIM_NOW = FIXED_SIM_NOW;

const FACILITY_ID = "FAC-PICKLEBALL";

test("P05-M7 (mock): FAC-PICKLEBALL đặt được, policy has_authoritative_rules=false, source_document_id=null", async () => {
  const backend = new MemorySimBackend();
  const session_id = randomSessionId("bb01-mock");
  const resident_id = "R-MOCK-BB01";
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
  };

  const policy = await backend.getBookingPolicy(input);
  assert.equal(policy.has_authoritative_rules, false, "BB-01: FAC-PICKLEBALL không có nguồn nội quy");
  assert.equal(policy.source_document_id, null);
  assert.equal(policy.is_bookable, true, "nhưng VẪN đặt được chỗ (hai quyền tách rời)");

  await backend.checkEligibility(input);
  const result = await backend.createBooking(input);
  assert.equal(result.ok, true, "đặt FAC-PICKLEBALL phải THÀNH CÔNG dù has_authoritative_rules=false");
});

test("P05-M7 (postgres): FAC-PICKLEBALL đặt được, policy has_authoritative_rules=false, source_document_id=null", async () => {
  const sql = getSql();
  const backend = new PostgresSimBackend();
  const session_id = randomSessionId("bb01-pg");
  const slot_start = futureSlotIso(5, 9);
  const slot_end = futureSlotIso(5, 10);
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
  try {
    const policy = await backend.getBookingPolicy(input);
    assert.equal(policy.has_authoritative_rules, false, "BB-01 (postgres)");
    assert.equal(policy.source_document_id, null);
    assert.equal(policy.is_bookable, true);

    await backend.checkEligibility(input);
    const result = await backend.createBooking(input);
    assert.equal(result.ok, true, "đặt FAC-PICKLEBALL phải THÀNH CÔNG (postgres)");
  } finally {
    await cleanupFacility(sql, FACILITY_ID, [session_id]);
    await closePool();
  }
});
