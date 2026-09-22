#!/usr/bin/env node
// scripts/validate_capabilities.mjs — P05-M1 (SPEC-P05-Action-Layer.md §10):
// kiểm đăng ký capability ở `lib/simbackend/contract.ts` khớp đúng
// `01-CONTRACTS.md` §8.4 — đúng 9 dòng (7 đọc, 2 ghi), và MỌI capability
// `kind:'write'` phải có `precheck_capability_id` khác null (BB-03, C-07).
//
// In `capabilities: N · write: N · write_without_precheck: N`; exit 0 khi
// N tổng = 9, write = 2, write_without_precheck = 0. exit 1 khi sai.
import { CAPABILITIES } from "../lib/simbackend/contract.ts";

const total = CAPABILITIES.length;
const writes = CAPABILITIES.filter((c) => c.kind === "write");
const writesWithoutPrecheck = writes.filter((c) => c.precheck_capability_id === null);

console.log(`capabilities: ${total} · write: ${writes.length} · write_without_precheck: ${writesWithoutPrecheck.length}`);

const errors = [];
if (total !== 9) errors.push(`Expected 9 capabilities, got ${total} (C-07)`);
if (writes.length !== 2) errors.push(`Expected 2 write capabilities, got ${writes.length}`);
if (writesWithoutPrecheck.length !== 0) {
  errors.push(`write capability thiếu precheck_capability_id: ${writesWithoutPrecheck.map((c) => c.capability_id).join(", ")} (BB-03)`);
}
if (errors.length > 0) {
  for (const e of errors) console.error(`VALIDATE_ERROR: ${e}`);
  process.exit(1);
}
process.exit(0);
