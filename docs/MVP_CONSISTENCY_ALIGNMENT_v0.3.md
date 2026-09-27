# ResidentGPT MVP Consistency Alignment v0.3

> **Decision status:** FROZEN FOR MVP v0.3
> **Decision date:** 21/09/2026
> **BTC deadline:** 27/10/2026
> **Supersedes:** `MVP_CONSISTENCY_ALIGNMENT_v0.2.md`
> **Approval scope:** `BTC_MVP_Evaluation`

## 1. Basis for v0.3

BTC yêu cầu MVP phải chứng minh đồng thời năm năng lực:

1. Web đã triển khai và có Live URL.
2. Đăng nhập hai vai trò Cư dân và BQL/CSKH.
3. RAG trả lời có citations minh bạch.
4. Chat Memory đa lượt cùng Query Rewriter.
5. Low Confidence hoặc High Risk được chuyển tuyến an toàn cho BQL.

Baseline v0.2 chỉ mô tả một luồng vận hành đơn vai trò nên không còn phù hợp. v0.3 thay kiến trúc sản phẩm bằng Resident-facing self-service chat kết hợp Management Escalation Inbox.

## 2. Decisions Aligned

### 2.1. Actors and authorization

- Cư dân là primary user của Resident Chat View.
- BQL/CSKH là primary user của Escalation Inbox.
- Auth/RBAC bắt buộc kiểm tra ở server; Resident không được truy cập Inbox.

### 2.2. Resident conversation flow

- Chat Memory lưu lịch sử theo đúng user/conversation.
- Query Rewriter biến follow-up thành standalone query trước RAG.
- Missing required context trả `clarification_required`.
- High Confidence + eligible evidence trả `answered` cùng `document_id` và `section_id`.
- Low Confidence/High Risk/failure trả Resident Escalation Card và tạo ticket cho BQL.

### 2.3. BQL flow

- BQL đăng nhập để xem danh sách và chi tiết escalation cases.
- Ticket có exact canonical reason code, context/transcript tối thiểu, risk/confidence outcome và evidence đã thử.
- BQL phản hồi và cập nhật trạng thái xử lý; hệ thống không tự phán quyết case rủi ro cao.

### 2.4. Confidence mechanism

- Confidence Gate kết hợp Source Eligibility, Similarity Score và Grader Node.
- High Risk luôn override similarity cao.
- Ngưỡng phải versioned, loggable và được calibration trên Golden Dataset.
- Không hiển thị fake confidence percentage cho người dùng.

### 2.5. Deployment and reliability

- Kiến trúc phải cloud-ready/containerizable.
- Live URL + build/commit + smoke-test evidence là release requirement.
- Auth/model/retrieval/persistence/render error phải có fallback; không màn hình trắng.

## 3. Golden Dataset v0.3 Alignment

- `dataset_revision: "0.3"`.
- `approval_scope: BTC_MVP_Evaluation`.
- 50 FAQ cases giữ nguyên.
- 30 E2E cases giữ nguyên số lượng, với 20 `answered` và 10 `escalated`.
- Action contracts:
  - Answered: `resident_submits_query`, `system_answers_with_citation`.
  - Clarification: `resident_submits_query`, `system_requests_clarification`, `resident_provides_context`, `system_answers_with_citation`.
  - Escalation: `resident_submits_query`, `system_detects_low_confidence_or_risk`, `system_escalates_to_bql`.
- Rubric chấm bắt buộc Grounding, Confidence Escalation và Memory.

## 4. Preserved Invariants

### 4.1. Knowledge Pack 1.18

Giữ nguyên 100%:

- 21 file `knowledge/canonical/*.md`.
- `knowledge/manifest.yaml`.
- `knowledge/intent_source_map.yaml`.

Không sửa nội dung, metadata hoặc mapping trong migration v0.3.

### 4.2. Five Provisional MVP Intents

- `I-01`: Thẻ cư dân/ra vào.
- `I-02`: Phương tiện/thẻ xe.
- `I-03`: Tiện ích chung.
- `I-04`: Chuyển đồ/thi công.
- `I-05`: Nội quy sinh hoạt.

### 4.3. Ten Canonical Reason Codes

`pii_or_account_specific`, `legal_or_compensation_escalation`, `unsupported_intent`, `intent_unresolved`, `no_eligible_source`, `source_conflict`, `source_expired_or_unknown`, `system_error`, `emergency_or_life_safety`, `reviewer_rejected_draft`.

`clarification_required` tiếp tục là state/event, không phải escalation reason.

### 4.4. Required Context Contract

Danh mục field tại PRD §5.1 được giữ nguyên và phải khớp byte-for-value với `required_context_by_intent` trong Golden manifest. Thiếu field áp dụng phải Clarify.

## 5. Explicit Scope Removal

- Không Booking/đặt lịch.
- Không payment/thanh toán tự động.
- Không upsell/quảng cáo.
- Không tổng đài thoại/call transcription.
- Không tự động giải quyết tranh chấp pháp lý, bồi thường, trách nhiệm hoặc tài chính cá nhân.

## 6. Cross-document Contract

- Problem Card, Product Brief, PRD và UI Flow cùng mô tả hai vai trò.
- PRD, UI Flow, manifest, rubric, E2E JSONL và validator cùng dùng terminal `answered`/`escalated`.
- Mỗi case `answered` phải có citation `document_id` + `section_id`.
- Mỗi Low Confidence/High Risk case phải có Resident Escalation Card và BQL ticket.
- Không tài liệu active nào được mô tả luồng operator đơn vai trò của baseline cũ.

## 7. Verification Required

1. Tính lại SHA-256 cho 8 file Golden được liệt kê trong `FROZEN_CHECKSUMS.sha256`.
2. Chạy `powershell -ExecutionPolicy Bypass -File evals/golden/validate_dataset.ps1`.
3. Validator phải in: `Summary: PASS (All checksums verified, 50 FAQ cases valid, 30 E2E cases valid)`.
4. Rà quét toàn repo cho cơ chế v0.2 và scope Booking/Upsell.
5. Xác nhận `git diff -- knowledge` rỗng và canonical count vẫn là 21.

## 8. Residual Delivery Evidence

Alignment này khóa yêu cầu và evaluation contract; không tự tuyên bố code đã deploy. Trước nghiệm thu BTC vẫn cần cung cấp Live URL, dual-role smoke test, UI fault-injection evidence và actual Golden run results.
