#!/usr/bin/env node
// scripts/dump_schema.mjs — in các giá trị enum then chốt sau khi migrate
// (OPERATIONS.md §4 bước 4, 01-CONTRACTS.md §11 C-M1). Kỳ vọng: đủ 15
// `reason_code`, đủ 4 `lifecycle_state`.
//
// CẤM chạy script này trong gói P01a: cần DATABASE_URL, chủ tịch chưa cấp.

import { makeSql } from "./_pg.mjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL chưa được cấu hình. Xem specs/OPERATIONS.md §3.");
  process.exit(2);
}

const sql = makeSql(process.env.DATABASE_URL);

try {
  const reasonCodes = await sql(
    "select enumlabel from pg_enum where enumtypid = 'reason_code'::regtype order by enumsortorder"
  );
  const lifecycleStates = await sql(
    "select enumlabel from pg_enum where enumtypid = 'lifecycle_state'::regtype order by enumsortorder"
  );

  console.log(`reason_code (${reasonCodes.length}):`);
  reasonCodes.forEach((r) => console.log(`  - ${r.enumlabel}`));
  console.log(`lifecycle_state (${lifecycleStates.length}):`);
  lifecycleStates.forEach((r) => console.log(`  - ${r.enumlabel}`));

  if (reasonCodes.length !== 15) {
    console.error(`FAIL: expected 15 reason_code, got ${reasonCodes.length}`);
    process.exit(1);
  }
  if (lifecycleStates.length !== 4) {
    console.error(`FAIL: expected 4 lifecycle_state, got ${lifecycleStates.length}`);
    process.exit(1);
  }
  process.exit(0);
} catch (e) {
  console.error(`SQL_ERROR: ${e.message}`);
  process.exit(1);
}
