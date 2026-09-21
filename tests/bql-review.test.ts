// tests/bql-review.test.ts — W3 (handoff H07): máy trạng thái review_queue
// (SPEC-P03 §3.3). Canh THUẦN hàm `assertPendingTransition`: chuyển từ
// `pending` không ném lỗi; chuyển từ bất kỳ trạng thái cuối nào khác đều ném
// `ReviewTransitionError` (không có đường quay lại `pending`, P03-C4).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertPendingTransition,
  ReviewTransitionError,
} from "../lib/adapters/bql-store.ts";

test("assertPendingTransition: state='pending' ⇒ không ném lỗi (chuyển hợp lệ)", () => {
  assert.doesNotThrow(() => assertPendingTransition("pending"));
});

test("assertPendingTransition: state='approved' ⇒ ném ReviewTransitionError", () => {
  assert.throws(() => assertPendingTransition("approved"), ReviewTransitionError);
});

test("assertPendingTransition: state='edited_approved' ⇒ ném ReviewTransitionError", () => {
  assert.throws(() => assertPendingTransition("edited_approved"), ReviewTransitionError);
});

test("assertPendingTransition: state='rejected' ⇒ ném ReviewTransitionError", () => {
  assert.throws(() => assertPendingTransition("rejected"), ReviewTransitionError);
});
