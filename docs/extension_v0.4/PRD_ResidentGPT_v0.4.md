# PRD — ResidentGPT Extension v0.4

> **Trạng thái:** yêu cầu mục tiêu cho demo; chưa có bằng chứng implementation.
> **Mốc nộp:** hết ngày 04/10/2026, `Asia/Ho_Chi_Minh`.
> **Baseline:** [PRD MVP v0.3](../PRD_ResidentGPT_MVP.md) và [bản đồ v0.4](README.md).

## 1. Kết quả cần chứng minh

ResidentGPT v0.4 bổ sung bốn năng lực **chạy được đầu cuối trong demo**: (1) classifier → retriever → composer → verifier dưới một coordinator; (2) BQL upload/cập nhật, preview, duyệt, publish và quản lý version của tài liệu; (3) chỉ câu rủi ro cần BQL duyệt trước khi gửi; (4) bảng eval faithfulness/relevance và dashboard outcome có số liệu thực từ demo/eval, denominator, khoảng ngày và trạng thái handoff. Các yêu cầu MVP v0.3 vẫn là nền: resident/management login, chat nhiều lượt, required-context clarification, citation, hard-risk routing, BQL Inbox và fallback.

Đây là demo/pilot có một `pilot_operator_scope` đã khóa tại [MVP Data Scope Lock](../MVP_DATA_SCOPE_LOCK.md). Không mở multi-site runtime, booking, payment, upsell, xử lý tranh chấp hay truy cập dữ liệu tài khoản cá nhân. Tài liệu mới do BQL upload là lớp runtime versioned; baseline 21 canonical và golden v0.3 không đổi.

## 2. Người dùng và quyền

- **Resident:** hỏi/tiếp tục hội thoại, xem câu trả lời và citation, nhận clarification hoặc trạng thái BQL đang xử lý, đánh dấu `Đã giải quyết` / `Chưa giải quyết` cho từng case.
- **Management/BQL:** xem support Inbox, upload/preview/duyệt tài liệu, duyệt/sửa/từ chối draft rủi ro, ghi phản hồi và xem dashboard theo quyền. Server kiểm tra role và scope ở mọi API; chỉ ẩn nút UI không đủ.
- Tác vụ `upload_document`, `approve_document`, `review_answer`, `view_audit` là permission trong role `management`; không tạo role thứ ba cho demo. Chính sách một người tự duyệt tài liệu mình upload nằm ở O-03.

## 3. Quy tắc quyết định thống nhất

1. Xác thực và tải memory đúng resident/conversation; rewrite follow-up thành câu hỏi độc lập mà không thêm fact.
2. **Hard-risk gate trước mọi retrieval/generation:** emergency/life safety, PII hoặc account-specific, pháp lý/bồi thường/tranh chấp chuyển ngay sang BQL hoặc hướng dẫn khẩn cấp theo v0.3. Không tạo substantive draft để BQL “duyệt” trong các trường hợp này.
3. Classifier trả một trong năm intent `I-01`…`I-05` hoặc unresolved/unsupported. Đối chiếu Required Context Contract v0.3 §5.1; thiếu field an toàn có thể bổ sung thì hỏi lại bằng `clarification_required`, không retrieval.
4. Retriever chỉ thấy baseline section đủ eligibility và runtime version đã `approved` + `published`, còn hiệu lực, đúng scope và `allowed_for_rag`. Nếu runtime version thay thế baseline source, active snapshot chỉ trả version hợp lệ đã publish. Golden v0.3 phải chạy trên build/config v0.3 và snapshot `1.18` đã ghi version; v0.4 cần case/revision riêng cho behavior review mới.
5. Composer chỉ tạo draft từ evidence có locator/citation. Verifier kiểm claim, citation, source version/scope/effective date và conflict. Confidence gate gồm source eligibility, retrieval score đã hiệu chỉnh và verifier outcome. Không dùng một similarity score cao để vượt hard risk hoặc missing context.
6. Đủ evidence, mọi claim được hỗ trợ, citations hợp lệ, không conflict và qua ngưỡng confidence đã hiệu chỉnh → gửi tự động `terminal_state = answered`, `answer_delivery_mode = auto`.
7. Có evidence nhưng confidence thấp, hoặc draft có claim/citation chưa đạt verifier → giữ draft ở `pending_review`. BQL phải chỉnh và gắn evidence hợp lệ trước khi gửi câu trả lời factual; thao tác duyệt/sửa ghi `answer_delivery_mode = human_assisted`.
8. Không có eligible source, source conflict, source hết hiệu lực, hard risk, hoặc BQL từ chối draft và không thể sửa có căn cứ → không gửi substantive answer; tạo support handoff với một trong 10 canonical reason codes hiện có, Resident thấy trạng thái liên hệ/handoff. `pending_review` là state trung gian, không phải kết quả đã trả lời.
9. Timeout/error: một lần retry có kiểm soát khi an toàn; nếu chưa phục hồi, fallback rõ ràng và support handoff với `system_error`. Không gửi answer trước khi ghi được outcome/audit cần thiết.

`risk_trigger` chi tiết như `low_confidence`, `unsupported_claim`, `missing_evidence`, `source_conflict`, `ocr_uncertain` là tín hiệu review nội bộ, **không thêm vào** canonical reason-code enum frozen. `reason_code` chỉ bắt buộc khi tạo support handoff; map `missing_evidence` → `no_eligible_source`, `source_conflict` → `source_conflict`, source hết hiệu lực → `source_expired_or_unknown`, draft bị từ chối → `reviewer_rejected_draft` khi đúng tình huống.

## 4. Yêu cầu theo capability

### FR4-01 — Multi-agent và tracing

- Hợp đồng typed cho các bước, correlation qua `request_id`, `case_id`, `conversation_id`, version của prompt/model/index và source snapshot.
- Coordinator sở hữu state transition, timeout và retry; tối đa một đường ra business cho mỗi case/attempt, không cho các agent tự phát vòng lặp không giới hạn.
- Lưu evidence và verifier verdict đủ để tái hiện vì sao auto-send, review hay handoff. Không đưa chain-of-thought, raw PII hoặc secret vào log.
- Chi tiết ở [kiến trúc và hợp đồng](AGENT_ARCHITECTURE_AND_CONTRACTS.md).

### FR4-02 — Upload/cập nhật tài liệu BQL

- Demo nhận `.md`, `.txt`, `.pdf` có text hoặc scan, `.docx`, `.png`, `.jpg/.jpeg`. Tệp khác bị từ chối với lý do dễ hiểu. Không gọi phạm vi này là “mọi định dạng”.
- Parser/OCR sinh preview theo trang/section, kèm source filename, extracted text, cảnh báo trang rỗng/chất lượng thấp. BQL xác nhận metadata property/area/audience, hiệu lực, owner, section và các phần loại khỏi RAG trước khi duyệt.
- Chỉ version `approved` rồi `published` mới được index active; publish cần re-index thành công và kiểm tra retrieval trước khi chuyển active snapshot. Lỗi giữ version cũ hoạt động. Withdraw/rollback phải loại version khỏi active retrieval.
- Không ghi đè `knowledge/canonical`, manifest `1.18` hoặc golden. Chi tiết ở [quản trị tài liệu](KNOWLEDGE_GOVERNANCE_AND_HITL.md).

### FR4-03 — Review câu trả lời rủi ro

- BQL thấy draft (có thể rỗng nếu không có nguồn), evidence, verifier findings, risk trigger, thời điểm và case context tối thiểu. Có thể approve, edit+approve, reject hoặc yêu cầu thêm thông tin.
- Câu đang chờ review không xuất hiện như câu đã được xác nhận. Nếu không có eligible evidence, BQL phải bổ sung nguồn đã publish hoặc xử lý thủ công theo support case; không chỉ bấm approve một khẳng định vô căn cứ.
- Audit trước/sau, actor, timestamp, reason, source version; thao tác lặp lại không gửi trùng câu.

### FR4-04 — Eval và dashboard

- Eval giữ tách bạch quality của **draft AI trước HITL** và outcome của **câu đã gửi sau HITL**. Faithfulness/relevance có rubric, numerator/denominator, `n`, snapshot và reviewer evidence.
- Dashboard dùng `case_id`, phân biệt auto, human-assisted, support handoff, pending, unknown feedback. Báo auto-answer, confirmed auto-resolution, 72h containment proxy và feedback coverage theo [hợp đồng metric](EVAL_METRICS_DASHBOARD.md).
- Resident feedback `Đã giải quyết` / `Chưa giải quyết` và follow-up/reopen cùng vấn đề được lưu làm event. Không suy ra confirmed resolution từ im lặng.

## 5. Acceptance đầu cuối ngày 04/10

| ID | Kịch bản demo và bằng chứng pass |
|---|---|
| AC4-01 | Resident hỏi một câu thuộc scope, đủ context: classifier đúng intent; retrieval chỉ trả active approved evidence; verifier PASS; auto-answer có `document_id`, `section_id`, version và locator; trace cho thấy không có human touch. |
| AC4-02 | Resident thiếu required context: thấy Clarification Card trước retrieval; bổ sung rồi reprocess qua hard-risk gate và trả đúng source hoặc handoff. |
| AC4-03 | Hard risk/PII/legal: không tạo substantive answer; Resident thấy fallback/handoff và BQL nhận đúng canonical reason code. Severe cases v0.3 vẫn phải qua Gate 3A riêng. |
| AC4-04 | Low confidence/claim chưa được hỗ trợ: draft bị giữ; BQL duyệt hoặc sửa+duyệt với evidence hợp lệ, hoặc từ chối; Resident không thấy draft trước quyết định; audit có before/after. |
| AC4-05 | Upload fixture hợp lệ cho từng extension `.md`, `.txt`, `.pdf` text, `.pdf` scan, `.docx`, `.png`, `.jpg/.jpeg`; BQL thấy preview; parse/OCR lỗi/mơ hồ không publish; duyệt và publish thành công thì retrieval thấy version mới. |
| AC4-06 | Supersede/withdraw một version: active retrieval không còn trả version cũ hoặc withdrawn; rollback khôi phục đúng version đã được duyệt, có audit. |
| AC4-07 | Bảng eval hiển thị ít nhất một run thật có faithfulness, relevance, sample size, version và drill-down claim/rubric; chưa chạy thì hiện `NOT RUN`, không dựng số giả. |
| AC4-08 | Dashboard hiển thị cohort/date/timezone, numerator/denominator cho auto-answer, confirmed resolution, 72h proxy, feedback coverage; phân biệt case reviewed, handoff, pending và unknown. Dữ liệu demo có thể synthetic nhưng phải đi qua event flow thật và được gắn nhãn synthetic. |
| AC4-09 | Resident bị 403 trên API BQL; lỗi parser/model/retrieval/persistence có fallback và không làm rò dữ liệu hoặc trang trắng. |

Đối với AC4-05, “chạy được” nghĩa là từng định dạng trong danh sách được xử lý end-to-end hoặc trả lỗi có kiểm soát theo tình huống input lỗi; không đánh dấu pass cho một định dạng nếu mới có nút upload nhưng không có extract/preview/publish/retrieve.

## 6. Bằng chứng release và giới hạn

- Ghi build/commit, Live URL hoặc môi trường demo, health/smoke, tài khoản role thử nghiệm, input/output và timestamp cho từng AC; không lưu credential trong artifact.
- Ghi kết quả thực của golden v0.3 ở artifact riêng; không sửa `eval/results/report.md` nếu chưa chạy. Eval mới v0.4 có dataset/revision riêng, không trộn mẫu số với 50 FAQ/30 E2E frozen.
- Chưa có ngưỡng số faithfulness/relevance được Product owner duyệt. Demo phải đo và hiện kết quả; release gate số là O-06. Confidence threshold là O-01, phải chốt trước khi bật auto-send.
- Các quyết định còn mở và owner ở [bản đồ tài liệu](README.md). Quy trình chi tiết ở các tài liệu liên kết; PRD này quyết định phạm vi và hành vi sản phẩm.
