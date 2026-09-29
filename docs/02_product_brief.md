# MaintenanceOps Agent — Product Brief

> **Document status:** DRAFT · Policy v0.3 đã chốt, chờ tên và sign-off approver
> **Version:** 0.3
> **Ngày:** 2026-09-27  
> **Owner:** TV1 — Product / BA / Process  
> **Phạm vi:** Prototype một tuần, chỉ dùng dữ liệu mô phỏng

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1 | 2026-09-27 | Tạo Product Brief từ Source Audit và Problem Statement v0.1 | DRAFT |
| 0.2 | 2026-09-27 | Áp dụng OD-01/02/03/08; ghi nhận governance OD-09 và cập nhật readiness | DRAFT · Chờ sign-off |
| 0.3 | 2026-09-27 | Khóa hai nhóm dịch vụ; thêm asset/duty/stock gate, team-only routing, 12 ticket và 4 demo flow | DRAFT · Chờ sign-off |
| 0.4-candidate | 2026-09-29 | `CR-BPTN-01`: BPTN review có điều kiện + override; định vị "đề xuất tuyến team" và capacity mô phỏng | PROPOSED · Chờ duyệt CR |
| 0.5-candidate | 2026-09-29 | `CR-BPTN-02`: actor cư dân/phòng ban/kho; giao phòng ban thay team route; 10 trạng thái + blocker; BQL nghiệm thu/trả làm lại/hủy; bỏ luật an toàn và `EXCEPTION`; acceptance 1–16 | PROPOSED · Chờ duyệt CR |

> **`CR-BPTN-02` (v0.5 candidate), PROPOSED:** mục 2, 3, 7, 11, 12, 13, 14 và 17 đã cập nhật theo [CR-BPTN-02](CR-BPTN-02.md).

# Phase 2 — Product Brief

## 1. Product vision

Tạo một trợ lý điều phối hồ sơ bảo trì có thể giải thích và truy vết, giúp BQL nhận đúng review package hoặc exception mà vẫn giữ quyết định cuối cùng ở con người.

Vision này chưa phải cam kết triển khai vận hành thật; MVP chỉ kiểm chứng thiết kế trên dữ liệu mô phỏng.

## 2. MVP objective

Chứng minh Agent có thể xử lý ticket bảo trì vệ sinh và kỹ thuật sau app/form hiện có (`CR-BPTN-02` (v0.5 candidate)): kiểm tra dữ liệu và trùng,
phân loại, đề xuất phòng ban, BPTN review khi cần, tra tài sản kỹ thuật, kiểm vật tư, giao phòng ban, đối soát hồ sơ khi
phòng ban báo hoàn thành, để BQL nghiệm thu; cư dân theo dõi trạng thái công khai. Agent không vượt quyền.

## 3. Target users và actors

- **Cư dân (`CR-BPTN-02` (v0.5 candidate)):** gửi phản ánh, xem trạng thái công khai, bổ sung thông tin, đánh giá, báo chưa xong.
- **BPTN:** gỡ blocker cần người quyết định (trùng, loại việc, review, tài sản, sai phòng ban); không sửa phản ánh gốc.
- **Phòng ban (thay "Nhân sự thực hiện"):** nhận việc, tự phân công, cập nhật checklist/vật tư/ghi chú, báo hoàn thành,
  trả về khi sai phòng ban, tạm hoãn tại hiện trường.
- **Kho (`CR-BPTN-02` (v0.5 candidate)):** nhập vật tư mô phỏng.
- **BQL:** xem dashboard, nghiệm thu, trả làm lại, hủy; nhận thông báo leo thang.
- **Agent:** actor hệ thống chạy pipeline và đối soát trong giới hạn permission.

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

- Hai playbook mô phỏng `PB-CLN-01` → `DEPT_CLEANING`, `PB-TEC-01` → `DEPT_TECHNICAL` (`CR-BPTN-02` (v0.5 candidate): bỏ exception rule set).
- Ticket ingestion từ fixture/form chuẩn hóa và schema validation.
- Tách raw immutable data, normalized administrative data, Agent proposal, human execution data và audit.
- Trước classification bắt buộc `ticket_id`, `created_at`, `original_description`; `priority` optional.
- Agent đề xuất `service_category_normalized`, `ticket_type_normalized`, playbook và location; theo `CR-BPTN-01` (v0.4 candidate) BPTN chỉ review khi Agent đánh dấu `PENDING_REVIEW` (thiếu location/category không rõ), xác nhận hoặc override có `override_reason`; mọi xác nhận/override có audit.
- `CR-BPTN-02` (v0.5 candidate): thứ tự bắt buộc BPTN review (nếu cần) → tra tài sản → giao phòng ban; draft chỉ tạo khi giao (`can_route`).
- Playbook Registry, Asset Catalog, tồn kho và duty roster là cấu hình/dữ liệu mô phỏng read-only; không có CRUD trong MVP.
- `CR-BPTN-02` (v0.5 candidate): không tra ca trực/capacity theo team; lịch làm việc theo phòng ban (ngoài giờ → `OUT_OF_HOURS`). Tra tài sản bắt buộc cho kỹ thuật, ưu tiên `LIGHTING`.
- Giao tới phòng ban; Agent không gán nhân viên (`assignee_id` do phòng ban set).
- Checklist, material và evidence requirement theo playbook.
- Mười trạng thái + blocker, retry và leo thang; API cư dân (trường công khai) và dashboard BQL (`CR-BPTN-02` (v0.5 candidate)).
- Trước route kiểm tra vật tư dự kiến, định mức và tồn kho mô phỏng; sau thực hiện đối soát planned/norm/issued/used; Agent không phê duyệt.
- Đối soát bước 10 đủ sáu điều kiện khi phòng ban báo hoàn thành; non-blocking warning vẫn hiện trong package.
- Rule/lý do/nguồn tối thiểu cho draft, warning, exception và state.
- Mười màn hình dự kiến `UI-01` đến `UI-10` (thêm theo dõi cho cư dân và dashboard BQL, `CR-BPTN-02` (v0.5 candidate)).
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

`CR-BPTN-02` (v0.5 candidate): không còn `EX-CLN-01`, `EX-TEC-01` và trạng thái `EXCEPTION`. Mỗi lần dừng là một blocker:

| Tình huống | Trạng thái / blocker | Người gỡ |
|---|---|---|
| Thiếu nội dung/vị trí | `NEED_INFO` / `MISSING_INFO` | Cư dân |
| Trùng ticket đang mở (48h) | `VERIFYING` / `DUPLICATE` | BPTN |
| Loại việc không rõ / ngoài phạm vi | `VERIFYING` / `CATEGORY_UNCLEAR`, `OUT_OF_SCOPE` | BPTN |
| Playbook chỉ do LLM đề xuất | `VERIFYING` / `PENDING_REVIEW` | BPTN |
| Kỹ thuật không xác định được tài sản | `VERIFYING` / `ASSET_UNCLEAR` | BPTN (chọn asset hoặc xác định tại hiện trường kèm lý do) |
| Thiếu vật tư | `ON_HOLD` / `WAITING_MATERIAL` | Kho |
| Ngoài giờ phòng ban | `ROUTED` / `OUT_OF_HOURS` | Hệ thống (đầu ca) |
| Chưa ai nhận việc sau 2h | `ROUTED` / `NOT_ACCEPTED` | Phòng ban |
| Phòng ban trả về | `VERIFYING` / `WRONG_DEPT` | BPTN |
| Vướng tại hiện trường | `ON_HOLD` / `BLOCKED_ONSITE` (kèm eta) | Phòng ban |
| BQL trả làm lại | `IN_PROGRESS` / `REWORK` | Phòng ban |

Leo thang chỉ bật cờ và thông báo BQL; không đổi trạng thái, không tự hủy/đóng.

## 12. Target workflow

`CR-BPTN-02` (v0.5 candidate):

1. Cư dân gửi phản ánh → `RECEIVED`.
2. Agent kiểm tra dữ liệu (tính cả phần bổ sung) và trùng.
3. Agent phân loại, **đề xuất** phòng ban theo bảng playbook → phòng ban.
4. BPTN review nếu cần.
5. Nếu kỹ thuật, tra Asset Catalog; không xác định thì chờ BPTN.
6. Kiểm vật tư/tồn kho mô phỏng.
7. **Giao phòng ban** khi `can_route` đúng; tạo `WorkOrderDraft`.
8. Phòng ban nhận việc, thực hiện, báo hoàn thành.
9. Agent đối soát → `READY_FOR_REVIEW`.
10. BQL nghiệm thu (`CLOSED`), trả làm lại hoặc hủy; cư dân có 7 ngày báo chưa xong.

## 13. State model

`CR-BPTN-02` (v0.5 candidate): chính `RECEIVED` (Đã tiếp nhận), `VERIFYING` (Đang xác minh), `ROUTED` (Đã chuyển phòng ban), `IN_PROGRESS`
(Đang xử lý), `READY_FOR_REVIEW` (Chờ nghiệm thu), `CLOSED` (Hoàn thành); phụ `NEED_INFO` (Chờ bạn bổ sung), `ON_HOLD`
(Tạm hoãn); kết thúc `MERGED` (Đã gộp), `CANCELLED` (Đã hủy). Cư dân và BQL xem cùng trạng thái ở hai mức chi tiết.

Chỉ BQL chuyển sang `CLOSED` hoặc `CANCELLED`. Không ticket nào vào `ROUTED` khi `can_route` sai. Chi tiết transition ở
`03_lean_prd.md` §5 và `data-contract-v1.md` §8.

## 14. Role and permission summary

- **Cư dân:** gửi, xem trạng thái công khai, bổ sung, đánh giá, báo chưa xong; chỉ ticket của mình.
- **BPTN:** gỡ blocker `VERIFYING`, giá trị chọn vào `locked_fields` kèm lý do; không sửa raw, không đóng/hủy.
- **Agent:** chạy pipeline, đề xuất và giao phòng ban khi `can_route`, đối soát; không ghi `assignee_id`, không ghi đè
  `locked_fields`, không tự bỏ qua tra tài sản, không đóng/hủy, không tự viết lời cho cư dân.
- **Phòng ban:** chỉ ticket đã giao cho mình; nhận việc, phân công, cập nhật, báo hoàn thành, trả về, tạm hoãn.
- **Kho:** nhập vật tư.
- **BQL:** nghiệm thu, trả làm lại, hủy; chi tiết sub-role là `OD-05`.

Mọi thay đổi trạng thái có đúng một event; permission rule có ưu tiên cao hơn model output (`CR-BPTN-02` (v0.5 candidate)).

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

- 12/12 synthetic tickets và 4/4 demo flow đúng expected outcome (`CR-BPTN-02` (v0.5 candidate)).
- 16 test chấp nhận của CR-BPTN-02 (`03_lean_prd.md` §9.2) pass.
- 100% ticket thiếu dữ liệu vào `NEED_INFO`, không tự điền; nội dung gốc bất biến qua mọi action.
- 0 ticket có `department_id` mà `can_route` sai; tra tài sản luôn chạy trước khi giao ticket kỹ thuật.
- 0 ticket `CLOSED`/`CANCELLED` không do BQL; 0 lần Agent ghi `assignee_id` hoặc ghi đè `locked_fields`.
- Mọi thay đổi trạng thái có đúng một event; `resume()` gọi lại không tạo event mới.
- API cư dân không lộ `reason_code`, `internal_note`, `assignee_id`, phòng ban đề xuất.
- Đối soát vật tư đúng ba phép so sánh; không có phê duyệt tự động; ảnh không bắt buộc.
- Bốn demo flow chạy end-to-end và reset được.

## 18. Risks và mitigation

| Risk | Hệ quả | Mitigation P0 |
|---|---|---|
| Product approver/proxy BQL chưa có tên và sign-off | Policy mô phỏng chưa có approval evidence | Giữ tài liệu DRAFT; điền tên và ghi version/date/sign-off trước build baseline |
| LLM output không ổn định | Routing/safety không dự đoán được | Deterministic schema, safety, state và permission rules chạy trước model output |
| Dữ liệu mô phỏng bị hiểu là dữ liệu thật | Claim sai về Vinhomes | Nhãn synthetic ở mọi screen/export; ID `SIM-`; không dùng tên/SLA/định mức thật |
| BPTN/BQL bị gộp | Sai quyền chỉnh sửa/quyết định | Permission matrix, UI CTA theo role, negative tests |
| BPTN confirmation bắt buộc thành thủ tục hình thức | Chậm flow, trách nhiệm mờ | `CR-BPTN-01`: chỉ review khi dữ liệu hành chính thiếu/không rõ; override bắt buộc reason và audit |
| Ảnh bị biến thành evidence chung | Chặn sai case | Policy v0.3 xác nhận không bắt buộc ảnh trong cả hai playbook |
| Draft hoặc route bị hiểu là giao việc thành công | Báo sai trạng thái vận hành | Hiển thị riêng `draft_status` và `route_status`; UI copy "Đề xuất team"/"Đề xuất tuyến team hợp lệ"; không route/READY nếu gate chưa pass |
| Team route bị biến thành gán cá nhân | Vượt phạm vi mô phỏng | Chỉ dùng `SIM-TEAM-*`; `assignee_id=null`; không có CTA gán nhân viên |
| Material variance bị hiểu là vi phạm | Agent vượt quyền | Chỉ phát hiện/mô tả; không approve/conclude; hiển thị `variance_reason` và mô phỏng |
| Prompt injection trong evidence | Model làm theo nội dung không tin cậy | Treat evidence as data; instruction hierarchy; allowlisted schema/actions; red-team tests |
| Deadline một tuần | Cắt nhầm safety | Giữ role, immutability, audit, state, readiness, exception; cắt polish/P1 trước |

## 19. Deferred / Future Scope / Backlog

Các mục dưới đây không thuộc MVP hiện tại và cần discovery/source riêng:

- Loại vệ sinh khác ngoài khu vực chung cần vệ sinh.
- Sự cố điện, nước hoặc thiết bị khác ngoài đèn khu vực chung.
- CSKH chỉ thuộc Deferred/Future Scope; không có active use case, acceptance criteria, data contract, validator, demo flow hoặc test case MVP.
- Route acknowledgement của team, capacity cập nhật động, route khảo sát/sửa chữa nhiều bước và safety containment route thuộc backlog sau MVP.
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

**PASS.** Product Brief thống nhất với Problem Statement và policy v0.3: hai playbook, 12 ticket, 4 demo flow, asset/duty/stock gate và team-only route. Chỉ danh tính và bằng chứng sign-off thuộc OD-09 còn chặn approved build baseline.
