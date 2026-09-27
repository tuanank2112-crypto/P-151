# Product Brief — ResidentGPT MVP v0.3: Dual-role Resident Chat & BQL Escalation

> **Document status:** FROZEN FOR MVP v0.3 — Dual-role & Confidence Escalation Alignment
> **Freeze date:** 21/09/2026
> **Deadline:** 27/10/2026
> **Alignment log:** `docs/MVP_CONSISTENCY_ALIGNMENT_v0.3.md`
> **Scope contract:** `knowledge_coverage_scope = VINHOMES_OCEAN_PARK`;
> `pilot_operator_scope = Cư dân Tòa S1.12, Cụm Sapphire 1 & Văn phòng BQL Tòa nhà (Tầng 1 S1.03, Hotline 1900 232 389 Nhánh 4) tại Vinhomes Ocean Park 1`.
> Knowledge coverage rộng hơn pilot operator scope không đồng nghĩa hỗ trợ multi-site.

## 1. Product Vision

ResidentGPT là hệ thống AI tương hỗ hai vai trò:

- **Cư dân** dùng chatbot tự phục vụ 24/7 để hỏi nội quy/tiện ích, hỏi nối tiếp và nhận câu trả lời có căn cứ minh bạch.
- **BQL/CSKH** dùng Escalation Inbox để tiếp nhận, theo dõi và phản hồi các ca AI chuyển tuyến vì Confidence thấp, thiếu evidence hoặc rủi ro cao.

Mục tiêu là giảm tải câu hỏi lặp lại cho BQL mà không đánh đổi tính chính xác, an toàn hoặc khả năng truy vết.

## 2. Problem

Cư dân phải gọi hotline hoặc chờ Zalo cho nhiều việc hành chính nhỏ. BQL vừa xử lý lượng câu hỏi lặp lại, vừa thiếu một hàng đợi tập trung cho các ca khó. Một chatbot đơn lượt không đủ vì câu hỏi nối tiếp phụ thuộc ngữ cảnh; một chatbot không có Confidence Gate có thể suy đoán khi evidence yếu hoặc khi nội dung thuộc nhóm rủi ro cao.

## 3. Primary Users

### 3.1. Cư dân — Resident

- Đăng nhập vào Resident Chat View.
- Hỏi câu hỏi thuộc năm intent MVP và tiếp tục hội thoại đa lượt.
- Nhận câu trả lời trực tiếp khi evidence đủ mạnh, luôn kèm `document_id` và `section_id`.
- Nhận Clarification Card khi thiếu required context.
- Nhận Thẻ Escalation với Hotline/Văn phòng BQL khi Low Confidence hoặc High Risk.

### 3.2. BQL/CSKH — Management / Operator

- Đăng nhập vào BQL Escalation Inbox.
- Xem case, transcript, context đã thu thập, confidence/risk outcome và canonical reason code.
- Nhận và phản hồi các case cần can thiệp con người.
- Theo dõi trạng thái case mà không phụ thuộc vào nhiều kênh rời rạc.

## 4. Solution Hypothesis

Nếu ResidentGPT duy trì Chat Memory, viết lại câu hỏi phụ thuộc thành standalone query, retrieval trên Knowledge Pack `1.18`, chấm Similarity Score và Grader Node trước khi trả lời, thì:

- Cư dân sẽ tự giải quyết nhanh các câu hỏi có căn cứ rõ.
- BQL chỉ tập trung vào case thiếu căn cứ hoặc cần phán đoán con người.
- Mỗi câu trả lời có thể kiểm tra lại theo document/section.
- Hệ thống sẽ fail safely thay vì hallucinate.

## 5. Provisional MVP Intents — Frozen

1. `I-01`: Thẻ cư dân/ra vào.
2. `I-02`: Phương tiện/thẻ xe.
3. `I-03`: Tiện ích chung.
4. `I-04`: Chuyển đồ/thi công.
5. `I-05`: Nội quy sinh hoạt.

Required context của từng intent được khóa tại PRD §5.1. Danh mục intent không được mở rộng trong MVP v0.3.

## 6. In Scope

### 6.1. Web Live Deployment

- Kiến trúc cloud-ready, đóng gói bằng Docker và có thể triển khai bằng Streamlit hoặc Next.js/backend tương đương.
- Acceptance evidence phải chứa Live URL truy cập công khai và health/smoke check thành công.
- Không được coi tài liệu thiết kế là bằng chứng web đã deploy.

### 6.2. Đăng nhập hai vai trò

- Auth xác định `resident` hoặc `management`.
- Cư dân chỉ vào Resident Chat View và lịch sử hội thoại của mình.
- BQL/CSKH vào Escalation Inbox và chỉ thấy dữ liệu đúng quyền.
- Truy cập sai vai trò phải bị từ chối an toàn.

### 6.3. RAG có citations

- Retrieval chỉ dùng đúng 21 tài liệu canonical thuộc Knowledge Pack `1.18`.
- Mọi câu trả lời trạng thái `answered` phải có ít nhất một citation hợp lệ gồm `document_id` và `section_id`.
- Không có evidence đủ điều kiện, evidence mâu thuẫn hoặc hết hiệu lực thì không trả lời nội dung.

### 6.4. Chat Memory đa lượt

- Lưu lịch sử theo user/session/conversation với kiểm soát truy cập.
- Query Rewriter dùng lịch sử để tạo standalone query cho RAG.
- Retrieval chỉ nhận rewritten query và required context liên quan, không nạp toàn bộ transcript một cách mất kiểm soát.

### 6.5. Confidence Escalation

- Confidence Gate kết hợp Similarity Score, source eligibility và Grader Node.
- Low Confidence hoặc High Risk tạo Thẻ Escalation cho Cư dân và ticket trong BQL Escalation Inbox.
- Ticket lưu transcript cần thiết, lý do, intent nếu xác định được, citations/evidence đã thử và timestamps.
- Dùng đúng 10 canonical reason codes; `clarification_required` chỉ là state/event.

## 7. Scope Boundaries

### 7.1. Out of Answerable Scope — In Safety-Handling Scope

- PII/account-specific hoặc tài chính cá nhân cần xác minh.
- Pháp lý, bồi thường, tranh chấp, xác định trách nhiệm/lỗi.
- An ninh, credential, quyền truy cập và emergency/life-safety.
- Unsupported/unresolved intent.
- Không có eligible source, source conflict, source expired/unknown hoặc system error.
- **Negative Guardrail — Phí sạc ô tô điện:** Knowledge Pack chỉ có biểu phí sạc xe máy điện/xe đạp điện (162.000 đ/tháng), KHÔNG có phí sạc ô tô điện. Cấm suy rộng từ xe hai bánh sang ô tô điện; bắt buộc phân loại `no_eligible_source` hoặc hướng dẫn liên hệ BQL.
- **Negative Guardrail — Thi công Biệt thự / Shophouse / Liền kề:** Nguồn thi công hiện có chỉ áp dụng cho Căn Hộ. Cấm suy rộng quy chế Căn Hộ sang Biệt thự; bắt buộc chuyển `no_eligible_source` / escalation.

Các case trên phải được xử lý an toàn, hiển thị hướng dẫn liên hệ phù hợp (Văn phòng BQL Tầng 1 S1.03, Hotline 1900 232 389 Nhánh 4) và chuyển vào Escalation Inbox; không được sinh câu trả lời suy đoán.

### 7.2. Out of Product Scope

- Booking/đặt lịch và thanh toán tự động.
- Upsell, quảng cáo hoặc đề xuất mua thêm dịch vụ.
- Tích hợp tổng đài thoại, call transcription hoặc tự động gọi ra.
- Tự động giải quyết tranh chấp, diễn giải pháp lý, xác định trách nhiệm hoặc mức bồi thường.
- Mở rộng ngoài năm intent hoặc ngoài Vinhomes Ocean Park 1 trong MVP.
- Thay thế hoàn toàn BQL hoặc tự động đóng các case escalation cần con người.

## 8. Success Metrics & Acceptance Evidence

- **Grounding:** 100% case `answered` có citation `document_id` + `section_id` hợp lệ từ 21 canonical documents.
- **Safety Gate 3A (Zero Severe Safety Violations):** 100% (0 vi phạm) đối với các trường hợp nghiêm trọng (`emergency_or_life_safety`, `pii_or_account_specific`, `legal_or_compensation_escalation`); bắt buộc chuyển `escalated`, tuyệt đối cấm hallucinate hoặc đưa ra câu trả lời trực tiếp.
- **Safety Gate 3B (General Safe Behavior Rate - M3):** $\ge 90\%$ (tối thiểu 15/16 cases) trên toàn bộ 16 ca thuộc diện an toàn/không đủ điều kiện trả lời trực tiếp; fail safely và gắn đúng canonical reason code.
- **Memory:** câu hỏi phụ thuộc ngữ cảnh được rewrite và trả lời đúng context.
- **Dual role:** cả Resident Chat và BQL Escalation Inbox vượt qua role-based E2E.
- **Reliability:** lỗi không tạo màn hình trắng; luôn có fallback, retry hoặc escalation.
- **Deployment:** Live URL và smoke-test evidence tồn tại trước nghiệm thu BTC.
- **Golden contract:** 50 FAQ cases và 30 E2E cases; E2E phân bổ 20 `answered`, 10 `escalated`.

## 9. Data & Governance Invariants

- Không sửa 21 file canonical, `knowledge/manifest.yaml` hoặc `knowledge/intent_source_map.yaml` của revision `1.18`.
- Giữ nguyên năm intent, mười reason codes và Required Context Contract.
- Evaluation chỉ dùng dữ liệu synthetic/de-identified; không cố ý lưu raw PII không cần thiết.
- Mọi thay đổi material sau freeze phải tăng revision và chạy lại validator/checksum.

## 10. Product Decision

MVP v0.3 ưu tiên tuyệt đối năm tiêu chí BTC: Live Web, dual-role login, citation-grounded RAG, multi-turn memory và confidence/risk escalation. Booking, payment và upsell bị loại khỏi scope để tập trung hoàn thành đúng hạn 27/10/2026.
