# MaintenanceOps Agent — Data Contract v1

> **Document status:** FINAL — cross-reviewed với Playbook v1  
> **Version:** 1.0  
> **Ngày:** 2026-09-27  
> **Owner duy nhất:** Agent B — AI/Data Owner  
> **Business reviewer:** Agent A — Product/BA Owner  
> **Data classification:** `SIMULATED` — toàn bộ instance, workflow, rule, checklist, vật tư, bằng chứng, định mức và kết quả trong contract này là dữ liệu mô phỏng; không phải dữ liệu hoặc quy trình vận hành thật của Vinhomes.

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1-draft | 2026-09-27 | Phase 1: entity map sơ bộ theo PRD v0.2 và decisions đã khóa | DRAFT |
| 0.9 | 2026-09-27 | Phase 2: áp dụng Field Matrix v1; hoàn thiện field-level schema, validators, state machine, permission/immutability/audit và dispositions cho Implementation Gaps | CROSS-REVIEW DRAFT |
| 1.0 | 2026-09-27 | Phase 3: reverse-review Playbook; align canonical field/rule/evidence IDs, checklist timing, material mode, CSKH comparator/cardinality; đóng `GAP-B-01..09` | FINAL |

---

## 1. Mục đích, phạm vi và ranh giới

Data Contract này là đầu vào thống nhất cho AI, UI và QA của prototype mô phỏng. Contract chỉ bao phủ:

- `PB-CLN-01`: vệ sinh khu vực chung và exception chất không rõ nguồn gốc có dấu hiệu nguy hại.
- `PB-TEC-01`: đèn khu vực chung không hoạt động và exception mùi khét/tia lửa/dây điện hở.
- `PB-CS-01`: cập nhật tiến độ ticket và exception conflict/tranh chấp/nội dung nhạy cảm.
- Bốn state: `IN_PROGRESS`, `CHỜ_XÁC_MINH`, `READY_FOR_REVIEW`, `EXCEPTION`.
- Chín entity bắt buộc, các value object phục vụ validation, state, warning và explainability.

Contract không định nghĩa UI, integration thật, work order thật, SOP hiện trường, SLA thật, định mức thật, tồn kho thật, computer vision, outbound messaging, tài chính hoặc use case ngoài ba playbook trên.

## 2. Quy ước contract

### 2.1 Nhãn và ID mô phỏng

- Mọi entity instance bắt buộc có `synthetic=true`.
- Mọi ID instance bắt đầu bằng `SIM-`; ID template/rule tĩnh có prefix playbook tương ứng.
- `norm_qty` có dữ liệu số luôn đi với `norm_label=SYNTHETIC`; nếu chưa cấu hình norm thì `norm_qty=null`, `norm_label=N_A`.
- Không field nào được mô tả là dữ liệu, quy trình, định mức hoặc kết quả vận hành thật.

### 2.2 Required và gate

- `R-CLASSIFICATION`: bắt buộc trước classification.
- `R-PRE_DRAFT`: bắt buộc trước khi tạo `WorkOrderDraft`.
- `R-READY`: bắt buộc để đạt `READY_FOR_REVIEW`.
- `C-*`: conditional; điều kiện được ghi tại field.
- `O`: optional; không được Agent tự suy đoán để lấp đầy.
- Giá trị `UNKNOWN`, blank hoặc whitespace-only được phép lưu khi enum/type cho phép, nhưng không thỏa bất kỳ required gate nào.

### 2.3 Source/owner chuẩn

- `RESIDENT_SOURCE`: dữ liệu gốc cư dân; immutable.
- `SYSTEM_INGEST`: fixture/system tạo ID, time, integrity metadata; sau ingest là immutable.
- `AGENT_PROPOSAL`: Agent chỉ ghi proposal/derived result, không ghi đè source hoặc human fields.
- `BPTN`: xác nhận/chỉnh field hành chính allowlisted.
- `HUMAN_EXECUTION`: nhân sự thực hiện cập nhật checklist, material, execution evidence.
- `BQL`: chỉ xử lý business exception/resolution trong phạm vi prototype.
- `SYSTEM_DERIVED`: validator/state engine ghi kết quả có rule/source/version; không phải human approval.

### 2.4 Canonical codes

- Stored state dùng `CHỜ_XÁC_MINH` có underscore theo quyết định mới nhất. Nhãn hiển thị có thể là “CHỜ XÁC MINH” nhưng không phải stored enum khác.
- Permission denial canonical code là `ACTION_DENIED`. Tên cũ `ACTION_OUT_OF_AUTHORITY` chỉ là deprecated documentation alias, không được emit trong v1.
- Timestamp dùng ISO 8601 có timezone.
- JSON-like object được mô tả ở mức schema; tài liệu này không phải code implementation.

---

## 3. Entity map và quan hệ

| Entity bắt buộc | Vai trò | Quan hệ chính | Write owner | Rào chắn |
|---|---|---|---|---|
| `Ticket` | Raw ticket, admin layer, CSKH source snapshot và current state | Parent của mọi case entity | Raw: ingest-only; admin: BPTN; state: SYSTEM_DERIVED | Raw immutable; state chỉ qua validator |
| `AgentClassificationProposal` | Proposal service/type/playbook + rule/source | N—1 Ticket; 1—0..1 logical draft | Agent | Không ghi đè admin/source; không confidence-only |
| `WorkOrderDraft` | Draft mô phỏng, idempotent, readiness aggregate | N—1 Ticket/proposal; parent checklist/material/evidence requirements | Agent/SYSTEM_DERIVED | Không phải work order thật; chỉ tạo sau pre-draft gate |
| `ChecklistTemplate` | Template checklist versioned của playbook | 1—N ChecklistItem | Static simulated config | Không chứa SOP kỹ thuật thật |
| `ChecklistItem` | Instance checklist execution | N—1 WorkOrderDraft/template item | HUMAN_EXECUTION | Agent không tự `COMPLETED` |
| `MaterialLine` | Material record và ba comparison | N—1 WorkOrderDraft | HUMAN_EXECUTION input; Agent derive comparisons | Không approval/inventory/violation conclusion |
| `EvidenceRecord` | Original hoặc execution evidence | N—1 Ticket; 0..1 WorkOrderDraft requirement | Ingest hoặc HUMAN_EXECUTION | Checklist không thay evidence; ảnh optional |
| `ExceptionRecord` | Blocking exception route BQL | N—1 Ticket | Agent create; BQL resolve | Agent không resolve; permission denial không tạo record này |
| `AuditEvent` | Append-only event cho edit/decision/transition/rejection | N—1 Ticket; target polymorphic | SYSTEM | Audit fail → business mutation fail closed |

### 3.1 Supporting value objects, không mở rộng workflow

- `AdministrativeNormalization`: embedded, versioned dưới `Ticket`.
- `ProcessingHistorySnapshot` và `ComparisonSourceValue`: embedded immutable dưới `Ticket.cskh_context`.
- `RuleSignal`: embedded dưới `AgentClassificationProposal`.
- `EvidenceRequirement`, `ReadinessEvaluation`, `NonBlockingWarning`: embedded dưới `WorkOrderDraft`.
- `MaterialComparisonResult`: embedded dưới `MaterialLine`.

```text
Ticket
  ├── 0..N AgentClassificationProposal
  ├── 0..N WorkOrderDraft revisions
  │     ├── 1 ChecklistTemplate reference
  │     ├── 1..N ChecklistItem
  │     ├── 0..N MaterialLine (PB-CS-01 = 0)
  │     └── 1..N EvidenceRequirement links
  ├── 0..N EvidenceRecord
  ├── 0..N ExceptionRecord
  └── 1..N AuditEvent
```

---

## 4. Enum và controlled vocabulary

| Enum | Giá trị hợp lệ |
|---|---|
| `TicketState` | `IN_PROGRESS`, `CHỜ_XÁC_MINH`, `READY_FOR_REVIEW`, `EXCEPTION` |
| `ServiceCategory` | `VE_SINH`, `KY_THUAT`, `CSKH`, `UNKNOWN` |
| `TicketType` | `COMMON_AREA_CLEANING`, `COMMON_AREA_LIGHTING`, `STATUS_UPDATE`, `UNKNOWN` |
| `PlaybookId` | `PB-CLN-01`, `PB-TEC-01`, `PB-CS-01` |
| `ConfirmationStatus` | `PENDING`, `CONFIRMED` |
| `SignalStatus` | `PRESENT`, `ABSENT`, `UNCLEAR` |
| `ChecklistStatus` | `PENDING`, `COMPLETED` |
| `MaterialGateStatus` | `RECONCILED`, `NEEDS_CLARIFICATION`, `N/A` |
| `NormLabel` | `SYNTHETIC`, `N_A` |
| `ComparisonType` | `PLANNED_VS_NORM`, `ISSUED_VS_PLANNED`, `USED_VS_ISSUED` |
| `ComparisonStatus` | `MATCH`, `VARIANCE`, `N/A` |
| `EvidenceType` | `PROCESSING_NOTE`, `RESULT_NOTE`, `REFERENCE_TICKET_LINK`, `RESPONSE_CONTENT_OR_DRAFT`, `CONTACT_LOG_OR_DRAFT`, `SIMULATED_IMAGE`, `RESIDENT_ORIGINAL` |
| `EvidenceValidationStatus` | `PRESENT`, `MISSING`, `INVALID_TYPE`, `SOURCE_UNVERIFIED` |
| `ReadabilityStatus` | `READABLE`, `UNREADABLE`, `NOT_APPLICABLE` |
| `EvidenceSource` | `RESIDENT_ORIGINAL`, `HUMAN_EXECUTION`, `SYSTEM_SIMULATED` |
| `ExceptionType` | `CLEANING_HAZARD`, `ELECTRICAL_HIGH_RISK`, `CSKH_CONFLICT`, `CSKH_DISPUTE`, `CSKH_SENSITIVE` |
| `RiskLevel` | `HIGH_RISK`, `BUSINESS_REVIEW` |
| `ExceptionStatus` | `OPEN`, `RESOLVED_BY_BQL` |
| `WarningType` | `EXPLAINED_MATERIAL_VARIANCE` |
| `ActorRole` | `SYSTEM`, `BPTN`, `AGENT`, `HUMAN_EXECUTION`, `BQL`, `QA_INTERNAL` |
| `ActionResult` | `ALLOWED`, `ACTION_DENIED` |

`priority` không có enum đã khóa. V1 cho phép `string|null` do BPTN nhập từ fixture/config đã xác minh; Agent không được derive và field không tham gia gate.

---

## 5. Field-level schema

Mỗi bảng dùng các cột: field; type; required/gate; enum/const; source/owner; validation; liên kết; ví dụ mô phỏng.

### 5.1 `Ticket`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ `SIMULATED` |
|---|---|---|---|---|---|---|---|
| `ticket_id` | string | `R-CLASSIFICATION` | pattern `SIM-TKT-*` | SYSTEM_INGEST | Non-empty, unique, immutable; `UNKNOWN` invalid | PK; parent key | `SIM-TKT-CLN-001` |
| `created_at` | datetime | `R-CLASSIFICATION` | ISO 8601 | SYSTEM_INGEST | Parseable, timezone present, immutable | Audit ordering | `2026-09-27T08:00:00+07:00` |
| `original_description` | string | `R-CLASSIFICATION` | — | RESIDENT_SOURCE | Trimmed non-empty; `UNKNOWN`/blank invalid; untrusted data; immutable | Proposal `source_references` | `Khu vực chung cần vệ sinh` |
| `original_evidence_refs` | array<string> | O | IDs `SIM-EVD-*` | RESIDENT_SOURCE/SYSTEM_INGEST | Immutable refs; zero allowed; không phải default minimum evidence | EvidenceRecord | `[]` |
| `raw_integrity_marker` | string | R ingest integrity | — | SYSTEM_INGEST | Hash/equivalent recomputed phải unchanged sau ingest | Raw immutability validator | `sha256:SIMULATED-...` |
| `source_revision` | string | `R-PRE_DRAFT` | — | SYSTEM_INGEST | Immutable revision token; tham gia idempotency key | WorkOrderDraft | `SRC-001` |
| `dataset_version` | string | R | — | SYSTEM_INGEST | Non-empty; versioned fixture | QA reset | `maintenanceops-sim-v1` |
| `current_state` | enum | R | `TicketState` | SYSTEM_DERIVED | Chỉ transition hợp lệ và có AuditEvent | State machine | `IN_PROGRESS` |
| `administrative_normalization` | object | C: tồn tại sau proposal; fields required pre-draft | — | BPTN + SYSTEM | Theo §5.1.1; không chứa replacement raw text/evidence | Proposal/draft | xem dưới |
| `cskh_context` | object/null | `R-PRE_DRAFT` chỉ `PB-CS-01` | — | SYSTEM_INGEST fixture | Theo §5.1.2; immutable; null cho CLN/TEC | CSKH comparison | xem dưới |
| `synthetic` | boolean | R | `true` | SYSTEM_INGEST | False/missing → schema reject | Toàn entity | `true` |

#### 5.1.1 `Ticket.administrative_normalization`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `administrative_revision` | integer | R khi object tồn tại | integer ≥ 1 | SYSTEM | Tăng đơn điệu; mỗi change có audit | Draft `administrative_revision` | `2` |
| `service_category_normalized` | enum | `R-PRE_DRAFT` | `ServiceCategory` | BPTN confirm/edit | Không `UNKNOWN`; phải tương thích playbook; edit có reason/audit | Proposal | `VE_SINH` |
| `ticket_type_normalized` | enum | `R-PRE_DRAFT` | `TicketType` | BPTN confirm/edit | Không `UNKNOWN`; phải tương thích playbook; audit | Proposal | `COMMON_AREA_CLEANING` |
| `location_normalized` | string/object | `R-PRE_DRAFT` cả ba playbook | — | BPTN | Non-empty, không `UNKNOWN`; nguồn đã xác minh; audit | Draft scope | `Tòa SIM-A / sảnh chung` |
| `priority` | string/null | O | chưa khóa | BPTN | Agent không ghi/derive; không tham gia state gate | — | `null` |
| `confirmation_status` | enum | `R-PRE_DRAFT` | `PENDING|CONFIRMED` | BPTN/SYSTEM | `PENDING` chặn draft → `CHỜ_XÁC_MINH` | Proposal | `CONFIRMED` |
| `confirmed_by` | string/null | C: required iff `CONFIRMED` | actor ID | BPTN | Actor tồn tại và role BPTN | AuditEvent | `SIM-ACTOR-BPTN-01` |
| `confirmed_at` | datetime/null | C: required iff `CONFIRMED` | ISO 8601 | SYSTEM | Có timezone, không trước proposal | AuditEvent | `2026-09-27T08:03:00+07:00` |
| `source_references` | array<string> | R khi confirm/edit | — | BPTN | Ít nhất một ref hiện hữu; không tự bịa | Ticket/raw source | `["ticket.original_description"]` |
| `change_reason` | string | C: required khi giá trị confirmed khác proposal hoặc admin edit | — | BPTN | Non-empty; đồng nhất AuditEvent.reason | AuditEvent | `Chuẩn hóa theo fixture đã xác minh` |

#### 5.1.2 `Ticket.cskh_context`

Đây là cấu trúc fixture bất biến được duyệt dưới nhãn `SIMULATED ASSUMPTION`; Agent không tự suy diễn hoặc tự điền claim.

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `reference_ticket_id` | string | `R-PRE_DRAFT` CSKH | pattern `SIM-TKT-*` | SYSTEM_INGEST/HUMAN fixture | Non-empty; thiếu → `CHỜ_XÁC_MINH`; không infer | Evidence requirement `CS-EVD-REFERENCE-LINK` | `SIM-TKT-REF-011` |
| `request_claims` | map<string, ComparisonSourceValue> | `R-PRE_DRAFT` để so field tương ứng | keys allowlist | RESIDENT_SOURCE fixture | Immutable; field ngoài allowlist reject; mỗi value có source ref | CSKH conflict validator | xem dưới |
| `processing_history_snapshot` | object | `R-PRE_DRAFT` CSKH | — | SYSTEM_INGEST fixture | Immutable, non-empty; thiếu → `CHỜ_XÁC_MINH` | CSKH comparison | xem dưới |
| `resident_denies_history` | boolean | R CSKH risk evaluation | true/false | SYSTEM_INGEST fixture | `true` → exception; missing flag/source → clarification; không default missing thành false | Source/rule trace | `false` |
| `requests_right_wrong_or_responsibility` | boolean | R CSKH risk evaluation | true/false | SYSTEM_INGEST fixture | `true` → exception; missing flag/source → clarification; không default missing thành false | Source/rule trace | `false` |
| `sensitive_content_flag` | boolean | R CSKH risk evaluation | true/false | SYSTEM_INGEST fixture | `true` → exception; missing flag/source → clarification; không tự sinh từ keyword đơn lẻ | Source/rule trace | `false` |
| `risk_flag_source_references` | map<string,string> | R CSKH risk evaluation | keys = three risk flags | SYSTEM_INGEST fixture | Mỗi flag có source ref hiện hữu; thiếu → `PB-CS-R-SRC-01`/clarification | Source trace | `{sensitive_content_flag: "fixture.flags.sensitive"}` |

`ComparisonSourceValue`:

| Field | Type | Required | Validation | Ví dụ |
|---|---|---|---|---|
| `field_name` | enum | R | `reference_ticket_id|recorded_status|outcome_code|last_processing_time|contact_status` | `recorded_status` |
| `value` | scalar/datetime | R nếu claim hiện hữu | Không blank/`UNKNOWN`; type nhất quán theo field | `IN_PROGRESS` |
| `source_reference` | string | R | Trỏ tới raw fixture hiện hữu | `ticket.raw.claims.recorded_status` |

`processing_history_snapshot`:

| Field | Type | Required | Validation | Ví dụ |
|---|---|---|---|---|
| `snapshot_id` | string | R | `SIM-HIS-*`, immutable | `SIM-HIS-011` |
| `captured_at` | datetime | R | ISO 8601 có timezone | `2026-09-27T07:55:00+07:00` |
| `values` | map<string, ComparisonSourceValue> | R | Cùng comparison allowlist; immutable | `{recorded_status: ...}` |
| `source_reference` | string | R | Ref tới fixture snapshot | `fixture.history.SIM-HIS-011` |
| `synthetic` | boolean | R | const true | `true` |

### 5.2 `AgentClassificationProposal`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `proposal_id` | string | R | `SIM-ACP-*` | SYSTEM | Unique | PK | `SIM-ACP-001` |
| `ticket_id` | string | R | — | SYSTEM | Ticket tồn tại | Ticket FK | `SIM-TKT-CLN-001` |
| `proposal_revision` | integer | R | ≥1 | SYSTEM | Tăng đơn điệu | Audit/version | `1` |
| `service_category_proposed` | enum | R classification output | `ServiceCategory` | AGENT_PROPOSAL | Không `UNKNOWN` để match playbook | Admin normalization | `VE_SINH` |
| `ticket_type_proposed` | enum | R classification output | `TicketType` | AGENT_PROPOSAL | Không `UNKNOWN`; pair hợp lệ với service/playbook | Admin normalization | `COMMON_AREA_CLEANING` |
| `playbook_id` | enum | R classification output | `PlaybookId` | AGENT_PROPOSAL | Pair mapping exact; không invent playbook | Draft | `PB-CLN-01` |
| `playbook_version` | string | R | const `1.0` | Static config/Agent | Version tồn tại | ChecklistTemplate | `1.0` |
| `asset_type` | enum/null | O; chỉ TEC | `LIGHTING` | AGENT_PROPOSAL | Không phải raw required field | TEC explanation | `LIGHTING` |
| `reported_symptom` | enum/null | O; chỉ TEC | `NOT_WORKING` | AGENT_PROPOSAL | Không phải raw required field | TEC explanation | `NOT_WORKING` |
| `matched_rule_ids` | array<string> | R | playbook rule IDs | AGENT_PROPOSAL | Non-empty; mọi ID tồn tại trong playbook | Rule trace | `["PB-CLN-R-TRG-01"]` |
| `classification_reason` | string | R | — | AGENT_PROPOSAL | Non-empty, không chứa unsupported fact | Explainability | `Khớp phản ánh vệ sinh khu vực chung` |
| `source_references` | array<string> | R | — | AGENT_PROPOSAL | Non-empty; ref tồn tại | Ticket/raw | `["ticket.original_description"]` |
| `rule_signals` | array<RuleSignal> | R | signal catalog | AGENT_PROPOSAL/SYSTEM_DERIVED | Đủ signal bắt buộc theo playbook; `UNCLEAR` không bị coi là false | Exception validator | xem dưới |
| `confirmation_status` | enum | `R-PRE_DRAFT` | `PENDING|CONFIRMED` | BPTN/SYSTEM | PENDING → no draft/`CHỜ_XÁC_MINH` | Ticket admin | `CONFIRMED` |
| `confirmed_by` | string/null | C iff CONFIRMED | BPTN actor | BPTN | Actor role BPTN | Audit | `SIM-ACTOR-BPTN-01` |
| `confirmed_at` | datetime/null | C iff CONFIRMED | ISO 8601 | SYSTEM | Không trước proposal creation | Audit | `2026-09-27T08:03:00+07:00` |
| `created_at` | datetime | R | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:01:00+07:00` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

`RuleSignal` có `signal_code`, `status: PRESENT|ABSENT|UNCLEAR`, `source_references[]`, `evaluated_at`, `rule_id`. Signal catalog v1:

- CLN: `UNKNOWN_SUBSTANCE_PRESENT`, `HAZARD_SIGNAL_PRESENT`.
- TEC: `BURNING_SMELL_PRESENT`, `SPARK_PRESENT`, `EXPOSED_WIRE_PRESENT`.
- CSKH không dùng `SignalStatus`: ba boolean risk flags và source refs nằm trong immutable `Ticket.cskh_context`; comparison result do validator tạo. Missing không được mặc định thành false.

### 5.3 `WorkOrderDraft`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `work_order_draft_id` | string | R | `SIM-WOD-*` | SYSTEM | Unique logical draft ID | PK | `SIM-WOD-CLN-001` |
| `ticket_id` | string | R | — | SYSTEM | Ticket tồn tại | Ticket FK | `SIM-TKT-CLN-001` |
| `proposal_id` | string | R | — | SYSTEM | Proposal confirmed | Proposal FK | `SIM-ACP-001` |
| `playbook_id` | enum | R | `PlaybookId` | AGENT_PROPOSAL | Khớp proposal/admin | Template FK | `PB-CLN-01` |
| `playbook_version` | string | R | `1.0` | SYSTEM | Khớp proposal/template | Template FK | `1.0` |
| `administrative_revision` | integer | R | ≥1 | SYSTEM | Ref đúng confirmed administrative revision | Ticket admin | `2` |
| `source_revision` | string | R | — | SYSTEM | Khớp Ticket source revision | Ticket | `SRC-001` |
| `idempotency_key` | string | R | derived | SYSTEM | Chính xác `ticket_id + playbook_version + source_revision`; unique cho logical draft | Idempotency | `SIM-TKT-CLN-001|1.0|SRC-001` |
| `draft_revision` | integer | R | ≥1 | SYSTEM | Retry cùng input không tạo duplicate; revision tăng khi authorized source/admin revision đổi | Audit | `1` |
| `draft_status` | enum | R | const `DRAFT` | SYSTEM | Không có status operational khác | — | `DRAFT` |
| `scope_summary` | string | R | — | AGENT_PROPOSAL | Non-empty; mọi fact có source/proposal ref; không chẩn đoán | Source refs | `Ghi nhận vệ sinh tại vị trí đã chuẩn hóa` |
| `generation_reason` | string | R | — | AGENT_PROPOSAL | Non-empty | Explainability | `Pre-draft gates passed` |
| `matched_rule_ids` | array<string> | R | — | AGENT_PROPOSAL | Rule tồn tại | Playbook | `["PB-CLN-R-TRG-01"]` |
| `source_references` | array<string> | R | — | AGENT_PROPOSAL | Non-empty, ref tồn tại | Ticket/proposal | `["ticket.original_description"]` |
| `checklist_template_id` | string | R | template ID | SYSTEM | Template đúng playbook/version | ChecklistTemplate | `PB-CLN-01-CHK-V1` |
| `checklist_item_ids` | array<string> | R khi tạo draft | — | SYSTEM | Sinh đủ mọi required template item; ≥1; item initial PENDING | ChecklistItem | `["SIM-CHK-CLN-001-01", ...]` |
| `material_requirement_mode` | enum | R | `TRACKED|N_A` | Static playbook/System | CSKH const N_A; N_A yêu cầu zero line; TRACKED chỉ CLN/TEC | Material gate | `TRACKED` |
| `material_gate_status` | enum | `R-READY` | `MaterialGateStatus` | SYSTEM_DERIVED | READY chỉ `RECONCILED|N/A`; CSKH const N/A; N/A → zero line | MaterialLine | `RECONCILED` |
| `material_line_ids` | array<string> | C | — | SYSTEM | CSKH/N/A = `[]`; otherwise refs cùng draft | MaterialLine | `["SIM-MAT-001"]` |
| `evidence_requirements` | array<EvidenceRequirement> | R | catalog §6.2 | Static config | Đủ exact requirements playbook; image không required | EvidenceRecord | xem §6.2 |
| `readiness_evaluation` | object | R after evaluation | — | SYSTEM_DERIVED | Theo seven gates; không phải human acceptance | State validator | xem dưới |
| `blocking_exception_active` | boolean | `R-READY` | false để pass | SYSTEM_DERIVED | True iff có ExceptionRecord OPEN; READY yêu cầu false | ExceptionRecord | `false` |
| `non_blocking_warnings` | array<NonBlockingWarning> | O | only explained variance | SYSTEM_DERIVED | Warning visible; không tự override blocker | Material comparison | `[]` |
| `created_at` | datetime | R | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:04:00+07:00` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

`ReadinessEvaluation` bắt buộc chứa bảy boolean gates: `playbook_present`, `work_order_draft_present`, `required_fields_complete`, `checklist_complete`, `minimum_evidence_complete`, `material_reconciled_or_na`, `no_blocking_exception`; cùng `evaluated_at`, `rule_ids`, `source_references`, `target_state`, `reason`. `READY_FOR_REVIEW` chỉ khi cả bảy đều true.

`NonBlockingWarning` gồm `warning_id`, `warning_type=EXPLAINED_MATERIAL_VARIANCE`, `blocking=false`, `rule_id`, `reason`, `material_line_ids`, `comparison_types`, `created_at`, `synthetic=true`.

### 5.4 `ChecklistTemplate`

| Field | Type | Required | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `checklist_template_id` | string | R | playbook template ID | Static `SIMULATED` config | Unique theo playbook/version | WorkOrderDraft | `PB-CLN-01-CHK-V1` |
| `playbook_id` | enum | R | `PlaybookId` | Static config | Exact mapping | Proposal/draft | `PB-CLN-01` |
| `playbook_version` | string | R | `1.0` | Static config | Exact version | Proposal/draft | `1.0` |
| `template_version` | string | R | `1.0` | Static config | Immutable sau fixture freeze | ChecklistItem | `1.0` |
| `items` | array<object> | R | catalog §6.1 | Product/BA-approved simulated config | ≥1; unique item ID; mỗi item required flag và owner | ChecklistItem | xem §6.1 |
| `not_real_sop_label` | boolean | R | true | Static config | False/missing reject | Safety label | `true` |
| `synthetic` | boolean | R | true | Static config | Missing/false reject | — | `true` |

Mỗi `items[]` có `template_item_id`, `label`, `required`, `update_owner=HUMAN_EXECUTION`, `completion_status_enum=[PENDING,COMPLETED]`.

### 5.5 `ChecklistItem`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `checklist_item_id` | string | R | `SIM-CHK-*` | SYSTEM | Unique | PK | `SIM-CHK-CLN-001-01` |
| `work_order_draft_id` | string | R | — | SYSTEM | Draft tồn tại | Draft FK | `SIM-WOD-CLN-001` |
| `checklist_template_id` | string | R | — | SYSTEM | Template đúng draft playbook/version | Template FK | `PB-CLN-01-CHK-V1` |
| `template_item_id` | string | R | catalog §6.1 | SYSTEM | Item tồn tại trong template | Template item | `CLN-CHK-01` |
| `label_snapshot` | string | R | — | SYSTEM | Khớp template version; immutable trong revision | Explainability | `Location execution khớp location đã chuẩn hóa` |
| `required` | boolean | R | true cho v1 catalog | Static config | Không được actor runtime đổi | READY gate | `true` |
| `status` | enum | R khi tạo item; evaluated tại READY | `PENDING|COMPLETED` | SYSTEM initial/HUMAN_EXECUTION update | Initial phải PENDING; chỉ HUMAN_EXECUTION đổi sang COMPLETED; READY yêu cầu mọi required item COMPLETED | Readiness | `PENDING` |
| `updated_by` | string | C: required khi update | actor ID | HUMAN_EXECUTION | Role phải HUMAN_EXECUTION | Audit | `SIM-ACTOR-EXEC-01` |
| `updated_at` | datetime | C: required khi update | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:20:00+07:00` |
| `note` | string/null | O | — | HUMAN_EXECUTION | Nếu có phải non-blank; không thay EvidenceRecord | — | `Đã ghi nhận mục mô phỏng` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

### 5.6 `MaterialLine`

Chỉ tồn tại cho CLN/TEC khi `material_gate_status != N/A`. Khi toàn gate `N/A`, không tạo `MaterialLine`.

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `material_line_id` | string | R | `SIM-MAT-*` | SYSTEM | Unique | PK | `SIM-MAT-001` |
| `work_order_draft_id` | string | R | — | SYSTEM | Draft CLN/TEC tồn tại | Draft FK | `SIM-WOD-TEC-001` |
| `item_code` | string | R | `SIM-*` | HUMAN_EXECUTION/fixture | Non-empty, simulated | — | `SIM-MAT-LAMP-01` |
| `item_name` | string | R | — | HUMAN_EXECUTION/fixture | Non-empty, simulated label | — | `Vật tư chiếu sáng mô phỏng` |
| `unit` | string/null | O | — | HUMAN_EXECUTION/fixture | Nếu có phải gắn ngữ cảnh simulated; không dùng cho inventory | — | `unit-sim` |
| `planned_qty` | number | R line | ≥0 | HUMAN_EXECUTION/fixture | Finite number | Comparison 1/2 | `2` |
| `norm_qty` | number/null | C | ≥0 hoặc null | HUMAN_EXECUTION/fixture | Number iff `norm_label=SYNTHETIC`; null iff `N_A` | Comparison 1 | `2` |
| `norm_label` | enum | R line | `SYNTHETIC|N_A` | SYSTEM/config | `SYNTHETIC` → numeric norm; `N_A` → null norm | Safety label | `SYNTHETIC` |
| `issued_qty` | number | R line | ≥0 | HUMAN_EXECUTION/fixture | Finite number | Comparison 2/3 | `2` |
| `used_qty` | number | R line | ≥0 | HUMAN_EXECUTION/fixture | Finite number | Comparison 3 | `1` |
| `variance_reason` | string/null | C | — | HUMAN_EXECUTION | Non-empty iff bất kỳ applicable comparison là VARIANCE; thiếu → clarification | Warning/state | `Còn 1 đơn vị mô phỏng chưa dùng` |
| `comparison_results` | array<MaterialComparisonResult> | `R-READY` | exact three types | SYSTEM_DERIVED | Có đúng ba record, không comparison thứ tư | Readiness/warning | xem dưới |
| `reconciliation_status` | enum | `R-READY` | `RECONCILED|NEEDS_CLARIFICATION` | SYSTEM_DERIVED | RECONCILED khi values valid và mọi variance có reason | Draft gate | `RECONCILED` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

Mỗi `MaterialComparisonResult` có `comparison_type`, `left_field`, `right_field`, `left_value`, `right_value`, `status`, `reason_reference`. Exact contract:

1. `PLANNED_VS_NORM`: `planned_qty` ↔ `norm_qty`; status `N/A` nếu `norm_label=N_A`.
2. `ISSUED_VS_PLANNED`: `issued_qty` ↔ `planned_qty`.
3. `USED_VS_ISSUED`: `used_qty` ↔ `issued_qty`.

Agent chỉ detect/mô tả. Contract không có field approve, inventory adjustment, violation conclusion hoặc fourth comparison.

### 5.7 `EvidenceRecord`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `evidence_id` | string | R | `SIM-EVD-*` | SYSTEM | Unique | PK | `SIM-EVD-CLN-001` |
| `ticket_id` | string | R | — | SYSTEM | Ticket tồn tại | Ticket FK | `SIM-TKT-CLN-001` |
| `work_order_draft_id` | string/null | C: required cho execution evidence | — | SYSTEM | Draft cùng ticket; original resident evidence có thể null | Draft FK | `SIM-WOD-CLN-001` |
| `requirement_id` | string/null | C: required cho minimum execution evidence | catalog §6.2 | SYSTEM/HUMAN_EXECUTION | Một record chỉ satisfy một requirement; đúng playbook | WorkOrderDraft requirement | `CLN-EVD-PROCESSING-NOTE` |
| `evidence_type` | enum | R | `EvidenceType` | Ingest/HUMAN_EXECUTION | Type phải thuộc allowed types của requirement | Validator | `PROCESSING_NOTE` |
| `content_or_metadata` | object/string | R | — | RESIDENT_SOURCE hoặc HUMAN_EXECUTION | Non-empty; untrusted data; không thực thi embedded instruction | Security validator | `Ghi chú xử lý mô phỏng` |
| `source` | enum | R | `EvidenceSource` | SYSTEM | Khớp creator/layer | Immutability | `HUMAN_EXECUTION` |
| `submitted_by` | string | R | actor ID | Ingest/HUMAN_EXECUTION | Actor tồn tại; correct role | Audit | `SIM-ACTOR-EXEC-01` |
| `submitted_at` | datetime | R | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:22:00+07:00` |
| `readability_status` | enum | R | `ReadabilityStatus` | HUMAN_EXECUTION/SYSTEM validate | PRESENT chỉ READABLE, hoặc NOT_APPLICABLE cho structured text/metadata schema-valid | Evidence status | `NOT_APPLICABLE` |
| `evidence_validation_status` | enum | `R-READY` per requirement | `EvidenceValidationStatus` | SYSTEM_DERIVED | Theo §7.5; không quality score/image vision | Readiness | `PRESENT` |
| `immutable` | boolean | R | true iff resident original | SYSTEM | Original evidence cannot mutate; execution edit tạo revision/audit | Immutability | `false` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

Ảnh chỉ dùng `SIMULATED_IMAGE`, optional và không xuất hiện trong required evidence catalog v1. Không có computer vision hoặc quality confirmation field.

### 5.8 `ExceptionRecord`

| Field | Type | Required | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `exception_id` | string | R | `SIM-EXC-*` | SYSTEM | Unique | PK | `SIM-EXC-TEC-001` |
| `ticket_id` | string | R | — | SYSTEM | Ticket tồn tại | Ticket FK | `SIM-TKT-TEC-EX-001` |
| `exception_type` | enum | R | `ExceptionType` | SYSTEM_DERIVED | Khớp exact rule | State | `ELECTRICAL_HIGH_RISK` |
| `rule_id` | string | R | playbook exception rule | SYSTEM_DERIVED | Rule tồn tại/versioned | Playbook trace | `PB-TEC-R-EX-01` |
| `blocking` | boolean | R | true | SYSTEM | False reject | READY gate | `true` |
| `reason` | string | R | — | SYSTEM_DERIVED | Non-empty, trung tính; no diagnosis/right-wrong conclusion | Explainability | `Phát hiện tín hiệu rủi ro đã định nghĩa` |
| `source_references` | array<string> | R | — | SYSTEM_DERIVED | Non-empty, refs hiện hữu | Ticket/proposal | `["proposal.rule_signals[SPARK_PRESENT]"]` |
| `risk_level` | enum | R | `HIGH_RISK|BUSINESS_REVIEW` | Static rule | Cleaning/technical = HIGH_RISK; CSKH = BUSINESS_REVIEW | Routing | `HIGH_RISK` |
| `authorized_handler` | enum | R | const `BQL` | Static rule | Agent/non-BQL cannot resolve | Permission | `BQL` |
| `status` | enum | R | `OPEN|RESOLVED_BY_BQL` | BQL transition | Agent cannot set resolved | State machine | `OPEN` |
| `missing_information` | array<string> | O | — | SYSTEM_DERIVED/BQL | Chỉ nêu field/source cần xác minh; không high-risk instruction | Clarification | `[]` |
| `comparison_field` | enum/null | C: required for CSKH conflict | CSKH allowlist | SYSTEM_DERIVED | Hai nguồn hiện hữu cùng field | CSKH comparison | `recorded_status` |
| `resident_source_value` | scalar/null | C: CSKH conflict | — | Immutable fixture | Ref/value hiện hữu; no correctness flag | Ticket claim | `IN_PROGRESS` |
| `history_source_value` | scalar/null | C: CSKH conflict | — | Immutable history | Ref/value hiện hữu; no correctness flag | Snapshot | `READY_FOR_REVIEW` |
| `resolution_note` | string/null | C iff resolved | — | BQL | Non-empty, audited; không do Agent ghi | State transition | `BQL proxy đã ghi resolution mô phỏng` |
| `resolved_by` | string/null | C iff resolved | BQL actor | BQL | Actor role BQL | Audit | `SIM-ACTOR-BQL-01` |
| `resolved_at` | datetime/null | C iff resolved | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:30:00+07:00` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

Không có `correct_source`, `approved`, `accepted`, `technical_diagnosis` hoặc `resident_message` field.

Nếu nhiều CSKH exception rules cùng kích hoạt, tạo đúng một `ExceptionRecord` cho mỗi triggered rule. Các record được nhóm bằng query theo `ticket_id`; không tạo thêm Package entity và ticket chỉ có một state `EXCEPTION`.

### 5.9 `AuditEvent`

| Field | Type | Required | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `event_id` | string | R | `SIM-AUD-*` | SYSTEM | Unique, append-only | PK | `SIM-AUD-001` |
| `ticket_id` | string | R | — | SYSTEM | Ticket tồn tại | Ticket FK | `SIM-TKT-CLN-001` |
| `entity_type` | string | R | one of contract entities/value-object paths | SYSTEM | Target type tồn tại | Target | `Ticket` |
| `entity_id` | string | R | — | SYSTEM | Target tồn tại hoặc attempted target được định danh | Target | `SIM-TKT-CLN-001` |
| `action` | enum/string | R | catalog §7.8 | SYSTEM | Known action only; denied action retained | Permission/audit | `UPDATE_ADMIN_FIELD` |
| `actor_id` | string | R | — | Identity/system | Non-empty | Actor | `SIM-ACTOR-BPTN-01` |
| `actor_role` | enum | R | `ActorRole` | Identity/system | Role/action validator | Permission | `BPTN` |
| `timestamp` | datetime | R | ISO 8601 | SYSTEM | Có timezone, append ordering | — | `2026-09-27T08:03:00+07:00` |
| `field_name` | string | R | field path | SYSTEM | Key luôn hiện diện; decision/transition dùng logical path | Target field | `administrative_normalization.location_normalized` |
| `old_value` | any/null | R key | — | SYSTEM | Snapshot trước action; null hợp lệ khi create | Change record | `UNKNOWN` |
| `new_value` | any/null | R key | — | SYSTEM | Attempted value nếu denied; actual value nếu allowed | Change record | `Tòa SIM-A / sảnh chung` |
| `reason` | string | R | — | Actor/system | Non-empty | Explainability | `Chuẩn hóa theo fixture đã xác minh` |
| `action_result` | enum | R | `ALLOWED|ACTION_DENIED` | Permission engine | ACTION_DENIED → no mutation/state change/ExceptionRecord | Permission | `ALLOWED` |
| `error_code` | string/null | C cho schema/system error | error catalog | SYSTEM | Không dùng deprecated `ACTION_OUT_OF_AUTHORITY`; permission denial đã biểu diễn bằng action_result | Error contract | `null` |
| `rule_id` | string/null | C: deterministic decision | — | SYSTEM | Required cho classification/state/warning/exception/denial rule | Rule trace | `PB-COM-R-LOC-01` |
| `playbook_version` | string/null | C khi playbook áp dụng | `1.0` | SYSTEM | Exact version | Playbook | `1.0` |
| `schema_version` | string | R | `1.0` | SYSTEM | Exact contract version | Contract | `1.0` |
| `run_id` | string | R | `SIM-RUN-*` | SYSTEM | Truy vết reset/replay | QA | `SIM-RUN-001` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

AuditEvent append-only. Nếu audit write fail, mutation/transition/rejection result không được commit một phần.

---

## 6. Playbook-specific static contract

### 6.1 Checklist catalog

| Playbook | Template | Item ID | Label mô phỏng | Required READY | Update owner |
|---|---|---|---|---|---|
| `PB-CLN-01` | `PB-CLN-01-CHK-V1` | `CLN-CHK-01` | Location trong execution update khớp `location_normalized` | true | HUMAN_EXECUTION |
| `PB-CLN-01` | `PB-CLN-01-CHK-V1` | `CLN-CHK-02` | Execution update được ghi nhận theo `scope_summary` | true | HUMAN_EXECUTION |
| `PB-CLN-01` | `PB-CLN-01-CHK-V1` | `CLN-CHK-03` | Mọi scoped item trong fixture được đánh dấu `COMPLETED` | true | HUMAN_EXECUTION |
| `PB-TEC-01` | `PB-TEC-01-CHK-V1` | `TEC-CHK-01` | Execution update định danh đúng location/lighting asset | true | HUMAN_EXECUTION |
| `PB-TEC-01` | `PB-TEC-01-CHK-V1` | `TEC-CHK-02` | Có bản ghi hoàn tất safety checklist mô phỏng | true | HUMAN_EXECUTION |
| `PB-TEC-01` | `PB-TEC-01-CHK-V1` | `TEC-CHK-03` | Result update đã được ghi | true | HUMAN_EXECUTION |
| `PB-CS-01` | `PB-CS-01-CHK-V1` | `CS-CHK-01` | Đã ghi nhận presence của reference/history | true | HUMAN_EXECUTION |
| `PB-CS-01` | `PB-CS-01-CHK-V1` | `CS-CHK-02` | Đã hoàn tất comparison trên allowlisted fields | true | HUMAN_EXECUTION |
| `PB-CS-01` | `PB-CS-01-CHK-V1` | `CS-CHK-03` | Response content/draft đã chuẩn bị | true | HUMAN_EXECUTION |
| `PB-CS-01` | `PB-CS-01-CHK-V1` | `CS-CHK-04` | Contact log/draft record đã chuẩn bị | true | HUMAN_EXECUTION |

Các label trên là documentation gates mô phỏng, không phải SOP xử lý hiện trường hoặc xác nhận chất lượng.

### 6.2 Evidence requirement catalog

| Requirement ID | Playbook | Allowed evidence type | Minimum condition | Missing/wrong type | Image |
|---|---|---|---|---|---|
| `CLN-EVD-PROCESSING-NOTE` | `PB-CLN-01` | `PROCESSING_NOTE` | Non-empty; đúng ticket/draft; actor/time/readability valid | `IN_PROGRESS` | Optional, không satisfy requirement |
| `TEC-EVD-RESULT-NOTE` | `PB-TEC-01` | `RESULT_NOTE` | Non-empty; đúng ticket/draft; actor/time/readability valid | `IN_PROGRESS` | Optional, không satisfy requirement |
| `CS-EVD-REFERENCE-LINK` | `PB-CS-01` | `REFERENCE_TICKET_LINK` | Value khớp `Ticket.cskh_context.reference_ticket_id`; actor/time/readability valid | `IN_PROGRESS` nếu requirement rõ | Optional, không satisfy requirement |
| `CS-EVD-RESPONSE-CONTENT` | `PB-CS-01` | `RESPONSE_CONTENT_OR_DRAFT` | Non-empty; đúng ticket/draft; actor/time/readability valid | `IN_PROGRESS` | Optional, không satisfy requirement |
| `CS-EVD-CONTACT-RECORD` | `PB-CS-01` | `CONTACT_LOG_OR_DRAFT` | Non-empty; đúng ticket/draft; actor/time/readability valid | `IN_PROGRESS` | Optional, không satisfy requirement |

Ba CSKH requirement độc lập; một EvidenceRecord chỉ satisfy một requirement. Cùng một record không được pass đồng thời `CS-EVD-RESPONSE-CONTENT` và `CS-EVD-CONTACT-RECORD`.

### 6.3 Exception signal contract

| Rule | Playbook | Condition | Output/state | Prohibited output |
|---|---|---|---|---|
| `PB-CLN-R-EX-01` | CLN | `UNKNOWN_SUBSTANCE_PRESENT=PRESENT` **AND** `HAZARD_SIGNAL_PRESENT=PRESENT` | `ExceptionRecord(CLEANING_HAZARD)`, `EXCEPTION` | Standard handling instruction |
| `PB-CLN-R-RISK-01` | CLN | Một trong hai cleaning signal = `UNCLEAR` | `CHỜ_XÁC_MINH`, no standard draft | Guessing signal |
| `PB-CLN-R-SAFE-01` | CLN | Một signal PRESENT, signal kia ABSENT | `IN_PROGRESS`; tiếp tục gate, không tuyên bố an toàn | Treat one signal as full exception/safety proof |
| `PB-TEC-R-EX-01` | TEC | Bất kỳ `BURNING_SMELL_PRESENT`, `SPARK_PRESENT`, `EXPOSED_WIRE_PRESENT` = `PRESENT` | `ExceptionRecord(ELECTRICAL_HIGH_RISK)`, `EXCEPTION` | Diagnosis, repair guidance, standard draft |
| `PB-TEC-R-RISK-01` | TEC | Bất kỳ required risk signal = `UNCLEAR` và chưa có signal PRESENT | `CHỜ_XÁC_MINH`, no standard draft | Treat unclear as absent |
| `PB-CS-R-SRC-01` | CSKH | Reference/history/comparison source hoặc required risk flag/source missing | `CHỜ_XÁC_MINH` | Infer/fill/default source |
| `PB-CS-R-EX-01` | CSKH | Hai source hiện hữu, cùng allowlisted field, values incompatible | `ExceptionRecord(CSKH_CONFLICT)`, `EXCEPTION` | Correct-source conclusion |
| `PB-CS-R-EX-02` | CSKH | `resident_denies_history=true` | `ExceptionRecord(CSKH_DISPUTE)`, `EXCEPTION` | Right/wrong conclusion/outbound response |
| `PB-CS-R-EX-03` | CSKH | `requests_right_wrong_or_responsibility=true` | `ExceptionRecord(CSKH_DISPUTE)`, `EXCEPTION` | Right/wrong conclusion/outbound response |
| `PB-CS-R-EX-04` | CSKH | `sensitive_content_flag=true` | `ExceptionRecord(CSKH_SENSITIVE)`, `EXCEPTION` | Automated handling/outbound response |

CSKH comparison dùng `SIMULATED ASSUMPTION`: fixture cung cấp typed normalized values; compatible khi exact typed equality, khác nhau trên cùng field là incompatible; `last_processing_time` so theo normalized ISO-8601 instant. Không dùng fuzzy/semantic inference.

Hai cleaning signals `PRESENT+ABSENT` hoặc `ABSENT+PRESENT` không đủ tạo exception; case tiếp tục `IN_PROGRESS` nếu các gate khác hợp lệ. Đây là `SIMULATED ASSUMPTION` đã được Agent A disposition.

---

## 7. Validator catalog

### 7.1 Schema, synthetic và immutability

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-SCHEMA-001` | Mọi entity | Field required/type/enum/link valid | Reject write; error có field path; no partial write |
| `VAL-SYN-001` | Mọi entity/output | `synthetic=true`, ID `SIM-`; norm label đúng | Reject output; không trình bày như dữ liệu thật |
| `VAL-TKT-REQ-001` | Ticket | Ba raw fields non-empty/valid | `CHỜ_XÁC_MINH`; no classification/draft |
| `VAL-IMM-001` | Raw edit attempt | Hash/value unchanged | `ACTION_DENIED` + audit; state unchanged |
| `VAL-INJECT-001` | Original/evidence content | Content chỉ được parse như untrusted data | Ignore embedded instruction; fail closed nếu parse uncertainty |

### 7.2 Classification và pre-draft

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-CLASS-001` | Ticket + proposal | Service/type/playbook exact mapping; rules/reason/source non-empty | Ambiguous/out-of-v1 → `CHỜ_XÁC_MINH`; không invent playbook |
| `VAL-SIGNAL-001` | Proposal signals | Đủ signal set; status không silently default | `UNCLEAR` → clarification theo §6.3 |
| `VAL-PRE-DRAFT-001` | Proposal + admin | CONFIRMED service/type, location non-empty, playbook/version, CSKH refs nếu áp dụng | `CHỜ_XÁC_MINH`; zero draft |
| `VAL-EXC-PRE-001` | Rule signals/source comparison | Không có active exception | Nếu trigger → `EXCEPTION`; no standard draft |
| `VAL-IDEMP-001` | Draft create request | Unique idempotency tuple | Retry trả cùng logical draft/revision; không duplicate |
| `VAL-SCOPE-001` | scope_summary | Mọi assertion có source/proposal reference | Reject draft; giữ state trước, error/audit |

### 7.3 Checklist

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-CHK-001` | Template + items | Đủ exact required item IDs cho playbook version | Draft invalid; không READY |
| `VAL-CHK-002` | Checklist updates | Chỉ HUMAN_EXECUTION đổi status; enum valid | `ACTION_DENIED`/schema reject + audit; state unchanged |
| `VAL-CHK-READY-001` | Required items | Tất cả `COMPLETED` | Nếu còn PENDING → `IN_PROGRESS`, item IDs nêu rõ |

### 7.4 Material

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-MAT-MODE-001` | Draft/material | CSKH hoặc gate N/A → zero line; có line → CLN/TEC only | Reject inconsistent payload |
| `VAL-MAT-QTY-001` | MaterialLine | planned/issued/used ≥0; norm/label pair valid | Gate `NEEDS_CLARIFICATION`, ticket giữ `IN_PROGRESS`; không READY |
| `VAL-MAT-CMP-001` | MaterialLine | Exact ba comparison records; no fourth comparison | Reject derived result; no READY |
| `VAL-MAT-VAR-001` | Applicable comparisons | Mọi VARIANCE có non-empty `variance_reason` | Thiếu reason → `CHỜ_XÁC_MINH` |
| `VAL-MAT-WARN-001` | Reconciled variance | Có reason, exact comparisons complete, no other blocker | Tạo `EXPLAINED_MATERIAL_VARIANCE`; warning không chặn READY |
| `VAL-MAT-PERM-001` | Agent material action | Chỉ detect/describe | Approve/adjust/inventory/violation action → `ACTION_DENIED` + audit |

### 7.5 Evidence và readability

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-EVD-LINK-001` | EvidenceRecord | Ticket/draft/requirement cùng case/playbook | Reject record sai link; requirement không được satisfy; `IN_PROGRESS` nếu requirement known |
| `VAL-EVD-TYPE-001` | Requirement + record | Type thuộc allowlist requirement | `INVALID_TYPE`; `IN_PROGRESS` |
| `VAL-EVD-CONTENT-001` | content/metadata | Non-empty, schema-valid | `MISSING`; `IN_PROGRESS` |
| `VAL-EVD-READ-001` | readability | READABLE; hoặc NOT_APPLICABLE cho structured text/metadata schema-valid | UNREADABLE → not PRESENT/`IN_PROGRESS`; source/readability không xác minh được → `CHỜ_XÁC_MINH` |
| `VAL-EVD-READY-001` | All requirements | Mỗi independent requirement có đúng một hoặc nhiều valid record, ít nhất một PRESENT | Missing known → `IN_PROGRESS`; unknown requirement/source → `CHỜ_XÁC_MINH` |
| `VAL-EVD-IMG-001` | Image absence | Không required requirement nào là image | Không block, không warning |

### 7.6 Exception và CSKH conflict

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-CLN-EX-001` | CLN signals | Both PRESENT → exact exception | `EXCEPTION`; no standard draft |
| `VAL-TEC-EX-001` | TEC signals | Any PRESENT → exact exception | `EXCEPTION`; no diagnosis/guidance |
| `VAL-CS-SOURCE-001` | CSKH context | Reference + history + relevant two-source values + three boolean flags/source refs exist | Missing → `PB-CS-R-SRC-01`, `CHỜ_XÁC_MINH`; không default false/conflict inference |
| `VAL-CS-CONFLICT-001` | Same-field source pair | Both typed normalized values present; exact typed equality = compatible; unequal = incompatible; time so normalized instant | Incompatible → `PB-CS-R-EX-01`, `EXCEPTION`; record both values/refs, no fuzzy inference/correctness field |
| `VAL-CS-SENSITIVE-001` | Three CSKH boolean flags | Any true → exact `PB-CS-R-EX-02|03|04` | `EXCEPTION`; no right/wrong/outbound response |
| `VAL-EXC-RESOLVE-001` | Resolution request | Actor BQL; exception OPEN; resolution note/time valid | Non-BQL/Agent → `ACTION_DENIED`; exception unchanged |

### 7.7 Readiness và state

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-READY-001` | ReadinessEvaluation | Seven gates true | Chọn non-READY state theo resolver §8 |
| `VAL-STATE-TRANS-001` | Current/target state | Transition thuộc allowlist; actor/context hợp lệ | Reject + audit; current state unchanged |
| `VAL-WARN-001` | Warning | Only explained material variance; rule/reason/source visible | Unknown warning reject; warning không che blocker |

### 7.8 Permission và audit

Permission validator phải chạy trước mutation. Action catalog tối thiểu:

| Action | BPTN | Agent | HUMAN_EXECUTION | BQL | Failure |
|---|---:|---:|---:|---:|---|
| View raw ticket | Allow read-only | Allow read-only | Allow read-only theo case | Allow read-only | Default deny unknown role |
| Edit admin allowlist/confirm proposal | Allow + reason/audit | Deny | Deny | Deny trong MVP | `ACTION_DENIED` |
| Edit raw content/original evidence | Deny | Deny | Deny | Deny | `ACTION_DENIED`, raw unchanged |
| Create classification proposal/draft | Deny | Allow theo gates | Deny | Deny | `ACTION_DENIED` |
| Update checklist/material/add execution evidence | Deny | Validate only | Allow + audit | Request follow-up only | `ACTION_DENIED` |
| Mark READY via deterministic gate | Deny | Allow derived transition | Deny | Review only | `ACTION_DENIED` |
| Resolve exception | Deny | Deny | Deny | Allow + audit | `ACTION_DENIED` |
| Accept/close ticket | Deny | Deny | Deny | Không phải action/state trong MVP | `ACTION_DENIED` |
| Approve/adjust material/inventory | Deny | Deny | Deny | Deny trong MVP | `ACTION_DENIED` |
| Send resident message/request resident image | Deny | Deny | Deny | Ngoài scope contract | `ACTION_DENIED` |

Forbidden Agent actions gồm: edit raw/admin/human fields; tự complete checklist; resolve exception; accept/close; technical quality confirmation; approve/adjust material; modify inventory; outbound message; request resident image. Denial tạo AuditEvent với `action_result=ACTION_DENIED`, không data/state side effect và không tạo `ExceptionRecord`.

Audit action catalog: `INGEST`, `CREATE_PROPOSAL`, `CONFIRM_NORMALIZATION`, `UPDATE_ADMIN_FIELD`, `CREATE_DRAFT`, `UPDATE_CHECKLIST`, `UPDATE_MATERIAL`, `ADD_EVIDENCE`, `VALIDATE_EVIDENCE`, `RECONCILE_MATERIAL`, `TRANSITION_STATE`, `CREATE_EXCEPTION`, `RESOLVE_EXCEPTION`, `ACTION_DENIED`, `SYSTEM_ERROR`.

---

## 8. State machine contract

### 8.1 Resolver priority

1. Permission failure: emit `ACTION_DENIED`, audit; **không đổi state** và không tạo business exception.
2. Raw schema/required failure: `CHỜ_XÁC_MINH`; không classification/draft.
3. Sau khi đủ raw fields, exception safety/business rule có source rõ: `EXCEPTION`; chặn standard draft/flow.
4. Signal/source unclear, classification ambiguous, proposal chưa confirm, thiếu location/CSKH reference-history, variance thiếu reason hoặc evidence/source không xác minh được: `CHỜ_XÁC_MINH`.
5. Execution known-incomplete: checklist pending, known evidence missing/wrong type/unreadable, material reconciliation chưa hoàn tất: `IN_PROGRESS`.
6. Seven gates all true: `READY_FOR_REVIEW`; `EXPLAINED_MATERIAL_VARIANCE` có thể còn active và phải được giữ trong output.
7. System/validator error: fail closed, không tạo READY; giữ prior safe state và tạo audit/error. Nếu exception engine unavailable trước draft, không tạo draft.

### 8.2 State definition

| State | Entry condition | Allowed mutation/action | Prohibited |
|---|---|---|---|
| `IN_PROGRESS` | Raw valid; đang chờ execution known rõ; hoặc revalidation sau authorized resolution/update | Agent proposal/draft theo gate; BPTN confirm; HUMAN_EXECUTION update | Agent accept/close/approve/send; raw edit |
| `CHỜ_XÁC_MINH` | Missing/unknown/unclear classification, pre-draft, variance reason hoặc evidence/source | Authorized human bổ sung ở editable layer; Agent revalidate | Agent tự điền; direct READY; raw edit |
| `READY_FOR_REVIEW` | Seven gates true | BQL review; authorized change quay lại IN_PROGRESS rồi re-evaluate | Diễn giải như accepted/completed/closed/material-approved |
| `EXCEPTION` | Exact CLN/TEC/CSKH exception rule | BQL resolution/request verification | Agent resolve, diagnosis, right/wrong conclusion, standard high-risk guidance |

### 8.3 Transition allowlist

| From | Trigger/actor | Guard | To | Audit required |
|---|---|---|---|---|
| Ingest event | SYSTEM | Ticket accepted | `IN_PROGRESS` | Yes |
| `IN_PROGRESS` | Agent validator | Missing/unclear/ambiguous/pre-draft gap | `CHỜ_XÁC_MINH` | Yes |
| `IN_PROGRESS` | Agent validator | Exact exception rule | `EXCEPTION` | Yes + ExceptionRecord |
| `IN_PROGRESS` | Agent validator | Seven gates pass | `READY_FOR_REVIEW` | Yes + readiness detail |
| `CHỜ_XÁC_MINH` | Authorized human + Agent | Data saved in editable layer, audit complete, revalidation starts | `IN_PROGRESS` | Yes |
| `CHỜ_XÁC_MINH` | Agent validator | Newly verified exception rule | `EXCEPTION` | Yes + ExceptionRecord |
| `EXCEPTION` | BQL + Agent | BQL resolution allows standard flow; revalidation | `IN_PROGRESS` | Yes |
| `EXCEPTION` | BQL | Requests missing verification | `CHỜ_XÁC_MINH` | Yes |
| `READY_FOR_REVIEW` | Authorized human + Agent | Legitimate admin/execution update | `IN_PROGRESS` | Yes |
| `READY_FOR_REVIEW` | Agent validator | Newly detected exact exception before BQL outcome | `EXCEPTION` | Yes + ExceptionRecord |

Invalid transitions: direct `CHỜ_XÁC_MINH→READY_FOR_REVIEW`; Agent-resolved `EXCEPTION→READY_FOR_REVIEW`; any transition to `CLOSED|COMPLETED|ACCEPTED|MATERIAL_APPROVED`; manual state override; READY khi bất kỳ gate false.

---

## 9. Output contracts

### 9.1 Classification result

Bắt buộc trả: proposal ID/revision, proposed service/type/playbook/version, matched rule IDs, reason, source references, complete rule signals, confirmation status, target state/reason, synthetic label. Không trả confidence như sole gate hoặc unsupported fact.

### 9.2 Work order draft result

Bắt buộc trả: draft ID, ticket/proposal/playbook/version/admin/source linkage, idempotency key, scope summary, checklist template/items, material mode/lines, evidence requirements, generation rule/reason/source và synthetic label. Không có operational order ID/action.

### 9.3 Readiness result

Bắt buộc trả: seven-gate breakdown, failing field/requirement/item IDs, exact target state, rule IDs/reason/source, active blocking exception IDs, visible non-blocking warnings, evaluation timestamp và audit event ID.

### 9.4 Permission rejection

Bắt buộc trả: `decision=DENY`, `code=ACTION_DENIED`, requested action, actor ID/role, target entity/field, reason, unchanged state, audit event ID. Không tạo `ExceptionRecord` chỉ vì permission denial.

---

## 10. Implementation Gaps và dispositions

| Gap ID | Gap từ Phase 1/2 | Agent A disposition | Áp dụng trong contract | Status |
|---|---|---|---|---|
| `GAP-B-01` | Cách biểu diễn material gate/`norm_qty` N/A | `APPROVE` + correction | Gate N/A → zero line; line có numeric planned/issued/used; norm numeric + SYNTHETIC hoặc null + N_A; comparison 1 N/A khi no norm | CLOSED |
| `GAP-B-02` | Cleaning composite và xử lý một/unclear signal | `SIMULATED ASSUMPTION` | Both PRESENT → EXCEPTION; một PRESENT + một ABSENT không exception; bất kỳ UNCLEAR → CHỜ, no standard draft | CLOSED |
| `GAP-B-03` | Vị trí hai nguồn CSKH deterministic | `SIMULATED ASSUMPTION` | Immutable fixture `request_claims` + immutable history snapshot; mỗi value có source ref; Agent không infer | CLOSED |
| `GAP-B-04` | Ba evidence requirement CSKH độc lập hay dùng chung record | `APPROVE` | Ba requirement IDs; một record chỉ satisfy một requirement | CLOSED |
| `GAP-B-05` | Readability nào pass | `APPROVE` | READABLE hoặc NOT_APPLICABLE cho structured schema-valid; UNREADABLE không pass; unknown → CHỜ | CLOSED |
| `GAP-B-06` | CSKH risk flag dùng boolean hay SignalStatus; behavior khi missing | `APPROVE` | Ba flag là boolean; mỗi flag phải có source ref; missing flag/source → `PB-CS-R-SRC-01`/`CHỜ_XÁC_MINH`; không default false | CLOSED |
| `GAP-B-07` | Comparator `compatible/incompatible` cho năm CSKH fields chưa testable | `SIMULATED ASSUMPTION` | Typed exact equality; unequal same-field values = incompatible; time so normalized ISO-8601 instant; không fuzzy/semantic inference | CLOSED |
| `GAP-B-08` | Owner update `CS-CHK-01` | `APPROVE` | HUMAN_EXECUTION set status; System fixture chỉ cung cấp source links, không set COMPLETED | CLOSED |
| `GAP-B-09` | Cardinality khi nhiều CS exception rules cùng trigger | `SIMULATED ASSUMPTION` | Một ExceptionRecord cho mỗi triggered rule, group bằng query theo ticket; một ticket state `EXCEPTION`; không thêm Package entity | CLOSED |

Không còn Implementation Gap chưa có disposition sau Field Matrix và reverse review Playbook v1.

---

## 11. Contract-level acceptance checks

1. Mọi required field trong playbook phải map tới field path và validator trong contract.
2. Mọi field trong contract phải có source/owner, validation và mục đích nghiệp vụ; field không có consumer phải bị remove.
3. Mỗi state-affecting rule phải có đúng một state outcome; warning/permission annotations không được giả thành business exception.
4. `READY_FOR_REVIEW` chỉ khi seven gates machine-checkable đều pass.
5. Raw content/evidence mutation, Agent checklist completion, exception resolution, acceptance/close/material approval/outbound action đều `ACTION_DENIED` + audit.
6. Không evidence requirement nào bắt buộc ảnh.
7. CSKH material gate luôn N/A và zero line.
8. Material chỉ có ba comparisons; `norm_qty` luôn SYNTHETIC hoặc N_A.
9. Mọi content/evidence là untrusted data; embedded instruction không thay policy.
10. Tất cả entity/output đều có nhãn `synthetic=true` và ID mô phỏng.

---

## 12. Cross-review result

- Mỗi required field trong Playbook v1 có field path và validator tương ứng: **PASS**.
- Mỗi field/entity trong contract có mục đích nghiệp vụ hoặc mục đích integrity/audit rõ: **PASS**.
- Canonical rule IDs, evidence IDs, checklist IDs, enum và owner khớp Playbook v1: **PASS**.
- Mỗi routing rule cho đúng một state; permission denial giữ state và không tạo business exception: **PASS**.
- Seven-gate READY machine-checkable; checklist instances được tạo cùng draft ở trạng thái `PENDING`: **PASS**.
- Raw immutability, permission, audit, material three-comparison, evidence/readability và CSKH two-source validators: **PASS**.
- Không field/rule Playbook nào chưa map; không contract field nào được xác định là không có consumer: **PASS**.
- Agent A final re-read: **PASS; không còn blocking business/schema gap**.

## 13. Open Issues

`No blocking open issues`.
