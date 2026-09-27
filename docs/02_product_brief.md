# MaintenanceOps Agent — Product Brief

> **Document status:** DRAFT · Policy v0.2 đã chốt, chờ tên và sign-off approver  
> **Version:** 0.2  
> **Ngày:** 2026-09-27  
> **Owner:** TV1 — Product / BA / Process  
> **Phạm vi:** Prototype một tuần, chỉ dùng dữ liệu mô phỏng

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1 | 2026-09-27 | Tạo Product Brief từ Source Audit và Problem Statement v0.1 | DRAFT |
| 0.2 | 2026-09-27 | Áp dụng OD-01/02/03/08; ghi nhận governance OD-09 và cập nhật readiness | DRAFT · Chờ sign-off |

# Phase 2 — Product Brief

## 1. Product vision

Tạo một trợ lý điều phối hồ sơ bảo trì có thể giải thích và truy vết, giúp BQL nhận đúng review package hoặc exception mà vẫn giữ quyết định cuối cùng ở con người.

Vision này chưa phải cam kết triển khai vận hành thật; MVP chỉ kiểm chứng thiết kế trên dữ liệu mô phỏng.

## 2. MVP objective

Trong một tuần, chứng minh Agent có thể xử lý sáu kịch bản mô phỏng thuộc vệ sinh, kỹ thuật và CSKH để phân loại, tạo work order draft đúng cấu trúc, kiểm tra hồ sơ, đối soát vật tư, phát hiện ngoại lệ và chuyển đúng trường hợp cho BQL mà không vượt quyền.

## 3. Target users và actors

- **BPTN:** xem ticket gốc, chuẩn hóa trường hành chính, ghi lý do chỉnh sửa.
- **Nhân sự thực hiện:** đọc draft/checklist và cập nhật tiến độ, checklist, vật tư, evidence, kết quả.
- **BQL:** xem package `READY_FOR_REVIEW`, xử lý `EXCEPTION`, yêu cầu xác minh/bổ sung và ra quyết định nghiệp vụ ngoài prototype Agent.
- **Agent:** actor hệ thống thực hiện rule/schema validation, đề xuất và kiểm tra trong giới hạn permission.
- **Cư dân:** nguồn phản ánh, không phải user của MVP.

## 4. Jobs to be done

### BPTN

- Khi nhận ticket, cần chuẩn hóa đúng các trường hành chính mà không làm thay đổi lời phản ánh/bằng chứng gốc.
- Khi dữ liệu thiếu hoặc không rõ, cần thấy chính xác trường nào phải xác minh thay vì đoán.

### Nhân sự thực hiện

- Khi làm việc với work order draft, cần biết checklist, material và evidence nào phải cập nhật theo playbook.
- Khi nộp hồ sơ, cần thấy gate nào còn thiếu hoặc có chênh lệch cần giải thích.

### BQL

- Khi nhận case, cần thấy nguồn, playbook, draft, readiness gate, warning/exception và audit trong một package có thể kiểm tra.
- Khi case rủi ro/nhạy cảm, cần thấy rule kích hoạt và dữ liệu liên quan mà không bị Agent tự chẩn đoán/kết luận.

### Agent

- Khi xử lý ticket, cần ưu tiên deterministic safety/permission rules, tạo structured output, không bịa dữ kiện và giải thích mọi state/recommendation.

## 5. Value proposition

- **Có cấu trúc:** một schema và readiness gate chung cho ba playbook mô phỏng.
- **Có rào chắn:** case thiếu/rủi ro dừng đúng; UI không có hành động vượt quyền.
- **Có thể giải thích:** state, warning/exception và material variance đều có rule/lý do/nguồn.
- **Có thể truy vết:** dữ liệu gốc bất biến, mọi chỉnh sửa có audit tối thiểu.
- **Có thể kiểm thử:** 18 synthetic tickets, expected outcomes và sáu demo paths reset được.

Không khẳng định các giá trị trên đã cải thiện thời gian, chi phí, chất lượng hoặc SLA thực tế.

## 6. Product principles

1. **Human authority first:** BQL giữ quyết định cuối; Agent chỉ đề xuất/kiểm tra/routing.
2. **Source is immutable:** không sửa phản ánh hoặc bằng chứng gốc.
3. **No guessing:** thiếu/không rõ input bắt buộc cho classification/draft → `CHỜ XÁC MINH`; execution/evidence chưa hoàn tất → `IN_PROGRESS`; Agent không tự điền.
4. **Safety rules before model output:** high-risk/permission rules có ưu tiên tuyệt đối.
5. **Evidence is playbook-specific:** ảnh không phải requirement chung.
6. **Explain every gate:** mọi trạng thái, warning và exception phải có reason/rule/source.
7. **Synthetic by design:** mọi dữ liệu/output có nhãn mô phỏng; không giả lập claim vận hành thật.
8. **Narrow and testable:** chỉ ba use case + ba exception; mọi yêu cầu mới đi backlog.

## 7. P0 scope

- Ba playbook mô phỏng và ba exception rule set đã khóa về phạm vi.
- Ticket ingestion từ fixture/form chuẩn hóa và schema validation.
- Tách raw immutable data, normalized administrative data, Agent proposal, human execution data và audit.
- Trước classification bắt buộc `ticket_id`, `created_at`, `original_description`; `priority` optional.
- Agent đề xuất `service_category_normalized`, `ticket_type_normalized` và playbook; BPTN xác nhận service/type và `location_normalized` trước draft, mọi xác nhận/chỉnh sửa có audit.
- Agent chạy high-risk rules và chỉ tạo work order draft idempotent sau khi confirmation/location gate pass.
- Checklist, material và evidence requirement theo playbook.
- Bốn state: `IN_PROGRESS`, `CHỜ XÁC MINH`, `READY_FOR_REVIEW`, `EXCEPTION`.
- Ba phép đối soát vật tư; `norm_qty` ghi rõ mô phỏng/`N/A`; CSKH `N/A`.
- Readiness gate đủ bảy điều kiện; non-blocking warning vẫn hiện trong package.
- Rule/lý do/nguồn tối thiểu cho draft, warning, exception và state.
- Tám màn hình dự kiến `UI-01` đến `UI-08`; có thể trình bày `UI-04` và `UI-05` trong cùng trang nhưng giữ hai khu chức năng rõ.
- 18 synthetic tickets, sáu demo paths, 9 expected work order drafts nếu test design phù hợp, expected outcomes và reset.
- Basic accessibility, error handling, synthetic labels và prompt-injection resistance cho nội dung evidence/tệp.

## 8. P1 scope

Chỉ thực hiện khi P0 xanh; không làm thay đổi safety contract:

- Rule explanation explorer nâng cao và liên kết chi tiết tới từng source field.
- Bộ lọc Work Queue theo dịch vụ, state, warning.
- Full replay toàn bộ golden set từ một action nội bộ.
- Export JSON và toàn bộ audit trail.
- Responsive/polish, loading/empty state nâng cao.

Ghi chú: việc hiển thị non-blocking warning và reason tối thiểu là P0; chỉ trải nghiệm phân tích nâng cao là P1.

## 9. Out of scope

- Chatbot cư dân; booking tiện ích.
- IoT; computer vision xác nhận chất lượng; bảo trì dự đoán.
- Tích hợp hệ thống thật; tạo work order thật.
- Gửi tin nhắn cho cư dân; yêu cầu cư dân bổ sung ảnh.
- Báo giá; hóa đơn; thanh toán.
- Thuê ngoài.
- Phân công hoặc tối ưu lịch nhân sự.
- Quản lý tồn kho đầy đủ.
- Agent nghiệm thu, hoàn tất công việc, đóng ticket, xác nhận chất lượng kỹ thuật, phê duyệt xuất/điều chỉnh vật tư hoặc tự xử lý case rủi ro cao.

## 10. Ba use case chính

### UC-CLN-01 — Vệ sinh khu vực chung

- Trigger: phản ánh khu vực chung cần vệ sinh.
- Output mong đợi: work order draft, checklist, material/evidence requirement; sau execution update, Agent kiểm tra và có thể đưa `READY_FOR_REVIEW`.
- Checklist là readiness gate riêng. Minimum evidence: ghi chú xử lý không rỗng, liên kết đúng case. Ảnh không bắt buộc.

### UC-TEC-01 — Đèn khu vực chung không hoạt động

- Trigger: đèn chiếu sáng khu vực chung không hoạt động, không có tín hiệu high-risk.
- Output mong đợi: work order draft, checklist an toàn/kết quả, material/evidence requirement; kiểm tra hồ sơ trước review.
- Checklist an toàn là readiness gate riêng. Minimum evidence: kết quả xử lý không rỗng; material gate phải hoàn tất hoặc `N/A`. Ảnh không bắt buộc.

### UC-CS-01 — Cập nhật tiến độ ticket có mã tham chiếu

- Trigger: cư dân yêu cầu cập nhật tiến độ một ticket đã có mã tham chiếu.
- Output mong đợi: work order draft CSKH, material `N/A`, nội dung xử lý/dự kiến phản hồi và log/bản nháp liên hệ để BQL xem xét.
- Minimum evidence: `reference_ticket_id`, nội dung xử lý hoặc bản nháp phản hồi, và log liên hệ.
- Không tự gửi phản hồi cho cư dân.

## 11. Ba exception path

### EX-CLN-01 — Chất không rõ nguồn gốc/có dấu hiệu nguy hại

- Agent dừng standard flow, không đưa hướng dẫn xử lý, tạo `EXCEPTION`, nêu tín hiệu/rule/source và chuyển BQL.

### EX-TEC-01 — Mùi khét, tia lửa hoặc dây điện hở

- Agent không chẩn đoán hoặc hướng dẫn xử lý, không tạo continuation mang tính kỹ thuật, tạo `EXCEPTION` và chuyển BQL.

### EX-CS-01 — Mâu thuẫn, tranh chấp hoặc khiếu nại nhạy cảm

- Agent giữ nguyên dữ liệu, không kết luận đúng/sai, tạo `EXCEPTION` và chuyển BQL.
- Conflict chỉ được xác định khi hai nguồn hiện hữu nói về cùng một field trong `reference_ticket_id`, `recorded_status`, `outcome_code`, `last_processing_time`, `contact_status` nhưng có giá trị không tương thích.
- Thiếu một nguồn → `CHỜ XÁC MINH`. Cư dân phủ nhận history, yêu cầu xác định đúng/sai/trách nhiệm, hoặc fixture có cờ nhạy cảm → `EXCEPTION`.

## 12. Target workflow

1. Cư dân gửi ticket qua app/form chuẩn hóa.
2. BPTN tiếp nhận và xem raw resident data read-only.
3. Agent validate `ticket_id`, `created_at`, `original_description`, chạy high-risk rules và đề xuất service/type/playbook.
4. BPTN xác nhận service/type proposal và bổ sung/xác nhận location; hệ thống tạo audit event.
5. Nếu confirmation/location gate pass và không có blocker, Agent tạo work order draft/checklist/material/evidence requirement.
6. Nhân sự thực hiện cập nhật execution data.
7. Agent đối soát vật tư, checklist và evidence.
8. Agent xác định `READY_FOR_REVIEW`, `CHỜ XÁC MINH` hoặc `EXCEPTION`, kèm reason/audit.
9. BQL xem xét package hoặc xử lý exception; quyết định sau đó nằm ngoài quyền Agent.

## 13. State model

- `IN_PROGRESS`: ticket hợp lệ đang được phân loại, có draft hoặc đang chờ execution/checklist/evidence update; thiếu evidence đã biết rõ cần bổ sung vẫn ở state này.
- `CHỜ XÁC MINH`: thiếu raw field bắt buộc, chưa xác nhận service/type, thiếu location trước draft, không xác định được evidence cần bổ sung, hoặc nguồn cần con người xác minh.
- `READY_FOR_REVIEW`: toàn bộ readiness gate pass; warning không chặn vẫn phải hiển thị.
- `EXCEPTION`: high-risk, tranh chấp/nhạy cảm hoặc mâu thuẫn đã xác định; BQL xử lý. `ACTION_OUT_OF_AUTHORITY` bị reject + audit và không đổi business state.

Không có transition trực tiếp do Agent thực hiện sang nghiệm thu/hoàn tất/đóng ticket.

## 14. Role and permission summary

- **BPTN:** xác nhận service/type proposal, bổ sung/xác nhận location và edit administrative fields trong allowlist; không edit raw resident data/evidence.
- **Agent:** read/validate/propose service/type/playbook/check/route; không tự xác nhận administrative proposal, edit source, execute, approve hoặc communicate externally.
- **Nhân sự thực hiện:** update execution data; không edit source hoặc quyết định exception.
- **BQL:** review package, resolve exception/request verification và ra quyết định nghiệp vụ cuối; chi tiết sub-role là `OD-05`.

Mọi hành động sửa dữ liệu có audit; permission rule có ưu tiên cao hơn model output.

## 15. Product hypothesis

Nếu structured Agent được giới hạn bởi deterministic safety/permission rules và playbook-specific gates, thì trên bộ dữ liệu mô phỏng Agent sẽ tạo được hồ sơ nhất quán, dừng đúng case thiếu/rủi ro và không vượt quyền. Kết quả chỉ xác nhận feasibility của prototype.

## 16. North Star đề xuất cho giai đoạn pilot

**Đề xuất, chưa phải KPI đã chốt:** Tỷ lệ review package do Agent chuẩn bị mà BQL xác nhận là đủ để bắt đầu xem xét, không cần trả lại chỉ vì thiếu một thành phần readiness gate.

Điều kiện dùng metric này:

- Chỉ đo sau khi playbook/evidence/threshold được phê duyệt và có baseline shadow mode.
- Tách kết quả theo use case và loại thiếu sót; không dùng dữ liệu synthetic làm baseline thật.
- Không diễn giải metric như tỷ lệ nghiệm thu, hoàn thành hoặc chất lượng kỹ thuật.

## 17. Internal prototype acceptance criteria

> **Đây là acceptance criteria nội bộ trên bộ dữ liệu mô phỏng, không phải KPI vận hành thực tế.**

- Phân loại đúng ít nhất 17/18 tickets và đúng 6/6 demo cases.
- 9/9 expected work order drafts hợp lệ theo schema, nếu test design xác định chín case đủ điều kiện tạo draft.
- 100% case thiếu một trong ba raw classification fields hoặc thiếu confirmation/location trước draft vào `CHỜ XÁC MINH`; không có trường tự điền.
- 100% raw ticket/evidence bất biến qua mọi action.
- 100% chỉnh sửa administrative/execution data có audit fields tối thiểu.
- 100% seeded material variance được phát hiện bằng đúng ba phép so sánh; CSKH luôn `N/A`.
- Không case thiếu checklist/evidence tối thiểu đạt `READY_FOR_REVIEW`; thiếu evidence đã xác định rõ giữ `IN_PROGRESS`.
- 100% high-risk/sensitive exception được chuyển BQL, đúng state, có reason/rule/source.
- 0 Agent action hoặc UI CTA vượt quyền.
- 100% `ACTION_OUT_OF_AUTHORITY` bị reject, có audit và không tự tạo `EXCEPTION` cho ticket.
- Sáu demo paths chạy end-to-end, reset được trong tổng thời lượng 10–12 phút.

## 18. Risks và mitigation

| Risk | Hệ quả | Mitigation P0 |
|---|---|---|
| Product approver/proxy BQL chưa có tên và sign-off | Policy mô phỏng chưa có approval evidence | Giữ tài liệu DRAFT; điền tên và ghi version/date/sign-off trước build baseline |
| LLM output không ổn định | Routing/safety không dự đoán được | Deterministic schema, safety, state và permission rules chạy trước model output |
| Dữ liệu mô phỏng bị hiểu là dữ liệu thật | Claim sai về Vinhomes | Nhãn synthetic ở mọi screen/export; ID `SIM-`; không dùng tên/SLA/định mức thật |
| BPTN/BQL bị gộp | Sai quyền chỉnh sửa/quyết định | Permission matrix, UI CTA theo role, negative tests |
| Ảnh bị biến thành evidence chung | Chặn sai case | Policy v0.2 xác nhận không bắt buộc ảnh trong cả ba playbook |
| Material variance bị hiểu là vi phạm | Agent vượt quyền | Chỉ phát hiện/mô tả; không approve/conclude; hiển thị `variance_reason` và mô phỏng |
| Prompt injection trong evidence | Model làm theo nội dung không tin cậy | Treat evidence as data; instruction hierarchy; allowlisted schema/actions; red-team tests |
| Deadline một tuần | Cắt nhầm safety | Giữ role, immutability, audit, state, readiness, exception; cắt polish/P1 trước |

## 19. Backlog

Các mục dưới đây không thuộc MVP hiện tại và cần discovery/source riêng:

- Loại vệ sinh khác ngoài khu vực chung cần vệ sinh.
- Sự cố điện, nước hoặc thiết bị khác ngoài đèn khu vực chung.
- CSKH sau nghiệm thu hoặc yêu cầu không có mã tham chiếu.
- Bộ lọc/nâng cấp explainability/export/replay thuộc P1.
- Authentication, persistence và integration thật chỉ được xem xét trong phase sau, không nằm trong prototype một tuần.

## 20. Definition of Ready để bắt đầu build

Build baseline chỉ Ready khi:

- Scope ba use case + ba exception được Product owner xác nhận.
- `OD-01`, `OD-02`, `OD-03`, `OD-08` đã chốt và được áp dụng trong v0.2.
- Actor/permission matrix và four-state transition được sign-off.
- Data contract P0 gồm immutable/admin/proposal/execution/audit layers đã review.
- 18 ticket design và expected outcomes đã được Product/BA + QA duyệt.
- Wireframe bao phủ sáu demo paths và các edge flow bắt buộc.
- Không có P0 contradiction hoặc UI CTA vượt quyền.
- Owner/reviewer roles đã được chỉ định; tên Product approver/proxy và bằng chứng sign-off OD-09 đã được điền.

## 21. Definition of Done cho prototype

- Sáu demo paths và các edge flow required-field/material/evidence/warning chạy end-to-end, reset được.
- 18/18 cases có expected outcome; eval report ghi pass/total và failure reason.
- Internal acceptance gates ở mục 17 được đo và kết quả đính kèm.
- Không có P0 blocker về role, immutability, audit, state, readiness hoặc safety.
- UI hiển thị synthetic label, source/admin/proposal/execution separation và disabled forbidden actions.
- Error handling, idempotent draft generation, prompt-injection tests và accessibility cơ bản pass.
- Limitations, assumptions, open decisions và backlog được bàn giao rõ.
- Không có claim về hiệu quả vận hành thật.

## Phase 2 consistency gate

**PASS.** Product Brief thống nhất với Phase 0–1 và policy v0.2. OD-01/02/03/08 đã đóng. Chỉ danh tính và bằng chứng sign-off thuộc OD-09 còn chặn approved build baseline.
