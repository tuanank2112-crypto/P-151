import { test } from "node:test";
import assert from "node:assert/strict";
import { REASON_CODES, LIFECYCLE_STATES } from "../lib/types.ts";

test("REASON_CODES có đúng 15 phần tử (Đ12, BB-09)", () => {
  assert.equal(REASON_CODES.length, 15);
  // Không trùng lặp — enum thật sự là tập, không phải mảng có phần tử lặp.
  assert.equal(new Set(REASON_CODES).size, 15);
});

test("REASON_CODES chứa đúng mã pii_or_account_specific đã đảo nội hàm (Đ06)", () => {
  assert.ok(REASON_CODES.includes("pii_or_account_specific"));
});

test("LIFECYCLE_STATES có đúng 4 phần tử và KHÔNG chứa clarification_required như reason_code", () => {
  assert.equal(LIFECYCLE_STATES.length, 4);
  assert.ok(LIFECYCLE_STATES.includes("clarification_required"));
  // clarification_required là lifecycle_state, KHÔNG phải reason_code (01-CONTRACTS.md §2.1).
  assert.ok(!REASON_CODES.includes("clarification_required" as never));
});
