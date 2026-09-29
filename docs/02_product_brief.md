# MaintenanceOps Agent — Product Brief

> **Document status:** FROZEN
> **Version:** 0.3
> **Ngày:** 2026-09-28
> **MVP baseline:** MaintenanceOps MVP v0.3
> **Freeze date:** 28/09/2026
> **Owner:** TV1 — Product / BA / Process  
> **Phạm vi:** Prototype một tuần, chỉ dùng dữ liệu mô phỏng

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1 | 2026-09-27 | Tạo Product Brief từ Source Audit và Problem Statement v0.1 | DRAFT |
| 0.2 | 2026-09-27 | Áp dụng OD-01/02/03/08; ghi nhận governance OD-09 và cập nhật readiness | DRAFT · Chờ sign-off |
| 0.3 | 2026-09-27 | Khóa hai nhóm dịch vụ; thêm asset/duty/stock gate, team-only routing, 12 ticket và 4 demo flow | DRAFT · Chờ sign-off |
| 0.3-freeze | 2026-09-28 | Đóng OD-09 và freeze phạm vi MaintenanceOps MVP v0.3 | FROZEN |

# Phase 2 — Product Brief

## 1. Product vision

Tạo một trợ lý điều phối hồ sơ bảo trì có thể giải thích và truy vết, giúp BQL nhận đúng review package hoặc exception mà vẫn giữ quyết định cuối cùng ở con người.

Vision này chưa phải cam kết triển khai vận hành thật; MVP chỉ kiểm chứng thiết kế trên dữ liệu mô phỏng.

## 2. MVP objective

Trong một tuần, chứng minh Agent có thể xử lý ticket bảo trì vệ sinh và kỹ thuật sau app/form hiện có: phân loại, tra playbook, tra asset kỹ thuật, kiểm tra vật tư/tồn kho và duty, tạo work order draft, đề xuất route ở cấp team, đối soát hồ sơ và chuyển đúng trường hợp cho BQL mà không vượt quyền.

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

- **Có cấu trúc:** một schema và readiness gate chung cho hai playbook mô phỏng.
- **Có rào chắn:** case thiếu/rủi ro dừng đúng; UI không có hành động vượt quyền.
- **Có thể giải thích:** state, warning/exception và material variance đều có rule/lý do/nguồn.
- **Có thể truy vết:** dữ liệu gốc bất biến, mọi chỉnh sửa có audit tối thiểu.
- **Có thể kiểm thử:** 12 synthetic tickets, expected outcomes và bốn demo flow reset được.

Không khẳng định các giá trị trên đã cải thiện thời gian, chi phí, chất lượng hoặc SLA thực tế.

## 6. Product principles

1. **Human authority first:** BQL giữ quyết định cuối; Agent chỉ đề xuất/kiểm tra/routing.
2. **Source is immutable:** không sửa phản ánh hoặc bằng chứng gốc.
3. **No guessing:** thiếu/không rõ input bắt buộc cho classification/draft → `CHỜ XÁC MINH`; execution/evidence chưa hoàn tất → `IN_PROGRESS`; Agent không tự điền.
4. **Safety rules before model output:** high-risk/permission rules có ưu tiên tuyệt đối.
5. **Evidence is playbook-specific:** ảnh không phải requirement chung.
6. **Explain every gate:** mọi trạng thái, warning và exception phải có reason/rule/source.
7. **Synthetic by design:** mọi dữ liệu/output có nhãn mô phỏng; không giả lập claim vận hành thật.
8. **Narrow and testable:** chỉ hai use case, bốn demo flow và các regression case đã nêu; mọi yêu cầu mới đi backlog.

## 7. P0 scope

- Hai playbook mô phỏng `PB-CLN-01` và `PB-TEC-01` với exception rule set đã khóa.
- Ticket ingestion từ fixture/form chuẩn hóa và schema validation.
- Tách raw immutable data, normalized administrative data, Agent proposal, human execution data và audit.
- Trước classification bắt buộc `ticket_id`, `created_at`, `original_description`; `priority` optional.
- Agent đề xuất `service_category_normalized`, `ticket_type_normalized` và playbook; BPTN xác nhận service/type và `location_normalized` trước draft, mọi xác nhận/chỉnh sửa có audit.
- Agent chạy high-risk rules và tạo work order draft idempotent sau confirmation/location gate; asset, stock hoặc duty chưa pass vẫn cho phép draft tồn tại nhưng không cho route hợp lệ.
- Playbook Registry, Asset Catalog, tồn kho và duty roster là cấu hình/dữ liệu mô phỏng read-only; không có CRUD trong MVP.
- Duty lookup bắt buộc cho cả hai nhóm; chỉ kiểm tra team phù hợp, đang trực và còn sức chứa. Asset lookup bắt buộc riêng cho kỹ thuật, ưu tiên `LIGHTING`.
- Routing chỉ tới `SIM-TEAM-*`; không gán nhân viên, `assignee_id=null`.
- Checklist, material và evidence requirement theo playbook.
- Bốn state: `IN_PROGRESS`, `CHỜ XÁC MINH`, `READY_FOR_REVIEW`, `EXCEPTION`.
- Trước route kiểm tra vật tư dự kiến, định mức và tồn kho mô phỏng; sau thực hiện đối soát planned/norm/issued/used; Agent không phê duyệt.
- Readiness gate đủ tám điều kiện, gồm route hợp lệ; non-blocking warning vẫn hiện trong package.
- Rule/lý do/nguồn tối thiểu cho draft, warning, exception và state.
- Tám màn hình dự kiến `UI-01` đến `UI-08`; có thể trình bày `UI-04` và `UI-05` trong cùng trang nhưng giữ hai khu chức năng rõ.
- 12 synthetic tickets (6 vệ sinh, 6 kỹ thuật), bốn demo flow chính và tám regression cases, expected outcomes và reset.
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
- Gán nhân viên cụ thể hoặc tối ưu lịch nhân sự thực tế.
- Màn hình quản lý tài sản, quản lý Playbook Registry hoặc lập lịch nhân sự riêng.
- Quản lý tồn kho đầy đủ.
- Agent nghiệm thu, hoàn tất công việc, đóng ticket, xác nhận chất lượng kỹ thuật, phê duyệt xuất/điều chỉnh vật tư hoặc tự xử lý case rủi ro cao.

## 10. Hai use case chính

### UC-CLN-01 — Vệ sinh khu vực chung

- Trigger: phản ánh khu vực chung cần vệ sinh.
- Output mong đợi: playbook match, vật tư/tồn kho, team/duty/route status, work order draft và checklist/evidence requirement; sau execution update, Agent chỉ đưa `READY_FOR_REVIEW` khi route hợp lệ và đủ gate.
- Duty lookup bắt buộc. Nếu không có team trực: draft vẫn tồn tại, `IN_PROGRESS`, reason `NO_AVAILABLE_TEAM`, `route_status=NOT_ROUTED`; duty không xác định: `CHỜ XÁC MINH`, reason `DUTY_UNKNOWN`.
- Checklist là readiness gate riêng. Minimum evidence: ghi chú xử lý không rỗng, liên kết đúng case. Ảnh không bắt buộc.

### UC-TEC-01 — Đèn khu vực chung không hoạt động

- Trigger: đèn chiếu sáng khu vực chung không hoạt động, không có tín hiệu high-risk.
- Output mong đợi: asset match `LIGHTING`, vật tư/tồn kho, team/duty/route status, work order draft, checklist an toàn/kết quả và evidence requirement.
- Asset lookup và duty lookup đều bắt buộc. Asset không tìm thấy hoặc nhiều match → `CHỜ XÁC MINH`, không route; Agent không tự đoán.
- Checklist an toàn là readiness gate riêng. Minimum evidence: kết quả xử lý không rỗng; material gate phải hoàn tất hoặc `N/A`. Ảnh không bắt buộc.

## 11. Exception và routing path

### EX-CLN-01 — Chất không rõ nguồn gốc/có dấu hiệu nguy hại

- Agent dừng standard flow, không đưa hướng dẫn xử lý, tạo `EXCEPTION`, nêu tín hiệu/rule/source và chuyển BQL.

### EX-TEC-01 — Mùi khét, tia lửa hoặc dây điện hở

- Agent không chẩn đoán hoặc hướng dẫn xử lý, không tạo continuation mang tính kỹ thuật, tạo `EXCEPTION` và chuyển BQL.

### Route không hợp lệ nhưng draft vẫn tồn tại

- Không có team trực hoặc team vượt sức chứa: `IN_PROGRESS`, không route; lần lượt ghi `NO_AVAILABLE_TEAM` hoặc `TEAM_CAPACITY_EXCEEDED` ở reason/queue field.
- Duty data không xác định: `CHỜ XÁC MINH`, reason `DUTY_UNKNOWN`, không route.
- Vật tư thiếu: `IN_PROGRESS`, reason `MATERIAL_SHORTAGE`, không route. Tồn kho không rõ: `CHỜ XÁC MINH`, reason `MATERIAL_STOCK_UNKNOWN`, không route.
- Kỹ thuật không có asset match duy nhất: `CHỜ XÁC MINH`, reason `ASSET_NOT_FOUND` hoặc `ASSET_AMBIGUOUS`, không route.

## 12. Target workflow

1. Ticket đến từ app/form hiện có; BPTN xem raw data read-only và xác nhận thông tin hành chính.
2. Agent phân loại và tra Playbook Registry.
3. Nếu kỹ thuật, Agent tra Asset Catalog read-only; không match duy nhất thì chờ xác minh.
4. Agent xác định vật tư dự kiến/định mức và kiểm tra tồn kho mô phỏng.
5. Agent tra duty team mô phỏng theo service, trạng thái trực và sức chứa.
6. Agent tạo `WorkOrderDraft`; chỉ tạo route cấp team khi asset/stock/duty gates pass.
7. Nhân sự thực hiện checklist, cập nhật vật tư, ghi chú và bằng chứng.
8. Agent đối soát planned/norm/issued/used, checklist, evidence và route.
9. Agent xác định một trong bốn state, kèm reason/audit; BQL xem xét.

## 13. State model

- `IN_PROGRESS`: ticket hợp lệ đang xử lý; gồm draft chưa route vì không có team trực, team quá tải hoặc thiếu vật tư, và case chờ execution/checklist/evidence đã biết rõ.
- `CHỜ XÁC MINH`: thiếu raw/admin data, asset không tìm thấy/không duy nhất, duty unknown, tồn kho unknown hoặc nguồn cần con người xác minh.
- `READY_FOR_REVIEW`: tám readiness gate pass, đặc biệt phải có route hợp lệ; warning không chặn vẫn phải hiển thị.
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

- Phân loại đúng 12/12 synthetic tickets và 4/4 demo flow.
- Mọi case đủ confirmation/location đều có draft schema-valid, kể cả case route chưa hợp lệ.
- 100% case thiếu một trong ba raw classification fields hoặc thiếu confirmation/location trước draft vào `CHỜ XÁC MINH`; không có trường tự điền.
- 100% raw ticket/evidence bất biến qua mọi action.
- 100% chỉnh sửa administrative/execution data có audit fields tối thiểu.
- 100% stock gate trước route và bốn mức planned/norm/issued/used sau thực hiện được kiểm tra đúng; không có phê duyệt tự động.
- 100% route chỉ dùng `SIM-TEAM-*`, `assignment_scope=TEAM_ONLY`, `assignment_mode=SIMULATED_TEAM_ROUTE`, `assignee_id=null`.
- 0 case thiếu route hợp lệ đạt `READY_FOR_REVIEW`.
- Không case thiếu checklist/evidence tối thiểu đạt `READY_FOR_REVIEW`; thiếu evidence đã xác định rõ giữ `IN_PROGRESS`.
- 100% high-risk/sensitive exception được chuyển BQL, đúng state, có reason/rule/source.
- 0 Agent action hoặc UI CTA vượt quyền.
- 100% `ACTION_OUT_OF_AUTHORITY` bị reject, có audit và không tự tạo `EXCEPTION` cho ticket.
- Bốn demo flow chạy end-to-end và reset được.

## 18. Risks và mitigation

| Risk | Hệ quả | Mitigation P0 |
|---|---|---|
| Scope thay đổi sau freeze nhưng không qua change control | Baseline và test oracle bị lệch | Giữ v0.3 bất biến; yêu cầu mới chuyển backlog hoặc cần quyết định re-baseline riêng |
| LLM output không ổn định | Routing/safety không dự đoán được | Deterministic schema, safety, state và permission rules chạy trước model output |
| Dữ liệu mô phỏng bị hiểu là dữ liệu thật | Claim sai về Vinhomes | Nhãn synthetic ở mọi screen/export; ID `SIM-`; không dùng tên/SLA/định mức thật |
| BPTN/BQL bị gộp | Sai quyền chỉnh sửa/quyết định | Permission matrix, UI CTA theo role, negative tests |
| Ảnh bị biến thành evidence chung | Chặn sai case | Policy v0.3 xác nhận không bắt buộc ảnh trong cả hai playbook |
| Draft bị hiểu là đã giao việc | Báo sai trạng thái vận hành | Hiển thị riêng `draft_status` và `route_status`; không route/READY nếu gate chưa pass |
| Team route bị biến thành gán cá nhân | Vượt phạm vi mô phỏng | Chỉ dùng `SIM-TEAM-*`; `assignee_id=null`; không có CTA gán nhân viên |
| Material variance bị hiểu là vi phạm | Agent vượt quyền | Chỉ phát hiện/mô tả; không approve/conclude; hiển thị `variance_reason` và mô phỏng |
| Prompt injection trong evidence | Model làm theo nội dung không tin cậy | Treat evidence as data; instruction hierarchy; allowlisted schema/actions; red-team tests |
| Deadline một tuần | Cắt nhầm safety | Giữ role, immutability, audit, state, readiness, exception; cắt polish/P1 trước |

## 19. Deferred / Future Scope / Backlog

Các mục dưới đây không thuộc MVP hiện tại và cần discovery/source riêng:

- Loại vệ sinh khác ngoài khu vực chung cần vệ sinh.
- Sự cố điện, nước hoặc thiết bị khác ngoài đèn khu vực chung.
- CSKH chỉ thuộc Deferred/Future Scope; không có active use case, acceptance criteria, data contract, validator, demo flow hoặc test case MVP.
- Bộ lọc/nâng cấp explainability/export/replay thuộc P1.
- Authentication, persistence và integration thật chỉ được xem xét trong phase sau, không nằm trong prototype một tuần.

## 20. Definition of Ready để bắt đầu build

Build baseline chỉ Ready khi:

- Scope hai playbook, asset/duty/stock gate và team-only routing được Product owner xác nhận.
- `OD-01`, `OD-02`, `OD-03`, `OD-10`, `OD-11`, `OD-12` đã chốt và được áp dụng trong v0.3.
- Actor/permission matrix và four-state transition được sign-off.
- Data contract P0 gồm immutable/admin/proposal/execution/audit layers đã review.
- 12 ticket design và expected outcomes đã được Product/BA + QA duyệt.
- Wireframe bao phủ bốn demo flow và các edge flow bắt buộc.
- Không có P0 contradiction hoặc UI CTA vượt quyền.
- Owner/reviewer roles đã được chỉ định; tên Product approver/proxy và bằng chứng sign-off OD-09 đã được điền.

## 21. Definition of Done cho prototype

- Bốn demo flow và các edge flow required-field/asset/duty/stock/material/evidence chạy end-to-end, reset được.
- 12/12 cases có expected outcome; eval report ghi pass/total và failure reason.
- Internal acceptance gates ở mục 17 được đo và kết quả đính kèm.
- Không có P0 blocker về role, immutability, audit, state, readiness hoặc safety.
- UI hiển thị synthetic label, source/admin/proposal/execution separation và disabled forbidden actions.
- Error handling, idempotent draft generation, prompt-injection tests và accessibility cơ bản pass.
- Limitations, assumptions, open decisions và backlog được bàn giao rõ.
- Không có claim về hiệu quả vận hành thật.

## Phase 2 consistency gate

**PASS.** Product Brief thống nhất với Problem Statement và policy v0.3: hai playbook, 12 ticket, 4 demo flow, asset/duty/stock gate và team-only route. OD-09 đã đóng; baseline `MaintenanceOps MVP v0.3` đã `FROZEN` ngày 28/09/2026.
