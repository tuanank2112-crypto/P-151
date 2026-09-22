# PRD — ResidentGPT MVP v0.3: Dual-role Resident Chat & BQL Escalation

> **Version:** `v0.3`
> **Status:** FROZEN FOR MVP v0.3 — Dual-role & Confidence Escalation Alignment
> **Freeze date:** 21/09/2026
> **BTC deadline:** 27/10/2026
> **Knowledge Pack:** revision `1.18` — 21 canonical documents
> **Golden Dataset:** revision `0.3` — 50 FAQ cases, 30 E2E cases
> **Alignment log:** `docs/MVP_CONSISTENCY_ALIGNMENT_v0.3.md`
> **Scope contract:** `knowledge_coverage_scope = VINHOMES_OCEAN_PARK`;
> `pilot_operator_scope = Cư dân Tòa S1.12, Cụm Sapphire 1 & Văn phòng BQL Tòa nhà (Tầng 1 S1.03, Hotline 1900 232 389 Nhánh 4) tại Vinhomes Ocean Park 1`.
> Knowledge coverage rộng hơn pilot operator scope không đồng nghĩa hỗ trợ multi-site.

## MVP Scope Freeze v0.3

ResidentGPT v0.3 là một web app AI hai vai trò:

- **Cư dân:** chatbot tự phục vụ, hội thoại đa lượt, trả lời có citations hoặc nhận Clarification/Escalation Card.
- **BQL/CSKH:** Escalation Inbox để tiếp nhận, xem lý do và phản hồi các case được chuyển tuyến.

Năm yêu cầu cứng của BTC là: Live Web, dual-role login, RAG có citations, Chat Memory/Query Rewriter và confidence/risk escalation. Booking, payment và upsell không thuộc MVP.

### Core invariants — không được sửa

1. Không thay đổi Knowledge Pack `1.18`: 21 file `knowledge/canonical/*.md`, `knowledge/manifest.yaml`, `knowledge/intent_source_map.yaml`.
2. Giữ nguyên năm Provisional MVP Intents:
   - `I-01`: Thẻ cư dân/ra vào.
   - `I-02`: Phương tiện/thẻ xe.
   - `I-03`: Tiện ích chung.
   - `I-04`: Chuyển đồ/thi công.
   - `I-05`: Nội quy sinh hoạt.
3. Giữ nguyên 10 canonical reason codes tại Mục 8.
4. Giữ nguyên Required Context Contract tại Mục 5.1; thiếu field bắt buộc phải kích hoạt `clarification_required`.

### Release evidence bắt buộc

- Live URL truy cập công khai.
- Resident role và Management role đăng nhập thành công; truy cập chéo bị chặn.
- E2E evidence cho `answered`, `clarification_required` và `escalated`.
- Validator Golden Dataset trả `Summary: PASS (All checksums verified, 50 FAQ cases valid, 30 E2E cases valid)`.
- UI lỗi/retrieval/model failure không bao giờ trả màn hình trắng.

## 1. Product Summary

Cư dân cần câu trả lời nhanh cho các câu hỏi hành chính nhỏ nhưng ngại gọi hotline hoặc chờ Zalo. BQL phải trả lời nhiều câu lặp lại và thiếu hàng đợi tập trung cho các ca khó. ResidentGPT cung cấp Resident Chat View để tự phục vụ và Escalation Inbox để BQL xử lý các trường hợp AI không đủ tin cậy hoặc không được phép tự trả lời.

Luồng AI sử dụng Chat Memory để duy trì hội thoại, Query Rewriter để tạo standalone query, RAG trên 21 tài liệu canonical, Source Eligibility, Similarity Score và Grader Node. Hệ thống chỉ trả lời trực tiếp khi đủ context, đủ evidence và Confidence cao; mọi câu trả lời phải có `document_id` và `section_id`.

## 2. Personas & Access

### 2.1. Resident

- Mục tiêu: hỏi nhanh, hỏi nối tiếp, hiểu căn cứ và biết liên hệ ai khi AI không thể trả lời.
- Quyền: tạo/xem conversation của chính mình; xem Answer/Clarification/Escalation Card của mình.
- Không có quyền: xem Escalation Inbox hoặc case của cư dân khác.

### 2.2. Management / BQL/CSKH

- Mục tiêu: xử lý hàng đợi case khó theo lý do, mức độ khẩn và thời gian tạo.
- Quyền: xem Escalation Inbox, case detail, transcript cần thiết, reason code, confidence/risk outcome; ghi phản hồi và cập nhật trạng thái xử lý.
- Không được dùng vai trò quản trị để thay đổi Knowledge Pack đã frozen trong UI MVP.

## 3. Jobs To Be Done

- Khi cần hỏi nội quy/tiện ích, Cư dân muốn nhận câu trả lời ngay và thấy nguồn điều khoản.
- Khi hỏi nối tiếp, Cư dân muốn hệ thống hiểu đúng đối tượng ở lượt trước mà không phải lặp lại toàn bộ câu hỏi.
- Khi câu hỏi còn thiếu dữ kiện, Cư dân muốn được hỏi lại ngắn gọn, không bị đưa sang tuyến thủ công quá sớm.
- Khi AI không đủ chắc chắn hoặc nội dung rủi ro cao, Cư dân muốn có hướng dẫn liên hệ cụ thể và biết case đã được chuyển cho BQL.
- Khi case được chuyển tuyến, BQL muốn thấy đủ transcript, lý do và evidence đã thử để phản hồi nhanh.

## 4. MVP User Stories

### 4.1. Resident stories

- **US-R01 — Submit query:** Là Cư dân, tôi muốn đăng nhập và gửi câu hỏi trong Resident Chat View.
- **US-R02 — Multi-turn memory:** Là Cư dân, tôi muốn hỏi nối tiếp và hệ thống nhớ đúng ngữ cảnh câu trước.
- **US-R03 — Clarification:** Là Cư dân, tôi muốn được hỏi lại nhẹ nhàng khi thiếu required context.
- **US-R04 — Grounded answer:** Là Cư dân, tôi muốn câu trả lời trực tiếp có `document_id` và `section_id` để kiểm tra căn cứ.
- **US-R05 — Safe escalation:** Là Cư dân, tôi muốn nhận Thẻ Escalation có Hotline/Văn phòng BQL khi câu hỏi phức tạp, rủi ro cao hoặc Confidence thấp.
- **US-R06 — Conversation history:** Là Cư dân, tôi muốn xem lại lịch sử hội thoại thuộc tài khoản của mình.

### 4.2. Management stories

- **US-M01 — Role login:** Là BQL/CSKH, tôi muốn đăng nhập đúng vai trò quản lý.
- **US-M02 — Inbox list:** Là BQL/CSKH, tôi muốn xem danh sách case bị chuyển tuyến, gồm thời gian, intent, reason code và trạng thái.
- **US-M03 — Case detail:** Là BQL/CSKH, tôi muốn xem transcript cần thiết, context, evidence đã thử và lý do Low Confidence/High Risk.
- **US-M04 — Response:** Là BQL/CSKH, tôi muốn phản hồi cho Cư dân và cập nhật trạng thái xử lý.
- **US-M05 — Auditability:** Là BQL/CSKH, tôi muốn mọi chuyển tuyến và phản hồi có timestamps và actor để truy vết.

## 5. Functional Requirements

### FR-01 — Auth & Role Selection

- Hỗ trợ đăng nhập và phân định chính xác hai vai trò `resident` và `management`.
- Sau đăng nhập, route theo role: Resident Chat View hoặc BQL Escalation Inbox.
- Server-side authorization phải chặn truy cập chéo; không chỉ ẩn bằng UI.
- Session hết hạn hoặc lỗi auth phải hiển thị trạng thái có thể phục hồi, không trả màn hình trắng.

### FR-02 — Conversational Memory

- Lưu lịch sử chat đa lượt theo `user_id`, `conversation_id` và timestamps.
- Query Rewriter tự động condense/rewrite câu hỏi phụ thuộc thành standalone query.
- Rewritten query phải giữ đúng entity/context có liên quan và không tạo fact mới.
- Retrieval nhận rewritten query cùng required context cần thiết; không dùng nguyên transcript dài làm query RAG.

### FR-03 — Context Clarification

- Xác định intent hoặc trạng thái unresolved/unsupported trước khi trả lời.
- Đối chiếu Required Context Contract tại Mục 5.1.
- Thiếu field bắt buộc phải trả `clarification_required` với câu hỏi ngắn gọn; không retrieval/answer như thể context đã đủ.
- Không yêu cầu thêm PII/account data không cần thiết.
- Khi Cư dân bổ sung context, reprocess từ safety/risk check và giữ conversation continuity.

### FR-04 — Knowledge Retrieval

- RAG chỉ dùng 21 tài liệu canonical thuộc Knowledge Pack `1.18`.
- Chỉ dùng source/section đủ eligibility theo `knowledge/manifest.yaml` và `knowledge/intent_source_map.yaml`.
- Retrieval phải trả `document_id`, `section_id`, relevance/similarity và đoạn evidence.
- Không có eligible source, source conflict hoặc source expired/unknown phải đi Escalation Gate, không đoán.

### FR-05 — Direct Grounded Response

- Chỉ trả lời trực tiếp khi required context đủ, không High Risk, evidence eligible và Confidence cao.
- Mỗi response trạng thái `answered` bắt buộc kèm ít nhất một citation đúng `document_id` và `section_id`.
- Citation phải hỗ trợ trực tiếp factual claim; exact quote không bắt buộc.
- Answer Card hiển thị nội dung, citations và cách mở metadata nguồn.

### FR-06 — Confidence Measurement & Escalation

- Tính Confidence bằng Similarity Score kết hợp Source Eligibility và Grader Node.
- Threshold/config phải versioned và log được; không hiển thị phần trăm chưa calibrated như sự thật tuyệt đối cho người dùng.
- Nếu Confidence thấp hoặc High Risk, hệ thống không trả substantive answer.
- Resident nhận Thẻ Escalation có lý do dễ hiểu, Hotline và Văn phòng BQL phù hợp.
- Hệ thống tạo ticket trong BQL Escalation Inbox với canonical reason code, transcript cần thiết, intent/context, evidence đã thử và timestamps.

### FR-07 — BQL Escalation Inbox

- Hiển thị danh sách case theo trạng thái `new`, `in_progress`, `responded`, `closed` ở tầng xử lý BQL; terminal state của Golden flow vẫn là `escalated` tại thời điểm handoff thành công.
- Cho phép lọc theo reason code, intent, mức ưu tiên và thời gian.
- Case detail cho phép BQL ghi phản hồi; phản hồi phải gắn actor/timestamp.
- Không tự động giải quyết hoặc tự đóng case pháp lý, tranh chấp, tài chính cá nhân hoặc an ninh.

### FR-08 — Persistence & Audit Log

- Lưu conversation, message, rewritten query, retrieved citations, confidence outcome, terminal state và escalation record.
- Bắt buộc lưu đủ 7 trường thông tin quan sát phục vụ audit: `request_id`, `conversation_id`, `role`, `intent_id`, `reason_code`, `confidence_decision`, `citations`.
- Log không cố ý persist raw PII không cần thiết; evaluation dùng synthetic/de-identified data.
- Mọi eval case phải tái tạo được sequence và output cần chấm.

### FR-09 — Deployment & Failure Handling

- Web app phải cloud-ready, containerizable và expose health endpoint.
- Release record phải lưu Live URL, build/commit và deployment timestamp.
- Auth, model, retrieval, persistence hoặc rendering error phải trả Error/Fallback Card có retry hoặc escalation; không được render màn hình trắng.

### 5.1. Required Context Contract — Frozen for MVP v0.3

Các field dưới đây là danh mục context có thể bắt buộc theo intent. Hệ thống chỉ hỏi field cần thiết để chọn đúng rule/source cho câu hỏi hiện tại; field có hậu tố `when_relevant` là conditional, không bắt buộc cho mọi case. Không được dùng clarification để yêu cầu thêm PII/account data không cần thiết.

| Intent | Required-context fields |
|---|---|
| I-01 — Thẻ cư dân/ra vào | `card_type`, `request_type`, `property_type`, `unit_type_when_limit_is_relevant` |
| I-02 — Phương tiện/thẻ xe | `parking_card_or_parking_service`, `facility_type`, `monthly_or_casual`, `vehicle_type`, `time_window_when_casual` |
| I-03 — Tiện ích chung | `amenity_type`, `amenity_variant_when_relevant`, `age_or_height_when_safety_relevant` |
| I-04 — Chuyển đồ/thi công | `moving_or_construction`, `property_type`, `building_or_area_when_relevant`, `work_type_when_construction_schedule_is_asked`, `requested_day_or_time_when_schedule_is_asked` |
| I-05 — Nội quy sinh hoạt | `rule_topic`, `apartment_commercial_or_villa_scope`, `general_rule_or_case_specific_decision` |

`evals/golden/dataset_manifest.yaml` revision `0.3` phải giữ đúng danh sách này. Thay đổi material cần cập nhật PRD, UI Flow, Golden Dataset và tăng revision trước khi chạy lại evaluation.

## 6. Non-Functional Requirements

- **NFR-01 — Reliability:** 100% lỗi auth/model/retrieval/persistence/render có fallback; UI không bao giờ là màn hình trắng.
- **NFR-02 — Security/RBAC:** authorization được kiểm tra server-side; Cư dân không truy cập Inbox; BQL không xem dữ liệu ngoài scope được cấp.
- **NFR-03 — Grounding:** 100% response `answered` có citation hợp lệ từ canonical corpus.
- **NFR-04 — Memory isolation:** không rò rỉ message/context giữa user hoặc conversation.
- **NFR-05 — Privacy:** giảm thiểu PII, không ghi secret/token vào log, evaluation dùng dữ liệu synthetic/de-identified.
- **NFR-06 — Observability:** log `request_id`, `conversation_id`, role, latency, rewrite outcome, retrieval outcome, confidence decision, terminal state và reason code khi áp dụng.
- **NFR-07 — Deployability:** build tái lập bằng Docker; health check và smoke test chạy trên Live URL.
- **NFR-08 — Usability:** citations, Clarification Card và Escalation Card đọc được trên desktop/mobile; trạng thái loading/error rõ ràng.

## 7. Acceptance Criteria

### 7.1. Auth & dual role

- **AC-01:** Resident login thành công mở Resident Chat View; không truy cập được Management route/API.
- **AC-02:** Management login thành công mở Escalation Inbox; role/authorization được kiểm tra server-side.

### 7.2. Memory & clarification

- **AC-03:** Câu hỏi nối tiếp được Query Rewriter chuyển thành standalone query đúng context, không thêm fact.
- **AC-04:** Thiếu required context trả Clarification Card đúng field và không substantive answer.
- **AC-05:** Sau khi bổ sung đủ context, flow reprocess và kết thúc `answered` hoặc `escalated` theo evidence/risk.

### 7.3. Grounded answer

- **AC-06:** Câu hỏi đủ context, Confidence cao và có eligible evidence kết thúc `answered`.
- **AC-07:** Mọi case `answered` hiển thị citation đúng `document_id` và `section_id` từ 21 canonical documents.
- **AC-08:** Citation phải hỗ trợ claim; không dùng section bị exclude/conflict hoặc source expired/unknown.

### 7.4. Confidence/risk escalation

- **AC-09 (Gate 3A — Zero Severe Violations):** 100% các tình huống nghiêm trọng (`emergency_or_life_safety`, `pii_or_account_specific`, `legal_or_compensation_escalation`) kết thúc `escalated` ngay lập tức; cấm hallucinate hoặc trả lời trực tiếp.
- **AC-10 (Gate 3B — General Safe Behavior Rate M3):** $\ge 90\%$ (tối thiểu 15/16 cases) trên toàn bộ quần thể safety-handling (gồm thiếu context, lỗi hệ thống, nguồn hết hạn, nguồn mâu thuẫn...) được xử lý an toàn và đúng canonical reason code.
- **AC-11:** Resident thấy Thẻ Escalation (Hotline 1900 232 389 Nhánh 4 / Văn phòng BQL Tòa S1.03); BQL thấy ticket tương ứng trong Inbox cùng exact canonical reason code.
- **AC-12:** `clarification_required` không bị dùng như escalation reason code.

### 7.5. BQL response & reliability

- **AC-13:** BQL mở case detail và ghi phản hồi có actor/timestamp.
- **AC-14:** Lỗi auth/retrieval/model/persistence/render hiển thị fallback có thể hành động; không màn hình trắng.
- **AC-15:** Live URL, build/commit và smoke-test evidence được ghi trước nghiệm thu.

## 8. Safety, Confidence & Reason Codes

### 8.1. Decision order

1. Xác thực user và role (`resident` hoặc `management`).
2. Nạp conversation memory đúng scope (`user_id`, `conversation_id`).
3. Query Rewrite: viết lại câu hỏi phụ thuộc thành standalone query.
4. Early High-Risk/PII/Emergency gate: Nếu phát hiện rủi ro cao (an toàn tính mạng, PII/tài chính cá nhân, bồi thường pháp lý) → lập tức chuyển `escalated` với thẻ liên hệ và ticket BQL, không retrieval, không sinh nội dung.
5. Intent Classification & Required Context check: đối chiếu intent và Required Context Contract (§5.1).
6. Missing context check: Nếu thiếu required context → kích hoạt `clarification_required` (trả Clarification Card, dừng flow và chờ người dùng bổ sung; KHÔNG thực hiện retrieval).
7. Eligible retrieval: Truy vấn vector/keyword trên đúng 21 tài liệu canonical của Knowledge Pack `1.18` (chỉ chạy khi đã đủ required context và an toàn).
8. Similarity Score + Grader Node: Đánh giá relevance và độ tin cậy của evidence trích xuất.
9. High Confidence & Grounded → `answered` với citations hợp lệ (`document_id` + `section_id`).
10. Low Confidence / Source conflict / System failure → `escalated` + Thẻ Escalation (Hotline 1900 232 389 Nhánh 4 / Văn phòng BQL Tòa S1.03) + ticket BQL (kèm canonical reason code).

### 8.2. Canonical reason-code enum — Frozen

1. `pii_or_account_specific`
2. `legal_or_compensation_escalation`
3. `unsupported_intent`
4. `intent_unresolved`
5. `no_eligible_source`
6. `source_conflict`
7. `source_expired_or_unknown`
8. `system_error`
9. `emergency_or_life_safety`
10. `reviewer_rejected_draft`

Đây là enum duy nhất cho backend, UI, audit log và Golden Dataset. `clarification_required` là state/event, không phải reason code.

### 8.3. Routing contract

- Missing required context → `clarification_required`; không ticket nếu người dùng còn có thể bổ sung an toàn.
- High Risk hoặc Low Confidence → Thẻ Escalation + ticket BQL + terminal state `escalated`.
- System error → safe fallback; retry nếu phù hợp, nếu không thì ticket với `system_error`.
- Emergency/life-safety → hướng dẫn liên hệ khẩn cấp phù hợp ngay; đồng thời ghi escalation, không chẩn đoán hoặc trì hoãn bằng FAQ flow.

### 8.4. Knowledge Boundary & Negative Guardrails

- **Phí sạc ô tô điện:** Knowledge Pack chỉ có biểu phí sạc xe máy điện/xe đạp điện (162.000 đ/tháng), KHÔNG có phí sạc ô tô điện. Cấm suy rộng từ xe hai bánh sang ô tô điện; bắt buộc phân loại `no_eligible_source` hoặc hướng dẫn liên hệ BQL.
- **Thi công Biệt thự / Shophouse / Liền kề:** Nguồn thi công hiện có chỉ áp dụng cho Căn Hộ. Cấm suy rộng quy chế Căn Hộ sang Biệt thự; bắt buộc chuyển `no_eligible_source` / escalation.
- **Phạm vi pilot:** Khóa vận hành tại Cụm Sapphire 1 — Tòa S1.12, Vinhomes Ocean Park 1 (Văn phòng BQL Tòa nhà: Tầng 1 S1.03; Hotline: 1900 232 389 Nhánh 4).

## 9. State & Data Contract

### 9.1. Resident conversation states

`authenticated` → `query_submitted` → `rewritten` → một trong:

- `clarification_required` → `context_provided` → reprocess;
- `answered`;
- `escalated`;
- `recoverable_error` → retry hoặc escalation.

### 9.2. Minimum answer payload

- `conversation_id`
- `message_id`
- `terminal_state: answered`
- `answer_text`
- `citations[]` với `document_id`, `section_id`
- `created_at`

### 9.3. Minimum escalation ticket payload

- `ticket_id`, `conversation_id`, `resident_id_or_alias`
- `intent_id` nếu xác định được
- `reason_code`
- `risk_or_confidence_outcome`
- transcript/context tối thiểu cần thiết
- evidence/citations đã thử nếu có
- `status`, `created_at`, `updated_at`, management response nếu có

## 10. Evaluation Contract

- Golden Dataset revision: `0.3`.
- FAQ catalog: 50 cases; giữ nguyên 40 answerable, 5 clarification, 5 escalation.
- E2E catalog: 30 cases; terminal distribution 20 `answered`, 10 `escalated`.
- Successful resident action contract: `resident_submits_query` → `system_answers_with_citation`.
- Clarification contract: `resident_submits_query` → `system_requests_clarification` → `resident_provides_context` → `system_answers_with_citation`.
- Escalation contract: `resident_submits_query` → `system_detects_low_confidence_or_risk` → `system_escalates_to_bql`.
- Recoverable error & retry contract: `resident_submits_query` → `system_encounters_recoverable_error` → `resident_retries_query` → `system_answers_with_citation`.
- Unresolved clarification escalation contract: `resident_submits_query` → `system_requests_clarification` → `resident_provides_unhelpful_context` → `system_detects_low_confidence_or_risk` → `system_escalates_to_bql`.
- Safety bifurcation: Gate 3A (100% Zero Severe Safety Violations trên emergency, pii, legal) và Gate 3B (M3 $\ge 90\%$ trên 16 cases an toàn).
- Grounding, Confidence Escalation và Memory được chấm theo `evals/golden/rubric.md`.

## 11. Out of Scope

- Booking/đặt lịch, thanh toán tự động và upsell.
- Voice call center, transcription hoặc auto-call.
- Tự động phán quyết tranh chấp/pháp lý/bồi thường.
- CRM enterprise hoặc routing đa phòng ban phức tạp ngoài Escalation Inbox MVP.
- Multi-site/multi-tenant ngoài pilot OCP1.
- Thay đổi Knowledge Pack `1.18`, năm intents, mười reason codes hoặc Required Context Contract.

## 12. Definition of Done

- [ ] Live URL công khai hoạt động; health/smoke test pass.
- [ ] Hai role login và RBAC E2E pass.
- [ ] Resident Chat đa lượt + Query Rewriter pass Memory cases.
- [ ] 100% case `answered` có `document_id` và `section_id` hợp lệ.
- [ ] Low Confidence/High Risk tạo Resident Escalation Card và BQL Inbox ticket.
- [ ] BQL xem case và phản hồi được.
- [ ] UI không có màn hình trắng trong fault-injection tests.
- [ ] Không có Booking, payment hoặc upsell trong MVP flow.
- [ ] Golden validator trả đúng `Summary: PASS (All checksums verified, 50 FAQ cases valid, 30 E2E cases valid)`.
- [ ] Cross-document consistency scan không còn cơ chế BQL duyệt rồi sao chép câu trả lời của kiến trúc cũ.

## 13. Open Decisions Before Real-user Pilot

- Giá trị similarity threshold và calibration protocol của Grader Node.
- PII redaction/retention/access policy.
- SLA và routing nội bộ sau khi BQL nhận từng reason code.
- Cơ chế notify Cư dân khi BQL phản hồi ngoài phạm vi E2E handoff tối thiểu.
- Live deployment provider và production operations owner.
