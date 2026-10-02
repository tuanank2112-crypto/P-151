# MaintenanceOps Agent — Playbook v1

> **Document status:** DRAFT · CHANGE CONTROL
> **Version:** 1.2-candidate
> **Ngày cập nhật:** 2026-10-01
> **MVP baseline:** v0.3/Playbook v1.1 đã freeze; v0.6/Playbook v1.2 candidate theo `CR-BPTN-03`
> **Freeze history:** v1.1 — 28/09/2026; v1.2 chưa freeze
> **Owner duy nhất:** TV1 — Product / BA / Process  
> **Business scope:** Hai playbook mô phỏng `PB-CLN-01`, `PB-TEC-01`
> **Data classification:** `SIMULATED` — không phải quy trình, dữ liệu, SLA, định mức, tồn kho hoặc hướng dẫn vận hành thực tế của Vinhomes.

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.9 | 2026-09-27 | Tạo baseline playbook theo template chung; khóa Field Matrix, rule ID, state oracle, checklist hồ sơ, evidence/material gate và acceptance criteria | DRAFT FOR CROSS-REVIEW |
| 1.0 | 2026-09-27 | Áp dụng `GAP-B-01..09`; cross-review Data Contract; đồng bộ canonical field/rule/checklist/evidence IDs, state outcome, field owner và machine-checkable READY gates | FINAL |
| 1.1 | 2026-09-27 | Chỉ giữ CLN/TEC; thêm asset/duty/stock gate, team-only routing, draft-without-route và route readiness | FINAL |
| 1.1-freeze | 2026-09-28 | Đóng OD-09 và đưa Playbook v1.1 vào frozen baseline MaintenanceOps MVP v0.3 | FROZEN |
| 1.2-candidate | 2026-10-01 | Bỏ team/duty; thêm safety, priority, merge, department routing, ON_HOLD, ảnh bắt buộc và BQL close/cancel | DRAFT · CHỜ PHÊ DUYỆT CR-03 |

---

# Active Playbook Registry v1.2 candidate

## 1. Registry boundary

Registry read-only chỉ có:

- `PB-CLN-01` — Vệ sinh khu vực chung → `SIM-DEPT-CLN-01`.
- `PB-TEC-01` — Đèn chiếu sáng khu vực chung → `SIM-DEPT-TEC-01`.

Registry không phải CRUD feature. Không chứa CSKH, team/duty/capacity, lịch trực hoặc assignee. Tất cả catalog/fixture là synthetic và read-only.

## 2. Common pipeline rules

1. Validate raw/minimum data; raw text và ảnh bất biến.
2. Chạy safety cho mọi ticket trước khi chọn playbook.
3. Kiểm tra duplicate và đưa BPTN/BQL xử lý theo owner.
4. Đề xuất playbook, phòng ban và priority; BPTN chỉ review khi có blocker.
5. Tra asset cho kỹ thuật; vệ sinh `NOT_APPLICABLE`.
6. Lập vật tư và kiểm tra stock mô phỏng.
7. Chỉ khi `can_route=true`: tạo draft, set `department_id`, chuyển `ROUTED`.
8. Phòng ban nhận → `IN_PROGRESS`, thực hiện checklist và nộp hồ sơ.
9. Agent kiểm tra readiness; BQL close/rework/cancel.

## 3. Common safety layer

- Bậc 1 gồm tín hiệu rõ như khói/lửa, mùi khét, tia lửa, dây điện hở, giật điện, quá nóng/chảy nhựa, nước vào thiết bị điện, người bị thương/mắc kẹt, mùi gas, vật sắp rơi, hóa chất/kim tiêm/máu/chất thải y tế; và tổ hợp đèn nhấp nháy với nóng/mùi/âm thanh bất thường.
- Bậc 1 → `VERIFYING + EMERGENCY_PENDING_BQL`; không tạo draft/department.
- Bậc 2 gồm diễn đạt nghi ngờ, sự việc đã qua, từ đa nghĩa hoặc âm thanh bất thường chưa đủ kết luận → `SAFETY_REVIEW_REQUIRED`.
- BPTN chỉ có ba action cho Bậc 2; mọi action có audit, xác nhận an toàn bắt buộc lý do.
- Phủ định như “không có mùi khét” không kích hoạt. “Bóng/đèn bị cháy, hỏng, chập chờn, nhấp nháy, nổ bóng” đứng một mình đi flow thường theo D-04 candidate; khi có khói/lửa/mùi/nóng/bị giật/bị thương thì lên Bậc 1.
- Rule đọc cả có dấu/không dấu. LLM chỉ được nâng mức.

## 4. Common priority rules

- `HIGH`: sự cố đèn ở lối đi chung, sảnh, cầu thang, hầm, lối thoát nhưng chưa có dấu hiệu emergency; hoặc vệ sinh cản trở/trơn trượt lối đi.
- `MEDIUM`: ticket kỹ thuật/vệ sinh thông thường; mặc định khi chưa đủ vị trí để phân biệt.
- `LOW`: vệ sinh thông thường, chưa ảnh hưởng trực tiếp đến sử dụng khu vực chung.
- Tăng nặng theo duplicate/vulnerable-person rule trong CR-03. BPTN/BQL override phải có reason/audit.

## 5. `PB-CLN-01` — Vệ sinh khu vực chung

### Trigger

Phản ánh rác, bẩn, tràn đổ hoặc yêu cầu vệ sinh trong khu vực chung, không thuộc nhánh safety emergency.

### Asset, material và route

- Asset: `NOT_APPLICABLE`.
- Department: `SIM-DEPT-CLN-01`.
- Material plan/norm/stock dùng catalog synthetic. Biết thiếu → `ON_HOLD + WAITING_MATERIAL`; không draft/route.
- Material `SIM-MAT-CLEAN-01` phải dùng cùng một đơn vị và số lượng giữa planned và norm cho fixture happy path; mọi variance phải là case có chủ đích, có reason.
- `UNKNOWN` stock xử lý theo D-05 candidate.

### Checklist và hồ sơ

- Xác nhận khu vực; thực hiện vệ sinh; kiểm tra khu vực sau xử lý.
- Result note không rỗng.
- Material actual hoặc `NOT_APPLICABLE`.
- Ít nhất một ảnh mô phỏng.
- Material reconciliation hoàn tất.

### Exception/safety examples

Hóa chất đổ, kim tiêm, máu, chất thải y tế hoặc chất lạ kèm dấu hiệu nguy hại không đi thẳng vào checklist; chuyển safety branch theo §3.

## 6. `PB-TEC-01` — Đèn khu vực chung

### Trigger

Đèn khu vực chung không hoạt động/chập chờn/hỏng, không có tín hiệu emergency sau safety layer.

### Asset, material và route

- Department: `SIM-DEPT-TEC-01`.
- Cần đúng một `LIGHTING` asset hoặc quyết định `ONSITE_BY_BPTN` có reason/audit.
- Không tìm thấy/nhiều asset → `VERIFYING + ASSET_UNCLEAR`; Agent không đoán.
- Lập planned material và kiểm stock. Biết thiếu → `ON_HOLD`, chưa route; kho nhập đủ → chạy lại toàn bộ gate.
- Chỉ tạo draft khi asset, review, department, risk và material gate cho phép.

### Checklist và hồ sơ

- Xác nhận asset/khu vực; kiểm tra an toàn theo checklist mô phỏng; xử lý theo playbook; kiểm tra kết quả.
- Result note, material actual/N-A, ít nhất một ảnh và reconciliation là bắt buộc.
- Playbook không phải hướng dẫn sửa điện thật và Agent không chẩn đoán/hướng dẫn xử lý nguy hiểm.

### Safety examples

Mùi khét, tia lửa, dây điện hở, khói/lửa, giật điện, quá nóng/chảy nhựa hoặc nước vào thiết bị điện → Bậc 1. Câu nghi ngờ hoặc đa nghĩa chưa có tín hiệu đi kèm → Bậc 2 hoặc flow thường theo bẫy D-04/CR-03.

## 7. Department execution rules

- Phòng ban chỉ bấm nhận ticket; chia người nội bộ ngoài hệ thống.
- Trả sai phòng ban trước khi làm cần reason; lần thứ hai alert BQL.
- Sau khi bắt đầu, chỉ báo BQL xem; không tự route lại. Dữ liệu thực hiện được giữ.
- Thiếu vật tư sau khi nhận → `ON_HOLD + WAITING_MATERIAL`; không làm giả completion.

## 8. Readiness and BQL rules

`READY_FOR_REVIEW` cần đủ checklist, result note, material actual/N-A, ít nhất một ảnh, material reconciliation và không còn blocker mở. BQL duyệt → `CLOSED`; rework → `IN_PROGRESS + REWORK`, reset checklist, tăng count; từ ba lần escalate. Chỉ BQL cancel với reason/audit ở state được phép.

Không có reopen. Rating một lần sau `CLOSED` không tác động state/priority/department.

## 9. Removed rules

- Duty lookup, team capacity, `routing_team_id`, `SIM-TEAM-*`, `SIM-DUTY-*`.
- WorkOrderDraft không có route.
- Bốn state v0.3 và EXCEPTION như top-level state.
- Evidence ảnh tùy chọn.
- Agent/BPTN đóng ticket hoặc gán nhân viên.

## 10. Candidate acceptance

- Hai playbook dùng chung safety/priority/duplicate/permission layer.
- Mọi route đích là `SIM-DEPT-*`, không phải team/person.
- CLN asset N/A; TEC asset exact hoặc onsite-by-BPTN.
- Known material shortage luôn chặn route; restock reruns all gates.
- `assignee_id` luôn null.
- Readiness và quyền close/cancel khớp Data Contract v1.2 candidate.
- Chi tiết test theo AC-01–AC-18; chưa frozen cho đến khi CR-03 được duyệt và D-09 về `OUT_OF_HOURS` được chốt.

---

# Historical appendix — Playbook v1.1

> Nội dung dưới đây được giữ để audit freeze v0.3. Duty/team route, draft-without-route, bốn state và evidence không bắt buộc không còn active trong v1.2 candidate.

# 1. Mục đích và ranh giới

Tài liệu này là nguồn nghiệp vụ v1 cho đội AI/Data, UX/UI và Integration/QA xây prototype mô phỏng. Tài liệu chỉ xác định dữ liệu đầu vào, rule, output, gate và kết quả state có thể kiểm thử; không phải SOP hiện trường và không cấp quyền vận hành cho Agent.

Phạm vi chỉ gồm:

1. `PB-CLN-01` — Khu vực chung cần vệ sinh.
2. `PB-TEC-01` — Đèn khu vực chung không hoạt động.
Nội dung ngoài hai trigger trên không được Agent tự tạo playbook; kết quả là `CHỜ XÁC MINH` với lý do không match duy nhất một playbook v1.1.

Fixture validation dùng 12 ticket mô phỏng: 6 vệ sinh, 6 kỹ thuật. Bốn demo flow chính gồm vệ sinh thành công; vệ sinh không có team trực; kỹ thuật asset match + vật tư đủ + team trực; kỹ thuật asset không tìm thấy hoặc thiếu vật tư. Tám ticket còn lại dùng regression.

## 1.1 Quy ước v1

- Mọi fixture, rule, checklist, material, evidence, work order draft và kết quả đều có nhãn `SIMULATED`.
- State canonical của v1.1: `IN_PROGRESS`, `CHỜ XÁC MINH`, `READY_FOR_REVIEW`, `EXCEPTION`.
- Permission denial canonical của v1: `ACTION_DENIED`. Đây là action result, không phải ticket state; ticket state không đổi và không tự tạo business exception.
- `UNKNOWN`, chuỗi rỗng hoặc giá trị chỉ có khoảng trắng được phép lưu để phản ánh input nhưng không thỏa required gate.
- Checklist trong tài liệu là checklist hoàn thiện hồ sơ mô phỏng, không phải chỉ dẫn kỹ thuật hoặc quy trình hiện trường.
- `READY_FOR_REVIEW` chỉ có nghĩa hồ sơ đủ điều kiện để BQL xem xét; không có nghĩa nghiệm thu, hoàn tất, đóng ticket hoặc phê duyệt vật tư.
- Playbook Registry, Asset Catalog và DutyAvailability là cấu hình/fixture nội bộ read-only; không có CRUD riêng.
- Agent chỉ route ở cấp `SIM-TEAM-*`; `assignment_mode=SIMULATED_TEAM_ROUTE`, `assignment_scope=TEAM_ONLY`, `assignee_id=null`.
- Không có rule nào được dùng model confidence làm điều kiện duy nhất. Schema, deterministic safety rule, permission và state gate có ưu tiên cao hơn model output.

# 2. Actor và quyền sở hữu dữ liệu

| Actor/layer | Được làm trong playbook | Không được làm |
|---|---|---|
| BPTN | Xem raw ticket; xác nhận/chỉnh `service_category_normalized`, `ticket_type_normalized`; nhập/xác nhận `location_normalized`; chỉnh field hành chính trong allowlist; ghi reason | Sửa raw resident content/evidence; suy đoán dữ kiện; quyết định exception; tạo/hoàn tất work order thật |
| Agent | Validate; đề xuất service/type/playbook; lookup asset/duty/stock; tạo work order draft; đề xuất team route; đối soát; đánh giá gate; routing exception; tạo reason/audit | Sửa nguồn; gán nhân viên; tự hoàn tất checklist; nghiệm thu/đóng; xác nhận chất lượng; duyệt/điều chỉnh vật tư; tự xử lý rủi ro cao |
| Nhân sự thực hiện | Cập nhật checklist, material, evidence, processing/result note và tiến độ mô phỏng | Sửa nguồn cư dân; tự thay rule/state; giải quyết exception thay BQL |
| BQL | Xem `READY_FOR_REVIEW`; xử lý `EXCEPTION`; yêu cầu xác minh/bổ sung; ghi resolution thuộc thẩm quyền người | Yêu cầu Agent bỏ qua safety/permission gate; dùng output mô phỏng như phê duyệt quy trình thật |
| System | Lưu fixture, enforce schema/permission/state, tạo ID/timestamp/audit | Tự bổ sung fact nghiệp vụ không có trong nguồn |

# 3. Template chung và gate bắt buộc

## 3.1 Chuỗi xử lý

1. Ingest raw ticket bất biến.
2. Validate ba field trước classification.
3. Nếu hợp lệ, Agent đề xuất service/type/playbook kèm rule, reason và source reference.
4. BPTN xác nhận/chỉnh service/type và xác nhận location; mọi thay đổi được audit.
5. Agent chạy exception rule ưu tiên trước standard draft.
6. Nếu kỹ thuật, Agent tra Asset Catalog; cả hai playbook kiểm tra vật tư/tồn kho và DutyAvailability.
7. Khi confirmation/location pass và không high-risk, Agent tạo draft; asset/stock/duty chưa pass vẫn cho phép draft nhưng không route.
8. Agent chỉ đề xuất route tới team khi asset gate (nếu áp dụng), stock và duty/capacity pass.
9. Nhân sự thực hiện cập nhật checklist, material và evidence.
10. Agent đối soát planned/norm/issued/used, route, checklist/evidence và readiness.
11. Agent đưa case về đúng một trong bốn state, kèm rule, reason, source và audit.

## 3.2 Required fields theo gate

| Gate | Field/điều kiện bắt buộc | Owner/source | Nếu không đạt |
|---|---|---|---|
| `GATE-CLASSIFICATION` | `ticket_id`, `created_at`, `original_description` hợp lệ | System ingest / resident source; immutable | `CHỜ XÁC MINH`; không tự điền, không tạo draft |
| `GATE-PROPOSAL` | Một `playbook_id` trong allowlist; Agent proposal có service/type, matched rule, reason, source reference | Agent | Ambiguous/outside v1.1 → `CHỜ XÁC MINH` |
| `GATE-PRE-DRAFT` | Service/type `CONFIRMED` bởi BPTN; `location_normalized` hợp lệ; không có blocking exception | BPTN + Agent safety validator | `CHỜ XÁC MINH` nếu thiếu confirmation/location; `EXCEPTION` nếu rule exception active |
| `GATE-WORK-ORDER` | Work order draft schema-valid, linked, `SIMULATED`, idempotent | Agent/System | Giữ `IN_PROGRESS` khi lỗi tạo/schema; fail closed, không partial write |
| `GATE-ASSET` | Kỹ thuật có đúng một `LIGHTING` asset match; vệ sinh `NOT_APPLICABLE` | Agent + Asset Catalog | Zero/multiple → `CHỜ XÁC MINH`; draft asset unresolved; không route |
| `GATE-STOCK` | Planned/norm và stock mô phỏng đủ hoặc explicit `NOT_APPLICABLE` | Agent validator | Thiếu → `IN_PROGRESS`; unknown → `CHỜ XÁC MINH`; draft tồn tại, không route |
| `GATE-DUTY` | Team phù hợp đang trực và còn capacity | Agent + DutyAvailability | No team/capacity → `IN_PROGRESS`; unknown → `CHỜ XÁC MINH`; draft tồn tại |
| `GATE-ROUTE` | `route_status=ROUTED`, team-only constants, `assignee_id=null` | Agent deterministic router | Invalid route không phải giao việc và luôn chặn READY |
| `GATE-CHECKLIST` | Mọi required item là `COMPLETED`; không có item `PENDING` | Nhân sự thực hiện; Agent validate | Giữ `IN_PROGRESS` |
| `GATE-EVIDENCE` | Mọi minimum evidence requirement của playbook là `PRESENT` và hợp lệ | Nhân sự thực hiện; Agent validate | Known missing/wrong type → `IN_PROGRESS`; requirement/source không xác định → `CHỜ XÁC MINH` |
| `GATE-MATERIAL` | `RECONCILED` hoặc toàn gate `N/A` | Nhân sự thực hiện + Agent | Chưa nhập/chưa reconcile → `IN_PROGRESS`; variance thiếu reason → `CHỜ XÁC MINH` |
| `GATE-BLOCKER` | Không có blocking exception active | Agent deterministic rules | `EXCEPTION` hoặc `CHỜ XÁC MINH` đúng theo rule |
| `GATE-READY` | Tám gate: playbook, draft, required/asset, route, checklist, evidence, material, no blocker | Agent deterministic aggregator | Pass → `READY_FOR_REVIEW`; fail → state do gate lỗi quy định |

## 3.3 Evidence validity chung

Một evidence record chỉ `PRESENT` khi đồng thời:

- `evidence_type` đúng requirement của playbook;
- liên kết đúng `ticket_id`, `work_order_draft_id` và `requirement_id`;
- nội dung hoặc metadata không rỗng;
- có `submitted_by`, `submitted_at`;
- `readability_status=READABLE`, hoặc `NOT_APPLICABLE` đối với structured text/metadata đã pass schema;
- có `synthetic=true`.

`UNREADABLE`, sai type hoặc sai link không pass. Ảnh là optional trong cả hai playbook v1.1 và không được dùng để tự xác nhận chất lượng.

## 3.4 Material validity chung

- Trước route, Agent so planned/norm với tồn kho mô phỏng. `INSUFFICIENT` → `IN_PROGRESS`/`MATERIAL_SHORTAGE`; `UNKNOWN` → `CHỜ XÁC MINH`/`MATERIAL_STOCK_UNKNOWN`; draft vẫn tồn tại và không route.
- Toàn material gate có thể là `N/A`; khi đó không có `MaterialLine`.
- Nếu có `MaterialLine`, `planned_qty`, `issued_qty`, `used_qty` là số không âm.
- `norm_qty` là số không âm kèm `norm_label=SYNTHETIC`, hoặc không có giá trị số kèm `norm_label=N_A` khi định mức mô phỏng chưa được cấu hình.
- Chỉ chạy ba comparison: `PLANNED_VS_NORM`, `ISSUED_VS_PLANNED`, `USED_VS_ISSUED`. Comparison đầu trả `N/A` khi `norm_label=N_A`.
- Bất kỳ variance nào trong comparison áp dụng phải có `variance_reason` không rỗng. Thiếu reason → `CHỜ XÁC MINH`.
- Variance có reason tạo warning duy nhất `EXPLAINED_MATERIAL_VARIANCE`; warning không chặn READY nếu mọi gate khác pass.
- Sau thực hiện Agent đối soát bốn mức planned/norm/issued/used bằng đúng ba comparison. Agent chỉ phát hiện/mô tả; không phê duyệt xuất, điều chỉnh tồn kho, duyệt sai lệch hoặc kết luận vi phạm.

## 3.5 Audit và permission chung

Mỗi edit, confirmation, state transition, Agent decision và permission rejection phải tạo audit event. Edit event tối thiểu có:

- `actor_id`
- `actor_role`
- `timestamp`
- `field_name`
- `old_value`
- `new_value`
- `reason`

Audit bổ sung `event_id`, `ticket_id`, target entity/action và `rule_id` khi áp dụng. Nếu audit write thất bại, edit/transition không commit. Mọi Agent action ngoài quyền trả `ACTION_DENIED`, ghi audit, không có side effect, không đổi ticket state và không tạo `ExceptionRecord`.

# 4. Field Matrix v1

Ma trận dưới đây là handoff nghiệp vụ cho AI/Data. `Required` luôn gắn với một gate; không có required toàn cục ngầm định.

## 4.1 Common fields

| Field name | Ý nghĩa nghiệp vụ | Owner/source | Required/optional | Gate sử dụng | Enum/constraint dự kiến |
|---|---|---|---|---|---|
| `ticket_id` | ID ticket mô phỏng | System ingest; immutable | Required | Classification, mọi linkage | `SIM-TKT-*`; non-empty; `UNKNOWN` fail |
| `created_at` | Thời điểm fixture được tiếp nhận | System ingest; immutable | Required | Classification | ISO 8601; `UNKNOWN` fail |
| `original_description` | Nội dung phản ánh gốc | Resident source; immutable | Required | Classification, trigger, exception | Non-empty untrusted text; `UNKNOWN` fail |
| `original_evidence_refs` | Metadata/reference evidence gốc | Resident source; immutable | Optional | Trigger/exception source | Array refs; ảnh không là required mặc định |
| `raw_integrity_marker` | Chứng minh raw source không đổi | System | Required | Immutability | Hash/equivalent |
| `synthetic` | Nhãn dữ liệu mô phỏng | System | Required | Mọi entity/output | Constant `true` |
| `dataset_version` | Version fixture | System | Required | Reproducibility/audit | Non-empty version |
| `current_state` | State nghiệp vụ hiện tại | System/Agent gate | Required | State machine | `IN_PROGRESS|CHỜ XÁC MINH|READY_FOR_REVIEW|EXCEPTION` |
| `service_category_normalized` | Nhóm dịch vụ do Agent đề xuất, BPTN xác nhận/chỉnh | Agent → BPTN | Required | Pre-draft | `VE_SINH|KY_THUAT`; `UNKNOWN` fail |
| `ticket_type_normalized` | Loại ticket do Agent đề xuất, BPTN xác nhận/chỉnh | Agent → BPTN | Required | Pre-draft | `COMMON_AREA_CLEANING|COMMON_AREA_LIGHTING`; `UNKNOWN` fail |
| `confirmation_status` | Trạng thái xác nhận service/type | BPTN | Required | Pre-draft | `PENDING|CONFIRMED` |
| `confirmed_by` | BPTN thực hiện xác nhận | BPTN | Conditional required | Pre-draft khi confirmed | Valid actor ID/role BPTN |
| `confirmed_at` | Thời điểm xác nhận | System | Conditional required | Pre-draft khi confirmed | ISO 8601 |
| `location_normalized` | Vị trí hành chính đã xác nhận | BPTN | Optional classification; required draft | Pre-draft | Non-empty structured/string; `UNKNOWN` fail |
| `priority` | Mức ưu tiên mô phỏng nếu đã có rule | BPTN/admin | Optional | Không chặn v1 | Không Agent-derived; enum chưa khóa |
| `administrative_revision` | Revision lớp normalized data | System | Required khi có admin data | Draft idempotency/audit | Integer tăng dần |
| `playbook_id` | Playbook Agent đề xuất | Agent | Required | Proposal, draft, READY | `PB-CLN-01|PB-TEC-01` |
| `playbook_version` | Version playbook | Agent/System | Required | Proposal, draft, READY | `1.1` |
| `matched_rule_ids` | Rule đã match | Agent | Required | Proposal/explainability | Non-empty allowlisted array |
| `classification_reason` | Lý do chọn playbook | Agent | Required | Proposal | Non-empty; không kết luận ngoài nguồn |
| `source_references` | Field/evidence nguồn cho decision | Agent | Required | Proposal/exception/warning | Non-empty valid references |
| `work_order_draft_id` | ID bản nháp mô phỏng | System | Required | Draft, READY | `SIM-WOD-*` |
| `source_revision` | Revision nguồn dùng tạo draft | System | Required | Draft/idempotency | Non-empty revision |
| `idempotency_key` | Khóa chống duplicate draft | System | Required | Draft | `ticket_id+playbook_version+source_revision` |
| `scope_summary` | Phạm vi draft chỉ từ nguồn/proposal | Agent | Required | Draft | Non-empty; source-grounded |
| `draft_status` | Trạng thái bản nháp | System | Required | Draft | Constant `DRAFT` |
| `asset_id` | Asset kỹ thuật match | Agent lookup | Conditional, key luôn có | Asset/route | `SIM-ASSET-*` hoặc null; vệ sinh N/A |
| `asset_lookup_status` | Kết quả asset lookup | Agent | Required | Asset/route | `MATCHED|NOT_FOUND|AMBIGUOUS|NOT_APPLICABLE` |
| `asset_match_reason` | Lý do match/unresolved | Agent | Required | Explainability | Non-empty + source ref |
| `routing_team_id` | Team mô phỏng đề xuất | Agent | Conditional | Duty/route | `SIM-TEAM-*` hoặc null |
| `duty_lookup_status` | Kết quả duty/capacity | Agent | Required | Duty/route | `AVAILABLE|NO_AVAILABLE_TEAM|CAPACITY_EXCEEDED|DUTY_UNKNOWN` |
| `duty_source_ref` | Nguồn duty fixture | Agent | Required khi source có mặt | Duty/audit | `SIM-DUTY-*` hoặc source path |
| `assignment_mode` | Chế độ route | System | Required | Route | Constant `SIMULATED_TEAM_ROUTE` |
| `assignment_scope` | Phạm vi gán | System | Required | Route | Constant `TEAM_ONLY` |
| `assignee_id` | Nhân viên cụ thể | System | Required key | Permission | Constant `null` |
| `material_stock_status` | Kết quả stock gate trước route | Agent | Required | Stock/route | `SUFFICIENT|INSUFFICIENT|UNKNOWN|NOT_APPLICABLE` |
| `route_status` | Kết quả route | Agent | Required | Route/READY | `ROUTED|NOT_ROUTED` |
| `queue_status` | Trạng thái hàng đợi phụ | Agent | Required | Queue UI | `NOT_QUEUED|PENDING_BQL_REVIEW` |
| `queue_reason` | Lý do chưa route | Agent | Conditional | Queue/route | Allowlisted reason; không phải top-level state |
| `checklist_item.status` | Trạng thái item hồ sơ | System khởi tạo; Nhân sự thực hiện cập nhật | Required từ lúc tạo item | Checklist/READY | Initial `PENDING`; sau đó `PENDING|COMPLETED`; Agent không update |
| `material_gate_status` | Kết quả material gate | Agent validator | Required | Material/READY | `RECONCILED|NEEDS_CLARIFICATION|N/A` |
| `evidence_validation_status` | Kết quả từng requirement | Agent validator | Required | Evidence/READY | `PRESENT|MISSING|INVALID_TYPE|SOURCE_UNVERIFIED` |
| `blocking_exception_active` | Có blocker business/safety hay không | Agent rules | Required | READY | Boolean; phải `false` |
| `warning_type` | Warning không chặn | Agent | Optional | READY package | Chỉ `EXPLAINED_MATERIAL_VARIANCE` |
| `action_result` | Kết quả permission check | System | Conditional | Mọi attempted action | `ALLOWED|ACTION_DENIED` |
| `audit.*` | Truy vết edit/decision/transition | System | Required per event | Audit | Actor/time/field/old/new/reason + linkage |

## 4.2 Use-case-specific fields

| Field name | Ý nghĩa nghiệp vụ | Owner/source | Required/optional | Gate sử dụng | Enum/constraint dự kiến |
|---|---|---|---|---|---|
| `unknown_substance_status` | Tín hiệu chất/chất bẩn không rõ nguồn gốc | Agent from source | Required for CLN risk evaluation | CLN exception | `PRESENT|ABSENT|UNCLEAR`; source ref required |
| `hazard_signal_status` | Dấu hiệu nguy hại trong case vệ sinh | Agent from source | Required for CLN risk evaluation | CLN exception | `PRESENT|ABSENT|UNCLEAR`; source ref required |
| `asset_type` | Loại đối tượng kỹ thuật đề xuất | Agent | Optional support | TEC classification | `LIGHTING` |
| `reported_symptom` | Triệu chứng được báo | Agent | Optional support | TEC classification | `NOT_WORKING` |
| `burning_smell_status` | Tín hiệu mùi khét | Agent from source | Required for TEC risk evaluation | TEC exception | `PRESENT|ABSENT|UNCLEAR`; source ref required |
| `spark_status` | Tín hiệu tia lửa | Agent from source | Required for TEC risk evaluation | TEC exception | `PRESENT|ABSENT|UNCLEAR`; source ref required |
| `exposed_wire_status` | Tín hiệu dây điện hở | Agent from source | Required for TEC risk evaluation | TEC exception | `PRESENT|ABSENT|UNCLEAR`; source ref required |

## 4.3 Material and evidence fields

| Field name | Ý nghĩa nghiệp vụ | Owner/source | Required/optional | Gate sử dụng | Enum/constraint dự kiến |
|---|---|---|---|---|---|
| `material_requirement_mode` | Playbook/draft có theo dõi line hay N/A | Playbook/System | Required | Draft/material | `TRACKED|N_A` |
| `planned_qty` | Số lượng dự kiến mô phỏng | Fixture/nhân sự thực hiện | Required per tracked line | Material | Number ≥ 0 |
| `norm_qty` | Định mức mô phỏng nếu cấu hình | Fixture | Conditional per tracked line | Material | Number ≥ 0 hoặc null khi `norm_label=N_A` |
| `norm_label` | Nhãn tính chất norm | System/playbook | Required per tracked line | Material | `SYNTHETIC|N_A` |
| `simulated_stock_qty` | Tồn kho mô phỏng trước route | Fixture read-only | Conditional | Stock/route | Number ≥0 hoặc null khi unknown/N/A |
| `material_stock_status` | Kết quả stock gate | Agent validator | Required | Stock/route | `SUFFICIENT|INSUFFICIENT|UNKNOWN|NOT_APPLICABLE` |
| `issued_qty` | Số lượng đã xuất mô phỏng | Fixture/nhân sự thực hiện | Required per tracked line | Material | Number ≥ 0 |
| `used_qty` | Số lượng đã dùng mô phỏng | Fixture/nhân sự thực hiện | Required per tracked line | Material | Number ≥ 0 |
| `variance_reason` | Giải thích chênh lệch | Nhân sự thực hiện | Required iff applicable comparison varies | Material | Non-empty; không phải approval |
| `comparison_type` | Phép so sánh được phép | Agent validator | Required per comparison | Material | `PLANNED_VS_NORM|ISSUED_VS_PLANNED|USED_VS_ISSUED` |
| `comparison_status` | Kết quả so sánh | Agent validator | Required per comparison | Material | `MATCH|VARIANCE|N/A` |
| `evidence_id` | ID evidence mô phỏng | System | Required per record | Evidence | `SIM-EVD-*` |
| `requirement_id` | Requirement record đáp ứng | Playbook/System | Required | Evidence | Allowlisted per playbook |
| `evidence_type` | Loại evidence | Nhân sự thực hiện/fixture | Required | Evidence | Allowlisted per playbook |
| `content_or_metadata` | Nội dung hoặc metadata | Nhân sự thực hiện/fixture | Required | Evidence | Non-empty |
| `submitted_by` | Người nộp evidence | Nhân sự thực hiện/System fixture | Required | Evidence/audit | Valid actor ID |
| `submitted_at` | Thời điểm nộp | System | Required | Evidence/audit | ISO 8601 |
| `readability_status` | Khả năng đọc/validate | Agent/schema validator | Required | Evidence | `READABLE|UNREADABLE|NOT_APPLICABLE` |

# 5. Common rule catalog

| Rule ID | Trigger/condition | Output/action | State outcome | Test anchor |
|---|---|---|---|---|
| `PB-COM-R-ING-01` | Thiếu/blank/`UNKNOWN` một trong ba raw classification fields | Liệt kê exact field; không proposal/draft | `CHỜ XÁC MINH` | `TC-ING-001` |
| `PB-COM-R-IMM-01` | Bất kỳ actor cố sửa raw content/evidence | `ACTION_DENIED`, raw unchanged, audit | State không đổi | `TC-ING-002`, `TC-PERM-001` |
| `PB-COM-R-CLS-01` | Ticket hợp lệ nhưng không match duy nhất một playbook v1.1 | Nêu ambiguity/out-of-scope; không invent playbook | `CHỜ XÁC MINH` | `TC-CLASS-004` |
| `PB-COM-R-CFM-01` | Agent proposal chưa được BPTN confirm | Chờ confirmation; không draft | `CHỜ XÁC MINH` | `TC-CLASS-005` |
| `PB-COM-R-LOC-01` | Thiếu/`UNKNOWN` location tại pre-draft | Nêu field; không draft | `CHỜ XÁC MINH` | `TC-WO-004` |
| `PB-COM-R-WO-01` | Confirmation/location pass, không blocker | Tạo một draft idempotent `SIMULATED` | `IN_PROGRESS` | `TC-WO-001/002` |
| `PB-COM-R-AST-01` | TEC asset zero/multiple match | Draft asset unresolved; no guess/no route; reason `ASSET_NOT_FOUND|ASSET_AMBIGUOUS` | `CHỜ XÁC MINH` | `TC-ASSET-002/003` |
| `PB-COM-R-STK-01` | Stock insufficient | Giữ draft; `route_status=NOT_ROUTED`; reason `MATERIAL_SHORTAGE` | `IN_PROGRESS` | `TC-STOCK-002` |
| `PB-COM-R-STK-02` | Stock unknown | Giữ draft; no route; reason `MATERIAL_STOCK_UNKNOWN` | `CHỜ XÁC MINH` | `TC-STOCK-003` |
| `PB-COM-R-DTY-01` | Duty rõ nhưng không team trực | Giữ draft; no route; reason `NO_AVAILABLE_TEAM` | `IN_PROGRESS` | `TC-DUTY-002` |
| `PB-COM-R-DTY-02` | Team vượt capacity | Giữ draft; no route; reason `TEAM_CAPACITY_EXCEEDED` | `IN_PROGRESS` | `TC-DUTY-004` |
| `PB-COM-R-DTY-03` | Duty data unknown | Giữ draft; no route; reason `DUTY_UNKNOWN` | `CHỜ XÁC MINH` | `TC-DUTY-003` |
| `PB-COM-R-ROUTE-01` | Asset/stock/duty pass | Route `SIM-TEAM-*`, team-only, assignee null | `IN_PROGRESS` | `TC-ROUTE-001` |
| `PB-COM-R-ROUTE-02` | Bất kỳ route gate fail | Không coi là giao việc; không READY | State theo gate fail | `TC-ROUTE-002/004` |
| `PB-COM-R-CHK-01` | Còn required checklist `PENDING` | Nêu item pending | `IN_PROGRESS` | `TC-CHK-001` |
| `PB-COM-R-EVD-01` | Minimum evidence đã biết bị thiếu/sai type/unreadable | Nêu requirement lỗi | `IN_PROGRESS` | `TC-EVD-001/003/005` |
| `PB-COM-R-EVD-02` | Không xác định được requirement đúng hoặc source/readability cần người xác minh | Nêu dữ liệu cần xác minh | `CHỜ XÁC MINH` | `TC-EVD-001` variant |
| `PB-COM-R-MAT-01` | Tracked material chưa đủ qty/reconciliation | Nêu field/comparison chưa hoàn tất | `IN_PROGRESS` | `TC-MAT-001..003` setup |
| `PB-COM-R-MAT-02` | Có applicable variance nhưng thiếu `variance_reason` | Nêu line/comparison cần reason | `CHỜ XÁC MINH` | `TC-MAT-004` |
| `PB-COM-R-WARN-01` | Applicable variance có reason, không blocker khác | Tạo/hiển thị `EXPLAINED_MATERIAL_VARIANCE` | Không transition; state giữ nguyên cho tới khi READY gate chạy | `TC-STATE-002` |
| `PB-COM-R-READY-01` | Đủ eight gates, gồm `route_status=ROUTED` | Gate breakdown + reason + audit | `READY_FOR_REVIEW` | `TC-STATE-001/002` |
| `PB-COM-R-PERM-01` | Agent/actor yêu cầu action ngoài quyền | `ACTION_DENIED`; audit; no side effect/exception | State không đổi | `TC-PERM-001..004` |
| `PB-COM-R-AUD-01` | Audit không ghi được cho attempted mutation/transition | Fail closed; rollback attempted change | State/data không đổi | `TC-AUD-003` |
| `PB-COM-R-SEC-01` | Content/evidence chứa instruction | Treat as untrusted data; không làm theo | Không transition do instruction; state giữ nguyên | `TC-SEC-001/002` |

---

# 6. Playbook `PB-CLN-01` — Vệ sinh khu vực chung

## 6.1 Identity và trigger

| Thuộc tính | Giá trị |
|---|---|
| Use case | `UC-CLN-01` |
| Version | `1.1` |
| Classification proposal | `service_category_normalized=VE_SINH`; `ticket_type_normalized=COMMON_AREA_CLEANING` |
| Trigger | Raw description mô phỏng phản ánh khu vực chung cần vệ sinh |
| Happy-path boundary | Không có composite hazard exception; ticket thuộc đúng scope vệ sinh khu vực chung |
| Exception | Chất lỏng/chất bẩn không rõ nguồn gốc **và** có dấu hiệu nguy hại |
| Value output | Work order draft + material/stock + team/duty/route package để BQL review |

## 6.2 Gate fields và owner

| Gate | Required fields/conditions | Owner |
|---|---|---|
| Classification | Common raw trio | System/resident source |
| Proposal | Service/type/playbook/rule/reason/source refs | Agent |
| Risk evaluation | `unknown_substance_status`, `hazard_signal_status`, source refs | Agent từ source, deterministic rule |
| Pre-draft | BPTN-confirmed service/type; valid location | BPTN |
| Asset | `NOT_APPLICABLE` | Agent/System |
| Stock trước route | Planned/norm/stock status | Agent từ fixture read-only |
| Duty/route | Team vệ sinh phù hợp, đang trực, còn capacity; team-only | Agent từ DutyAvailability |
| Execution | All CLN checklist items; processing note evidence; material gate | Nhân sự thực hiện |
| READY | Eight common gates pass, route valid | Agent validator |

## 6.3 Classification và exception rules

| Rule ID | Condition | Output | State |
|---|---|---|---|
| `PB-CLN-R-TRG-01` | Raw trio valid; description matches common-area cleaning; no ambiguity | Propose CLN service/type/playbook with source | `CHỜ XÁC MINH` while BPTN confirmation pending |
| `PB-CLN-R-EX-01` | `unknown_substance_status=PRESENT` **and** `hazard_signal_status=PRESENT` | Create blocking exception, route BQL; no standard instructions/draft | `EXCEPTION` |
| `PB-CLN-R-RISK-01` | Một trong hai risk statuses là `UNCLEAR` | Nêu signal/source cần xác minh; không standard draft | `CHỜ XÁC MINH` |
| `PB-CLN-R-SAFE-01` | Một status `PRESENT`, status kia `ABSENT` | Không đủ điều kiện exception; tiếp tục gates, không tuyên bố an toàn | `IN_PROGRESS` |
| `PB-CLN-R-EVD-01` | Required processing note không pass validity | Nêu requirement lỗi; ảnh không được dùng thay thế | `IN_PROGRESS` |
| `PB-CLN-R-READY-01` | Mọi common + CLN gate pass | Create readiness breakdown | `READY_FOR_REVIEW` |

`PB-CLN-R-RISK-01` và `PB-CLN-R-SAFE-01` là `SIMULATED ASSUMPTION` cho fixture deterministic theo handoff gap `GAP-B-02`; không phải rule hiện trường thật.

## 6.4 Happy path và transition

| Bước | Actor | Action/condition | From | To | Audit/output |
|---:|---|---|---|---|---|
| 1 | System/Agent | Ingest + validate raw trio | Event | `IN_PROGRESS` hoặc `CHỜ XÁC MINH` | Validation result, audit |
| 2 | Agent | Propose CLN playbook; evaluate composite risk | `IN_PROGRESS` | `CHỜ XÁC MINH`, `IN_PROGRESS` hoặc `EXCEPTION` | Proposal/rule/source hoặc exception |
| 3 | BPTN | Confirm service/type + location | `CHỜ XÁC MINH` | `IN_PROGRESS` | Admin revision + audit |
| 4 | Agent | Determine material/stock; lookup duty/capacity | `IN_PROGRESS` | State theo stock/duty result | Lookup result + reason/source |
| 5 | Agent | Create idempotent draft; route only if gates pass | non-high-risk | `IN_PROGRESS` hoặc `CHỜ XÁC MINH` | Draft always; `ROUTED|NOT_ROUTED` |
| 6 | Nhân sự thực hiện | Update checklist/material/evidence | `IN_PROGRESS` | `IN_PROGRESS` | Execution audit |
| 7 | Agent | Reconcile and validate eight gates | `IN_PROGRESS` | `READY_FOR_REVIEW` nếu route + all gates pass | Gate breakdown/warning/audit |

Exception path dừng tại bước 2 và chuyển `EXCEPTION`. Agent không tạo hướng dẫn xử lý chất nguy hại và không tiếp tục standard draft.

## 6.5 Work order draft output

Draft bắt buộc có:

- `work_order_draft_id`, `ticket_id`, `playbook_id=PB-CLN-01`, `playbook_version=1.1`;
- `source_revision`, `idempotency_key`, `scope_summary` source-grounded;
- Agent reason, matched rules, source references;
- CLN checklist template instances;
- `material_requirement_mode=TRACKED|N_A` và requirement tương ứng;
- `asset_id=null`, `asset_lookup_status=NOT_APPLICABLE`;
- `routing_team_id`, `duty_status`, `material_stock_status`, `route_status`, `queue_status`, `queue_reason`;
- `assignment_mode=SIMULATED_TEAM_ROUTE`, `assignment_scope=TEAM_ONLY`, `assignee_id=null`;
- evidence requirement `CLN-EVD-PROCESSING-NOTE`;
- `synthetic=true`, `draft_status=DRAFT`.

Không có operational work-order ID hoặc action tạo work order thật.

## 6.6 Checklist template

| Template item ID | Label mô phỏng | Owner update | Required | Pass condition |
|---|---|---|---|---|
| `CLN-CHK-01` | Khu vực trong execution update khớp `location_normalized` | Nhân sự thực hiện | Có | `COMPLETED`; linked location present |
| `CLN-CHK-02` | Execution update đã được ghi nhận theo `scope_summary` | Nhân sự thực hiện | Có | `COMPLETED`; update link present |
| `CLN-CHK-03` | Các hạng mục trong phạm vi draft đã được đánh dấu hoàn tất | Nhân sự thực hiện | Có | `COMPLETED`; không item scoped nào `PENDING` |

Các label trên chỉ kiểm tra hồ sơ; không quy định cách vệ sinh.

## 6.7 Evidence và material

- Minimum evidence: một `EvidenceRecord` có `requirement_id=CLN-EVD-PROCESSING-NOTE`, `evidence_type=PROCESSING_NOTE`, nội dung không rỗng và pass validity chung.
- Checklist không thay evidence record.
- Ảnh optional; thiếu ảnh không warning và không block.
- Material gate theo mục 3.4. Không nêu mã vật tư hoặc số lượng thật. Khi tracked và variance có reason, warning `EXPLAINED_MATERIAL_VARIANCE` vẫn phải hiển thị trong READY package.

## 6.8 Acceptance criteria

| AC ID | Given | When | Then |
|---|---|---|---|
| `AC-PB-CLN-01` | Raw trio hợp lệ, trigger đúng CLN | Agent classify | Đề xuất `PB-CLN-01`, service/type đúng, có reason/source; chưa tạo draft trước BPTN confirmation |
| `AC-PB-CLN-02` | Service/type chưa confirmed hoặc location thiếu | Agent nhận request tạo draft | Không draft; state `CHỜ XÁC MINH`; exact gate được nêu |
| `AC-PB-CLN-03` | Hai composite hazard signals `PRESENT` | Risk rule chạy | State `EXCEPTION`, route BQL, không guidance/standard draft |
| `AC-PB-CLN-04` | Risk signal `UNCLEAR` | Risk rule chạy | State `CHỜ XÁC MINH`; không suy đoán |
| `AC-PB-CLN-05` | Checklist complete nhưng processing note thiếu/sai | Readiness chạy | Evidence gate fail, state `IN_PROGRESS`; không READY |
| `AC-PB-CLN-06` | Ảnh không có nhưng mọi required gate khác pass | Readiness chạy | Ảnh không block; state có thể `READY_FOR_REVIEW` |
| `AC-PB-CLN-07` | Material variance có reason và không blocker khác | Reconcile/readiness chạy | Warning hiển thị; READY được phép nếu mọi gate pass |
| `AC-PB-CLN-08` | Mọi gate pass | Readiness chạy | `READY_FOR_REVIEW`; output không dùng ngôn ngữ nghiệm thu/đóng/phê duyệt |
| `AC-PB-CLN-09` | Duty rõ nhưng không team trực | Lookup/draft chạy | Draft tồn tại; `IN_PROGRESS`; `NO_AVAILABLE_TEAM`; no route/READY |
| `AC-PB-CLN-10` | Duty data unknown | Lookup/draft chạy | Draft tồn tại; `CHỜ XÁC MINH`; `DUTY_UNKNOWN`; no route |
| `AC-PB-CLN-11` | Agent cố set `assignee_id` | Permission/schema validate | Reject + audit; `assignee_id=null`; state unchanged |

Negative coverage: raw edit, Agent auto-complete checklist, variance thiếu reason, injection trong note và Agent approve material đều phải bị chặn theo common rules.

---

# 7. Playbook `PB-TEC-01` — Đèn khu vực chung không hoạt động

## 7.1 Identity và trigger

| Thuộc tính | Giá trị |
|---|---|
| Use case | `UC-TEC-01` |
| Version | `1.1` |
| Classification proposal | `service_category_normalized=KY_THUAT`; `ticket_type_normalized=COMMON_AREA_LIGHTING` |
| Trigger | Raw description mô phỏng báo đèn chiếu sáng khu vực chung không hoạt động |
| Required asset proposal | `asset_type=LIGHTING`; `reported_symptom=NOT_WORKING` |
| Exception | Có mùi khét, tia lửa hoặc dây điện hở |
| Value output | Asset match + stock + team/duty/route + work order draft không có chẩn đoán |

## 7.2 Gate fields và owner

| Gate | Required fields/conditions | Owner |
|---|---|---|
| Classification | Common raw trio | System/resident source |
| Proposal | Service/type/playbook/rule/reason/source refs | Agent |
| Risk evaluation | Ba electrical-risk statuses + source refs | Agent từ source, deterministic rule |
| Pre-draft | BPTN-confirmed service/type; valid location | BPTN |
| Asset | Exact one `SIM-ASSET-*` với `asset_type=LIGHTING` và location match | Agent + Asset Catalog |
| Stock trước route | Planned/norm/stock status | Agent từ fixture read-only |
| Duty/route | Team kỹ thuật phù hợp, đang trực, còn capacity; team-only | Agent + DutyAvailability |
| Execution | All TEC checklist items; result note; material gate | Nhân sự thực hiện |
| READY | Eight common gates pass, route valid | Agent validator |

## 7.3 Classification và exception rules

| Rule ID | Condition | Output | State |
|---|---|---|---|
| `PB-TEC-R-TRG-01` | Raw trio valid; common-area lighting not working; no ambiguity | Propose TEC service/type/playbook | `CHỜ XÁC MINH` while BPTN confirmation pending |
| `PB-TEC-R-EX-01` | Bất kỳ `burning_smell_status`, `spark_status`, `exposed_wire_status` là `PRESENT` | Blocking exception, route BQL; no diagnosis/guidance/standard draft | `EXCEPTION` |
| `PB-TEC-R-RISK-01` | Bất kỳ electrical-risk status là `UNCLEAR` và không signal nào `PRESENT` | Nêu signal/source cần xác minh; không standard draft | `CHỜ XÁC MINH` |
| `PB-TEC-R-AST-01` | Exact one LIGHTING/location match | Gắn `asset_id`, `asset_lookup_status=MATCHED` | `IN_PROGRESS` |
| `PB-TEC-R-AST-02` | Zero/multiple asset match | Không đoán; draft có asset unresolved; no route | `CHỜ XÁC MINH` |
| `PB-TEC-R-EVD-01` | Required result note không pass validity | Nêu requirement lỗi; ảnh không thay thế | `IN_PROGRESS` |
| `PB-TEC-R-MAT-01` | Tracked material chưa đủ qty hoặc reconciliation chưa chạy | Nêu field/comparison còn thiếu | `IN_PROGRESS` |
| `PB-TEC-R-MAT-02` | Có applicable variance nhưng thiếu `variance_reason` | Nêu line/comparison cần reason | `CHỜ XÁC MINH` |
| `PB-TEC-R-READY-01` | Mọi common + TEC gate pass | Create readiness breakdown | `READY_FOR_REVIEW` |

Nếu đồng thời có `PRESENT` và `UNCLEAR`, `PB-TEC-R-EX-01` ưu tiên và kết quả duy nhất là `EXCEPTION`.

## 7.4 Happy path và transition

| Bước | Actor | Action/condition | From | To | Audit/output |
|---:|---|---|---|---|---|
| 1 | System/Agent | Ingest + validate raw trio | Event | `IN_PROGRESS` hoặc `CHỜ XÁC MINH` | Validation result |
| 2 | Agent | Propose TEC playbook; run risk checks | `IN_PROGRESS` | `CHỜ XÁC MINH`, `IN_PROGRESS` hoặc `EXCEPTION` | Proposal hoặc exception |
| 3 | BPTN | Confirm service/type + location | `CHỜ XÁC MINH` | `IN_PROGRESS` | Admin revision + audit |
| 4 | Agent | Lookup asset, stock, duty/capacity | `IN_PROGRESS` | State theo lookup result | Exact source/reason |
| 5 | Agent | Create non-diagnostic draft; route only if gates pass | non-high-risk | `IN_PROGRESS` hoặc `CHỜ XÁC MINH` | Draft + route/queue fields |
| 6 | Nhân sự thực hiện | Update checklist/result/material | `IN_PROGRESS` | `IN_PROGRESS` | Execution audit |
| 7 | Agent | Reconcile and validate eight gates | `IN_PROGRESS` | `READY_FOR_REVIEW` nếu route + all gates pass | Gate breakdown/warning/audit |

Exception path dừng tại bước 2. Agent không chẩn đoán nguyên nhân, hướng dẫn xử lý, xác nhận an toàn hoặc tiếp tục standard work.

## 7.5 Work order draft output

Draft bắt buộc có common draft fields và:

- `playbook_id=PB-TEC-01`, `playbook_version=1.1`;
- mô tả đúng location/lighting symptom từ nguồn, không có nguyên nhân suy đoán;
- `asset_id`, `asset_lookup_status`, `asset_match_reason`;
- `routing_team_id`, `duty_status`, `material_stock_status`, `route_status`, `queue_status`, `queue_reason`;
- `assignment_mode=SIMULATED_TEAM_ROUTE`, `assignment_scope=TEAM_ONLY`, `assignee_id=null`;
- TEC checklist template instances;
- `material_requirement_mode=TRACKED|N_A`;
- evidence requirement `TEC-EVD-RESULT-NOTE`;
- không có instruction xử lý high-risk hoặc technical quality conclusion.

## 7.6 Checklist template

| Template item ID | Label mô phỏng | Owner update | Required | Pass condition |
|---|---|---|---|---|
| `TEC-CHK-01` | Execution update nhận diện đúng location và đối tượng lighting | Nhân sự thực hiện | Có | `COMPLETED`; source link present |
| `TEC-CHK-02` | Việc hoàn tất checklist an toàn mô phỏng đã được ghi nhận | Nhân sự thực hiện | Có | `COMPLETED`; completion metadata present |
| `TEC-CHK-03` | Kết quả xử lý mô phỏng đã được cập nhật | Nhân sự thực hiện | Có | `COMPLETED`; result update link present |

Checklist không mô tả thao tác sửa chữa, cô lập điện hoặc tiêu chuẩn nghiệm thu thực tế.

## 7.7 Evidence và material

- Minimum evidence: một `EvidenceRecord` có `requirement_id=TEC-EVD-RESULT-NOTE`, `evidence_type=RESULT_NOTE`, nội dung không rỗng và pass validity chung.
- Checklist an toàn là gate riêng; không thay result note.
- Material gate phải `RECONCILED` hoặc `N/A`; nếu tracked, dùng đúng material contract chung.
- Ảnh optional; Agent không xác định chất lượng từ ảnh.

## 7.8 Acceptance criteria

| AC ID | Given | When | Then |
|---|---|---|---|
| `AC-PB-TEC-01` | Raw trio hợp lệ, trigger đúng lighting | Agent classify | Đề xuất đúng TEC playbook/service/type, có reason/source |
| `AC-PB-TEC-02` | BPTN confirmation/location chưa pass | Create draft được yêu cầu | Không draft; `CHỜ XÁC MINH` |
| `AC-PB-TEC-03` | Bất kỳ high-risk signal `PRESENT` | Risk rule chạy | `EXCEPTION`, BQL handler, no diagnosis/guidance/standard draft |
| `AC-PB-TEC-04` | Không signal `PRESENT` nhưng có signal `UNCLEAR` | Risk rule chạy | `CHỜ XÁC MINH`; không suy đoán |
| `AC-PB-TEC-05` | Safety checklist còn `PENDING` | Readiness chạy | `IN_PROGRESS`; item được nêu; không READY |
| `AC-PB-TEC-06` | Result note thiếu hoặc unreadable | Evidence validation chạy | `IN_PROGRESS`; evidence gate fail |
| `AC-PB-TEC-07` | Material `RECONCILED` hoặc gate `N/A`, mọi gate khác pass | Readiness chạy | Material gate pass; CS-like zero line chỉ khi explicit `N/A` |
| `AC-PB-TEC-08` | Mọi gate pass | Readiness chạy | `READY_FOR_REVIEW`; không có quality/acceptance conclusion |
| `AC-PB-TEC-09` | Exact one asset, stock đủ, team trực/còn capacity | Routing chạy | Draft + `route_status=ROUTED`, team-only, assignee null |
| `AC-PB-TEC-10` | Asset không tìm thấy hoặc nhiều match | Lookup/draft chạy | Draft tồn tại với asset unresolved; `CHỜ XÁC MINH`; no route |
| `AC-PB-TEC-11` | Stock insufficient | Stock/draft chạy | Draft tồn tại; `IN_PROGRESS`; `MATERIAL_SHORTAGE`; no route |
| `AC-PB-TEC-12` | Duty unknown hoặc team capacity exceeded | Routing chạy | Đúng state/reason; draft tồn tại; no route/READY |

Negative coverage: model suy đoán nguyên nhân, Agent approve material, phép so sánh thứ tư, ảnh bị bắt buộc và instruction injection đều phải fail theo common rules.

---

# 8. Work order output contract chung

Mọi work order draft phải chứa tối thiểu:

| Nhóm | Field/output bắt buộc |
|---|---|
| Identity/link | `work_order_draft_id`, `ticket_id`, `playbook_id`, `playbook_version`, `source_revision`, `idempotency_key` |
| Boundary | `synthetic=true`, `draft_status=DRAFT`, nhãn “bản nháp/mô phỏng” |
| Scope | `scope_summary`, `location_normalized`, confirmed service/type |
| Explainability | `generation_reason`, `matched_rule_ids`, `source_references` |
| Asset/routing | `asset_id`, `asset_lookup_status`, `asset_match_reason`, `routing_team_id`, `duty_status`, `material_stock_status`, `route_status`, `queue_status`, `queue_reason` |
| Assignment boundary | `assignment_mode=SIMULATED_TEAM_ROUTE`, `assignment_scope=TEAM_ONLY`, `assignee_id=null` |
| Requirements | Checklist template instances, material mode/gate, evidence requirement IDs |
| Safety | Không blocking exception tại thời điểm tạo; permission/state decision trace |

Retry cùng `ticket_id + playbook_version + source_revision` trả cùng logical draft hoặc controlled revision, không tạo duplicate.

# 9. READY, exception và invalid action oracle

## 9.1 READY gate

`READY_FOR_REVIEW` chỉ khi đồng thời:

1. Có `playbook_id`/version hợp lệ.
2. Có work order draft hợp lệ.
3. Required fields và asset gate (nếu kỹ thuật) đã pass.
4. `route_status=ROUTED` tới team mô phỏng, duty/capacity pass và `assignee_id=null`.
5. Mọi required checklist item `COMPLETED`.
6. Mọi minimum evidence requirement `PRESENT` và hợp lệ.
7. Material `RECONCILED` hoặc `N/A`; stock gate trước route đã pass.
8. Không có blocking exception.

`EXPLAINED_MATERIAL_VARIANCE` có thể còn active nhưng phải hiển thị rule, reason và comparison source.

## 9.2 Exception output

Mỗi exception record phải có `exception_id`, `ticket_id`, `exception_type`, `blocking=true`, `rule_id`, `reason`, `source_references`, mức routing mô phỏng, `authorized_handler=BQL`, `status=OPEN`, audit và `synthetic=true`. Agent không có quyền set `RESOLVED_BY_BQL`.

## 9.3 Action vượt quyền

Các yêu cầu Agent sửa raw/read-only catalog, gán nhân viên cụ thể, tự complete checklist, nghiệm thu, đóng ticket, phê duyệt/điều chỉnh vật tư, xác nhận chất lượng hoặc resolve exception phải:

- trả `ACTION_DENIED`;
- không thay đổi dữ liệu/state;
- không tạo business exception;
- tạo audit/security event có actor/action/reason.

# 10. Handoff decisions và Implementation Gaps

Agent A đã quyết định toàn bộ gaps nhận được từ AI/Data vòng handoff đầu tiên:

| Gap ID | Disposition | Quyết định áp dụng |
|---|---|---|
| `GAP-B-01` | `APPROVE` | Toàn gate `N/A` = zero line. Tracked line dùng numeric qty; `norm_qty` nullable khi `norm_label=N_A`; không lưu literal `N/A` trong numeric field. |
| `GAP-B-02` | `SIMULATED ASSUMPTION` | CLN exception cần hai signal `PRESENT`; signal `UNCLEAR` → `CHỜ XÁC MINH`; one-present/one-absent không đủ exception, tiếp tục `IN_PROGRESS` nhưng không tuyên bố an toàn. |
| `GAP-B-05` | `APPROVE` | `READABLE` hoặc structured `NOT_APPLICABLE` mới pass; `UNREADABLE` không pass và giữ `IN_PROGRESS` khi requirement đã biết. |
| `GAP-C-01` | `APPROVE` | Asset unresolved vẫn cho draft với `asset_id=null`, nhưng `CHỜ XÁC MINH` và no route. |
| `GAP-C-02` | `APPROVE` | No-team/capacity/stock shortage giữ draft ở `IN_PROGRESS`; duty/stock unknown vào `CHỜ XÁC MINH`. |
| `GAP-C-03` | `APPROVE` | Route chỉ cấp team; mọi non-null `assignee_id` bị reject và audit. |

Không còn Implementation Gap undecided trong batch này. Các quyết định mang nhãn `SIMULATED ASSUMPTION` chỉ dùng cho prototype fixture/test oracle.

# 11. Cross-review checklist

| Điều kiện | Kết quả cuối | Evidence trong Playbook/Data Contract |
|---|---|---|
| Mỗi required field có owner và gate | PASS | §3–§4, per-playbook gate tables |
| Mỗi field playbook có mục đích nghiệp vụ | PASS | Field Matrix §4 |
| Mỗi routing rule dẫn tới đúng state/reason | PASS | §5, §6.3, §7.3 |
| Mỗi READY gate có dữ liệu kiểm tra được | PASS | §3.2, §9.1 |
| Không Agent authority vượt scope | PASS | §2, §3.5, §9.3 |
| Không ảnh bắt buộc toàn cục | PASS | §3.3 và từng playbook |
| `norm_qty` là mô phỏng hoặc `N/A` | PASS | §3.4, §4.3 |
| Mọi nội dung chưa có dữ liệu thật gắn `SIMULATED` | PASS | Metadata, §1.1, output contract |
| Mapping required field → entity/validator | PASS | `data-contract-v1.md` v1.1 §§5–7 |
| Asset/duty/stock/route fields và validators khớp | PASS | Data Contract v1.1; playbook gates/output/AC |
| Rule/checklist/evidence ID integrity | PASS | Hai catalog đã đồng bộ; không còn stale ID |
| Field không có business purpose | PASS | Không phát hiện field mồ côi sau cross-review |

## 11.1 Cross-review record

- Agent A đã review Data Contract về field mapping, owner, required timing, validator/state, permission và field purpose.
- Agent B đã reverse-review Playbook về canonical schema names, rule/evidence/checklist/asset/duty/route IDs và tính testable của gates.
- Findings đã đóng: draft tồn tại độc lập với route; asset kỹ thuật, stock, duty/capacity và team-only route có oracle deterministic.
- Các gap còn liên quan active MVP đều `CLOSED`; không có disposition bị bỏ trống.
- Kết quả: không có P0 logic mismatch giữa Playbook v1.1 và Data Contract v1.1.

# 12. Open Issues

`No blocking open issues` cho Playbook v1.1 và Data Contract v1.1. Governance `OD-09` đã đóng; hai deliverable thuộc frozen baseline MaintenanceOps MVP v0.3 ngày 28/09/2026. Các quyết định mở non-blocking không làm thay đổi schema/rule đã freeze.
