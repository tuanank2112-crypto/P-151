# ResidentGPT MVP v0.3 — Project Alignment Report

> **Report date:** 21/09/2026
> **Deadline:** 27/10/2026
> **Scope:** product/documentation/evaluation alignment
> **Important:** tài liệu thiết kế không tự chứng minh code đã implement hoặc web đã deploy.

## 1. Executive Summary

ResidentGPT v0.3 chuyển từ baseline công cụ nội bộ sang hệ thống AI hai vai trò. Cư dân đăng nhập để hỏi nội quy/tiện ích qua chatbot đa lượt; BQL/CSKH đăng nhập Escalation Inbox để xử lý Low Confidence/High Risk cases. Product, UX, architecture và Golden Dataset dùng chung ba outcome: `answered`, `clarification_required`, `escalated`.

Năm tiêu chí BTC đã trở thành release contract: Live Web, dual-role login, RAG citations, Chat Memory/Query Rewriter và Confidence Escalation. Booking, payment và upsell đã bị loại khỏi MVP.

## 2. Product Contract

- **Resident:** gửi câu hỏi, hỏi nối tiếp, nhận clarification, answer có citations hoặc Escalation Card.
- **Management:** xem Inbox, mở case detail, đọc reason/context/evidence outcome và phản hồi.
- **Grounding:** mọi `answered` response có `document_id` và `section_id` từ 21 canonical documents.
- **Memory:** follow-up được rewrite thành standalone query đúng context.
- **Safety:** High Risk hoặc Low Confidence không có substantive answer; hệ thống tạo BQL ticket.
- **Reliability:** mọi lỗi quan trọng có fallback; không màn hình trắng.

Nguồn: `docs/Problem_Card.md`, `docs/Product_Brief_ResidentGPT_MVP.md`, `docs/PRD_ResidentGPT_MVP.md`.

## 3. UX & Architecture

Bốn UI surfaces được đặc tả:

1. Resident Chat View.
2. Clarification Card.
3. Answer Card with Citations.
4. BQL Escalation Inbox.

Luồng kiến trúc: auth/RBAC → scoped memory → query rewrite → risk/context gate → eligible RAG → similarity + grader → Answer hoặc Escalation. Escalation Service phải vừa hiển thị Resident card vừa tạo Inbox ticket.

Nguồn: `docs/UI_Flow_ResidentGPT_MVP.md`, `docs/architecture_diagram.md`.

## 4. Preserved Invariants & Pilot Scope

- Knowledge Pack `1.18` giữ nguyên 21 canonical files, manifest và intent-source map.
- Năm intents `I-01`…`I-05` giữ nguyên.
- Mười canonical reason codes giữ nguyên.
- Required Context Contract tại PRD §5.1 giữ nguyên và khớp Golden manifest.
- **Pilot Operator Scope:** Khóa chính thức tại Cụm Sapphire 1 — Tòa S1.12, Vinhomes Ocean Park 1 (Văn phòng BQL Tòa nhà: Tầng 1 S1.03; Hotline: 1900 232 389 Nhánh 4).
- **Negative Guardrails:** 
  1. Phí sạc xe điện: Không suy rộng từ xe hai bánh (162.000 đ/tháng) sang ô tô điện; thiếu dữ liệu ô tô điện phải chuyển `no_eligible_source`.
  2. Quy chế thi công: Chỉ áp dụng Căn Hộ; không suy rộng sang Biệt thự / Shophouse / Nhà liền kề (`no_eligible_source`).

Nguồn: `docs/Problem_Card.md`, `docs/MVP_DATA_SCOPE_LOCK.md`, `docs/MVP_CONSISTENCY_ALIGNMENT_v0.3.md`, `evals/golden/dataset_manifest.yaml`.

## 5. Golden Dataset v0.3

- 50 FAQ component cases: 40 answerable, 5 clarification, 5 escalation.
- 30 E2E cases: 20 `answered`, 10 `escalated`.
- Answered flow: `resident_submits_query` → `system_answers_with_citation`.
- Clarification flow: `resident_submits_query` → `system_requests_clarification` → `resident_provides_context` → `system_answers_with_citation`.
- Escalation flow: `resident_submits_query` → `system_detects_low_confidence_or_risk` → `system_escalates_to_bql`.
- Retry flow: `resident_submits_query` → `system_encounters_recoverable_error` → `resident_retries_query` → `system_answers_with_citation`.
- Unresolved flow: `resident_submits_query` → `system_requests_clarification` → `resident_provides_unhelpful_context` → `system_detects_low_confidence_or_risk` → `system_escalates_to_bql`.
- Safety bifurcation: Gate 3A (100% Zero-tolerance trên emergency, pii, legal) và Gate 3B (M3 $\ge 90\%$ trên 16 cases an toàn).
- Rubric bắt buộc Grounding, Confidence Escalation, Memory, Dual-role và đầy đủ 7 trường audit log.

Nguồn: `evals/golden/dataset_manifest.yaml`, `evals/golden/e2e_product_flow_cases.jsonl`, `evals/golden/rubric.md`.

## 6. Scope Exclusions

- Booking/đặt lịch.
- Payment/thanh toán tự động.
- Upsell/quảng cáo.
- Voice call-center integration.
- Tự động giải quyết pháp lý, tranh chấp, bồi thường hoặc tài chính cá nhân.
- Multi-site runtime ngoài OCP1 pilot.

## 6.1. Data Transparency & Pitching Notes

- **Nguồn gốc dữ liệu:** Knowledge Pack `1.18` (21 canonical markdown documents) được trích xuất và chuẩn hóa từ hệ thống quy chế, biểu phí và hướng dẫn vận hành cư dân thực tế tại Vinhomes Ocean Park 1.
- **Mức độ tin cậy:** Một số tài liệu là nội quy do cư dân chuyển biên hoặc bản hướng dẫn nội khu đã được đội ngũ dự án chuẩn hóa (curator normalized) và gắn section_id cố định phục vụ RAG.
- **Tính minh bạch học thuật & kỹ thuật:** Dự án tuyên bố rõ ràng đây là bộ dữ liệu thực nghiệm phục vụ pilot MVP tại Tòa S1.12 Cụm Sapphire 1, không tự nhận 100% là văn bản pháp lý ban hành có con dấu của CĐT ngoài phạm vi vận hành tòa nhà. Điều này thể hiện tính trung thực cao nhất trước Hội đồng Giám khảo/BTC.

## 7. Evidence Status

### Frozen/aligned

- Product/UX/architecture requirement baseline v0.3.
- Knowledge Pack `1.18` invariants.
- Golden Dataset structure, rubric, review record và checksum contract v0.3; validator đã trả exact Summary PASS ngày 21/09/2026.

### Must be evidenced separately

- Live URL và deployment smoke test.
- Implemented dual-role auth/RBAC.
- Working Chat Memory and Query Rewriter.
- Running RAG citations and Confidence/Grader behavior.
- BQL Inbox ticket persistence and response flow.
- Actual Golden run results and fault-injection results.

Không được dùng trạng thái Frozen của tài liệu để tuyên bố các implementation evidence trên đã hoàn thành.

## 8. Release Checklist

- [ ] Live URL recorded with build/commit and smoke-test timestamp.
- [ ] Resident/Management login and access isolation pass.
- [ ] 100% `answered` outputs include valid citations.
- [ ] Memory-dependent cases preserve context.
- [ ] Low Confidence/High Risk creates Resident card and BQL ticket.
- [ ] Error paths never render a blank page.
- [x] Golden validator returns exact Summary PASS.
- [ ] Actual 50 FAQ/30 E2E run artifacts are stored and scored.
- [ ] No Booking/payment/upsell feature appears in MVP navigation or flow.

## 9. Conclusion

Baseline v0.3 defines a consistent, testable target for BTC. It is ready to guide implementation and evaluation, but deployment and actual product behavior must still be proven by Live URL, smoke tests and Golden run artifacts before the project can claim full acceptance.
