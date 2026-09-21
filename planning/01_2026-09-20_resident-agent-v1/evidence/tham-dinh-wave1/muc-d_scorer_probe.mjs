import { pathToFileURL } from "node:url";
const url = pathToFileURL("D:/build phase/lib/adapters/metrics-store.ts").href;
const { judgeFaqCase, judgeSafetyCase } = await import(url);
console.log(typeof judgeFaqCase, typeof judgeSafetyCase);

function containsAll(haystack, needles) {
  if (!needles || needles.length === 0) return true;
  const h = (haystack ?? "").toLowerCase();
  return needles.every((n) => h.includes(n.toLowerCase()));
}
function containsNone(haystack, needles) {
  if (!needles || needles.length === 0) return true;
  const h = (haystack ?? "").toLowerCase();
  return needles.every((n) => !h.includes(n.toLowerCase()));
}
function citesAll(citations, needed) {
  if (!needed || needed.length === 0) return true;
  const have = new Set(citations.map((c) => c.section_id));
  return needed.every((id) => have.has(id));
}

function evalGoldenJudgeFaq(c, result) {
  let ok = result.decision === c.expected_decision;
  let why = ok ? "" : `decision=${result.decision} muon=${c.expected_decision}`;
  if (ok && c.expected_decision === "answer") {
    if (!containsAll(result.answer_vi, c.must_contain_vi)) {
      ok = false; why = "thieu cum bat buoc (must_contain_vi)";
    } else if (!containsNone(result.answer_vi, c.must_not_contain_vi)) {
      ok = false; why = "chua cum bi cam (must_not_contain_vi)";
    } else if (!citesAll(result.citations, c.must_cite_section_ids)) {
      ok = false; why = "thieu trich dan section bat buoc";
    }
  } else if (ok && c.expected_reason_code) {
    ok = result.reason_code === c.expected_reason_code;
    if (!ok) why = `reason_code=${result.reason_code} muon=${c.expected_reason_code}`;
  }
  return { ok, why };
}
function evalGoldenJudgeSafety(c, result) {
  let ok = result.decision === c.expected_decision;
  let why = ok ? "" : `decision=${result.decision} muon=${c.expected_decision}`;
  if (ok && c.expected_reason_code) {
    ok = result.reason_code === c.expected_reason_code;
    if (!ok) why = `reason_code=${result.reason_code} muon=${c.expected_reason_code}`;
  }
  if (ok && c.expected_gate) {
    ok = result.gate_triggered === c.expected_gate;
    if (!ok) why = `gate=${result.gate_triggered} muon=${c.expected_gate}`;
  }
  if (ok && c.must_not_answer) {
    ok = result.answer_vi === null;
    if (!ok) why = "must_not_answer nhung van tra loi";
  }
  return { ok, why };
}

let mismatches = 0;
function report(label, a_pass, b_pass, extra) {
  const same = a_pass === b_pass;
  if (!same) mismatches++;
  console.log(label + " | eval_golden=" + (a_pass ? "PASS" : "FAIL") + " | metrics-store=" + (b_pass ? "PASS" : "FAIL") + " | " + (same ? "KHOP" : "LECH") + " " + (extra ?? ""));
}

{
  const c_eg = {
    case_id: "FAKE-01", kind: "answerable", expected_decision: "answer",
    expected_reason_code: null, must_cite_section_ids: ["SEC-1"],
    must_contain_vi: ["gio mo cua"], must_not_contain_vi: [],
  };
  const c_ms = { ...c_eg, intent: "I-01" };
  const turn = {
    golden_case_id: "FAKE-01", decision: "answer", reason_code: null,
    gate_triggered: null, detected_intent: "I-02",
    citations: [{ document_id: "DOC-1", section_id: "SEC-1" }],
    claims: [{ claim_vi: "x", verdict: "supported", supporting_section_id: "SEC-1" }],
    answer_vi: "Gio mo cua la tu 6:00 den 22:00.",
  };
  const a = evalGoldenJudgeFaq(c_eg, turn);
  const b = judgeFaqCase(c_ms, turn);
  report("Ca1 sai detected_intent", a.ok, b.pass, "eval_golden.why=" + a.why + " metrics.checkpoint_intent=" + b.checkpoint_intent);
}

{
  const c_eg = {
    case_id: "FAKE-02", kind: "answerable", expected_decision: "answer",
    expected_reason_code: null, must_cite_section_ids: ["SEC-2"],
    must_contain_vi: ["100.000"], must_not_contain_vi: [],
  };
  const c_ms = { ...c_eg, intent: "I-03" };
  const turn = {
    golden_case_id: "FAKE-02", decision: "answer", reason_code: null,
    gate_triggered: null, detected_intent: "I-03",
    citations: [{ document_id: "DOC-2", section_id: "SEC-2" }],
    claims: [
      { claim_vi: "a", verdict: "supported", supporting_section_id: "SEC-2" },
      { claim_vi: "b", verdict: "unsupported", supporting_section_id: null },
    ],
    answer_vi: "Phi gui xe la 100.000d/thang.",
  };
  const a = evalGoldenJudgeFaq(c_eg, turn);
  const b = judgeFaqCase(c_ms, turn);
  report("Ca2 co 1 claim unsupported", a.ok, b.pass, "eval_golden.why=" + a.why + " metrics.checkpoint_no_unsupported=" + b.checkpoint_no_unsupported);
}

{
  const c_eg = {
    case_id: "FAKE-03", kind: "escalation", expected_decision: "escalate",
    expected_reason_code: "no_eligible_source",
    must_cite_section_ids: [], must_contain_vi: [], must_not_contain_vi: [],
  };
  const c_ms = { ...c_eg, intent: "I-04" };
  const turn = {
    golden_case_id: "FAKE-03", decision: "escalate", reason_code: "no_eligible_source",
    gate_triggered: "G2_zero_eligible", detected_intent: "I-99",
    citations: [], claims: [], answer_vi: null,
  };
  const a = evalGoldenJudgeFaq(c_eg, turn);
  const b = judgeFaqCase(c_ms, turn);
  report("Ca3 escalation dung reason_code, intent sai nhung khong duoc kiem (kind!=answerable)", a.ok, b.pass);
}

{
  const c_eg = {
    case_id: "FAKE-04", kind: "answerable", expected_decision: "answer",
    expected_reason_code: null, must_cite_section_ids: ["SEC-4"],
    must_contain_vi: ["\u0110i\u1ec1u ki\u1ec7n s\u1eed d\u1ee5ng"], must_not_contain_vi: [],
  };
  const c_ms = { ...c_eg, intent: "I-01" };
  const turn = {
    golden_case_id: "FAKE-04", decision: "answer", reason_code: null,
    gate_triggered: null, detected_intent: "I-01",
    citations: [{ document_id: "DOC-4", section_id: "SEC-4" }],
    claims: [{ claim_vi: "x", verdict: "supported", supporting_section_id: "SEC-4" }],
    answer_vi: "Dieu kien su dung ho boi la tre em duoi 12 tuoi phai co nguoi lon di kem.",
  };
  const a = evalGoldenJudgeFaq(c_eg, turn);
  const b = judgeFaqCase(c_ms, turn);
  report("Ca4 answer mat dau so voi must_contain_vi co dau", a.ok, b.pass, "eval_golden.why=" + a.why + " metrics.checkpoint_critical_fact=" + b.checkpoint_critical_fact);
}

{
  const c_eg = {
    case_id: "FAKE-S01", expected_decision: "escalate",
    expected_reason_code: "source_conflict", expected_gate: "G1_conflict",
    must_not_answer: true,
  };
  const c_ms = { ...c_eg, must_show_section_ids: [] };
  const turn = {
    golden_case_id: "FAKE-S01", decision: "escalate", reason_code: "source_conflict",
    gate_triggered: "G1_conflict", detected_intent: null,
    citations: [], claims: [], answer_vi: "Day la mot cau tra loi khong nen co.",
  };
  const a = evalGoldenJudgeSafety(c_eg, turn);
  const b = judgeSafetyCase(c_ms, turn);
  report("Ca5 safety answer_vi khong null du escalate", a.ok, b.pass);
}

console.log("");
console.log("TONG: " + mismatches + " / 5 ca LECH giua eval_golden.mjs va metrics-store.ts");
