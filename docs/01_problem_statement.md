# MaintenanceOps Agent — Problem Statement

> **Phân loại tài liệu:** DRAFT · CHANGE CONTROL · Dữ liệu và quy trình mô phỏng
> **Version:** 0.6-candidate
> **Ngày cập nhật:** 2026-10-01
> **MVP baseline:** MaintenanceOps MVP v0.3 đã freeze; v0.6 candidate đang đề xuất theo `CR-BPTN-03`
> **Freeze history:** v0.3 — 28/09/2026; v0.6 chưa freeze
> **Owner:** TV1 — Product / BA / Process  
> **Source of truth đang đề xuất:** `CR-BPTN-03.md`; khi chưa có phê duyệt, đây là candidate chứ không phải frozen baseline mới
> **Lưu ý:** Tài liệu này không mô tả quy trình, SLA, định mức, tồn kho hay hiệu quả vận hành thực tế của Vinhomes.

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1 | 2026-09-27 | Tạo mới Phase 0 Source Audit và Phase 1 Problem Statement từ source of truth | DRAFT |
| 0.2 | 2026-09-27 | Ghi nhận quyết định OD-01/02/03/08 và cơ chế sign-off OD-09; cập nhật workflow proposal → BPTN confirmation | DRAFT · Chờ tên/sign-off approver |
| 0.3 | 2026-09-27 | Re-baseline MVP còn hai nhóm dịch vụ; bổ sung asset, duty, stock gate, team-only routing, dataset 12 ticket và 4 demo flow | DRAFT · Chờ tên/sign-off approver |
| 0.3-freeze | 2026-09-28 | Đóng OD-09 và freeze phạm vi MaintenanceOps MVP v0.3 | FROZEN |
| 0.6-candidate | 2026-10-01 | Re-baseline theo CR-BPTN-03: giao phòng ban, tầng an toàn, priority, merge, material hold, close/cancel/rating | DRAFT · CHỜ PHÊ DUYỆT CR-03 |

---

# Active baseline candidate — MaintenanceOps MVP v0.6

## A. Vấn đề cần giải quyết

Prototype cần chứng minh một luồng ticket bảo trì mô phỏng có thể đi từ phản ánh của cư dân đến phòng ban và BQL một cách có kiểm soát. Agent giúp đọc, đề xuất và kiểm tra điều kiện; con người giữ các quyết định có ảnh hưởng vận hành hoặc an toàn.

Các vấn đề chính:

- Ticket có thể thiếu hoặc mơ hồ về loại việc, vị trí, thiết bị và mức nguy hiểm.
- Phản ánh nguy hiểm không được đi vào luồng bảo trì thông thường trước khi con người xử lý.
- Ticket trùng cần được gộp có kiểm soát, không làm mất nội dung gốc.
- Ticket chỉ được giao đúng phòng ban khi đã vượt qua các điều kiện an toàn, phân loại, asset và vật tư.
- Hồ sơ hoàn thành phải đủ checklist, ghi chú, vật tư và ảnh trước khi BQL kiểm duyệt.
- Không actor nào được gán nhân viên cụ thể trong hệ thống.

## B. Phạm vi candidate

- Hai playbook: `PB-CLN-01` và `PB-TEC-01`.
- Actor: Cư dân, Agent, BPTN, Phòng ban Vệ sinh/Kỹ thuật, Kho mô phỏng và BQL.
- Dữ liệu, asset, vật tư, phòng ban và ticket đều là dữ liệu mô phỏng; ID nội bộ dùng tiền tố `SIM-`.
- Giao việc ở cấp **phòng ban**. Phòng ban tự chia người bên ngoài hệ thống; `assignee_id` luôn `null`.
- Mười trạng thái: `RECEIVED`, `VERIFYING`, `NEED_INFO`, `ON_HOLD`, `ROUTED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `MERGED`, `CLOSED`, `CANCELLED`.
- Ba mức ưu tiên: `HIGH`, `MEDIUM`, `LOW`.
- Ba mức an toàn: `NONE`, `UNCLEAR`, `EMERGENCY`; không tạo trạng thái `EMERGENCY`.

## C. Luồng mục tiêu

```text
Cư dân tạo ticket
→ hệ thống kiểm tra dữ liệu tối thiểu
→ Agent chạy luật an toàn cho mọi ticket
→ Agent kiểm tra trùng, đề xuất playbook, phòng ban và priority
→ BPTN chỉ can thiệp khi có blocker thuộc quyền BPTN
→ kỹ thuật tra asset; cả hai playbook kiểm tra vật tư/tồn kho mô phỏng
→ đủ điều kiện thì tạo WorkOrderDraft và giao phòng ban
→ phòng ban bấm nhận, thực hiện và nộp hồ sơ
→ Agent kiểm tra độ đầy đủ
→ BQL duyệt để CLOSED, trả làm lại hoặc hủy
→ cư dân xem lịch sử và rating một lần sau CLOSED
```

## D. Luật an toàn và quyền quyết định

- Bậc 1: `VERIFYING + EMERGENCY_PENDING_BQL`; không tạo draft, không giao phòng ban. Chỉ BQL được hạ cảnh báo, gộp, hủy hoặc đóng với ghi chú kết quả bắt buộc.
- Bậc 2: `VERIFYING + SAFETY_REVIEW_REQUIRED`; BPTN có đúng ba lựa chọn: xác nhận an toàn với lý do, nâng thành khẩn cấp, hoặc yêu cầu cư dân bổ sung.
- Khi cư dân bổ sung text/ảnh, dữ liệu mới được append-only và pipeline chạy lại từ tầng an toàn.
- Agent/LLM chỉ được nâng mức rủi ro, không được tự hạ tín hiệu do luật xác định.
- Chỉ BQL được đóng hoặc hủy. BPTN là tài khoản riêng và chỉ thấy thao tác theo quyền.

## E. Routing, asset và vật tư

- Không dùng duty/capacity theo team và không route đến `SIM-TEAM-*` trong candidate này.
- Kỹ thuật cần một asset hợp lệ; BPTN có thể xác nhận tại hiện trường theo đường `ONSITE_BY_BPTN`, phải có lý do và audit.
- Tồn kho biết chắc là thiếu: `ON_HOLD + WAITING_MATERIAL`, chưa giao phòng ban.
- Kho mô phỏng nhập đủ: hệ thống tự chạy lại toàn bộ điều kiện giao.
- Tồn kho không rõ: candidate dùng cờ `STOCK_CHECK_ON_ACCEPT` và cho đi tiếp; quyết định này vẫn cần được phê duyệt trong CR-03.
- WorkOrderDraft chỉ được tạo khi `can_route=true`, không còn quy tắc “draft tồn tại dù route không hợp lệ” của v0.3.

## F. Kết quả và giới hạn

Kết quả thành công là ticket được xử lý đúng nhánh, có audit và không vượt quyền. `READY_FOR_REVIEW` không phải nghiệm thu; BQL quyết định `CLOSED` hoặc trả làm lại. Ảnh bằng chứng là bắt buộc trong v0.6 candidate. Rating 1–5 sao chỉ gửi một lần sau `CLOSED`; không reopen, cư dân chưa hài lòng tạo ticket mới.

Ngoài phạm vi: gán nhân viên, lịch trực/capacity theo team, tích hợp hệ thống thật, kho thật, phân tích ảnh bằng AI, chatbot, thanh toán, hóa đơn, báo giá và tối ưu nhân sự.

## G. Governance

- Freeze v0.3 và OD-09 ngày 28/09/2026 vẫn là hồ sơ lịch sử hợp lệ.
- `CR-BPTN-03` đang `PROPOSED`; chưa có người phê duyệt được ghi tên.
- Không được gắn nhãn v0.6 là `FROZEN` hoặc `READY FOR BUILD` trước khi chốt D-02, D-03, D-05, D-09, người duyệt CR và bằng chứng sign-off.
- Chi tiết rule, transition và acceptance test lấy từ `CR-BPTN-03`; nếu code khác spec phải ghi drift.

---

# Historical appendix — MaintenanceOps MVP v0.3 (đã bị candidate v0.6 thay thế nếu CR-03 được duyệt)

> Nội dung từ đây trở xuống được giữ để truy vết freeze ngày 28/09/2026. Các quy tắc 4 trạng thái, duty/capacity, team-only routing và draft-without-route **không phải yêu cầu active của v0.6 candidate**.

# Phase 0 — Source Audit và assumptions

## 0.1 Nguồn đã đọc

- `CONFIRMED` Prompt MVP MaintenanceOps Agent trong phiên làm việc hiện tại.
- `CONFIRMED` Toàn bộ bảy tài liệu Markdown trong workspace: Problem Statement, Product Brief, Lean PRD, UI Flow, Traceability, Data Contract và Playbook.
- `CONFIRMED` Không sử dụng Internet, Library hoặc dữ liệu vận hành nội bộ thật để re-baseline v0.3/v1.1.

## 0.2 Source Audit

### Baseline MVP hiện hành

- MVP một tuần chỉ chứng minh tính khả thi của prototype bằng dữ liệu mô phỏng.
- Active scope chỉ có vệ sinh `PB-CLN-01` và kỹ thuật `PB-TEC-01`.
- Duty lookup là bắt buộc cho cả hai playbook; chỉ route tới team mô phỏng, không gán nhân viên.
- Asset lookup là bắt buộc riêng cho kỹ thuật; catalog ưu tiên `LIGHTING`, read-only và dùng ID `SIM-ASSET-*`.
- Material stock gate chạy trước routing; sau thực hiện Agent đối soát planned/norm/issued/used nhưng không phê duyệt.
- Không có team trực vẫn được tạo `WorkOrderDraft`, nhưng không có route hợp lệ và không được vào `READY_FOR_REVIEW`.
- Dữ liệu phản ánh gốc và bằng chứng gốc là bất biến; chỉnh sửa trường hành chính phải có audit.
- Chỉ dùng bốn state: `IN_PROGRESS`, `CHỜ XÁC MINH`, `READY_FOR_REVIEW`, `EXCEPTION`; trạng thái hàng đợi nằm ở field phụ.
- Dataset khóa ở 12 synthetic tickets: 6 vệ sinh, 6 kỹ thuật; 4 demo flow và 8 regression cases.

### Thay đổi so với baseline cũ

| ID | Nội dung cũ | Quyết định hiện hành | Xử lý |
|---|---|---|---|
| SA-01 | Phạm vi dịch vụ cũ rộng hơn | Chỉ hai nhóm/two playbooks | Loại phần ngoài phạm vi khỏi schema, validator, UI, acceptance và test |
| SA-02 | Baseline dataset/demo cũ | 12 ticket, 4 demo flow | Re-baseline toàn bộ acceptance/evaluation |
| SA-03 | Draft chỉ sinh sau mọi precondition routing | Draft vẫn tồn tại khi asset/material/duty chưa cho route | Tách `draft_status` khỏi `route_status` |
| SA-04 | READY chưa kiểm tra route | Route hợp lệ là gate bắt buộc bổ sung | Dùng tám gate; không READY khi route invalid |

Không phát hiện yêu cầu nào cho phép tích hợp hoặc dữ liệu vận hành thật.

## 0.3 Confirmed facts

- `CONFIRMED CF-01` MaintenanceOps Agent bắt đầu sau khi cư dân đã gửi phản ánh qua app/form chuẩn hóa; không xây chatbot cư dân hoặc làm lại form.
- `CONFIRMED CF-02` Chưa có dữ liệu vận hành nội bộ, workflow, playbook, work order, ảnh/bằng chứng, định mức hoặc dữ liệu vật tư thực tế.
- `CONFIRMED CF-03` Mọi ticket, workflow, playbook, work order, checklist, vật tư, bằng chứng, ngưỡng và kết quả trong MVP là mô phỏng.
- `CONFIRMED CF-04` Value unit là một case đủ điều kiện để BQL xem xét.
- `CONFIRMED CF-05` Agent được phân loại, tạo draft, sinh và kiểm tra hồ sơ, phát hiện ngoại lệ, đề xuất chuyển BQL; Agent không được tự sửa nguồn, tự nghiệm thu, tự đóng ticket, tự xác nhận chất lượng, tự phê duyệt vật tư, tự xử lý rủi ro cao hoặc tự gửi liên hệ cho cư dân.
- `CONFIRMED CF-06` BPTN chỉ chỉnh trường hành chính được cấu hình; không sửa nội dung/bằng chứng gốc hoặc suy đoán dữ kiện.
- `CONFIRMED CF-07` Nhân sự thực hiện cập nhật tiến độ, checklist, vật tư, evidence và ghi chú kết quả.
- `CONFIRMED CF-08` BQL xem xét `READY_FOR_REVIEW`, xử lý `EXCEPTION`, yêu cầu xác minh/bổ sung và ra quyết định nghiệp vụ cuối cùng ngoài quyền Agent.
- `CONFIRMED CF-09` Mọi chỉnh sửa phải tạo audit event có `actor_id`, `actor_role`, `timestamp`, `field_name`, `old_value`, `new_value`, `reason`.
- `CONFIRMED CF-10` Thiếu hoặc không rõ thông tin phải vào `CHỜ XÁC MINH`, ghi trường thiếu/mâu thuẫn và không được tự điền.
- `CONFIRMED CF-11` `READY_FOR_REVIEW` cần đủ tám gate, trong đó có `route_status=ROUTED`.
- `CONFIRMED CF-12` Bốn demo flow phải trình diễn được và reset được.
- `CONFIRMED CF-13` Trước classification chỉ bắt buộc `ticket_id`, `created_at`, `original_description`; thiếu một trong ba field → `CHỜ XÁC MINH`.
- `CONFIRMED CF-14` Agent đề xuất `service_category_normalized` và `ticket_type_normalized`; BPTN phải xác nhận trước khi tạo work order draft. `location_normalized` không chặn playbook proposal nhưng bắt buộc trước draft. `priority` là optional.
- `CONFIRMED CF-15` Checklist là readiness gate riêng, không được tính thay cho minimum evidence của hai playbook; ảnh không bắt buộc trong MVP.
- `CONFIRMED CF-16` `ACTION_OUT_OF_AUTHORITY` bị từ chối và audit; không tự chuyển business state của ticket sang `EXCEPTION`.
- `CONFIRMED CF-17` Không có team đang trực nhưng duty data rõ → tạo draft, `IN_PROGRESS`, reason `NO_AVAILABLE_TEAM`, không route; duty data không xác định → `CHỜ XÁC MINH`, reason `DUTY_UNKNOWN`.
- `CONFIRMED CF-18` Kỹ thuật không tìm thấy hoặc tìm thấy nhiều asset phù hợp → `CHỜ XÁC MINH`, không đoán và không route.
- `CONFIRMED CF-19` Tồn kho thiếu → draft tồn tại, `IN_PROGRESS`, không route; tồn kho không rõ → `CHỜ XÁC MINH`, không route.

## 0.4 Assumptions dùng để tạo draft

Các assumption dưới đây chỉ giúp tài liệu đủ cụ thể để review; chúng chưa phải quyết định nghiệp vụ chính thức.

- `ASSUMPTION A-01` Prototype dùng fixture lưu sẵn, ID tiền tố `SIM-`, state cục bộ/in-memory và không có tích hợp hệ thống thật.
- `ASSUMPTION A-02` Timestamp dùng ISO 8601 với timezone; cách hiển thị theo `Asia/Ho_Chi_Minh` để audit nhất quán trong demo.
- `ASSUMPTION A-03` Một role BQL tổng quát được dùng trong prototype; chưa tách các cấp phê duyệt nội bộ.
- `ASSUMPTION A-06` Không dùng ngưỡng số lượng để tự chuyển `EXCEPTION` trong v0.3 vì `OD-04` chưa được chốt; explained material variance là non-blocking warning duy nhất theo `OD-03`.
- `ASSUMPTION A-08` Agent tự gắn `READY_FOR_REVIEW` chỉ khi deterministic readiness gate pass; đây không phải thao tác phê duyệt mang tính quyết định của con người.
- `ASSUMPTION A-09` Evidence trong prototype là metadata/placeholder hoặc nội dung mô phỏng; không upload, phân tích ảnh hoặc computer vision.
- `ASSUMPTION A-10` Mọi thay đổi của nhân sự thực hiện đối với execution data cũng tạo audit event; raw resident data không có action edit.

## 0.5 Decision register

| ID | Quyết định | Kết quả/status | Owner/approver |
|---|---|---|---|
| OD-01 | Required fields và confirmation gate | `CLOSED` — ba raw fields trước classification; Agent proposal service/type; BPTN confirmation + location trước draft; priority optional | TV1 / Product approver proxy |
| OD-02 | Minimum evidence và rule ảnh | `CLOSED` — checklist tách gate; evidence theo use case; không bắt buộc ảnh | TV1 / Product approver proxy |
| OD-03 | Blocking/non-blocking catalog | `CLOSED` — catalog được duyệt; explained material variance là warning không chặn duy nhất; action ngoài quyền reject + audit | TV1 + TV4 |
| OD-04 | Ngưỡng chênh lệch vật tư, nếu có | `OPEN · NON-BLOCKING FOR MVP` — v0.3 không tự dùng threshold | Product approver proxy + TV1 |
| OD-05 | BQL sub-role authority | `OPEN · PILOT ONLY` — prototype dùng role BQL chung | Business owner tương lai |
| OD-06 | Mức ưu tiên và SLA | `OPEN · PILOT ONLY`; priority optional trong MVP | Business owner tương lai |
| OD-07 | Taxonomy reason cho chỉnh sửa hành chính | `OPEN · UAT`; schema vẫn bắt buộc reason | TV1 |
| OD-09 | Owner và thẩm quyền sign-off | `CLOSED · FROZEN` — Product approver/proxy và sign-off owner: Cao Văn Trường; evidence: `OD-09 Sign-off Record`; freeze date 28/09/2026 | Cao Văn Trường |
| OD-10 | Asset/duty lookup và team-only routing | `CLOSED` — asset chỉ bắt buộc cho kỹ thuật; duty bắt buộc cho cả hai; không gán nhân viên | TV1 / Product approver proxy |
| OD-11 | Draft khi route chưa hợp lệ | `CLOSED` — vẫn tạo draft; state/reason theo asset, stock hoặc duty; không READY | TV1 / Product approver proxy |
| OD-12 | Dataset/demo baseline | `CLOSED` — 12 ticket, 4 demo flow, 8 regression cases | TV1 + TV4 |

## 0.6 Glossary

| Thuật ngữ | Định nghĩa trong MVP |
|---|---|
| BPTN | Bộ phận tiếp nhận; nhận ticket và chỉ chuẩn hóa các trường hành chính được cấu hình. |
| BQL | Ban Quản lý; người có thẩm quyền xem xét hồ sơ, xử lý ngoại lệ và ra quyết định nghiệp vụ cuối cùng ngoài quyền Agent. |
| Agent | Thành phần AI/rule hỗ trợ đọc form chuẩn hóa, phân loại, tạo đề xuất/draft, kiểm tra hồ sơ, giải thích và routing trong giới hạn quyền. |
| Work order draft | Bản nháp/mô phỏng có cấu trúc, không phải lệnh công việc thật và không được ghi vào hệ thống vận hành. |
| Playbook | Bộ rule mô phỏng theo use case gồm trigger, required fields, checklist, material/evidence requirement, exception và exit criteria. |
| Blocking exception | Điều kiện ngăn case đạt `READY_FOR_REVIEW`; có thể đưa case vào `CHỜ XÁC MINH` hoặc `EXCEPTION` tùy loại. |
| Non-blocking warning | Vấn đề phải hiển thị và truy xuất được nhưng không ngăn `READY_FOR_REVIEW` nếu toàn bộ gate bắt buộc khác đã pass. |
| `CHỜ XÁC MINH` | State dùng khi thiếu, không rõ hoặc chưa đủ dữ kiện cần thiết; Agent không được suy đoán hay tự điền. |
| `READY_FOR_REVIEW` | Hồ sơ đã pass readiness gate và sẵn sàng chuyển BQL xem xét; không đồng nghĩa nghiệm thu/hoàn tất/đóng ticket/phê duyệt vật tư. |
| `EXCEPTION` | State cho case có rủi ro cao, tranh chấp/nhạy cảm hoặc mâu thuẫn đã xác định, cần BQL xử lý. `ACTION_OUT_OF_AUTHORITY` chỉ bị từ chối/audit và không tự tạo business exception. |

### Phase 0 consistency gate

**PASS.** Không có mâu thuẫn P0 chưa được xử lý. Asset, duty, stock gate và team-only routing chỉ là policy mô phỏng; OD-09 đã đóng và baseline v0.3 đã `FROZEN` ngày 28/09/2026.

---

# Phase 1 — Problem Statement

## 1. Background

MaintenanceOps Agent là prototype hỗ trợ BQL xử lý ticket bảo trì sau khi cư dân đã gửi phản ánh qua app/form hiện có. Trong một tuần, MVP cần chứng minh Agent có thể xử lý hai nhóm vệ sinh và kỹ thuật: phân loại, tra Playbook Registry, tra asset khi là kỹ thuật, kiểm tra vật tư và duty, tạo work order draft, đề xuất route cho team mô phỏng, đối soát hồ sơ rồi chuyển đúng case cho BQL mà không vượt quyền.

MVP không có dữ liệu hoặc workflow vận hành thật. Vì vậy, tài liệu chỉ xác định target workflow mô phỏng và các giả thuyết cần kiểm chứng; không đưa ra kết luận về hiện trạng hay hiệu quả của Vinhomes.

## 2. Known current boundary

### Đã biết

- Cư dân đã gửi phản ánh qua app/form chuẩn hóa.
- BPTN là điểm tiếp nhận và chuẩn hóa trường hành chính.
- Nội dung phản ánh và bằng chứng gốc phải được giữ nguyên.

### Chưa được xác minh

- Quy trình xử lý nội bộ thực tế sau BPTN.
- Cách phân công, nghiệm thu, đóng ticket và escalation thực tế.
- Required fields, evidence, định mức vật tư, threshold, SLA và mức ưu tiên chính thức.
- Thời gian xử lý, tỷ lệ lỗi, tỷ lệ thiếu dữ liệu hoặc bất kỳ KPI vận hành nào.

## 3. Target workflow mô phỏng

`Ticket từ app/form → BPTN xác nhận thông tin hành chính → Agent phân loại ticket → Agent tra Playbook Registry → nếu kỹ thuật, tra Asset Catalog → xác định vật tư và kiểm tra tồn kho mô phỏng → tra team đang trực → tạo WorkOrderDraft và đề xuất route cho team → nhân sự thực hiện checklist/cập nhật vật tư/ghi chú/bằng chứng → Agent đối soát hồ sơ → READY_FOR_REVIEW / IN_PROGRESS / CHỜ XÁC MINH / EXCEPTION → BQL xem xét`

Việc tiếp nhận/tạo draft là event/action, không tạo thêm state ngoài bốn state đã khóa.

## 4. Người dùng và actor liên quan

- **BPTN:** cần xem nguyên bản ticket và chuẩn hóa đúng các trường hành chính được phép.
- **Nhân sự thực hiện:** cần biết checklist, material/evidence requirement và cập nhật execution data.
- **BQL:** cần nhận một package có lý do, nguồn, trạng thái gate và audit để xem xét hoặc xử lý ngoại lệ.
- **Agent:** actor hệ thống bị ràng buộc bởi schema, rule an toàn và permission.
- **Cư dân:** nguồn của phản ánh; không phải người dùng của prototype, không có chatbot hoặc messaging trong scope.
- **Nhóm dự án TV1–TV4:** xây/review prototype; không phải actor nghiệp vụ.

## 5. Pain-point hypotheses

Các điểm dưới đây là giả thuyết, không phải kết luận từ dữ liệu vận hành:

- `HYPOTHESIS PH-01` Hồ sơ có thể thiếu hoặc mâu thuẫn dữ kiện cần thiết, làm tăng nhu cầu xác minh trước khi xử lý tiếp.
- `HYPOTHESIS PH-02` Việc chọn playbook và cấu trúc hóa work order draft có thể không nhất quán nếu không có schema/rule chung.
- `HYPOTHESIS PH-03` BQL có thể phải kiểm tra thủ công nhiều thành phần rời rạc để biết hồ sơ đã đủ checklist, vật tư và evidence hay chưa.
- `HYPOTHESIS PH-04` Chênh lệch giữa planned/norm/issued/used có thể khó nhìn thấy hoặc khó giải thích nếu không có đối soát thống nhất.
- `HYPOTHESIS PH-05` Nếu không có permission và safety gate rõ, Agent có nguy cơ tạo output bị hiểu là nghiệm thu, chẩn đoán, đóng ticket hoặc phê duyệt vật tư.
- `HYPOTHESIS PH-06` Nếu thiếu audit, thay đổi trường hành chính hoặc execution data có thể khó truy vết trong quá trình review.

## 6. Problem statement đầy đủ

Trong phạm vi prototype mô phỏng, BQL cần một cách nhất quán và có thể truy vết để biến ticket đã được BPTN xác nhận thông tin hành chính thành một hồ sơ sẵn sàng xem xét hoặc một case dừng đúng lý do. Giải pháp phải kiểm tra playbook, asset kỹ thuật, vật tư/tồn kho, duty/capacity, route, checklist và evidence; giữ nguyên dữ liệu cư dân; giải thích rule; và chặn mọi hành động vượt quyền. MVP chỉ kiểm chứng tính khả thi trên 12 synthetic tickets và bốn demo flow, không chứng minh pain point hay hiệu quả vận hành thực tế.

## 7. Problem statement một câu

**BQL cần một prototype có thể tạo và kiểm tra hồ sơ bảo trì mô phỏng một cách nhất quán, truy vết được và không vượt quyền, để mỗi case đủ điều kiện được chuyển sang BQL xem xét hoặc dừng đúng tại bước xác minh/ngoại lệ.**

## 8. Desired outcome

- Bốn demo flow chạy end-to-end từ ticket mô phỏng tới đúng state và route status.
- Mỗi case `READY_FOR_REVIEW` tạo ra một review package đủ gate và giải thích được.
- Mỗi case thiếu dữ liệu hoặc rủi ro dừng đúng, chỉ rõ lý do, nguồn và actor có thẩm quyền.
- Không có thay đổi dữ liệu gốc hoặc Agent action vượt quyền.
- Có test oracle trên 12 tickets để Product/BA, AI/Data, UX/UI và Integration/QA cùng kiểm thử.

## 9. Product hypothesis

Nếu Agent kết hợp deterministic safety/permission rules với structured output theo playbook mô phỏng, thì trên synthetic dataset Agent có thể tạo một package nhất quán cho BQL, phát hiện hồ sơ thiếu/rủi ro và không vượt quyền. Giả thuyết này chỉ được coi là đạt cho prototype khi pass acceptance criteria nội bộ; chưa chứng minh lợi ích vận hành thật.

## 10. Value unit

**Một case sẵn sàng để BQL xem xét**, gồm tối thiểu:

1. Playbook và phiên bản.
2. Work order draft liên kết ticket.
3. Required fields đủ; kỹ thuật có asset match duy nhất.
4. Route hợp lệ tới team mô phỏng đang trực và còn khả năng nhận ticket.
5. Evidence tối thiểu đủ theo playbook.
6. Checklist không còn `PENDING`.
7. Vật tư đã đối soát; stock gate trước route đã pass.
8. Không còn blocking exception.
9. Warning và audit/reason vẫn hiển thị để truy vết.

## 11. Non-goals

- Không thay thế hoặc khẳng định workflow vận hành thật.
- Không xây chatbot cư dân, booking tiện ích, IoT, computer vision hoặc bảo trì dự đoán.
- Không tích hợp hệ thống thật hoặc tạo work order thật.
- Không gửi tin nhắn/yêu cầu ảnh từ cư dân.
- Không nghiệm thu, đóng ticket, xác nhận chất lượng kỹ thuật, phê duyệt/điều chỉnh vật tư.
- Không làm báo giá, hóa đơn, thanh toán, thuê ngoài, gán nhân viên/tối ưu lịch thực tế hoặc quản lý tồn kho đầy đủ.
- Không đo hoặc cam kết SLA/KPI vận hành thật.

## 12. Assumptions áp dụng cho Problem Statement

- Áp dụng các assumption còn hiệu lực: `A-01`, `A-02`, `A-03`, `A-06`, `A-08`, `A-09`, `A-10`.
- Các pain point `PH-01` đến `PH-06` phải được xác minh bằng shadow mode; không được dùng làm sales/impact claim.

## 13. Open decisions áp dụng

- `OD-01`, `OD-02`, `OD-03`, `OD-09`, `OD-10`, `OD-11` và `OD-12` đã `CLOSED` cho policy mô phỏng.
- Baseline `MaintenanceOps MVP v0.3` đã `FROZEN` ngày 28/09/2026 theo `OD-09 Sign-off Record`; thay đổi phạm vi sau freeze phải qua change control.
- `OD-04`, `OD-05`, `OD-06`, `OD-07` vẫn mở nhưng không chặn prototype build theo phạm vi v0.3.

## 14. Risk nếu giải sai bài toán

- Prototype tối ưu một target flow không phản ánh nhu cầu thực tế và tạo kỳ vọng sai.
- Output mô phỏng bị hiểu là quy trình, định mức hoặc hiệu quả thật của Vinhomes.
- Agent vượt quyền qua ngôn ngữ, state hoặc CTA dù backend rule có cảnh báo.
- Rule quá chặt làm case hợp lệ bị dừng; rule quá lỏng làm case thiếu/rủi ro đạt `READY_FOR_REVIEW`.
- Evidence requirement chung hóa sai, đặc biệt biến ảnh thành điều kiện bắt buộc.
- Material variance bị trình bày như vi phạm hoặc phê duyệt thay vì chỉ phát hiện/giải thích.
- Vai trò BPTN và BQL bị gộp, làm sai quyền chỉnh sửa và quyết định cuối.

## 15. Tín hiệu cần thu thập trong shadow mode

Chỉ thu thập sau khi có phê duyệt governance và không để Agent thực hiện quyết định thật:

- Tỷ lệ ticket có từng trường bắt buộc, theo loại ticket.
- Những trường thường thiếu, không rõ hoặc mâu thuẫn; nguồn phát hiện.
- Phân bố playbook do con người chọn và mức đồng thuận với đề xuất Agent.
- Lý do BPTN sửa từng trường hành chính và tần suất sửa.
- Các bước con người thực hiện để tạo/check work order, checklist, evidence và material.
- Loại evidence thực sự được BQL dùng để review; trường hợp ảnh thực sự cần thiết.
- Các kiểu chênh lệch vật tư và cách người có thẩm quyền xử lý; không suy ngưỡng từ dữ liệu ít.
- Tỷ lệ/loại case cần `CHỜ XÁC MINH`, `EXCEPTION`, hoặc có non-blocking warning.
- Lý do BQL đồng ý, yêu cầu bổ sung hoặc bác đề xuất Agent.
- Số lần Agent đề xuất hành động ngoài quyền hoặc giải thích không đủ.
- Thời gian theo từng bước chỉ dùng để mô tả baseline sau khi dữ liệu đủ tin cậy; không dùng số mô phỏng làm KPI.

### Phase 1 consistency gate

**PASS.** Problem Statement giữ rõ known/unknown, pain point dưới dạng hypothesis, không có KPI giả, không mở rộng use case, và thống nhất với Phase 0 về actor, state, quyền hạn, evidence, material và synthetic boundary.

## Deferred / Future Scope

- CSKH chỉ thuộc discovery/backlog tương lai; không có use case, playbook, schema, validator, acceptance criteria, demo flow hoặc test case trong MVP hiện hành.
