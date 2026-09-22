# ResidentGPT Golden Dataset Review Log

## EVAL-REVIEW-001 — v0.3 Migration Scope

- **Date:** 21/09/2026
- **Decision:** chuyển evaluation contract từ baseline cũ sang Resident Chat + BQL Escalation Inbox.
- **Result:** 50 FAQ cases được giữ; 30 E2E cases được chuyển sang Resident action contracts.

## EVAL-REVIEW-002 — Invariant Audit

- **Date:** 21/09/2026
- **Result:** PASS
- Knowledge Pack revision `1.18` giữ nguyên.
- Năm Provisional MVP Intents giữ nguyên.
- Mười canonical reason codes giữ nguyên.
- Required Context Contract khớp PRD §5.1.

## EVAL-REVIEW-003 — Product Behavior Review

- **Date:** 21/09/2026
- **Result:** PASS
- Thành công kết thúc `answered` với citation.
- Low Confidence/High Risk kết thúc `escalated` với Resident card và BQL ticket.
- Clarification giữ đúng multi-turn context.
- Terminal distribution: 20 `answered`, 10 `escalated`.
- Booking, payment và upsell nằm ngoài scope.

## EVAL-REVIEW-004 — Freeze Approval

- **Date:** 21/09/2026
- **Decision:** APPROVED
- **Approval scope:** `BTC_MVP_Evaluation`
- **Approved by:** Project Owner / Business Approver
- **Approver name:** Not provided
- **Freeze state:** Frozen
- **Conditions:** checksum của tám target files được tính lại; validator phải trả exact Summary PASS.

## EVAL-REVIEW-005 — Action Contracts, Safety Bifurcation & Pilot Scope Alignment

- **Date:** 23/09/2026
- **Decision:** APPROVED
- **Approval scope:** `BTC_MVP_Evaluation`
- **Approved by:** Senior AI Architect / QA Reviewer
- **Action contracts:** Thêm signature tái hiện đúng retry cho `E2E-D-SYS-001` và unhelpful clarification cho `E2E-F-UNRESOLVED-001`.
- **Safety bifurcation:** Phân tách Gate 3A (100% Zero Severe Violations cho emergency, pii, legal) và Gate 3B (M3 $\ge 90\%$ trên 16 cases an toàn).
- **Dual-role & Observability:** Bổ sung các checkpoint quan sát trực tiếp (`resident_token_rejected_on_inbox_api`, `bql_inbox_displays_case_detail`, `bql_updates_status_with_timestamp`) và 7 trường log bắt buộc.
- **Pilot scope:** Khóa địa bàn pilot tại Tòa S1.12 Cụm Sapphire 1, Vinhomes Ocean Park 1 (Văn phòng BQL Tầng 1 S1.03, Hotline 1900 232 389 Nhánh 4).
- **Result:** PASS — recalculate checksums and validate.

## Change Control

Mọi thay đổi material sau freeze phải tăng revision, cập nhật review evidence, tính lại `FROZEN_CHECKSUMS.sha256` và chạy `validate_dataset.ps1`.
