# ResidentGPT MVP v0.3 — Evaluation Report Template

> **Status:** NOT RUN
> **Purpose:** canonical report for BTC MVP evaluation
> **Knowledge Pack:** revision `1.18` — Frozen
> **Golden Dataset:** revision `0.3` — Frozen
> **Detailed run artifacts:** `evals/golden/results/<run_id>/`

## 1. Run Metadata

- **Run ID:** TBD
- **Run date/time:** TBD
- **Build/commit:** TBD
- **Live URL:** TBD
- **Deployment smoke test:** TBD
- **Knowledge Pack revision:** `1.18`
- **Golden Dataset revision/status:** `0.3` / `Frozen`
- **Model/prompt/retrieval revisions:** TBD
- **Confidence threshold/Grader revision:** TBD
- **Reviewer(s):** TBD

## 2. Execution Coverage

- **FAQ catalog:** 50 total; 40 answerable, 5 clarification, 5 escalation.
- **E2E catalog:** 30 total; 20 FAQ-linked, 10 standalone.
- **Expected E2E terminals:** 20 `answered`, 10 `escalated`.
- **FAQ executed:** TBD/50.
- **E2E executed:** TBD/30.
- **Excluded cases and reasons:** TBD.

## 3. BTC Requirement Summary

| Requirement | Evidence | Actual | Status |
|---|---|---|---|
| Public Live Web | URL + health/smoke result | TBD | Pending |
| Dual-role login | Resident/Management auth + access isolation | TBD | Pending |
| Citation-grounded RAG | Valid `document_id` + `section_id` for every `answered` case | TBD | Pending |
| Chat Memory | Context-dependent rewrite/result checks | TBD | Pending |
| Confidence Escalation | High Risk/Low Confidence Resident card + BQL ticket | TBD | Pending |

## 4. Quality & Safety Metrics

| Gate | Denominator / measurement | Target | Actual | Status |
|---|---|---|---|---|
| M1 — Answer Quality | 40 answerable FAQ cases | ≥85% and ≥34/40 PASS | Not run | Pending |
| Grounding | All `answered` E2E/FAQ outputs | 100% valid citations | Not run | Pending |
| M3 — Correct Safe Behavior | 16 safety-handling E2E cases | ≥90% and ≥15/16 PASS | Not run | Pending |
| Memory correctness | Applicable multi-turn cases | 100% context-correct | Not run | Pending |
| Dual-role/handoff | Applicable E2E cases | 100% role/handoff checks | Not run | Pending |
| Logging completeness | 30 E2E cases | 30/30 applicable fields | Not run | Pending |
| Blank-screen prevention | Fault-injection matrix | 100% fallback rendered | Not run | Pending |

## 5. Grounding Results

- **Answered outputs checked:** TBD
- **Valid document + section citations:** TBD
- **Invalid/missing citations:** TBD
- **Unsupported claims:** TBD
- **Breakdown by intent/source:** TBD

## 6. Memory Results

- **Context-dependent cases executed:** TBD
- **Correct standalone rewrites:** TBD
- **Cross-conversation leakage:** TBD
- **Context omission/addition failures:** TBD

## 7. Confidence & Escalation Results

- **Low Confidence cases:** TBD
- **High Risk cases:** TBD
- **Correct Resident Escalation Cards:** TBD
- **Correct BQL Inbox tickets:** TBD
- **Reason-code accuracy:** TBD
- **Substantive answers incorrectly emitted:** TBD

## 8. Dual-role & Reliability

- **Resident login/access isolation:** TBD
- **Management login/Inbox access:** TBD
- **BQL case response with actor/timestamp:** TBD
- **Auth/model/retrieval/persistence/render fault tests:** TBD
- **Blank screens observed:** TBD

## 9. Failure Triage

Mỗi failure ghi tối thiểu case/run ID, expected/actual terminal state, failed checkpoint, reason code nếu áp dụng, expected/actual citations, severity, owner, remediation và rerun decision.

## 10. BTC Decision

- Không có Live URL hoặc một trong năm hard requirements fail: **Not ready for BTC acceptance**.
- Tất cả hard requirements có evidence và metric gates đạt: **Eligible for BTC MVP acceptance review**.
- **Actual decision:** Pending — evaluation not run.
