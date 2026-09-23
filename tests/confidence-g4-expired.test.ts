// tests/confidence-g4-expired.test.ts — Đ57: G4 dùng cùng luật Đ28/Đ41 như G3.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideTurn } from "../lib/confidence.ts";

const base = { retrieval_top1: 0.5, eligible_count: 3, retrieved_count: 4, faithfulness: 0.5, conflict_detected: false };

test("Đ57 G4 + hạng 1 hết hạn đúng chủ đề ⇒ source_expired_or_unknown", () => {
  const d = decideTurn({ ...base, top_rejected_reason: "expired_or_unknown", top_rejected_on_topic: true });
  assert.equal(d.gate, "G4_faithfulness_floor");
  assert.equal(d.reason_code, "source_expired_or_unknown");
});
test("Đ57 G4 + hạng 1 hết hạn nhưng LẠC chủ đề ⇒ no_eligible_source (Đ41, không bịa lý do)", () => {
  const d = decideTurn({ ...base, top_rejected_reason: "expired_or_unknown", top_rejected_on_topic: false });
  assert.equal(d.reason_code, "no_eligible_source");
});
test("Đ57 G4 + hạng 1 hợp lệ ⇒ no_eligible_source như cũ", () => {
  const d = decideTurn({ ...base, top_rejected_reason: null });
  assert.equal(d.gate, "G4_faithfulness_floor");
  assert.equal(d.reason_code, "no_eligible_source");
});
