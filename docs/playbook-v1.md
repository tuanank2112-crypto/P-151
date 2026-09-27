# MaintenanceOps Agent — Playbook v1

> **Document status:** FINAL · CROSS-REVIEW COMPLETE  
> **Version:** 1.0  
> **Ngày:** 2026-09-27  
> **Owner duy nhất:** TV1 — Product / BA / Process  
> **Business scope:** Ba playbook mô phỏng `PB-CLN-01`, `PB-TEC-01`, `PB-CS-01`  
> **Data classification:** `SIMULATED` — không phải quy trình, dữ liệu, SLA, định mức, tồn kho hoặc hướng dẫn vận hành thực tế của Vinhomes.

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.9 | 2026-09-27 | Tạo ba playbook theo template chung; khóa Field Matrix, rule ID, state oracle, checklist hồ sơ, evidence/material gate và acceptance criteria từ policy v0.2 | DRAFT FOR CROSS-REVIEW |
| 1.0 | 2026-09-27 | Áp dụng `GAP-B-01..09`; cross-review Data Contract; đồng bộ canonical field/rule/checklist/evidence IDs, state outcome, field owner và machine-checkable READY gates | FINAL |

---

# 1. Mục đích và ranh giới

Tài liệu này là nguồn nghiệp vụ v1 cho đội AI/Data, UX/UI và Integration/QA xây prototype mô phỏng. Tài liệu chỉ xác định dữ liệu đầu vào, rule, output, gate và kết quả state có thể kiểm thử; không phải SOP hiện trường và không cấp quyền vận hành cho Agent.

Phạm vi chỉ gồm:

1. `PB-CLN-01` — Khu vực chung cần vệ sinh.
2. `PB-TEC-01` — Đèn khu vực chung không hoạt động.
3. `PB-CS-01` — Yêu cầu cập nhật tiến độ ticket có mã tham chiếu.

Mỗi playbook có đúng một happy path và một exception path đã khóa. Nội dung ngoài ba trigger trên không được Agent tự tạo playbook; kết quả là `CHỜ_XÁC_MINH` với lý do không match duy nhất một playbook v1.

## 1.1 Quy ước v1

- Mọi fixture, rule, checklist, material, evidence, work order draft và kết quả đều có nhãn `SIMULATED`.
- State canonical của v1: `IN_PROGRESS`, `CHỜ_XÁC_MINH`, `READY_FOR_REVIEW`, `EXCEPTION`.
- Permission denial canonical của v1: `ACTION_DENIED`. Đây là action result, không phải ticket state; ticket state không đổi và không tự tạo business exception.
- `UNKNOWN`, chuỗi rỗng hoặc giá trị chỉ có khoảng trắng được phép lưu để phản ánh input nhưng không thỏa required gate.
- Checklist trong tài liệu là checklist hoàn thiện hồ sơ mô phỏng, không phải chỉ dẫn kỹ thuật hoặc quy trình hiện trường.
- `READY_FOR_REVIEW` chỉ có nghĩa hồ sơ đủ điều kiện để BQL xem xét; không có nghĩa nghiệm thu, hoàn tất, đóng ticket hoặc phê duyệt vật tư.
- Không có rule nào được dùng model confidence làm điều kiện duy nhất. Schema, deterministic safety rule, permission và state gate có ưu tiên cao hơn model output.

# 2. Actor và quyền sở hữu dữ liệu

| Actor/layer | Được làm trong playbook | Không được làm |
|---|---|---|
| BPTN | Xem raw ticket; xác nhận/chỉnh `service_category_normalized`, `ticket_type_normalized`; nhập/xác nhận `location_normalized`; chỉnh field hành chính trong allowlist; ghi reason | Sửa raw resident content/evidence; suy đoán dữ kiện; quyết định exception; tạo/hoàn tất work order thật |
| Agent | Validate; đề xuất service/type/playbook; tạo work order draft mô phỏng; sinh requirement; đối soát; đánh giá gate; phát hiện/routing exception; tạo reason/audit | Sửa nguồn; tự hoàn tất checklist; nghiệm thu/đóng; xác nhận chất lượng; duyệt/điều chỉnh vật tư; gửi liên hệ; tự xử lý rủi ro cao |
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
6. Nếu pre-draft gate pass, Agent tạo work order draft mô phỏng, idempotent.
7. Nhân sự thực hiện cập nhật checklist, material và evidence.
8. Agent chỉ đọc/validate, chạy ba phép đối soát vật tư được phép và đánh giá readiness.
9. Agent đưa case về đúng một trong bốn state, kèm rule, reason, source và audit.

## 3.2 Required fields theo gate

| Gate | Field/điều kiện bắt buộc | Owner/source | Nếu không đạt |
|---|---|---|---|
| `GATE-CLASSIFICATION` | `ticket_id`, `created_at`, `original_description` hợp lệ | System ingest / resident source; immutable | `CHỜ_XÁC_MINH`; không tự điền, không tạo draft |
| `GATE-PROPOSAL` | Một `playbook_id` trong allowlist; Agent proposal có service/type, matched rule, reason, source reference | Agent | Ambiguous/outside v1 → `CHỜ_XÁC_MINH` |
| `GATE-PRE-DRAFT` | Service/type `CONFIRMED` bởi BPTN; `location_normalized` hợp lệ; không có blocking exception | BPTN + Agent safety validator | `CHỜ_XÁC_MINH` nếu thiếu confirmation/location; `EXCEPTION` nếu rule exception active |
| `GATE-WORK-ORDER` | Work order draft schema-valid, linked, `SIMULATED`, idempotent | Agent/System | Giữ `IN_PROGRESS` khi lỗi tạo/schema; fail closed, không partial write |
| `GATE-CHECKLIST` | Mọi required item là `COMPLETED`; không có item `PENDING` | Nhân sự thực hiện; Agent validate | Giữ `IN_PROGRESS` |
| `GATE-EVIDENCE` | Mọi minimum evidence requirement của playbook là `PRESENT` và hợp lệ | Nhân sự thực hiện; Agent validate | Known missing/wrong type → `IN_PROGRESS`; requirement/source không xác định → `CHỜ_XÁC_MINH` |
| `GATE-MATERIAL` | `RECONCILED` hoặc toàn gate `N/A` | Nhân sự thực hiện + Agent | Chưa nhập/chưa reconcile → `IN_PROGRESS`; variance thiếu reason → `CHỜ_XÁC_MINH` |
| `GATE-BLOCKER` | Không có blocking exception active | Agent deterministic rules | `EXCEPTION` hoặc `CHỜ_XÁC_MINH` đúng theo rule |
| `GATE-READY` | Đồng thời: playbook, draft, required fields, checklist, evidence, material và no blocker đều pass | Agent deterministic aggregator | Pass → `READY_FOR_REVIEW`; fail → state do gate lỗi quy định |

## 3.3 Evidence validity chung

Một evidence record chỉ `PRESENT` khi đồng thời:

- `evidence_type` đúng requirement của playbook;
- liên kết đúng `ticket_id`, `work_order_draft_id` và `requirement_id`;
- nội dung hoặc metadata không rỗng;
- có `submitted_by`, `submitted_at`;
- `readability_status=READABLE`, hoặc `NOT_APPLICABLE` đối với structured text/metadata đã pass schema;
- có `synthetic=true`.

`UNREADABLE`, sai type hoặc sai link không pass. Ảnh là optional trong cả ba playbook v1 và không được dùng để tự xác nhận chất lượng.

## 3.4 Material validity chung

- Toàn material gate có thể là `N/A`; khi đó không có `MaterialLine`.
- Nếu có `MaterialLine`, `planned_qty`, `issued_qty`, `used_qty` là số không âm.
- `norm_qty` là số không âm kèm `norm_label=SYNTHETIC`, hoặc không có giá trị số kèm `norm_label=N_A` khi định mức mô phỏng chưa được cấu hình.
- Chỉ chạy ba comparison: `PLANNED_VS_NORM`, `ISSUED_VS_PLANNED`, `USED_VS_ISSUED`. Comparison đầu trả `N/A` khi `norm_label=N_A`.
- Bất kỳ variance nào trong comparison áp dụng phải có `variance_reason` không rỗng. Thiếu reason → `CHỜ_XÁC_MINH`.
- Variance có reason tạo warning duy nhất `EXPLAINED_MATERIAL_VARIANCE`; warning không chặn READY nếu mọi gate khác pass.
- Agent chỉ phát hiện và mô tả trung tính; không phê duyệt xuất, điều chỉnh tồn kho, duyệt sai lệch hoặc kết luận vi phạm.

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
| `current_state` | State nghiệp vụ hiện tại | System/Agent gate | Required | State machine | `IN_PROGRESS|CHỜ_XÁC_MINH|READY_FOR_REVIEW|EXCEPTION` |
| `service_category_normalized` | Nhóm dịch vụ do Agent đề xuất, BPTN xác nhận/chỉnh | Agent → BPTN | Required | Pre-draft | `VE_SINH|KY_THUAT|CSKH`; `UNKNOWN` fail |
| `ticket_type_normalized` | Loại ticket do Agent đề xuất, BPTN xác nhận/chỉnh | Agent → BPTN | Required | Pre-draft | `COMMON_AREA_CLEANING|COMMON_AREA_LIGHTING|STATUS_UPDATE`; `UNKNOWN` fail |
| `confirmation_status` | Trạng thái xác nhận service/type | BPTN | Required | Pre-draft | `PENDING|CONFIRMED` |
| `confirmed_by` | BPTN thực hiện xác nhận | BPTN | Conditional required | Pre-draft khi confirmed | Valid actor ID/role BPTN |
| `confirmed_at` | Thời điểm xác nhận | System | Conditional required | Pre-draft khi confirmed | ISO 8601 |
| `location_normalized` | Vị trí hành chính đã xác nhận | BPTN | Optional classification; required draft | Pre-draft | Non-empty structured/string; `UNKNOWN` fail |
| `priority` | Mức ưu tiên mô phỏng nếu đã có rule | BPTN/admin | Optional | Không chặn v1 | Không Agent-derived; enum chưa khóa |
| `administrative_revision` | Revision lớp normalized data | System | Required khi có admin data | Draft idempotency/audit | Integer tăng dần |
| `playbook_id` | Playbook Agent đề xuất | Agent | Required | Proposal, draft, READY | `PB-CLN-01|PB-TEC-01|PB-CS-01` |
| `playbook_version` | Version playbook | Agent/System | Required | Proposal, draft, READY | `1.0` |
| `matched_rule_ids` | Rule đã match | Agent | Required | Proposal/explainability | Non-empty allowlisted array |
| `classification_reason` | Lý do chọn playbook | Agent | Required | Proposal | Non-empty; không kết luận ngoài nguồn |
| `source_references` | Field/evidence nguồn cho decision | Agent | Required | Proposal/exception/warning | Non-empty valid references |
| `work_order_draft_id` | ID bản nháp mô phỏng | System | Required | Draft, READY | `SIM-WOD-*` |
| `source_revision` | Revision nguồn dùng tạo draft | System | Required | Draft/idempotency | Non-empty revision |
| `idempotency_key` | Khóa chống duplicate draft | System | Required | Draft | `ticket_id+playbook_version+source_revision` |
| `scope_summary` | Phạm vi draft chỉ từ nguồn/proposal | Agent | Required | Draft | Non-empty; source-grounded |
| `draft_status` | Trạng thái bản nháp | System | Required | Draft | Constant `DRAFT` |
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
| `reference_ticket_id` | Mã ticket được hỏi tiến độ | Fixture/human verified source | Required | CS pre-draft, evidence | Non-empty synthetic ID; không infer |
| `processing_history_snapshot` | Snapshot history mô phỏng chỉ đọc | Fixture/System; immutable | Required | CS pre-draft/comparison | Non-empty structured source |
| `request_claims` | Claim có cấu trúc từ current request fixture | Fixture; immutable | Optional per field | CS comparison | Map allowlisted field → value/source ref |
| `recorded_status` | Status dùng đối chiếu | Request/history sources | Optional per source; required when compared | CS conflict | Comparable normalized value |
| `outcome_code` | Mã kết quả dùng đối chiếu | Request/history sources | Optional per source; required when compared | CS conflict | Comparable simulated enum/value |
| `last_processing_time` | Mốc xử lý gần nhất dùng đối chiếu | Request/history sources | Optional per source; required when compared | CS conflict | ISO 8601 |
| `contact_status` | Trạng thái liên hệ dùng đối chiếu | Request/history sources | Optional per source; required when compared | CS conflict | Comparable simulated enum/value |
| `resident_denies_history` | Cư dân phủ nhận history | Fixture/source | Required CS risk evaluation | CS exception | Boolean + source ref; missing không default false |
| `requests_right_wrong_or_responsibility` | Yêu cầu xác định đúng/sai/trách nhiệm | Fixture/source | Required CS risk evaluation | CS exception | Boolean + source ref; missing không default false |
| `sensitive_content_flag` | Cờ fixture cần người có thẩm quyền xem xét | Fixture/System | Required CS risk evaluation | CS exception | Boolean + source ref; missing không default false |
| `comparison_field` | Field CSKH mâu thuẫn | Agent validator | Conditional required | CS exception | `reference_ticket_id|recorded_status|outcome_code|last_processing_time|contact_status` |
| `resident_source_value` | Giá trị từ current request | Immutable source | Conditional required | CS exception | Typed value + source ref |
| `history_source_value` | Giá trị từ history | Immutable source | Conditional required | CS exception | Same comparable type + source ref |

## 4.3 Material and evidence fields

| Field name | Ý nghĩa nghiệp vụ | Owner/source | Required/optional | Gate sử dụng | Enum/constraint dự kiến |
|---|---|---|---|---|---|
| `material_requirement_mode` | Playbook/draft có theo dõi line hay N/A | Playbook/System | Required | Draft/material | `TRACKED|N_A` |
| `planned_qty` | Số lượng dự kiến mô phỏng | Fixture/nhân sự thực hiện | Required per tracked line | Material | Number ≥ 0 |
| `norm_qty` | Định mức mô phỏng nếu cấu hình | Fixture | Conditional per tracked line | Material | Number ≥ 0 hoặc null khi `norm_label=N_A` |
| `norm_label` | Nhãn tính chất norm | System/playbook | Required per tracked line | Material | `SYNTHETIC|N_A` |
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
| `PB-COM-R-ING-01` | Thiếu/blank/`UNKNOWN` một trong ba raw classification fields | Liệt kê exact field; không proposal/draft | `CHỜ_XÁC_MINH` | `TC-ING-001` |
| `PB-COM-R-IMM-01` | Bất kỳ actor cố sửa raw content/evidence | `ACTION_DENIED`, raw unchanged, audit | State không đổi | `TC-ING-002`, `TC-PERM-001` |
| `PB-COM-R-CLS-01` | Ticket hợp lệ nhưng không match duy nhất một playbook v1 | Nêu ambiguity/out-of-scope; không invent playbook | `CHỜ_XÁC_MINH` | `TC-CLASS-004` |
| `PB-COM-R-CFM-01` | Agent proposal chưa được BPTN confirm | Chờ confirmation; không draft | `CHỜ_XÁC_MINH` | `TC-CLASS-005` |
| `PB-COM-R-LOC-01` | Thiếu/`UNKNOWN` location tại pre-draft | Nêu field; không draft | `CHỜ_XÁC_MINH` | `TC-WO-004` |
| `PB-COM-R-WO-01` | Confirmation/location pass, không blocker | Tạo một draft idempotent `SIMULATED` | `IN_PROGRESS` | `TC-WO-001/002` |
| `PB-COM-R-CHK-01` | Còn required checklist `PENDING` | Nêu item pending | `IN_PROGRESS` | `TC-CHK-001` |
| `PB-COM-R-EVD-01` | Minimum evidence đã biết bị thiếu/sai type/unreadable | Nêu requirement lỗi | `IN_PROGRESS` | `TC-EVD-001/003/005` |
| `PB-COM-R-EVD-02` | Không xác định được requirement đúng hoặc source/readability cần người xác minh | Nêu dữ liệu cần xác minh | `CHỜ_XÁC_MINH` | `TC-EVD-001` variant |
| `PB-COM-R-MAT-01` | Tracked material chưa đủ qty/reconciliation | Nêu field/comparison chưa hoàn tất | `IN_PROGRESS` | `TC-MAT-001..003` setup |
| `PB-COM-R-MAT-02` | Có applicable variance nhưng thiếu `variance_reason` | Nêu line/comparison cần reason | `CHỜ_XÁC_MINH` | `TC-MAT-004` |
| `PB-COM-R-WARN-01` | Applicable variance có reason, không blocker khác | Tạo/hiển thị `EXPLAINED_MATERIAL_VARIANCE` | Không transition; state giữ nguyên cho tới khi READY gate chạy | `TC-STATE-002` |
| `PB-COM-R-READY-01` | Đủ playbook, draft, required fields, evidence, checklist, material; no blocker | Gate breakdown + reason + audit | `READY_FOR_REVIEW` | `TC-STATE-001` |
| `PB-COM-R-PERM-01` | Agent/actor yêu cầu action ngoài quyền | `ACTION_DENIED`; audit; no side effect/exception | State không đổi | `TC-PERM-001..004` |
| `PB-COM-R-AUD-01` | Audit không ghi được cho attempted mutation/transition | Fail closed; rollback attempted change | State/data không đổi | `TC-AUD-003` |
| `PB-COM-R-SEC-01` | Content/evidence chứa instruction | Treat as untrusted data; không làm theo | Không transition do instruction; state giữ nguyên | `TC-SEC-001/002` |

---

# 6. Playbook `PB-CLN-01` — Vệ sinh khu vực chung

## 6.1 Identity và trigger

| Thuộc tính | Giá trị |
|---|---|
| Use case | `UC-CLN-01` |
| Version | `1.0` |
| Classification proposal | `service_category_normalized=VE_SINH`; `ticket_type_normalized=COMMON_AREA_CLEANING` |
| Trigger | Raw description mô phỏng phản ánh khu vực chung cần vệ sinh |
| Happy-path boundary | Không có composite hazard exception; ticket thuộc đúng scope vệ sinh khu vực chung |
| Exception | Chất lỏng/chất bẩn không rõ nguồn gốc **và** có dấu hiệu nguy hại |
| Value output | Work order draft mô phỏng + requirement package để BQL review |

## 6.2 Gate fields và owner

| Gate | Required fields/conditions | Owner |
|---|---|---|
| Classification | Common raw trio | System/resident source |
| Proposal | Service/type/playbook/rule/reason/source refs | Agent |
| Risk evaluation | `unknown_substance_status`, `hazard_signal_status`, source refs | Agent từ source, deterministic rule |
| Pre-draft | BPTN-confirmed service/type; valid location | BPTN |
| Execution | All CLN checklist items; processing note evidence; material gate | Nhân sự thực hiện |
| READY | Seven common gates pass | Agent validator |

## 6.3 Classification và exception rules

| Rule ID | Condition | Output | State |
|---|---|---|---|
| `PB-CLN-R-TRG-01` | Raw trio valid; description matches common-area cleaning; no ambiguity | Propose CLN service/type/playbook with source | `CHỜ_XÁC_MINH` while BPTN confirmation pending |
| `PB-CLN-R-EX-01` | `unknown_substance_status=PRESENT` **and** `hazard_signal_status=PRESENT` | Create blocking exception, route BQL; no standard instructions/draft | `EXCEPTION` |
| `PB-CLN-R-RISK-01` | Một trong hai risk statuses là `UNCLEAR` | Nêu signal/source cần xác minh; không standard draft | `CHỜ_XÁC_MINH` |
| `PB-CLN-R-SAFE-01` | Một status `PRESENT`, status kia `ABSENT` | Không đủ điều kiện exception; tiếp tục gates, không tuyên bố an toàn | `IN_PROGRESS` |
| `PB-CLN-R-EVD-01` | Required processing note không pass validity | Nêu requirement lỗi; ảnh không được dùng thay thế | `IN_PROGRESS` |
| `PB-CLN-R-READY-01` | Mọi common + CLN gate pass | Create readiness breakdown | `READY_FOR_REVIEW` |

`PB-CLN-R-RISK-01` và `PB-CLN-R-SAFE-01` là `SIMULATED ASSUMPTION` cho fixture deterministic theo handoff gap `GAP-B-02`; không phải rule hiện trường thật.

## 6.4 Happy path và transition

| Bước | Actor | Action/condition | From | To | Audit/output |
|---:|---|---|---|---|---|
| 1 | System/Agent | Ingest + validate raw trio | Event | `IN_PROGRESS` hoặc `CHỜ_XÁC_MINH` | Validation result, audit |
| 2 | Agent | Propose CLN playbook; evaluate composite risk | `IN_PROGRESS` | `CHỜ_XÁC_MINH`, `IN_PROGRESS` hoặc `EXCEPTION` | Proposal/rule/source hoặc exception |
| 3 | BPTN | Confirm service/type + location | `CHỜ_XÁC_MINH` | `IN_PROGRESS` | Admin revision + audit |
| 4 | Agent | Create idempotent draft | `IN_PROGRESS` | `IN_PROGRESS` | `SIM-WOD-*` |
| 5 | Nhân sự thực hiện | Update checklist/material/evidence | `IN_PROGRESS` | `IN_PROGRESS` | Execution audit |
| 6 | Agent | Reconcile and validate all gates | `IN_PROGRESS` | `READY_FOR_REVIEW` nếu pass | Gate breakdown, warning nếu có, audit |

Exception path dừng tại bước 2 và chuyển `EXCEPTION`. Agent không tạo hướng dẫn xử lý chất nguy hại và không tiếp tục standard draft.

## 6.5 Work order draft output

Draft bắt buộc có:

- `work_order_draft_id`, `ticket_id`, `playbook_id=PB-CLN-01`, `playbook_version=1.0`;
- `source_revision`, `idempotency_key`, `scope_summary` source-grounded;
- Agent reason, matched rules, source references;
- CLN checklist template instances;
- `material_requirement_mode=TRACKED|N_A` và requirement tương ứng;
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
| `AC-PB-CLN-02` | Service/type chưa confirmed hoặc location thiếu | Agent nhận request tạo draft | Không draft; state `CHỜ_XÁC_MINH`; exact gate được nêu |
| `AC-PB-CLN-03` | Hai composite hazard signals `PRESENT` | Risk rule chạy | State `EXCEPTION`, route BQL, không guidance/standard draft |
| `AC-PB-CLN-04` | Risk signal `UNCLEAR` | Risk rule chạy | State `CHỜ_XÁC_MINH`; không suy đoán |
| `AC-PB-CLN-05` | Checklist complete nhưng processing note thiếu/sai | Readiness chạy | Evidence gate fail, state `IN_PROGRESS`; không READY |
| `AC-PB-CLN-06` | Ảnh không có nhưng mọi required gate khác pass | Readiness chạy | Ảnh không block; state có thể `READY_FOR_REVIEW` |
| `AC-PB-CLN-07` | Material variance có reason và không blocker khác | Reconcile/readiness chạy | Warning hiển thị; READY được phép nếu mọi gate pass |
| `AC-PB-CLN-08` | Mọi gate pass | Readiness chạy | `READY_FOR_REVIEW`; output không dùng ngôn ngữ nghiệm thu/đóng/phê duyệt |

Negative coverage: raw edit, Agent auto-complete checklist, variance thiếu reason, injection trong note và Agent approve material đều phải bị chặn theo common rules.

---

# 7. Playbook `PB-TEC-01` — Đèn khu vực chung không hoạt động

## 7.1 Identity và trigger

| Thuộc tính | Giá trị |
|---|---|
| Use case | `UC-TEC-01` |
| Version | `1.0` |
| Classification proposal | `service_category_normalized=KY_THUAT`; `ticket_type_normalized=COMMON_AREA_LIGHTING` |
| Trigger | Raw description mô phỏng báo đèn chiếu sáng khu vực chung không hoạt động |
| Optional support proposal | `asset_type=LIGHTING`; `reported_symptom=NOT_WORKING` |
| Exception | Có mùi khét, tia lửa hoặc dây điện hở |
| Value output | Work order draft mô phỏng không có chẩn đoán + requirement package |

## 7.2 Gate fields và owner

| Gate | Required fields/conditions | Owner |
|---|---|---|
| Classification | Common raw trio | System/resident source |
| Proposal | Service/type/playbook/rule/reason/source refs | Agent |
| Risk evaluation | Ba electrical-risk statuses + source refs | Agent từ source, deterministic rule |
| Pre-draft | BPTN-confirmed service/type; valid location | BPTN |
| Execution | All TEC checklist items; result note; material gate | Nhân sự thực hiện |
| READY | Seven common gates pass | Agent validator |

## 7.3 Classification và exception rules

| Rule ID | Condition | Output | State |
|---|---|---|---|
| `PB-TEC-R-TRG-01` | Raw trio valid; common-area lighting not working; no ambiguity | Propose TEC service/type/playbook | `CHỜ_XÁC_MINH` while BPTN confirmation pending |
| `PB-TEC-R-EX-01` | Bất kỳ `burning_smell_status`, `spark_status`, `exposed_wire_status` là `PRESENT` | Blocking exception, route BQL; no diagnosis/guidance/standard draft | `EXCEPTION` |
| `PB-TEC-R-RISK-01` | Bất kỳ electrical-risk status là `UNCLEAR` và không signal nào `PRESENT` | Nêu signal/source cần xác minh; không standard draft | `CHỜ_XÁC_MINH` |
| `PB-TEC-R-EVD-01` | Required result note không pass validity | Nêu requirement lỗi; ảnh không thay thế | `IN_PROGRESS` |
| `PB-TEC-R-MAT-01` | Tracked material chưa đủ qty hoặc reconciliation chưa chạy | Nêu field/comparison còn thiếu | `IN_PROGRESS` |
| `PB-TEC-R-MAT-02` | Có applicable variance nhưng thiếu `variance_reason` | Nêu line/comparison cần reason | `CHỜ_XÁC_MINH` |
| `PB-TEC-R-READY-01` | Mọi common + TEC gate pass | Create readiness breakdown | `READY_FOR_REVIEW` |

Nếu đồng thời có `PRESENT` và `UNCLEAR`, `PB-TEC-R-EX-01` ưu tiên và kết quả duy nhất là `EXCEPTION`.

## 7.4 Happy path và transition

| Bước | Actor | Action/condition | From | To | Audit/output |
|---:|---|---|---|---|---|
| 1 | System/Agent | Ingest + validate raw trio | Event | `IN_PROGRESS` hoặc `CHỜ_XÁC_MINH` | Validation result |
| 2 | Agent | Propose TEC playbook; run three risk checks | `IN_PROGRESS` | `CHỜ_XÁC_MINH`, `IN_PROGRESS` hoặc `EXCEPTION` | Proposal hoặc exception |
| 3 | BPTN | Confirm service/type + location | `CHỜ_XÁC_MINH` | `IN_PROGRESS` | Admin revision + audit |
| 4 | Agent | Create idempotent non-diagnostic draft | `IN_PROGRESS` | `IN_PROGRESS` | `SIM-WOD-*` |
| 5 | Nhân sự thực hiện | Update checklist/result/material | `IN_PROGRESS` | `IN_PROGRESS` | Execution audit |
| 6 | Agent | Reconcile and validate | `IN_PROGRESS` | `READY_FOR_REVIEW` nếu pass | Gate breakdown/warning/audit |

Exception path dừng tại bước 2. Agent không chẩn đoán nguyên nhân, hướng dẫn xử lý, xác nhận an toàn hoặc tiếp tục standard work.

## 7.5 Work order draft output

Draft bắt buộc có common draft fields và:

- `playbook_id=PB-TEC-01`, `playbook_version=1.0`;
- mô tả đúng location/lighting symptom từ nguồn, không có nguyên nhân suy đoán;
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
| `AC-PB-TEC-02` | BPTN confirmation/location chưa pass | Create draft được yêu cầu | Không draft; `CHỜ_XÁC_MINH` |
| `AC-PB-TEC-03` | Bất kỳ high-risk signal `PRESENT` | Risk rule chạy | `EXCEPTION`, BQL handler, no diagnosis/guidance/standard draft |
| `AC-PB-TEC-04` | Không signal `PRESENT` nhưng có signal `UNCLEAR` | Risk rule chạy | `CHỜ_XÁC_MINH`; không suy đoán |
| `AC-PB-TEC-05` | Safety checklist còn `PENDING` | Readiness chạy | `IN_PROGRESS`; item được nêu; không READY |
| `AC-PB-TEC-06` | Result note thiếu hoặc unreadable | Evidence validation chạy | `IN_PROGRESS`; evidence gate fail |
| `AC-PB-TEC-07` | Material `RECONCILED` hoặc gate `N/A`, mọi gate khác pass | Readiness chạy | Material gate pass; CS-like zero line chỉ khi explicit `N/A` |
| `AC-PB-TEC-08` | Mọi gate pass | Readiness chạy | `READY_FOR_REVIEW`; không có quality/acceptance conclusion |

Negative coverage: model suy đoán nguyên nhân, Agent approve material, phép so sánh thứ tư, ảnh bị bắt buộc và instruction injection đều phải fail theo common rules.

---

# 8. Playbook `PB-CS-01` — Cập nhật tiến độ ticket

## 8.1 Identity và trigger

| Thuộc tính | Giá trị |
|---|---|
| Use case | `UC-CS-01` |
| Version | `1.0` |
| Classification proposal | `service_category_normalized=CSKH`; `ticket_type_normalized=STATUS_UPDATE` |
| Trigger | Cư dân yêu cầu cập nhật tiến độ ticket đã có mã tham chiếu |
| Required sources trước draft/comparison | `reference_ticket_id`, `processing_history_snapshot` |
| Exception | Conflict xác định trên cùng field, resident denial, right/wrong/responsibility request hoặc sensitive fixture flag |
| Value output | Work order draft CSKH + response/contact records dạng draft; không gửi cư dân |

## 8.2 Gate fields và owner

| Gate | Required fields/conditions | Owner |
|---|---|---|
| Classification | Common raw trio | System/resident source |
| Proposal | CS service/type/playbook/rule/reason/source refs | Agent |
| Pre-draft/source | Confirmed service/type + location + `reference_ticket_id` + non-empty history snapshot | BPTN + fixture/source |
| Conflict evaluation | Intersection của allowlisted fields có hai source; sensitive/dispute flags | Agent deterministic comparator/fixture |
| Execution/evidence | Ba evidence requirements + four CS checklist items | Nhân sự thực hiện/fixture |
| Material | Explicit `N/A`, zero material lines | Playbook/System |
| READY | Seven common gates pass | Agent validator |

## 8.3 Two-source comparison contract

`SIMULATED ASSUMPTION`: fixture có thể cung cấp structured immutable `request_claims[field]`, mỗi claim gồm value và source reference; history value nằm trong immutable `processing_history_snapshot`. Cấu trúc này chỉ giúp deterministic test, không phải Agent tự suy diễn claim từ text.

Allowlist field:

- `reference_ticket_id`
- `recorded_status`
- `outcome_code`
- `last_processing_time`
- `contact_status`

Conflict chỉ tồn tại khi hai nguồn hiện hữu nói về cùng field, cùng kiểu so sánh và có giá trị không tương thích. Nếu toàn current request source hoặc history source bị thiếu, hoặc một claim cần so sánh không có source đối ứng, kết quả là `CHỜ_XÁC_MINH`, không tự gọi conflict. Agent chỉ hiển thị field, hai source/value và rule; không có field kết luận nguồn nào đúng.

`SIMULATED ASSUMPTION`: fixture cung cấp typed normalized values. Hai values compatible khi bằng nhau chính xác sau type normalization; khác nhau trên cùng field là incompatible. Riêng `last_processing_time` được chuẩn hóa về cùng ISO 8601 instant trước khi so sánh. Không dùng fuzzy/semantic inference.

## 8.4 Classification và exception rules

| Rule ID | Condition | Output | State |
|---|---|---|---|
| `PB-CS-R-TRG-01` | Raw trio valid; request là status update | Propose CS service/type/playbook | `CHỜ_XÁC_MINH` while BPTN confirmation pending |
| `PB-CS-R-SRC-01` | Thiếu `reference_ticket_id`, `processing_history_snapshot`, một CS risk flag bắt buộc hoặc source của flag | Nêu source/flag thiếu; không default false, guess, conflict hoặc draft | `CHỜ_XÁC_MINH` |
| `PB-CS-R-CMP-01` | Hai sources cùng allowlisted field có compatible values | Record comparison pass; không kết luận chất lượng | `IN_PROGRESS` |
| `PB-CS-R-EX-01` | Hai sources cùng allowlisted field có incompatible values | Create conflict exception with exact field/values/refs | `EXCEPTION` |
| `PB-CS-R-EX-02` | `resident_denies_history=true` | Create dispute exception; no right/wrong conclusion | `EXCEPTION` |
| `PB-CS-R-EX-03` | `requests_right_wrong_or_responsibility=true` | Create dispute exception; route BQL | `EXCEPTION` |
| `PB-CS-R-EX-04` | `sensitive_content_flag=true` | Create sensitive-content exception; route BQL | `EXCEPTION` |
| `PB-CS-R-EVD-01` | Một trong ba evidence requirements không pass validity | Nêu requirement lỗi | `IN_PROGRESS` |
| `PB-CS-R-MAT-01` | CSKH case hợp lệ | `material_gate_status=N/A`; zero material lines | `IN_PROGRESS` cho tới khi các gate khác pass |
| `PB-CS-R-READY-01` | Mọi common + CS gate pass, no exception | Create readiness breakdown | `READY_FOR_REVIEW` |

Exception rules ưu tiên READY. `SIMULATED ASSUMPTION`: nếu nhiều CS exception rules cùng kích hoạt, tạo đúng một `ExceptionRecord` cho mỗi triggered rule; các record dùng cùng `ticket_id` và được nhóm khi truy vấn theo ticket, không thêm Package entity. State duy nhất vẫn là `EXCEPTION`.

## 8.5 Happy path và transition

| Bước | Actor | Action/condition | From | To | Audit/output |
|---:|---|---|---|---|---|
| 1 | System/Agent | Ingest + validate raw trio | Event | `IN_PROGRESS` hoặc `CHỜ_XÁC_MINH` | Validation result |
| 2 | Agent | Propose CS playbook | `IN_PROGRESS` | `CHỜ_XÁC_MINH` while pending confirmation | Proposal/rule/source |
| 3 | BPTN | Confirm service/type + location | `CHỜ_XÁC_MINH` | `IN_PROGRESS` | Admin revision + audit |
| 4 | Agent | Validate reference/history and run comparison/sensitive rules | `IN_PROGRESS` | `IN_PROGRESS`, `CHỜ_XÁC_MINH` hoặc `EXCEPTION` | Comparison/exception output |
| 5 | Agent | Create idempotent CS draft; material `N/A` | `IN_PROGRESS` | `IN_PROGRESS` | `SIM-WOD-*` |
| 6 | Nhân sự thực hiện | Complete checklist and three evidence records | `IN_PROGRESS` | `IN_PROGRESS` | Execution audit |
| 7 | Agent | Validate all gates | `IN_PROGRESS` | `READY_FOR_REVIEW` nếu pass | Gate breakdown/audit |

Không có action gửi response hoặc message cho cư dân.

## 8.6 Work order draft output

Draft bắt buộc có common draft fields và:

- `playbook_id=PB-CS-01`, `playbook_version=1.0`;
- `reference_ticket_id` và reference tới immutable history snapshot;
- comparison allowlist/rule version và source references;
- CS checklist template instances;
- ba evidence requirement IDs;
- `material_requirement_mode=N_A`, `material_gate_status=N/A`, zero `MaterialLine`;
- nội dung xử lý/response chỉ mang trạng thái draft; không có send action.

## 8.7 Checklist template

| Template item ID | Label mô phỏng | Owner update | Required | Pass condition |
|---|---|---|---|---|
| `CS-CHK-01` | Reference ticket và history snapshot đã được liên kết | Nhân sự thực hiện | Có | `COMPLETED`; source links present; System fixture chỉ cung cấp links |
| `CS-CHK-02` | Đối chiếu các field allowlist có đủ hai nguồn đã hoàn tất | Nhân sự thực hiện ghi nhận từ Agent comparison result | Có | `COMPLETED`; comparison result linked |
| `CS-CHK-03` | Nội dung xử lý hoặc bản nháp phản hồi đã được chuẩn bị | Nhân sự thực hiện | Có | `COMPLETED`; evidence link present |
| `CS-CHK-04` | Contact log hoặc contact draft đã được chuẩn bị | Nhân sự thực hiện | Có | `COMPLETED`; evidence link present |

`CS-CHK-02` không cho phép Agent tự hoàn tất checklist: Agent chỉ tạo comparison result; nhân sự thực hiện cập nhật item dựa trên record đó.

## 8.8 Evidence và material

Ba evidence requirement độc lập; một record chỉ đáp ứng một requirement:

| Requirement ID | Evidence type | Minimum content |
|---|---|---|
| `CS-EVD-REFERENCE-LINK` | `REFERENCE_TICKET_LINK` | `reference_ticket_id` + link đúng current case/draft |
| `CS-EVD-RESPONSE-CONTENT` | `RESPONSE_CONTENT_OR_DRAFT` | Nội dung xử lý hoặc response draft không rỗng |
| `CS-EVD-CONTACT-RECORD` | `CONTACT_LOG_OR_DRAFT` | Contact log hoặc contact draft không rỗng; không biểu thị đã gửi |

Ảnh không áp dụng. Material luôn `N/A`, zero line; không tạo material warning cho CSKH.

## 8.9 Acceptance criteria

| AC ID | Given | When | Then |
|---|---|---|---|
| `AC-PB-CS-01` | Raw trio hợp lệ và request là status update | Agent classify | Đề xuất đúng CS playbook/service/type, có reason/source |
| `AC-PB-CS-02` | Thiếu reference ticket hoặc history snapshot | Source validation chạy | `CHỜ_XÁC_MINH`; no guessed ID/conflict/draft |
| `AC-PB-CS-03` | Hai sources cùng allowlisted field có giá trị incompatible | Comparator chạy | `EXCEPTION`; output exact field/two values/refs; no correct-source conclusion |
| `AC-PB-CS-04` | Resident denial, responsibility request hoặc sensitive flag | Exception rules chạy | `EXCEPTION`; route BQL; không outbound response |
| `AC-PB-CS-05` | Hai sources có giá trị compatible và không sensitive/dispute | Comparator chạy | Không conflict exception; tiếp tục `IN_PROGRESS` |
| `AC-PB-CS-06` | Checklist complete nhưng một evidence record thiếu/sai | Readiness chạy | `IN_PROGRESS`; exact requirement fail; không READY |
| `AC-PB-CS-07` | Case CSKH bất kỳ | Material validation chạy | `N/A`, zero `MaterialLine`, không warning variance |
| `AC-PB-CS-08` | Mọi gate pass, no exception | Readiness chạy | `READY_FOR_REVIEW`; package là draft, không có send/complete/close action |

Negative coverage: Agent tự điền reference ID, sửa history, dùng một record pass hai requirements, tạo material line, kết luận bên đúng/sai hoặc gửi message đều phải bị chặn/audit.

# 9. Work order output contract chung

Mọi work order draft phải chứa tối thiểu:

| Nhóm | Field/output bắt buộc |
|---|---|
| Identity/link | `work_order_draft_id`, `ticket_id`, `playbook_id`, `playbook_version`, `source_revision`, `idempotency_key` |
| Boundary | `synthetic=true`, `draft_status=DRAFT`, nhãn “bản nháp/mô phỏng” |
| Scope | `scope_summary`, `location_normalized`, confirmed service/type |
| Explainability | `generation_reason`, `matched_rule_ids`, `source_references` |
| Requirements | Checklist template instances, material mode/gate, evidence requirement IDs |
| Safety | Không blocking exception tại thời điểm tạo; permission/state decision trace |

Retry cùng `ticket_id + playbook_version + source_revision` trả cùng logical draft hoặc controlled revision, không tạo duplicate.

# 10. READY, exception và invalid action oracle

## 10.1 READY gate

`READY_FOR_REVIEW` chỉ khi đồng thời:

1. Có `playbook_id`/version hợp lệ.
2. Có work order draft hợp lệ.
3. Required fields ở mọi gate đã pass.
4. Mọi required checklist item `COMPLETED`.
5. Mọi minimum evidence requirement `PRESENT` và hợp lệ.
6. Material `RECONCILED` hoặc `N/A`.
7. Không có blocking exception.

`EXPLAINED_MATERIAL_VARIANCE` có thể còn active nhưng phải hiển thị rule, reason và comparison source.

## 10.2 Exception output

Mỗi exception record phải có `exception_id`, `ticket_id`, `exception_type`, `blocking=true`, `rule_id`, `reason`, `source_references`, mức routing mô phỏng, `authorized_handler=BQL`, `status=OPEN`, audit và `synthetic=true`. CSKH conflict bổ sung comparison field/two values. Agent không có quyền set `RESOLVED_BY_BQL`.

## 10.3 Action vượt quyền

Các yêu cầu Agent sửa raw source, tự complete checklist, nghiệm thu, đóng ticket, phê duyệt/điều chỉnh vật tư, xác nhận chất lượng, gửi message, yêu cầu cư dân bổ sung ảnh hoặc resolve exception phải:

- trả `ACTION_DENIED`;
- không thay đổi dữ liệu/state;
- không tạo business exception;
- tạo audit/security event có actor/action/reason.

# 11. Handoff decisions và Implementation Gaps

Agent A đã quyết định toàn bộ gaps nhận được từ AI/Data vòng handoff đầu tiên:

| Gap ID | Disposition | Quyết định áp dụng |
|---|---|---|
| `GAP-B-01` | `APPROVE` | Toàn gate `N/A` = zero line. Tracked line dùng numeric qty; `norm_qty` nullable khi `norm_label=N_A`; không lưu literal `N/A` trong numeric field. |
| `GAP-B-02` | `SIMULATED ASSUMPTION` | CLN exception cần hai signal `PRESENT`; signal `UNCLEAR` → `CHỜ_XÁC_MINH`; one-present/one-absent không đủ exception, tiếp tục `IN_PROGRESS` nhưng không tuyên bố an toàn. |
| `GAP-B-03` | `SIMULATED ASSUMPTION` | CS fixture dùng immutable structured `request_claims` và history snapshot để deterministic compare; Agent không tự suy diễn claim. |
| `GAP-B-04` | `APPROVE` | Ba evidence requirements CSKH độc lập; một record không pass hai requirements. |
| `GAP-B-05` | `APPROVE` | `READABLE` hoặc structured `NOT_APPLICABLE` mới pass; `UNREADABLE` không pass và giữ `IN_PROGRESS` khi requirement đã biết. |
| `GAP-B-06` | `APPROVE` | Ba CS risk flags là boolean; thiếu flag/source bắt buộc → `PB-CS-R-SRC-01` và `CHỜ_XÁC_MINH`; không default missing thành false. |
| `GAP-B-07` | `SIMULATED ASSUMPTION` | Typed exact equality quyết định compatible; `last_processing_time` so normalized ISO instant; không fuzzy/semantic inference. |
| `GAP-B-08` | `APPROVE` | Owner update `CS-CHK-01` là Nhân sự thực hiện; System fixture chỉ cung cấp source links. |
| `GAP-B-09` | `SIMULATED ASSUMPTION` | Một ExceptionRecord cho mỗi triggered CS rule; group theo ticket; không thêm Package entity. |

Không còn Implementation Gap undecided trong batch này. Các quyết định mang nhãn `SIMULATED ASSUMPTION` chỉ dùng cho prototype fixture/test oracle.

# 12. Cross-review checklist

| Điều kiện | Kết quả cuối | Evidence trong Playbook/Data Contract |
|---|---|---|
| Mỗi required field có owner và gate | PASS | §3–§4, per-playbook gate tables |
| Mỗi field playbook có mục đích nghiệp vụ | PASS | Field Matrix §4 |
| Mỗi routing rule dẫn tới đúng state | PASS | §5, §6.3, §7.3, §8.4 |
| Mỗi READY gate có dữ liệu kiểm tra được | PASS | §3.2, §10.1 |
| Không Agent authority vượt scope | PASS | §2, §3.5, §10.3 |
| Không ảnh bắt buộc toàn cục | PASS | §3.3 và từng playbook |
| `norm_qty` là mô phỏng hoặc `N/A` | PASS | §3.4, §4.3 |
| Mọi nội dung chưa có dữ liệu thật gắn `SIMULATED` | PASS | Metadata, §1.1, output contract |
| Mapping required field → entity/validator | PASS | `data-contract-v1.md` v1.0 §§5–7 |
| Rule/checklist/evidence ID integrity | PASS | Hai catalog đã đồng bộ; không còn stale ID |
| Field không có business purpose | PASS | Không phát hiện field mồ côi sau cross-review |

## 12.1 Cross-review record

- Agent A đã review Data Contract về field mapping, owner, required timing, validator/state, permission và field purpose.
- Agent B đã reverse-review Playbook về canonical schema names, rule/evidence/checklist IDs và tính testable của comparator.
- Findings đã đóng: checklist instances/status bắt buộc từ lúc tạo draft; `material_requirement_mode` có field riêng; stale rule IDs được loại; evidence link mismatch không bị gán sai thành type error; CS flags/comparator/exception cardinality đã có oracle deterministic.
- `GAP-B-01` đến `GAP-B-09`: tất cả `CLOSED`; không có disposition bị bỏ trống.
- Kết quả: không có P0 logic mismatch giữa Playbook v1 và Data Contract v1.

# 13. Open Issues

`No blocking open issues` cho Playbook v1 và Data Contract v1. Tên Product approver/proxy và approval record thuộc governance `OD-09` của bộ tài liệu sản phẩm, không làm thay đổi schema/rule của hai deliverable này.
