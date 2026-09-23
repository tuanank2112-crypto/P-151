// tests/golden-any-of.test.ts — Đ56 (`plan.md` §2, 2026-09-23): phần tử
// MẢNG trong `must_cite_section_ids` / `must_contain_vi` = "một trong các"
// (dữ kiện thật sự có ở nhiều section / cùng nghĩa khác chữ). Dạng chuỗi cũ
// giữ nguyên nghĩa (regression). `SPEC-P00-Knowledge-Golden.md` §6.5.
import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeFaqCase, type GoldenFaqCase, type ScoredTurn } from "../lib/eval/score.ts";

const baseCase: GoldenFaqCase = {
  case_id: "T-ANY-01",
  intent: "I-01",
  kind: "answerable",
  expected_decision: "answer",
  expected_reason_code: null,
  must_cite_section_ids: [["SEC-A", "SEC-B"]],
  must_contain_vi: ["moc chuan"],
  must_not_contain_vi: [],
};

const turnCiting = (sectionId: string, answer = "Cau tra loi co moc chuan."): ScoredTurn => ({
  decision: "answer",
  reason_code: null,
  gate_triggered: null,
  detected_intent: "I-01",
  citations: [{ document_id: "DOC-1", section_id: sectionId, document_title_vi: "t", heading_vi: "h", snippet_vi: "s" }],
  claims: [{ claim_vi: "x", verdict: "supported", supporting_section_id: sectionId }],
  answer_vi: answer,
});

test("Đ56 citation mảng [A,B]: trích B (không trích A) vẫn PASS", () => {
  const r = judgeFaqCase(baseCase, turnCiting("SEC-B"));
  assert.equal(r.checkpoint_citation, true);
  assert.equal(r.pass, true);
});

test("Đ56 citation mảng [A,B]: trích C (ngoài mảng) ⇒ FAIL", () => {
  const r = judgeFaqCase(baseCase, turnCiting("SEC-C"));
  assert.equal(r.checkpoint_citation, false);
  assert.equal(r.pass, false);
});

test("Đ56 citation dạng chuỗi cũ: must_cite_section_ids=['A'], trích B ⇒ FAIL (hành vi cũ giữ nguyên)", () => {
  const c: GoldenFaqCase = { ...baseCase, must_cite_section_ids: ["SEC-A"] };
  const r = judgeFaqCase(c, turnCiting("SEC-B"));
  assert.equal(r.checkpoint_citation, false);
  assert.equal(r.pass, false);
});

test("Đ56 citation dạng chuỗi cũ: must_cite_section_ids=['A'], trích A ⇒ PASS (hành vi cũ giữ nguyên)", () => {
  const c: GoldenFaqCase = { ...baseCase, must_cite_section_ids: ["SEC-A"] };
  const r = judgeFaqCase(c, turnCiting("SEC-A"));
  assert.equal(r.checkpoint_citation, true);
});

test("Đ56 must_contain_vi mảng [['x','y']]: câu có 'y' (không có 'x') ⇒ PASS", () => {
  const c: GoldenFaqCase = {
    ...baseCase,
    must_cite_section_ids: ["SEC-A"],
    must_contain_vi: [["x", "y"]],
  };
  const r = judgeFaqCase(c, turnCiting("SEC-A", "Cau tra loi chi co y thoi."));
  assert.equal(r.checkpoint_critical_fact, true);
  assert.equal(r.pass, true);
});

test("Đ56 must_contain_vi mảng [['x','y']]: câu KHÔNG có cả hai ⇒ FAIL", () => {
  const c: GoldenFaqCase = {
    ...baseCase,
    must_cite_section_ids: ["SEC-A"],
    must_contain_vi: [["x", "y"]],
  };
  const r = judgeFaqCase(c, turnCiting("SEC-A", "Cau tra loi khong lien quan."));
  assert.equal(r.checkpoint_critical_fact, false);
  assert.equal(r.pass, false);
});

test("Đ56 must_contain_vi dạng chuỗi cũ vẫn chấm đúng (hành vi cũ giữ nguyên)", () => {
  const c: GoldenFaqCase = { ...baseCase, must_cite_section_ids: ["SEC-A"], must_contain_vi: ["moc chuan"] };
  assert.equal(judgeFaqCase(c, turnCiting("SEC-A", "Co moc chuan trong cau nay.")).checkpoint_critical_fact, true);
  assert.equal(judgeFaqCase(c, turnCiting("SEC-A", "Khong co gi lien quan.")).checkpoint_critical_fact, false);
});
