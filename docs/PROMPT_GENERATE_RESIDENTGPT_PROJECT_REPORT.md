# Prompt tạo báo cáo ResidentGPT MVP v0.3

Sử dụng prompt này cùng repository để tạo báo cáo trạng thái dự án mà không phóng đại mức độ hoàn thành.

```text
Bạn là Lead AI Architect và Technical Program Manager. Hãy đọc đầy đủ các nguồn sau:

- docs/Problem_Card.md
- docs/Product_Brief_ResidentGPT_MVP.md
- docs/PRD_ResidentGPT_MVP.md
- docs/UI_Flow_ResidentGPT_MVP.md
- docs/MVP_DATA_SCOPE_LOCK.md
- docs/MVP_CONSISTENCY_ALIGNMENT_v0.3.md
- docs/architecture_diagram.md
- knowledge/manifest.yaml
- knowledge/intent_source_map.yaml
- knowledge/README.md
- evals/golden/dataset_manifest.yaml
- evals/golden/rubric.md
- evals/golden/business_review_v0.3.md
- evals/golden/review_log.md
- evals/results/report.md

Viết báo cáo tiếng Việt về ResidentGPT MVP v0.3 cho mốc BTC 27/10/2026.

Báo cáo phải:

1. Mô tả chính xác hệ thống hai vai trò:
   - Cư dân dùng Resident Chat View tự phục vụ 24/7.
   - BQL/CSKH dùng Escalation Inbox để xử lý case AI chuyển tuyến.
2. Trình bày đủ năm tiêu chí BTC: Live Web, dual-role login, citation-grounded RAG, Chat Memory/Query Rewriter và Confidence Escalation.
3. Giải thích flow `answered`, `clarification_required`, `escalated`.
4. Nêu rõ mọi answer thành công phải có `document_id` và `section_id` từ 21 canonical documents.
5. Nêu rõ High Risk/Low Confidence không được hallucinate và phải tạo Resident Escalation Card + BQL ticket.
6. Bảo toàn năm intents, mười reason codes và Required Context Contract.
7. Khẳng định Booking, payment và upsell nằm ngoài MVP.
8. Phân biệt rõ:
   - yêu cầu/tài liệu đã Frozen;
   - Golden validator đã chạy hay chưa;
   - actual model/UI evaluation đã chạy hay chưa;
   - Live URL/deployment evidence có thật hay chưa.
9. Không suy diễn tài liệu thiết kế thành bằng chứng code đã implement hoặc web đã deploy.
10. Trích dẫn đường dẫn file/section cho các kết luận quan trọng.

Số liệu chuẩn:

- Knowledge Pack `1.18`: 21 canonical documents, không được sửa trong migration v0.3.
- Golden Dataset `0.3`: 50 FAQ cases, 30 E2E cases.
- E2E terminal distribution: 20 `answered`, 10 `escalated`.
- Answered action contract: resident_submits_query → system_answers_with_citation.
- Clarification action contract: resident_submits_query → system_requests_clarification → resident_provides_context → system_answers_with_citation.
- Escalation action contract: resident_submits_query → system_detects_low_confidence_or_risk → system_escalates_to_bql.

Kết thúc bằng:

- trạng thái thực tế hiện tại;
- evidence còn thiếu trước nghiệm thu;
- các bước tiếp theo theo thứ tự ưu tiên;
- checklist consistency giữa Product, UX, Architecture, Data và Evaluation.
```
