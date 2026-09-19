# Golden Evaluation Dataset Review Log

## EVAL-REVIEW-001 — Initial dataset draft

- **Date:** 2026-09-19
- **Dataset revision:** `0.1`
- **Status:** Draft for business review
- **Knowledge Pack revision:** `1.18` — Frozen
- **FAQ target:** 50 cases
- **E2E target:** 30 cases
- **Contains real resident data:** No

### Decisions applied

- Một catalog logic với hai evaluation layers.
- FAQ component dùng để chạy regression nhanh.
- E2E product flow là acceptance layer cho UI Flow.
- Approved và Escalated là business completion states.
- Expected terminal state được chấm theo từng case.
- Copy không phải completion event.
- Binary PASS/FAIL yêu cầu mọi critical checkpoint pass.
- Diagnostics hỗ trợ `not_applicable`.
- Gold answer chấm theo facts/source/behavior, không yêu cầu exact wording.

### Automated validation scope

- JSONL parse được.
- Số lượng case đúng manifest.
- ID không trùng.
- E2E reference trỏ đến FAQ case tồn tại.
- Gold document và section tồn tại trong canonical Knowledge Pack.
- Dataset tham chiếu Knowledge Pack revision `1.18`.

### Human review still required

- Xác nhận query đại diện cho cách BQL/CSKH thường gặp.
- Xác nhận `must_include_facts` và `must_not_include`.
- Xác nhận expected clarification fields.
- Xác nhận expected reason code và terminal state.
- Xác nhận wording/tone đủ dùng cho nhân viên BQL/CSKH.

Dataset chỉ được chuyển sang `Frozen` sau khi các mục trên được phê duyệt và
ghi một review entry mới.

## EVAL-REVIEW-002 — Automated structural validation

- **Date:** 2026-09-19
- **Dataset revision:** `0.1`
- **Result:** PASS
- **Command:** `powershell -ExecutionPolicy Bypass -File evals/golden/validate_dataset.ps1`

### Verified

- 50 FAQ cases: 10 case cho mỗi intent.
- FAQ distribution: 40 answerable, 5 clarification, 5 escalation.
- 30 E2E cases: 20 linked và 10 standalone.
- E2E terminal distribution: 20 Approved, 10 Escalated.
- Required fields, behavior mapping, reason codes và diagnostic contract hợp lệ.
- FAQ/E2E references hợp lệ.
- Gold document/section và prohibited section tồn tại trong Knowledge Pack.
- Dataset và Knowledge Pack cùng tham chiếu revision `1.18`.
- Dữ liệu căn trong safety fixture dùng placeholder synthetic `S2.01-XXXX`.

Kết quả này chỉ xác nhận cấu trúc và tính toàn vẹn tham chiếu. Trạng thái
dataset vẫn là `Draft_for_business_review` cho đến khi hoàn thành human review.

## EVAL-REVIEW-003 — Cross-document consistency alignment

- **Date:** 2026-09-19
- **Dataset revision:** `0.1`
- **Status:** Draft for business review — not an approval entry
- **Result:** Structural validation PASS after alignment

### Changes before business freeze

- Đồng bộ required-context contract với PRD/UI; bổ sung conditional field
  `work_type_when_construction_schedule_is_asked` cho I-04.
- Khóa canonical reason-code enum dùng chung cho PRD, UI, log và evaluation.
- Thay case I-02 account-specific bị trùng coverage bằng `no_eligible_source`.
- Thay case I-05 legal bị trùng coverage bằng `emergency_or_life_safety`.
- Thay standalone no-source case bằng fault-injection case
  `source_expired_or_unknown`.
- Giữ nguyên 50 FAQ, 30 E2E, 20 linked/10 standalone và terminal distribution
  20 Approved/10 Escalated.
- M3 cohort được khóa bằng 16 case ID trong manifest; minimum PASS là 15/16.
- Canonical reason-code E2E coverage đạt 10/10.

Các thay đổi này được thực hiện khi dataset vẫn ở trạng thái Draft. Dataset
chưa được chuyển sang Frozen; business/PM/technical review vẫn bắt buộc.

## EVAL-REVIEW-004 — Business approval and Golden Dataset freeze

- **Date:** 2026-09-19
- **Dataset revision:** `0.1`
- **Decision:** APPROVED
- **New status:** Frozen
- **Approval scope:** MVP demo and offline evaluation
- **Approved by:** Project Owner / Business Approver
- **Approver name:** Not provided
- **Approval evidence:** Explicit instruction in the project session to create
  the business review, record approval and freeze Golden Dataset `0.1`.
- **Technical review:** AI-assisted consistency, reference-integrity and
  automated validation review.
- **Business review:** `business_review_v0.1.md`
- **Integrity record:** `FROZEN_CHECKSUMS.sha256`

### Review conclusion

- 40 answerable FAQ cases have positive/negative gold criteria and canonical
  document/section citations.
- 5 clarification cases request only in-contract missing context.
- 5 FAQ escalation cases and the E2E safety cohort use the canonical safe
  behavior and reason-code contract.
- 30 E2E cases define executable state sequences, critical checkpoints and the
  expected terminal state.
- Canonical reason-code E2E coverage is 10/10.
- Blocking findings: 0.

Revision `0.1` is now immutable as the MVP demo/offline-evaluation baseline.
Any material label, fact, source, behavior, checkpoint or terminal-state change
requires a new dataset revision and a new approval entry. This approval does
not authorize real-resident-data use, Controlled/Conditional Pilot or
Production deployment.
