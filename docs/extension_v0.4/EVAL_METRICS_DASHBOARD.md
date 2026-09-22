# ResidentGPT v0.4 — eval và hợp đồng dashboard

> **Trạng thái:** metric definitions, chưa có kết quả chạy. Baseline `eval/results/report.md` hiện `NOT RUN` và Golden `0.3` là frozen.
> **Nguồn sản phẩm:** [PRD v0.4](PRD_ResidentGPT_v0.4.md). Event names ở [hợp đồng agent](AGENT_ARCHITECTURE_AND_CONTRACTS.md).

## 1. Hai lớp đánh giá

1. **Offline versioned evaluation:** giữ Golden `0.3` (50 FAQ/30 E2E) và các metric/gate frozen. Báo kết quả v0.3 trên build/config v0.3 và Knowledge Pack `1.18` đã ghi version. Vì v0.4 thay low-confidence terminal behavior, không ép toàn bộ golden v0.3 PASS trên v0.4 hoặc đổi nhãn golden cũ. Chạy regression các invariant chung trên v0.4 với kỳ vọng được ghi riêng; tạo bộ case v0.4 có revision/approval riêng cho ingest, OCR, version switch, verifier, HITL và dashboard; ghi rõ synthetic/de-identified.
2. **Draft quality v0.4:** chấm bản nháp AI **trước BQL edit/approve** trên đúng evidence snapshot đã truy xuất. Lưu `run_id`, `case_id`, `draft_id`, dataset revision, model/prompt/verifier/index/source snapshot version, timestamps, rubric/judge version, reviewer và rationale. Câu final do BQL sửa chấm riêng nếu cần, không dùng để che lỗi draft AI.
3. **Outcome analytics:** đọc event case/answer/review/handoff/feedback từ app. Không dùng điểm LLM judge hoặc số hardcoded làm số lượng case tự giải quyết.

LLM judge có thể hỗ trợ gắn nhãn, nhưng bộ mẫu chuẩn cần người review; thống kê tỷ lệ mẫu được kiểm tay, bất đồng và quyết định adjudication. Mọi severe unsupported claim hoặc vi phạm hard-risk báo riêng theo case, không ẩn trong trung bình. Nếu chưa chạy một metric, hiển thị `NOT RUN`; nếu denominator bằng 0, hiển thị `N/A`, không ghi 0%.

## 2. Faithfulness

**Đơn vị:** một substantive AI draft có ít nhất một factual claim. Tách câu thành các claim nguyên tử có thể kiểm chứng; chỉ so với context/evidence của đúng `source_snapshot_id` và citation mà model đã dùng tại thời điểm tạo draft.

| Thành phần | Định nghĩa |
|---|---|
| Claim supported | Cited eligible, approved/current, active source section trực tiếp hỗ trợ claim trong đúng property/area/scope. |
| Claim unsupported | Thiếu evidence, citation sai/không trỏ được, source không active/eligible, hoặc claim không suy ra được từ đoạn nguồn. Claim contradicted được báo riêng và tính unsupported. |
| `F_i` từng draft | `supported_factual_claims_i / all_factual_claims_i`. |
| Faithfulness dataset chính | `sum(F_i) / N_factual_drafts` (macro; mỗi câu hỏi cùng trọng số). |
| Micro claim-support ratio | `sum(supported_factual_claims_i) / sum(all_factual_claims_i)`. |
| Strict grounded-answer rate | `N_factual_drafts_with_all_claims_supported_and_all_citations_valid / N_factual_drafts`. |

Một draft có 3/4 claim được hỗ trợ có `F_i = 0.75` và strict pass = 0. Draft chỉ hỏi lại hoặc từ chối, không nêu fact, không vào mẫu số faithfulness; vẫn có trong abstention/clarification routing. Câu đã BQL sửa phải có `draft_id` và `final_answer_id` khác nhau để báo hai chất lượng riêng.

## 3. Relevance

**Đơn vị:** mọi substantive AI draft trong tập đánh giá, kể cả draft không có factual claim để chấm faithfulness; đối chiếu câu hỏi đã rewrite **và** ý định/câu gốc trong scoped conversation. Relevance đánh giá câu có giải đáp đúng yêu cầu và đủ ý; factual support thuộc faithfulness.

| Điểm | Rubric người đánh giá |
|---|---|
| `0` | Lạc đề, hiểu sai intent hoặc không giải đáp điều được hỏi. |
| `1` | Đúng chủ đề nhưng thiếu một yêu cầu quan trọng, chỉ đáp một phần hoặc thêm nội dung làm mục đích mơ hồ. |
| `2` | Đúng intent, bao phủ các ý người hỏi nêu và đủ cụ thể/hữu ích trong scope được phép. |

- **Normalized relevance:** `sum(relevance_score_i) / (2 * N_scored_substantive_drafts)`.
- **Full-relevance rate:** `N_scored_drafts_with_score_2 / N_scored_substantive_drafts`.
- Báo số case `0/1/2`, tổng `n` và reviewer agreement. Thông báo chuyển BQL thuần túy không phải substantive answer; chấm `routing_appropriateness` riêng: số handoff/clarification đúng policy ÷ tổng case phải handoff/clarification theo nhãn.

## 4. Case và eligibility của dashboard

`case_id` đại diện một vấn đề/intent độc lập. `conversation_id` có thể chứa nhiều case. Follow-up hoặc reopen cùng vấn đề trong 72 giờ từ final answer gắn cùng case; câu hỏi chủ đề khác tạo case mới. Với case khó phân biệt, cần gắn nhãn thủ công và báo tỷ lệ unresolved grouping.

**Headline denominator:** mọi câu hỏi hỗ trợ cư dân hợp lệ của pilot operator scope được tạo trong khoảng chọn, kể cả unsupported intent/no source và case phải chuyển người. Loại test/spam/non-resident/duplicate kỹ thuật theo cờ có lý do và báo số loại ra; không âm thầm lọc case khó. Ngoài headline có filter `knowledge_in_scope` để đánh giá chất lượng trong 5 intent/nguồn hiện có; hiển thị denominator của từng filter. Một câu hỏi thuộc pilot nhưng knowledge chưa bao phủ vẫn nằm trong headline denominator.

**Khoảng thời gian:** filter `[from, to)` theo `case_created_at` trong `Asia/Ho_Chi_Minh`; lưu event ở UTC. Mặc định xem 7 ngày gần nhất và cho chọn khoảng tùy ý. `as_of`/thời điểm tính phải hiển thị. Một case **mature** khi đã đủ 72 giờ từ lần `answer_sent_at` đầu tiên nếu có answer, hoặc từ `support_handoff_requested_at` đầu tiên nếu đã handoff, hoặc từ `case_created_at` nếu còn chưa có outcome. Follow-up/reopen cùng vấn đề sau answer đầu tiên trong cửa sổ đó loại case khỏi numerator tự giải quyết, kể cả khi hệ thống gửi thêm answer sau đó. Nếu còn pending review và chưa đủ cửa sổ thì hiện `immature`, ngoài mẫu số của các metric 72 giờ. Cửa sổ 72 giờ là đề xuất pilot, cần BQL xác nhận theo O-05.

## 5. Metric outcome: công thức và nhãn

| Metric | Tử số | Mẫu số | Diễn giải |
|---|---|---|---|
| Auto-answer rate | Case đã gửi answer bằng `answer_delivery_mode=auto`, không có `review_decided`/human edit trước khi gửi | Tất cả case hợp lệ tạo trong cohort | Đo khả năng tự gửi câu trả lời; chưa chứng minh vấn đề đã giải quyết. |
| Confirmed auto-resolution rate | Case mature có auto-answer, resident đánh dấu `Đã giải quyết` trong 72h, không có human review/support handoff, feedback `Chưa giải quyết` hoặc follow-up/reopen cùng vấn đề trong 72h | Tất cả case hợp lệ **mature** của cohort | Chỉ tính kết quả có phản hồi xác nhận; unknown vẫn ở mẫu số, không vào tử số. |
| 72h self-service containment proxy | Case mature có auto-answer, không có human review, feedback `Chưa giải quyết`, support handoff hoặc follow-up/reopen cùng vấn đề trong 72h | Tất cả case hợp lệ **mature** của cohort | Im lặng chỉ là proxy không phát sinh chuyển tiếp, không phải xác nhận đã giải quyết. |
| Feedback coverage | Case mature có feedback `Đã giải quyết` hoặc `Chưa giải quyết` hợp lệ trong 72h | Tất cả case hợp lệ **mature** của cohort | Cho biết mức thiếu dữ liệu xác nhận. |
| Human-assisted share | Case đã có answer sau bất kỳ BQL review/approve/edit | Tất cả case hợp lệ của cohort | BQL bấm approve không sửa vẫn là human touch. |
| Support handoff rate | Case có `support_handoff_requested` | Tất cả case hợp lệ của cohort | Tính từ lúc yêu cầu chuyển; không đợi `accepted`. |

Nếu feedback `Đã giải quyết` được ghi rồi case reopen cùng vấn đề trong 72h, case ra khỏi tử số confirmed. Feedback thiếu là `unknown`; không tự coi là no hoặc yes. Những case không đủ 72h chưa được dùng trong mẫu số confirmed/proxy/coverage; hiển thị số `immature` riêng. Báo số nguyên tử số/mẫu số cạnh mỗi phần trăm, ví dụ `3/12 (25%)`, cùng `as_of`, timezone và filter scope.

## 6. Review, handoff và dữ liệu cần ghi

`answer_review_status` (`not_required`, `pending`, `approved`, `edited_and_approved`, `rejected`, `needs_more_info`) độc lập với `support_handoff_status` (`none`, `requested`, `accepted`, `in_progress`, `resolved`, `closed`). Một case có review nhưng chưa support handoff vẫn là human-assisted nếu được gửi sau review; không tính auto-answer/auto-resolution. Một case handoff dù BQL chưa accept vẫn đã chuyển tuyến và không tự giải quyết. Không dùng `reviewer_rejected_draft` cho mọi low-confidence review; chỉ dùng canonical code này khi thực sự reject rồi handoff.

Event cần cho phép tái tính: `case_created`, `answer_sent` (mode + timestamp), `review_requested`, `review_decided`, `support_handoff_requested`, `support_handoff_accepted`, `feedback_recorded`, `case_reopened`, `case_closed`, cùng `case_id`, source/prompt/model/index versions và actor. Deduplicate bằng `event_id`/idempotency key. Không tính case từ UI impression hoặc dự đoán của model.

## 7. Báo cáo và release evidence

- Bảng eval có từng run, score, numerator/denominator, `n`, loại case bị loại, version, reviewer và drill-down claim/rubric; baseline v0.3 gates báo riêng theo [golden rubric](../../evals/golden/rubric.md).
- Dashboard có các filter ngày, property/knowledge scope, intent, auto/human-assisted/handoff và maturity; các breakdown cùng dùng định nghĩa trên. Dữ liệu synthetic phải có nhãn rõ.
- Chưa có mục tiêu số v0.4 cho faithfulness, relevance hoặc confirmed auto-resolution. Báo kết quả thực trước, sau đó Product owner + Eval owner chốt ngưỡng release và sample size trong decision log O-06. Không tự gắn PASS cho v0.4 dựa trên metric chưa có target hoặc chưa chạy.
