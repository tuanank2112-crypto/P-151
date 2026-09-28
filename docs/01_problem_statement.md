# MaintenanceOps Agent — Problem Statement

> **Phân loại tài liệu:** DRAFT · Dữ liệu và quy trình mô phỏng  
> **Version:** 0.3
> **Ngày:** 2026-09-27  
> **Owner:** TV1 — Product / BA / Process  
> **Source of truth:** Prompt MVP MaintenanceOps Agent ngày 2026-09-27 và các quyết định đã khóa trong tài liệu này
> **Lưu ý:** Tài liệu này không mô tả quy trình, SLA, định mức, tồn kho hay hiệu quả vận hành thực tế của Vinhomes.

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1 | 2026-09-27 | Tạo mới Phase 0 Source Audit và Phase 1 Problem Statement từ source of truth | DRAFT |
| 0.2 | 2026-09-27 | Ghi nhận quyết định OD-01/02/03/08 và cơ chế sign-off OD-09; cập nhật workflow proposal → BPTN confirmation | DRAFT · Chờ tên/sign-off approver |
| 0.3 | 2026-09-27 | Re-baseline MVP còn hai nhóm dịch vụ; bổ sung asset, duty, stock gate, team-only routing, dataset 12 ticket và 4 demo flow | DRAFT · Chờ tên/sign-off approver |

---

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
| OD-09 | Owner và thẩm quyền sign-off | `PARTIALLY CLOSED` — role/deadline đã chốt; tên Product approver/proxy và bằng chứng sign-off còn `TBD` | TV1; `[Tên nhóm trưởng / Product Owner]` |
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

**PASS.** Không có mâu thuẫn P0 chưa được xử lý. Asset, duty, stock gate và team-only routing chỉ là policy mô phỏng; OD-09 còn thiếu tên và bằng chứng sign-off.

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

- `OD-01`, `OD-02`, `OD-03`, `OD-10`, `OD-11` và `OD-12` đã `CLOSED` cho policy mô phỏng.
- `OD-09` còn thiếu tên Product approver/proxy và bằng chứng sign-off; đây là blocker duy nhất để đổi trạng thái tài liệu sang approved build baseline.
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
