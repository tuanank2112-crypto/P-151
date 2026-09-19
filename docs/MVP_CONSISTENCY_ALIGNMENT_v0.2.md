# ResidentGPT — MVP Consistency Alignment v0.2

> **Prepared:** 19/09/2026  
> **Applies to:** Problem Card, Product Brief, PRD, UI Flow, Golden Dataset
> and Evaluation Report  
> **Change type:** Documentation/evaluation-contract alignment  
> **Feature-scope impact:** None — MVP Scope Freeze v0.1 remains unchanged

## Decisions aligned

1. **Required context:** PRD Mục 5.1 và Golden manifest dùng cùng field
   catalog. Field `when_relevant` là conditional; hệ thống không hỏi context
   không cần thiết hoặc PII bổ sung.
2. **Reason codes:** PRD, UI và Golden Dataset dùng một canonical enum gồm 10
   code. `clarification_required` là state/event, không phải escalation reason.
3. **Financial boundary:** biểu phí công khai và hướng dẫn thanh toán chung có
   thể answerable; công nợ, giao dịch, hoàn/miễn/giảm phí hoặc nghĩa vụ cá nhân
   phải manual handling theo category phù hợp.
4. **Geographic scope:** Knowledge Pack bao phủ Vinhomes Ocean Park;
   pilot operator scope là BQL/CSKH của một cụm/tòa được chọn. Đây không phải
   multi-site/multi-tenant runtime.
5. **Evaluation contract:** Golden `0.1` có 50 FAQ, 30 E2E; M1 dùng 40
   answerable cases, M3 dùng 16 safety cases, M2 dùng paired E2E handling-time
   data. Human-control và logging completeness là gate 100% trên 30 E2E cases.
6. **Evaluation report:** template cũ được thay bằng M1/M2/M3, human-control,
   logging completeness và pilot decision rule của PRD.
7. **Golden status:** Golden Dataset `0.1` đã được review, ghi approval và
   chuyển sang `Frozen` ngày 19/09/2026 cho MVP demo/offline evaluation.

## Pre-freeze Golden corrections

- Chuẩn hóa I-04 conditional field thành
  `work_type_when_construction_schedule_is_asked`.
- Bổ sung E2E coverage cho `no_eligible_source`,
  `source_expired_or_unknown` và `emergency_or_life_safety` mà không thay đổi
  tổng số case hoặc terminal distribution.
- Canonical reason-code coverage hiện là 10/10.

## Validation

Business review và approval record nằm tại
`evals/golden/business_review_v0.1.md`; integrity evidence nằm tại
`evals/golden/FROZEN_CHECKSUMS.sha256`.

Chạy từ repository root:

```powershell
powershell -ExecutionPolicy Bypass -File evals/golden/validate_dataset.ps1
```

Expected summary:

- FAQ cases: 50.
- E2E cases: 30.
- Linked E2E cases: 20.
- FAQ distribution: 40 answerable, 5 clarification, 5 escalation.
- E2E terminals: 20 approved, 10 escalated.
- Canonical reason-code coverage: 10/10.

## Still open

- Ghi tên reviewer và approval entry trước khi Frozen Golden `0.1`.
- Thiết kế/triển khai product evaluation logging theo FR-10/NFR-06.
- Vẽ và export bốn UI surfaces đã định nghĩa trong UI Flow.
- Chạy evaluation thật; hiện chưa có M1–M3 actual result hoặc pilot decision.
