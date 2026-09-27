# ResidentGPT — Golden Dataset Business Review & Approval v0.3

> **Dataset revision:** `0.3`
> **Review date:** 21/09/2026
> **Approval scope:** `BTC_MVP_Evaluation`
> **Freeze state:** `Frozen`

## 1. Review Scope

Review xác nhận Golden Dataset đã được đồng bộ với ResidentGPT MVP v0.3: Resident-facing multi-turn chat, citation-grounded RAG và BQL Escalation Inbox.

Review không thay thế production security/privacy approval và không tự chứng minh Live URL đã được triển khai.

## 2. Evidence Reviewed

- `dataset_manifest.yaml`
- `faq_component_cases.jsonl`
- `e2e_product_flow_cases.jsonl`
- `rubric.md`
- PRD, UI Flow và Consistency Alignment v0.3
- Knowledge Pack `1.18` và canonical source references

## 3. Findings

- **PASS — Catalog integrity:** 50 FAQ cases và 30 E2E cases.
- **PASS — Intent balance:** mỗi `I-01`…`I-05` có 10 FAQ cases.
- **PASS — Terminal distribution:** 20 `answered`, 10 `escalated`.
- **PASS — Grounding:** mọi answer thành công bắt buộc có `document_id` và `section_id`.
- **PASS — Safety bifurcation:** Gate 3A (100% Zero-tolerance trên emergency, pii, legal) và Gate 3B (M3 $\ge 90\%$ trên 16 cases an toàn).
- **PASS — Action contracts:** `E2E-D-SYS-001` tái hiện đúng recoverable error/retry; `E2E-F-UNRESOLVED-001` tái hiện đúng unhelpful clarification dẫn đến escalation.
- **PASS — Observability & RBAC:** Checkpoints trực tiếp cho BQL (`resident_token_rejected_on_inbox_api`, `bql_inbox_displays_case_detail`, `bql_updates_status_with_timestamp`) và 7 trường log bắt buộc.
- **PASS — Pilot scope:** Khóa địa bàn pilot tại Tòa S1.12 Cụm Sapphire 1 (Văn phòng BQL Tòa nhà Tầng 1 S1.03, Hotline 1900 232 389 Nhánh 4).
- **PASS — Confidence escalation:** High Risk hoặc không có evidence phù hợp kết thúc `escalated` và tạo BQL handoff.
- **PASS — Memory:** clarification/follow-up contract giữ đúng context.
- **PASS — Invariants:** 5 intents, 10 reason codes và Required Context Contract được bảo toàn.
- **PASS — Scope guard:** Booking, payment và upsell không thuộc behavior được chấm.

## 4. Residual Risks

- Similarity threshold và Grader Node cần calibration bằng actual run.
- Live URL, dual-role auth implementation và fault-injection evidence phải được cung cấp trước nghiệm thu.
- PII retention/redaction/access cần phê duyệt trước real-user pilot.
- Knowledge Pack facts vẫn phụ thuộc source governance của revision `1.18`.

## 5. Approval Record

- **Decision:** `APPROVED`
- **Freeze state:** `Frozen`
- **Approved by role:** Project Owner / Business Approver
- **Approver name:** Not provided
- **Approval evidence:** yêu cầu rõ ràng trong phiên dự án ngày 21/09/2026 để nâng baseline lên v0.3 và đồng bộ theo năm tiêu chí BTC.
- **Applies to:** `BTC_MVP_Evaluation`
**Does not apply to:** production release, privacy/security sign-off hoặc xác nhận Live URL.

Mọi thay đổi material phải tăng revision, review lại source/behavior bị ảnh hưởng, tính lại checksum và chạy validator.
