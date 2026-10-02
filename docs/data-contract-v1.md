# MaintenanceOps Agent — Data Contract v1

> **Document status:** FINAL — cross-reviewed với Playbook v1.1
> **Version:** 1.1
> **Ngày:** 2026-09-27  
> **Owner duy nhất:** Agent B — AI/Data Owner  
> **Business reviewer:** Agent A — Product/BA Owner  
> **Data classification:** `SIMULATED` — toàn bộ instance, workflow, rule, checklist, vật tư, bằng chứng, định mức và kết quả trong contract này là dữ liệu mô phỏng; không phải dữ liệu hoặc quy trình vận hành thật của Vinhomes.

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1-draft | 2026-09-27 | Phase 1: entity map sơ bộ theo PRD v0.2 và decisions đã khóa | DRAFT |
| 0.9 | 2026-09-27 | Phase 2: áp dụng Field Matrix v1; hoàn thiện field-level schema, validators, state machine, permission/immutability/audit và dispositions cho Implementation Gaps | CROSS-REVIEW DRAFT |
| 1.0 | 2026-09-27 | Phase 3: reverse-review Playbook; align canonical field/rule/evidence IDs, checklist timing và material mode | FINAL |
| 1.1 | 2026-09-27 | Re-baseline hai playbook; thêm Asset, DutyAvailability, stock gate, team-only routing và route readiness | FINAL |
| 1.2-candidate | 2026-09-29 | `CR-BPTN-01`: `ConfirmationStatus` 4 giá trị, `review_required_reason`, `override_*`, `audit_event_id` trên administrative layer; bỏ confirmation khỏi proposal; thêm `WorkOrderDraft.duty_source_ref`; `dataset_version=maintenanceops-sim-v1.1` | PROPOSED · Chờ duyệt CR |
| 1.3-candidate | 2026-09-29 | `CR-BPTN-02`: 10 `TicketStatus` + `blocker`; `proposed_department_id`/`department_id`, `review_status`, `asset_resolution`, `locked_fields`; bảng `ticket_status_events`, `ticket_resident_additions`, outbox `Notification`; bỏ `DutyAvailability`, `ExceptionRecord`, safety signals, `EXCEPTION`, route team; chốt `can_route`; chỉ BQL đóng/hủy; `schema_version=1.2`, `dataset_version=maintenanceops-sim-v1.2` | PROPOSED · Chờ duyệt CR |

> **`CR-BPTN-02` (v0.5 candidate), PROPOSED:** các mục 1, 2.3, 2.4, 3, 4, 5.1, 5.2, 5.3, 5.5, 5.10, 5.12–5.15, 6.3, 7.2, 7.6–7.8, 8, 9 và
> 11 đã được viết lại theo [CR-BPTN-02](CR-BPTN-02.md). Trên nhánh `feature/chamanh`, khi có mâu thuẫn thì
> CR-BPTN-02 là nguồn đúng. Actor `HUMAN_EXECUTION` đổi thành `DEPARTMENT` (phòng ban).

---

## 1. Mục đích, phạm vi và ranh giới

Data Contract này là đầu vào thống nhất cho AI, UI và QA của prototype mô phỏng. Contract chỉ bao phủ:

- `PB-CLN-01`: vệ sinh khu vực chung.
- `PB-TEC-01`: đèn khu vực chung không hoạt động.
- Mười trạng thái kiểu theo dõi đơn hàng (`CR-BPTN-02` (v0.5 candidate)): chính `RECEIVED`, `VERIFYING`, `ROUTED`, `IN_PROGRESS`,
  `READY_FOR_REVIEW`, `CLOSED`; phụ `NEED_INFO`, `ON_HOLD`; kết thúc `MERGED`, `CANCELLED`. Mỗi lần dừng có một
  `blocker` với người gỡ, bước chạy lại và mốc leo thang.
- Agent **đề xuất** phòng ban ở bước 4 và chỉ **giao** ở bước 8, sau BPTN review (nếu cần) và tra tài sản. Không đề
  xuất team, không gán người.
- Dataset fixture gồm 12 ticket mô phỏng: 6 vệ sinh, 6 kỹ thuật; 4 demo flow chính và 8 regression cases.

Contract không định nghĩa UI chi tiết, integration thật, work order thật, SOP hiện trường, SLA thật, định mức/tồn kho
thật, phân công nhân sự trong phòng ban, kênh gửi thông báo, computer vision, tài chính hoặc use case ngoài hai playbook
trên. `CR-BPTN-02` (v0.5 candidate) bỏ luật an toàn: contract không còn nhận diện mùi khét, tia lửa, dây hở hay chất lạ.

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
- `BPTN`: review có điều kiện (`CR-BPTN-01`) — xác nhận hoặc override có `override_reason` field hành chính allowlisted; không override để bỏ qua safety exception.
- `DEPARTMENT` (`CR-BPTN-02` (v0.5 candidate), thay `HUMAN_EXECUTION`): phòng ban nhận việc, tự phân công nhân sự (`assignee_id`), cập
  nhật checklist/material/execution evidence, báo hoàn thành, trả về khi sai phòng ban, tạm hoãn tại hiện trường.
- `RESIDENT` (`CR-BPTN-02` (v0.5 candidate)): gửi phản ánh, bổ sung thông tin (append-only), đánh giá, báo chưa xong trong thời hạn mở lại.
- `WAREHOUSE` (`CR-BPTN-02` (v0.5 candidate)): nhập vật tư mô phỏng (sự kiện `stock_received`).
- `BQL`: người duy nhất được đóng (`CLOSED`), trả làm lại (`REWORK`) hoặc hủy (`CANCELLED`) ticket.
- `SYSTEM_DERIVED`: validator/state engine ghi kết quả có rule/source/version; không phải human approval.

### 2.4 Canonical codes

- `CR-BPTN-02` (v0.5 candidate): stored status dùng đúng mã tiếng Anh của `TicketStatus`; nhãn tiếng Việt cho cư dân chỉ sinh từ `src/maintenance/i18n/vi.yaml`. Nhãn `CHỜ XÁC MINH` của v0.3/v0.4 không còn được lưu.
- Permission denial canonical code là `ACTION_DENIED`. Tên cũ `ACTION_OUT_OF_AUTHORITY` chỉ là deprecated documentation alias, không được emit trong v1.
- Timestamp dùng ISO 8601 có timezone.
- JSON-like object được mô tả ở mức schema; tài liệu này không phải code implementation.

---

## 3. Entity map và quan hệ

| Entity bắt buộc | Vai trò | Quan hệ chính | Write owner | Rào chắn |
|---|---|---|---|---|
| `Ticket` | Raw ticket, trạng thái, blocker, phòng ban đề xuất/được giao | Parent của mọi case entity | Raw: ingest-only; status/blocker: chỉ qua `transition`; `assignee_id`: DEPARTMENT; `locked_fields`: BPTN | Raw immutable; giao phòng ban chỉ khi `can_route` |
| `AgentClassificationProposal` | Proposal service/type/playbook + tra tài sản | N—1 Ticket | Agent | Không ghi đè `locked_fields`; không confidence-only |
| `WorkOrderDraft` | Draft mô phỏng tạo ở bước 8 | N—1 Ticket/proposal; parent checklist/material/evidence requirements | Agent/SYSTEM_DERIVED | Không phải work order thật; `assignee_id=null` |
| `Asset` | Catalog tài sản vật lý mô phỏng cho kỹ thuật | Lookup theo type/location/playbook | Static simulated config, read-only | ID `SIM-ASSET-*`; không CRUD/runtime write |
| `ChecklistTemplate` | Template checklist versioned của playbook | 1—N ChecklistItem | Static simulated config | Không chứa SOP kỹ thuật thật |
| `ChecklistItem` | Instance checklist execution | N—1 WorkOrderDraft/template item | DEPARTMENT | Agent không tự `COMPLETED` |
| `MaterialLine` | Material record và ba comparison | N—1 WorkOrderDraft | DEPARTMENT input; Agent derive comparisons | Không approval/inventory/violation conclusion |
| `EvidenceRecord` | Original hoặc execution evidence | N—1 Ticket; 0..1 WorkOrderDraft requirement | Ingest hoặc DEPARTMENT | Checklist không thay evidence; ảnh phòng ban bắt buộc, ảnh cư dân optional |
| `StatusEvent` (`CR-BPTN-02` (v0.5 candidate)) | `ticket_status_events`: một dòng cho mỗi thay đổi status hoặc blocker | N—1 Ticket | SYSTEM (trong `transition`) | Nguồn duy nhất cho timeline cư dân và audit trạng thái |
| `ResidentAddition` (`CR-BPTN-02` (v0.5 candidate)) | `ticket_resident_additions`: thông tin cư dân bổ sung, hoặc BPTN ghi thay sau khi liên hệ cư dân (`submitted_by`) | N—1 Ticket | RESIDENT, BPTN | Append-only; không sửa raw |
| `Notification` (`CR-BPTN-02` (v0.5 candidate)) | Outbox sự kiện thông báo | N—1 Ticket | SYSTEM | Không gửi kênh thật |
| `AuditEvent` | Append-only event cho action không phải status (lookup, cập nhật thực hiện, từ chối quyền) | N—1 Ticket; target polymorphic | SYSTEM | Audit fail → business mutation fail closed |

Đã bỏ (`CR-BPTN-02` (v0.5 candidate)): `DutyAvailability` (không còn ca trực/capacity theo team), `ExceptionRecord` (không còn `EXCEPTION`).
Lịch làm việc phòng ban, giờ hành chính BPTN và mốc SLA là cấu hình tĩnh (`departments`, `business_hours`,
`sla_config` trong catalog), không phải entity runtime.

### 3.1 Supporting value objects, không mở rộng workflow

- `Blocker`, `LockedFields`: embedded dưới `Ticket` (`CR-BPTN-02` (v0.5 candidate)).
- `ClassificationRecord`: kết quả proposer được cache trên case để Agent không gọi lại model.
- `EvidenceRequirement`, `ReadinessEvaluation`, `NonBlockingWarning`: embedded dưới `WorkOrderDraft`.
- `MaterialComparisonResult`: embedded dưới `MaterialLine`.
- Đã bỏ: `AdministrativeNormalization` (thay bằng `locked_fields` + `review_status`), `RuleSignal`.

```text
Ticket
  ├── 0..1 Blocker, 1 LockedFields
  ├── 0..1 AgentClassificationProposal
  ├── 0..1 WorkOrderDraft (tạo ở bước 8; revision tăng khi giao lại)
  │     ├── 1 ChecklistTemplate reference
  │     ├── 1..N ChecklistItem
  │     ├── 0..N MaterialLine
  │     └── 1..N EvidenceRequirement links
  ├── 0..1 Asset reference (technical only)
  ├── 0..N ResidentAddition
  ├── 0..N EvidenceRecord
  ├── 1..N StatusEvent
  ├── 0..N Notification
  └── 1..N AuditEvent
```

---

## 4. Enum và controlled vocabulary

| Enum | Giá trị hợp lệ |
|---|---|
| `TicketStatus` (`CR-BPTN-02` (v0.5 candidate)) | chính: `RECEIVED`, `VERIFYING`, `ROUTED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `CLOSED`; phụ: `NEED_INFO`, `ON_HOLD`; kết thúc: `MERGED`, `CANCELLED` |
| `ReasonCode` (`CR-BPTN-02` (v0.5 candidate)) | `MISSING_INFO`, `DUPLICATE`, `CATEGORY_UNCLEAR`, `OUT_OF_SCOPE`, `PENDING_REVIEW`, `ASSET_UNCLEAR`, `WAITING_MATERIAL`, `OUT_OF_HOURS`, `NOT_ACCEPTED`, `WRONG_DEPT`, `BLOCKED_ONSITE`, `REWORK` |
| `Department` (`CR-BPTN-02` (v0.5 candidate)) | `DEPT_CLEANING`, `DEPT_TECHNICAL` (map từ playbook bằng bảng cấu hình `playbook_departments`) |
| `BlockerOwner` (`CR-BPTN-02` (v0.5 candidate)) | `RESIDENT`, `BPTN`, `DEPARTMENT`, `WAREHOUSE`, `SYSTEM`, `BQL` |
| `ReviewStatus` | `NOT_REQUIRED`, `PENDING_REVIEW`, `CONFIRMED` (đổi tên từ `ConfirmationStatus` v0.4; bỏ `OVERRIDDEN`) |
| `AssetResolution` (`CR-BPTN-02` (v0.5 candidate)) | `FOUND`, `ONSITE_BY_BPTN`, `NOT_APPLICABLE` |
| `TicketFlag` (`CR-BPTN-02` (v0.5 candidate)) | `ASSET_CHECK_ONSITE`, `STOCK_CHECK_ON_ACCEPT` |
| `ServiceCategory` | `VE_SINH`, `KY_THUAT`, `UNKNOWN` |
| `TicketType` | `COMMON_AREA_CLEANING`, `COMMON_AREA_LIGHTING`, `UNKNOWN` |
| `PlaybookId` | `PB-CLN-01`, `PB-TEC-01` |
| `ChecklistStatus` | `PENDING`, `COMPLETED` |
| `MaterialGateStatus` | `RECONCILED`, `NEEDS_CLARIFICATION`, `N/A` |
| `NormLabel` | `SYNTHETIC`, `N_A` |
| `ComparisonType` | `PLANNED_VS_NORM`, `ISSUED_VS_PLANNED`, `USED_VS_ISSUED` |
| `ComparisonStatus` | `MATCH`, `VARIANCE`, `N/A` |
| `EvidenceType` | `PROCESSING_NOTE`, `RESULT_NOTE`, `SIMULATED_IMAGE`, `RESIDENT_ORIGINAL` |
| `EvidenceValidationStatus` | `PRESENT`, `MISSING`, `INVALID_TYPE`, `SOURCE_UNVERIFIED` |
| `ReadabilityStatus` | `READABLE`, `UNREADABLE`, `NOT_APPLICABLE` |
| `EvidenceSource` | `RESIDENT_ORIGINAL`, `DEPARTMENT_EXECUTION`, `SYSTEM_SIMULATED` |
| `WarningType` | `EXPLAINED_MATERIAL_VARIANCE` |
| `ActorRole` | `SYSTEM`, `AGENT`, `RESIDENT`, `BPTN`, `DEPARTMENT`, `WAREHOUSE`, `BQL`, `QA_INTERNAL` |
| `ActionResult` | `ALLOWED`, `ACTION_DENIED` |
| `AssetLookupStatus` | `MATCHED`, `NOT_FOUND`, `AMBIGUOUS`, `LOCKED_BY_BPTN`, `CHECK_ONSITE`, `NOT_APPLICABLE` |
| `MaterialStockStatus` | `SUFFICIENT`, `INSUFFICIENT`, `UNKNOWN`, `NOT_APPLICABLE` |

Đã bỏ (`CR-BPTN-02` (v0.5 candidate)): `TicketState`, `ReviewRequiredReason`, `SignalStatus`, `ExceptionType`, `RiskLevel`, `ExceptionStatus`,
`DutyLookupStatus`, `RouteStatus`, `QueueStatus`, `QueueReason`.

---

## 5. Field-level schema

Mỗi bảng dùng các cột: field; type; required/gate; enum/const; source/owner; validation; liên kết; ví dụ mô phỏng.

### 5.1 `Ticket`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ `SIMULATED` |
|---|---|---|---|---|---|---|---|
| `ticket_id` | string | R | pattern `SIM-TKT-*` | SYSTEM_INGEST | Non-empty, unique, immutable | PK | `SIM-TKT-CLN-001` |
| `created_at` | datetime | R | ISO 8601 | SYSTEM_INGEST | Parseable, timezone present, immutable | Duplicate window, SLA | `2026-09-27T08:00:00+07:00` |
| `original_description` | string | R (bước 2, tính cả phần bổ sung) | — | RESIDENT_SOURCE | Lưu nguyên văn kể cả rỗng; untrusted data; immutable | Proposal | `Hành lang tầng 3 tòa SIM-A nhiều rác` |
| `original_evidence_refs` | array<string> | O | IDs `SIM-EVD-*` | RESIDENT_SOURCE/SYSTEM_INGEST | Immutable refs | EvidenceRecord | `[]` |
| `raw_integrity_marker` | string | R | — | SYSTEM_INGEST | Hash recomputed phải unchanged | Bất biến 4 | `sha256:...` |
| `resident_id` | string | R | actor `RESIDENT` | SYSTEM_INGEST | Cư dân chỉ xem/thao tác ticket của mình | Resident API | `SIM-ACTOR-RESIDENT-01` |
| `source_revision`, `dataset_version` | string | R | — | SYSTEM_INGEST | Immutable | QA reset | `SRC-001`, `maintenanceops-sim-v1.2` |
| `status` | enum | R | `TicketStatus` | SYSTEM_DERIVED qua `transition` | Chỉ transition trong §8.3; mỗi lần đổi có đúng một `StatusEvent` | State machine | `ROUTED` |
| `blocker` | object/null | C | `Blocker` §5.12 | SYSTEM/AGENT/DEPARTMENT/BQL | Chỉ tồn tại ở trạng thái cho phép (§5.12); `NEED_INFO`/`VERIFYING`/`ON_HOLD` bắt buộc có | Retry/escalation | xem §5.12 |
| `proposed_department_id` | enum/null | C: sau bước 4 | `Department` | AGENT (bước 4) hoặc `locked_fields.department` | Chỉ là đề xuất; cư dân không thấy | `can_route` | `DEPT_TECHNICAL` |
| `department_id` | enum/null | C: chỉ set ở bước 8 | `Department` | SYSTEM (bước 8) | Bằng `proposed_department_id` tại lúc giao; bắt buộc ở `ROUTED`/`IN_PROGRESS`/`READY_FOR_REVIEW`/`CLOSED`; về `null` khi `WRONG_DEPT` | Phạm vi quyền phòng ban | `DEPT_TECHNICAL` |
| `review_status` | enum/null | C: sau bước 5 | `ReviewStatus` | AGENT (`NOT_REQUIRED`/`PENDING_REVIEW`); BPTN (`CONFIRMED`) | `PENDING_REVIEW` chặn `can_route` | Bước 5 | `NOT_REQUIRED` |
| `asset_resolution` | enum/null | C: sau bước 6 | `AssetResolution` | AGENT (`FOUND`/`NOT_APPLICABLE`); chỉ BPTN dẫn tới `ONSITE_BY_BPTN` | `null` chặn `can_route`; reset khi BPTN đổi loại việc | Bước 6 | `FOUND` |
| `locked_fields` | object | R | `{category, location, asset_id, department}` | BPTN | Agent đọc, không ghi đè | Bước 3–8 | `{"category": "VE_SINH"}` |
| `assignee_id` | string/null | O | — | DEPARTMENT | Agent không bao giờ ghi | Bất biến 2 | `null` |
| `flags` | array<enum> | R | `TicketFlag` | AGENT/BPTN | `ASSET_CHECK_ONSITE` chỉ do BPTN chọn | Draft | `["STOCK_CHECK_ON_ACCEPT"]` |
| `merged_into` | string/null | C iff `MERGED` | ticket ID | BPTN | Ticket gốc đang mở | Resident view | `null` |
| `rework_count` | integer | R | ≥0, mặc định 0 | BQL (qua `REWORK`) | Tăng mỗi lần trả làm lại | Leo thang | `0` |
| `dispatched_at` | datetime/null | C | ISO 8601 | SYSTEM | Lúc ticket `ROUTED` trong giờ phòng ban | `NOT_ACCEPTED` | — |
| `accepted_at` | datetime/null | C | ISO 8601 | DEPARTMENT | Lúc phòng ban nhận việc | Bước 10 | — |
| `closed_by`, `closed_at` | string, datetime | C iff `CLOSED` | actor BQL | BQL | Chỉ BQL | Bất biến 1 | — |
| `cancel_reason` | string/null | C iff `CANCELLED` | — | BQL | Non-empty | — | — |
| `reopen_until` | datetime/null | C | `closed_at + reopen_window_days` | SYSTEM | Cư dân báo chưa xong khi `now < reopen_until` | — | — |
| `rating` | int/null | O | 1–5 | RESIDENT | Chỉ khi `CLOSED` | — | `5` |
| `synthetic` | boolean | R | `true` | SYSTEM_INGEST | False/missing → schema reject | — | `true` |

Không còn `current_state`, `state_decision`, `administrative_normalization` (`CR-BPTN-02` (v0.5 candidate)). BPTN không sửa trường hành chính
trực tiếp: giá trị BPTN chọn nằm trong `locked_fields`.

### 5.2 `AgentClassificationProposal`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `proposal_id` | string | R | `SIM-ACP-*` | SYSTEM | Unique | PK | `SIM-ACP-001` |
| `ticket_id` | string | R | — | SYSTEM | Ticket tồn tại | Ticket FK | `SIM-TKT-CLN-001` |
| `proposal_revision` | integer | R | ≥1 | SYSTEM | Tăng đơn điệu | Audit/version | `1` |
| `service_category_proposed` | enum | R classification output | `ServiceCategory` | AGENT_PROPOSAL | Không `UNKNOWN` để match playbook | Admin normalization | `VE_SINH` |
| `ticket_type_proposed` | enum | R classification output | `TicketType` | AGENT_PROPOSAL | Không `UNKNOWN`; pair hợp lệ với service/playbook | Admin normalization | `COMMON_AREA_CLEANING` |
| `playbook_id` | enum | R classification output | `PlaybookId` | AGENT_PROPOSAL | Pair mapping exact; không invent playbook | Draft | `PB-CLN-01` |
| `playbook_version` | string | R | const `1.1` | Static config/Agent | Version tồn tại | ChecklistTemplate | `1.1` |
| `asset_type` | enum/null | O; chỉ TEC | `LIGHTING` | AGENT_PROPOSAL | Không phải raw required field | TEC explanation | `LIGHTING` |
| `reported_symptom` | enum/null | O; chỉ TEC | `NOT_WORKING` | AGENT_PROPOSAL | Không phải raw required field | TEC explanation | `NOT_WORKING` |
| `location_proposed` | string/null | O | — | AGENT_PROPOSAL (luật cố định) | Chỉ khi đọc được đủ tòa/tầng/khu vực từ `original_description`; null nếu thiếu → `PENDING_REVIEW`. Giá trị này thành `location_normalized` trừ khi BPTN override | `location_normalized` | `Tòa SIM-A / Tầng 3 / Hành lang` |
| `asset_id` | string/null | C: field bắt buộc cho TEC, nullable khi unresolved | `SIM-ASSET-*` | SYSTEM_DERIVED lookup | CLN phải null; TEC chỉ non-null khi exact one match | Asset FK | `SIM-ASSET-LIGHT-001` |
| `asset_lookup_status` | enum | R | `AssetLookupStatus` | SYSTEM_DERIVED | CLN=`NOT_APPLICABLE`; TEC phải được lookup | Route gate | `MATCHED` |
| `asset_match_reason` | string | R | — | SYSTEM_DERIVED | Non-empty; nêu exact match/not found/ambiguous | Explainability | `Một asset LIGHTING khớp vị trí` |
| `category_source` | enum | R | `AGENT|BPTN_LOCKED` | SYSTEM | `BPTN_LOCKED` khi category lấy từ `locked_fields` (`CR-BPTN-02` (v0.5 candidate)) | Bất biến 3 | `AGENT` |
| `matched_rule_ids` | array<string> | R | playbook rule IDs | AGENT_PROPOSAL | Non-empty; mọi ID tồn tại trong playbook | Rule trace | `["PB-CLN-R-TRG-01"]` |
| `classification_reason` | string | R | — | AGENT_PROPOSAL | Non-empty, không chứa unsupported fact | Explainability | `Khớp phản ánh vệ sinh khu vực chung` |
| `source_references` | array<string> | R | — | AGENT_PROPOSAL | Non-empty; ref tồn tại | Ticket/raw | `["ticket.original_description"]` |
| `created_at` | datetime | R | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:01:00+07:00` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

`CR-BPTN-02` (v0.5 candidate): bỏ `routing_team_id`, `duty_*`, `route_status` và `rule_signals` khỏi proposal. `location_proposed` đọc
từ nội dung gốc + phần cư dân bổ sung; vị trí hiệu lực là `locked_fields.location` nếu BPTN đã chọn. `asset_lookup_status`
`NOT_FOUND`/`AMBIGUOUS` dừng ở `VERIFYING`/`ASSET_UNCLEAR`; Agent không tự bỏ qua.

### 5.3 `WorkOrderDraft`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `work_order_draft_id` | string | R | `SIM-WOD-*` | SYSTEM | Unique logical draft ID | PK | `SIM-WOD-CLN-001` |
| `ticket_id` | string | R | — | SYSTEM | Ticket tồn tại | Ticket FK | `SIM-TKT-CLN-001` |
| `proposal_id` | string | R | — | SYSTEM | Proposal tồn tại; admin layer không `PENDING_REVIEW` | Proposal FK | `SIM-ACP-001` |
| `playbook_id` | enum | R | `PlaybookId` | AGENT_PROPOSAL | Khớp proposal/admin | Template FK | `PB-CLN-01` |
| `playbook_version` | string | R | `1.1` | SYSTEM | Khớp proposal/template | Template FK | `1.1` |
| `source_revision` | string | R | — | SYSTEM | Khớp Ticket source revision | Ticket | `SRC-001` |
| `draft_revision` | integer | R | ≥1 | SYSTEM | Retry cùng input không tạo duplicate; revision tăng khi authorized source/admin revision đổi | Audit | `1` |
| `draft_status` | enum | R | const `DRAFT` | SYSTEM | Không có status operational khác | — | `DRAFT` |
| `scope_summary` | string | R | — | AGENT_PROPOSAL | Non-empty; mọi fact có source/proposal ref; không chẩn đoán | Source refs | `Ghi nhận vệ sinh tại vị trí đã chuẩn hóa` |
| `matched_rule_ids` | array<string> | R | — | AGENT_PROPOSAL | Rule tồn tại | Playbook | `["PB-CLN-R-TRG-01"]` |
| `source_references` | array<string> | R | — | AGENT_PROPOSAL | Non-empty, ref tồn tại | Ticket/proposal | `["ticket.original_description"]` |
| `asset_id` | string/null | R key | `SIM-ASSET-*`/null | SYSTEM_DERIVED | TEC non-null khi MATCHED; unresolved được null; CLN null | Asset FK | `null` |
| `location` | string | R | — | SYSTEM | Vị trí hiệu lực lúc giao | Scope | `Tòa SIM-A / Tầng 3 / Hành lang` |
| `department_id` | enum | R | `Department` | SYSTEM (bước 8) | Bằng `Ticket.proposed_department_id` lúc giao (`CR-BPTN-02` (v0.5 candidate)) | Ticket | `DEPT_CLEANING` |
| `flags` | array<enum> | R | `TicketFlag` | SYSTEM | Sao chép cờ của ticket lúc giao | Phòng ban | `[]` |
| `assignee_id` | null | R | const `null` | SYSTEM | Draft không chọn người; phòng ban tự set `Ticket.assignee_id` | Bất biến 2 | `null` |
| `material_stock_status` | enum | R | `MaterialStockStatus` | SYSTEM_DERIVED | Draft chỉ tồn tại khi không `INSUFFICIENT`; `UNKNOWN` kèm cờ `STOCK_CHECK_ON_ACCEPT` | MaterialLine | `SUFFICIENT` |
| `checklist_template_id` | string | R | template ID | SYSTEM | Template đúng playbook/version | ChecklistTemplate | `PB-CLN-01-CHK-V1` |
| `checklist_item_ids` | array<string> | R khi tạo draft | — | SYSTEM | Sinh đủ mọi required template item; ≥1; item initial PENDING | ChecklistItem | `["SIM-CHK-CLN-001-01", ...]` |
| `material_requirement_mode` | enum | R | `TRACKED|N_A` | Static playbook/System | N_A yêu cầu zero line | Material gate | `TRACKED` |
| `material_gate_status` | enum | `R-READY` | `MaterialGateStatus` | SYSTEM_DERIVED | READY chỉ `RECONCILED|N/A`; N/A → zero line | MaterialLine | `RECONCILED` |
| `material_line_ids` | array<string> | C | — | SYSTEM | N/A = `[]`; otherwise refs cùng draft | MaterialLine | `["SIM-MAT-001"]` |
| `evidence_requirements` | array<EvidenceRequirement> | R | catalog §6.2 | Static config | Đủ exact requirements playbook; image không required | EvidenceRecord | xem §6.2 |
| `readiness_evaluation` | object | R sau "báo hoàn thành" | — | SYSTEM_DERIVED | Sáu điều kiện bước 10; không phải nghiệm thu | State validator | xem dưới |
| `non_blocking_warnings` | array<NonBlockingWarning> | O | only explained variance | SYSTEM_DERIVED | Warning visible; không tự override blocker | Material comparison | `[]` |
| `created_at` | datetime | R | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:04:00+07:00` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

`WorkOrderDraft` chỉ được tạo ở bước 8, ngay trước khi giao (`CR-BPTN-02` (v0.5 candidate)). `ReadinessEvaluation` (bước 10, chạy khi
phòng ban báo hoàn thành) chứa bảy boolean: `department_accepted` (có `department_id` và `accepted_at`),
`checklist_complete`, `photo_present` (ít nhất một ảnh `SIMULATED_IMAGE` của phòng ban cho draft hiện tại), `processing_note_present`, `materials_entered`, `variance_explained` (lệch có lý do chỉ là
warning), `no_open_blocker` (`REWORK` không tính); cùng `evaluated_at`, `failing_items`. Đạt sáu điều kiện còn lại → Agent chuyển
`IN_PROGRESS → READY_FOR_REVIEW`. `processing_note_present` chỉ để ghi nhận, không tính vào điều kiện đạt (ghi chú không bắt buộc). Không đạt → giữ `IN_PROGRESS`, trả `failing_items` cho phòng ban, không set blocker.

`NonBlockingWarning` gồm `warning_id`, `warning_type=EXPLAINED_MATERIAL_VARIANCE`, `blocking=false`, `rule_id`, `reason`, `material_line_ids`, `comparison_types`, `created_at`, `synthetic=true`.

### 5.4 `Asset`

| Field | Type | Required | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `asset_id` | string | R | `SIM-ASSET-*` | Static fixture | Unique, immutable | Proposal/draft | `SIM-ASSET-LIGHT-001` |
| `asset_type` | enum | R | MVP ưu tiên `LIGHTING` | Static fixture | TEC lookup allowlist | Playbook | `LIGHTING` |
| `location_normalized` | string/object | R | — | Static fixture | Exact normalized location key; immutable | Ticket admin | `Tòa SIM-A / hành lang` |
| `asset_status` | enum/string | R | simulated catalog value | Static fixture | Non-empty; không suy diễn tình trạng thực | Lookup | `ACTIVE_SIMULATED` |
| `linked_playbook_id` | enum | R | const `PB-TEC-01` | Static fixture | CLN link reject | Playbook | `PB-TEC-01` |
| `source_ref` | string | R | — | Static fixture | Ref tồn tại | Audit/explainability | `fixture.asset.001` |
| `synthetic` | boolean | R | true | Static fixture | False/missing reject | All output | `true` |
| `read_only` | boolean | R | true | Static fixture | Runtime write → `ACTION_DENIED` | Permission | `true` |

### 5.5 `DutyAvailability`

**Đã bỏ (`CR-BPTN-02` (v0.5 candidate)).** Không còn tra ca trực, capacity hay `SIM-TEAM-*`. Giờ làm việc được cấu hình theo phòng ban:

| Config | Nội dung | Ví dụ mặc định (chờ chốt) |
|---|---|---|
| `playbook_departments` | Bảng playbook → `Department` | `PB-CLN-01: DEPT_CLEANING`, `PB-TEC-01: DEPT_TECHNICAL` |
| `departments[].shifts` | Ca làm việc giờ địa phương | 06:00–14:00, 14:00–22:00 cho cả hai phòng ban |
| `business_hours` | Giờ hành chính BPTN | 08:00–17:00, thứ Hai–Sáu |
| `sla_config` | Mốc retry/leo thang (§8.5) | xem §8.5 |

### 5.6 `ChecklistTemplate`

| Field | Type | Required | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `checklist_template_id` | string | R | playbook template ID | Static `SIMULATED` config | Unique theo playbook/version | WorkOrderDraft | `PB-CLN-01-CHK-V1` |
| `playbook_id` | enum | R | `PlaybookId` | Static config | Exact mapping | Proposal/draft | `PB-CLN-01` |
| `playbook_version` | string | R | `1.1` | Static config | Exact version | Proposal/draft | `1.1` |
| `template_version` | string | R | `1.1` | Static config | Immutable sau fixture freeze | ChecklistItem | `1.1` |
| `items` | array<object> | R | catalog §6.1 | Product/BA-approved simulated config | ≥1; unique item ID; mỗi item required flag và owner | ChecklistItem | xem §6.1 |
| `not_real_sop_label` | boolean | R | true | Static config | False/missing reject | Safety label | `true` |
| `synthetic` | boolean | R | true | Static config | Missing/false reject | — | `true` |

Mỗi `items[]` có `template_item_id`, `label`, `required`, `update_owner=DEPARTMENT`, `completion_status_enum=[PENDING,COMPLETED]`.

### 5.7 `ChecklistItem`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `checklist_item_id` | string | R | `SIM-CHK-*` | SYSTEM | Unique | PK | `SIM-CHK-CLN-001-01` |
| `work_order_draft_id` | string | R | — | SYSTEM | Draft tồn tại | Draft FK | `SIM-WOD-CLN-001` |
| `checklist_template_id` | string | R | — | SYSTEM | Template đúng draft playbook/version | Template FK | `PB-CLN-01-CHK-V1` |
| `template_item_id` | string | R | catalog §6.1 | SYSTEM | Item tồn tại trong template | Template item | `CLN-CHK-01` |
| `label_snapshot` | string | R | — | SYSTEM | Khớp template version; immutable trong revision | Explainability | `Location execution khớp location đã chuẩn hóa` |
| `required` | boolean | R | true cho v1 catalog | Static config | Không được actor runtime đổi | READY gate | `true` |
| `status` | enum | R khi tạo item; evaluated tại READY | `PENDING|COMPLETED` | SYSTEM initial/DEPARTMENT update | Initial phải PENDING; chỉ DEPARTMENT đổi sang COMPLETED; READY yêu cầu mọi required item COMPLETED | Readiness | `PENDING` |
| `updated_by` | string | C: required khi update | actor ID | DEPARTMENT | Role DEPARTMENT, đúng phòng ban của ticket | Audit | `SIM-ACTOR-DEPT-CLN-01` |
| `updated_at` | datetime | C: required khi update | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:20:00+07:00` |
| `note` | string/null | O | — | DEPARTMENT | Nếu có phải non-blank; không thay EvidenceRecord | — | `Đã ghi nhận mục mô phỏng` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

### 5.8 `MaterialLine`

Chỉ tồn tại cho CLN/TEC khi `material_gate_status != N/A`. Khi toàn gate `N/A`, không tạo `MaterialLine`.

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `material_line_id` | string | R | `SIM-MAT-*` | SYSTEM | Unique | PK | `SIM-MAT-001` |
| `work_order_draft_id` | string | R | — | SYSTEM | Draft CLN/TEC tồn tại | Draft FK | `SIM-WOD-TEC-001` |
| `item_code` | string | R | `SIM-*` | DEPARTMENT/fixture | Non-empty, simulated | — | `SIM-MAT-LAMP-01` |
| `item_name` | string | R | — | DEPARTMENT/fixture | Non-empty, simulated label | — | `Vật tư chiếu sáng mô phỏng` |
| `unit` | string/null | O | — | DEPARTMENT/fixture | Nếu có phải gắn ngữ cảnh simulated; không dùng cho inventory | — | `unit-sim` |
| `planned_qty` | number | R line | ≥0 | DEPARTMENT/fixture | Finite number | Comparison 1/2 | `2` |
| `norm_qty` | number/null | C | ≥0 hoặc null | DEPARTMENT/fixture | Number iff `norm_label=SYNTHETIC`; null iff `N_A` | Comparison 1 | `2` |
| `norm_label` | enum | R line | `SYNTHETIC|N_A` | SYSTEM/config | `SYNTHETIC` → numeric norm; `N_A` → null norm | Safety label | `SYNTHETIC` |
| `simulated_stock_qty` | number/null | C: pre-route | ≥0 hoặc null | Static fixture | Null chỉ khi stock unknown/not applicable | Stock gate | `5` |
| `material_stock_status` | enum | R pre-route | `MaterialStockStatus` | SYSTEM_DERIVED | SUFFICIENT/NOT_APPLICABLE mới pass route | Draft route | `SUFFICIENT` |
| `issued_qty` | number | R line | ≥0 | DEPARTMENT/fixture | Finite number | Comparison 2/3 | `2` |
| `used_qty` | number | R line | ≥0 | DEPARTMENT/fixture | Finite number | Comparison 3 | `1` |
| `variance_reason` | string/null | C | — | DEPARTMENT | Non-empty iff bất kỳ applicable comparison là VARIANCE; thiếu → clarification | Warning/state | `Còn 1 đơn vị mô phỏng chưa dùng` |
| `comparison_results` | array<MaterialComparisonResult> | `R-READY` | exact three types | SYSTEM_DERIVED | Có đúng ba record, không comparison thứ tư | Readiness/warning | xem dưới |
| `reconciliation_status` | enum | `R-READY` | `RECONCILED|NEEDS_CLARIFICATION` | SYSTEM_DERIVED | RECONCILED khi values valid và mọi variance có reason | Draft gate | `RECONCILED` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

Mỗi `MaterialComparisonResult` có `comparison_type`, `left_field`, `right_field`, `left_value`, `right_value`, `status`, `reason_reference`. Exact contract:

1. `PLANNED_VS_NORM`: `planned_qty` ↔ `norm_qty`; status `N/A` nếu `norm_label=N_A`.
2. `ISSUED_VS_PLANNED`: `issued_qty` ↔ `planned_qty`.
3. `USED_VS_ISSUED`: `used_qty` ↔ `issued_qty`.

Agent chỉ detect/mô tả. Contract không có field approve, inventory adjustment, violation conclusion hoặc fourth comparison.

### 5.9 `EvidenceRecord`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `evidence_id` | string | R | `SIM-EVD-*` | SYSTEM | Unique | PK | `SIM-EVD-CLN-001` |
| `ticket_id` | string | R | — | SYSTEM | Ticket tồn tại | Ticket FK | `SIM-TKT-CLN-001` |
| `work_order_draft_id` | string/null | C: required cho execution evidence | — | SYSTEM | Draft cùng ticket; original resident evidence có thể null | Draft FK | `SIM-WOD-CLN-001` |
| `requirement_id` | string/null | C: required cho minimum execution evidence | catalog §6.2 | SYSTEM/DEPARTMENT | Một record chỉ satisfy một requirement; đúng playbook | WorkOrderDraft requirement | `CLN-EVD-PROCESSING-NOTE` |
| `evidence_type` | enum | R | `EvidenceType` | Ingest/DEPARTMENT | Type phải thuộc allowed types của requirement | Validator | `PROCESSING_NOTE` |
| `content_or_metadata` | object/string | R | — | RESIDENT_SOURCE hoặc DEPARTMENT | Non-empty; untrusted data; không thực thi embedded instruction | Security validator | `Ghi chú xử lý mô phỏng` |
| `source` | enum | R | `EvidenceSource` | SYSTEM | Khớp creator/layer | Immutability | `DEPARTMENT_EXECUTION` |
| `submitted_by` | string | R | actor ID | Ingest/DEPARTMENT | Actor tồn tại; correct role | Audit | `SIM-ACTOR-DEPT-CLN-01` |
| `submitted_at` | datetime | R | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:22:00+07:00` |
| `readability_status` | enum | R | `ReadabilityStatus` | DEPARTMENT/SYSTEM validate | PRESENT chỉ READABLE, hoặc NOT_APPLICABLE cho structured text/metadata schema-valid | Evidence status | `NOT_APPLICABLE` |
| `evidence_validation_status` | enum | `R-READY` per requirement | `EvidenceValidationStatus` | SYSTEM_DERIVED | Theo §7.5; không quality score/image vision | Readiness | `PRESENT` |
| `immutable` | boolean | R | true iff resident original | SYSTEM | Original evidence cannot mutate; execution edit tạo revision/audit | Immutability | `false` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

Ảnh phòng ban dùng `SIMULATED_IMAGE` (source `DEPARTMENT_EXECUTION`, `requirement_id=null`), bắt buộc ít nhất một cho mỗi draft (điều kiện `photo_present`, thiếu → `failing_items` có `execution_photo`). Ảnh cư dân dùng `RESIDENT_ORIGINAL` (source `RESIDENT_ORIGINAL`, `immutable=true`), optional, tối đa 5. `content_or_metadata` là tên tệp do server sinh; loại tệp kiểm bằng magic bytes (JPG/PNG/WEBP, ≤ 5 MB). Không có computer vision hoặc quality confirmation field.

### 5.10 `ExceptionRecord`

**Đã bỏ (`CR-BPTN-02` (v0.5 candidate)).** Không còn luật an toàn, `EXCEPTION` hay resolution của BQL. Các tình huống cần người quyết định
được biểu diễn bằng `Ticket.blocker` (§5.12).

### 5.11 `AuditEvent`

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
| `playbook_version` | string/null | C khi playbook áp dụng | `1.1` | SYSTEM | Exact version | Playbook | `1.1` |
| `schema_version` | string | R | `1.2` | SYSTEM | Exact contract version | Contract | `1.2` |
| `run_id` | string | R | `SIM-RUN-*` | SYSTEM | Truy vết reset/replay | QA | `SIM-RUN-001` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

AuditEvent append-only. Nếu audit write fail, mutation/transition/rejection result không được commit một phần.
`CR-BPTN-02` (v0.5 candidate): thay đổi status/blocker ghi vào `StatusEvent` (§5.13), không ghi thêm `AuditEvent` `TRANSITION_STATE`.

### 5.12 `Blocker` (`CR-BPTN-02` (v0.5 candidate))

| Field | Type | Required | Validation rule | Ví dụ |
|---|---|---|---|---|
| `code` | enum | R | `ReasonCode`; phải thuộc tập cho phép của trạng thái hiện tại (bảng dưới) | `ASSET_UNCLEAR` |
| `owner_role` | enum | R | `BlockerOwner` theo mã (§8.4) | `BPTN` |
| `since` | datetime | R | ISO 8601 | — |
| `resume_step` | int/null | C | 2–8; bước pipeline chạy lại khi gỡ (§8.4) | `6` |
| `auto_retry_count` | int | R | ≥0; tối đa `max_auto_retries` rồi leo thang | `0` |
| `next_retry_at`, `escalate_at` | datetime/null | C | Tính từ `sla_config`, lịch phòng ban, giờ hành chính | — |
| `escalated` | bool | R | Chỉ bật cờ + thông báo BQL; không đổi status | `false` |
| `eta` | datetime/null | C | Bắt buộc với `BLOCKED_ONSITE`, phải ở tương lai | — |
| `public_message` | string | R | Sinh từ template i18n theo `ReasonCode`; Agent không tự viết | `Đang xác minh thiết bị tại vị trí phản ánh.` |
| `internal_note` | string/null | O | Không trả cho cư dân | — |
| `related_ticket_id` | string/null | C | Bắt buộc với `DUPLICATE` | `SIM-TKT-0001` |
| `resolved_at`, `resolved_by` | datetime, string | C | Sự kiện gỡ ghi vào đây; `resume()` đọc để chạy tiếp | — |

| Trạng thái | Blocker được phép |
|---|---|
| `NEED_INFO` (bắt buộc) | `MISSING_INFO` |
| `VERIFYING` (bắt buộc) | `DUPLICATE`, `CATEGORY_UNCLEAR`, `OUT_OF_SCOPE`, `PENDING_REVIEW`, `ASSET_UNCLEAR`, `WRONG_DEPT` |
| `ON_HOLD` (bắt buộc) | `WAITING_MATERIAL`, `BLOCKED_ONSITE` |
| `ROUTED` | `OUT_OF_HOURS`, `NOT_ACCEPTED` |
| `IN_PROGRESS` | `REWORK` |

### 5.13 `StatusEvent` — `ticket_status_events` (`CR-BPTN-02` (v0.5 candidate))

`id` (`SIM-EVT-*`), `ticket_id`, `from_status` (null chỉ ở event tạo ticket), `to_status`, `reason_code|null`,
`actor_role`, `actor_id|null`, `public_message`, `internal_note|null`, `public` (hiện trên timeline cư dân khi đổi
trạng thái hoặc blocker được đặt/gỡ; retry/leo thang là nội bộ), `created_at`. Mọi thay đổi `status` hoặc `blocker`
ghi đúng một dòng, trong cùng transaction.

### 5.14 `ResidentAddition` — `ticket_resident_additions` (`CR-BPTN-02` (v0.5 candidate))

`addition_id` (`SIM-ADD-*`), `ticket_id`, `content` (non-empty), `submitted_by` (chủ ticket), `submitted_at`.
Append-only; không sửa `original_description`. Agent đọc nội dung gốc + bổ sung ở bước 2 và khi phân loại lại.

### 5.15 `Notification` (`CR-BPTN-02` (v0.5 candidate))

`notification_id` (`SIM-NTF-*`), `ticket_id`, `type` (`ticket.status_changed`, `department.dispatch`,
`department.reconcile_failed`, `reminder`, `escalation`), `audience` (`BlockerOwner`), `payload`, `created_at`.
`ticket.status_changed` phát khi đổi trạng thái (kể cả vào/ra `NEED_INFO`/`ON_HOLD`); không phát khi chỉ đổi
`auto_retry_count` hay `internal_note`.

---

## 6. Playbook-specific static contract

### 6.1 Checklist catalog

| Playbook | Template | Item ID | Label mô phỏng | Required READY | Update owner |
|---|---|---|---|---|---|
| `PB-CLN-01` | `PB-CLN-01-CHK-V1` | `CLN-CHK-01` | Location trong execution update khớp `location_normalized` | true | DEPARTMENT |
| `PB-CLN-01` | `PB-CLN-01-CHK-V1` | `CLN-CHK-02` | Execution update được ghi nhận theo `scope_summary` | true | DEPARTMENT |
| `PB-CLN-01` | `PB-CLN-01-CHK-V1` | `CLN-CHK-03` | Mọi scoped item trong fixture được đánh dấu `COMPLETED` | true | DEPARTMENT |
| `PB-TEC-01` | `PB-TEC-01-CHK-V1` | `TEC-CHK-01` | Execution update định danh đúng location/lighting asset | true | DEPARTMENT |
| `PB-TEC-01` | `PB-TEC-01-CHK-V1` | `TEC-CHK-02` | Có bản ghi hoàn tất safety checklist mô phỏng | true | DEPARTMENT |
| `PB-TEC-01` | `PB-TEC-01-CHK-V1` | `TEC-CHK-03` | Result update đã được ghi | true | DEPARTMENT |

Các label trên là documentation gates mô phỏng, không phải SOP xử lý hiện trường hoặc xác nhận chất lượng.

### 6.2 Evidence requirement catalog

| Requirement ID | Playbook | Allowed evidence type | Minimum condition | Missing/wrong type | Image |
|---|---|---|---|---|---|
| `CLN-EVD-PROCESSING-NOTE` | `PB-CLN-01` | `PROCESSING_NOTE` | Non-empty; đúng ticket/draft; actor/time/readability valid | `IN_PROGRESS` | Optional, không satisfy requirement |
| `TEC-EVD-RESULT-NOTE` | `PB-TEC-01` | `RESULT_NOTE` | Non-empty; đúng ticket/draft; actor/time/readability valid | `IN_PROGRESS` | Optional, không satisfy requirement |

### 6.3 Exception signal contract

**Đã bỏ (`CR-BPTN-02` (v0.5 candidate)).** Các rule `PB-CLN-R-EX-01`, `PB-CLN-R-RISK-01`, `PB-CLN-R-SAFE-01`, `PB-TEC-R-EX-01`,
`PB-TEC-R-RISK-01` và signal catalog không còn hiệu lực. Phản ánh có tia lửa, mùi khét, dây hở, chất lạ hoặc mùi hắc
đi như ticket thường. Việc chấp nhận bỏ nhận diện rủi ro là câu hỏi mở ở CR-BPTN-02 §10.

---

## 7. Validator catalog

### 7.1 Schema, synthetic và immutability

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-SCHEMA-001` | Mọi entity | Field required/type/enum/link valid | Reject write; error có field path; no partial write |
| `VAL-SYN-001` | Mọi entity/output | `synthetic=true`, ID `SIM-`; norm label đúng | Reject output; không trình bày như dữ liệu thật |
| `VAL-TKT-REQ-001` | Ticket + additions | `ticket_id`, `created_at`, nội dung, vị trí sơ bộ (tính cả phần bổ sung) | `NEED_INFO`/`MISSING_INFO`, liệt kê field thiếu; no classification/draft |
| `VAL-IMM-001` | Raw edit attempt | Hash/value unchanged | `ACTION_DENIED` + audit; state unchanged |
| `VAL-INJECT-001` | Original/evidence content | Content chỉ được parse như untrusted data | Ignore embedded instruction; fail closed nếu parse uncertainty |

### 7.2 Classification và pre-draft

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-DUP-001` (`CR-BPTN-02` (v0.5 candidate)) | Ticket + ticket đang mở | Không có ticket chưa kết thúc, tạo trước, cùng category + vị trí, trong `duplicate_window_hours` | `VERIFYING`/`DUPLICATE`; BPTN gộp (`MERGED`) hoặc bác (chạy lại từ bước 5) |
| `VAL-CLASS-001` | Ticket + proposal | Service/type/playbook exact mapping; rules/reason/source non-empty | Khớp cả hai/luật-LLM lệch → `CATEGORY_UNCLEAR`; không khớp → `OUT_OF_SCOPE`; không invent playbook |
| `VAL-REVIEW-001` (`CR-BPTN-02` (v0.5 candidate)) | Proposal | Playbook không chỉ do LLM đề xuất, hoặc BPTN đã `CONFIRMED` | `VERIFYING`/`PENDING_REVIEW` |
| `VAL-LOCK-001` (`CR-BPTN-02` (v0.5 candidate)) | `locked_fields` | Agent không ghi đè; khi có `category` thì bước 4 không phân loại lại | Reject mutation |
| `VAL-SCOPE-001` | scope_summary | Mọi assertion có source/proposal reference | Reject draft; giữ state trước, error/audit |

### 7.3 Checklist

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-CHK-001` | Template + items | Đủ exact required item IDs cho playbook version | Draft invalid; không READY |
| `VAL-CHK-002` | Checklist updates | Chỉ DEPARTMENT của ticket, khi `IN_PROGRESS`, đổi status; enum valid | `ACTION_DENIED`/schema reject + audit; state unchanged |
| `VAL-CHK-READY-001` | Required items | Tất cả `COMPLETED` | Bước 10 không đạt: giữ `IN_PROGRESS`, item IDs trong `failing_items` |

### 7.4 Material

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-MAT-MODE-001` | Draft/material | Gate N/A → zero line; tracked line chỉ CLN/TEC | Reject inconsistent payload |
| `VAL-MAT-STOCK-001` | planned/norm/stock fixture | Không `INSUFFICIENT` | `CR-BPTN-02` (v0.5 candidate): INSUFFICIENT → `ON_HOLD`/`WAITING_MATERIAL`, chạy lại từ bước 6 (tra tài sản) khi nhập kho; UNKNOWN không chặn, gắn cờ `STOCK_CHECK_ON_ACCEPT` |
| `VAL-MAT-QTY-001` | MaterialLine | planned/issued/used ≥0 và đã nhập | Gate `NEEDS_CLARIFICATION`, ticket giữ `IN_PROGRESS`; không READY |
| `VAL-MAT-CMP-001` | MaterialLine | Exact ba comparison records; no fourth comparison | Reject derived result; no READY |
| `VAL-MAT-VAR-001` | Applicable comparisons | Mọi VARIANCE có non-empty `variance_reason` | Thiếu reason → bước 10 không đạt, giữ `IN_PROGRESS` |
| `VAL-MAT-WARN-001` | Reconciled variance | Có reason, exact comparisons complete, no other blocker | Tạo `EXPLAINED_MATERIAL_VARIANCE`; warning không chặn READY |
| `VAL-MAT-PERM-001` | Agent material action | Chỉ detect/describe | Approve/adjust/inventory/violation action → `ACTION_DENIED` + audit |

### 7.5 Evidence và readability

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-EVD-LINK-001` | EvidenceRecord | Ticket/draft/requirement cùng case/playbook | Reject record sai link; requirement không được satisfy; `IN_PROGRESS` nếu requirement known |
| `VAL-EVD-TYPE-001` | Requirement + record | Type thuộc allowlist requirement | `INVALID_TYPE`; `IN_PROGRESS` |
| `VAL-EVD-CONTENT-001` | content/metadata | Non-empty, schema-valid | `MISSING`; `IN_PROGRESS` |
| `VAL-EVD-READ-001` | readability | READABLE; hoặc NOT_APPLICABLE cho structured text/metadata schema-valid | UNREADABLE hoặc nguồn không xác minh được → not PRESENT, bước 10 không đạt |
| `VAL-EVD-READY-001` | All requirements | Ghi nhận requirement có record PRESENT hay không (ghi chú xử lý) | Thiếu → chỉ `processing_note_present=false`, không chặn bước 10 |
| `VAL-EVD-IMG-001` | Image absence | Phòng ban: ít nhất một ảnh cho draft hiện tại; cư dân: không bắt buộc | Thiếu ảnh phòng ban → bước 10 không đạt, giữ `IN_PROGRESS` |

### 7.6 Asset, duty, route và exception

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-ASSET-001` | TEC proposal + Asset Catalog | Exact one LIGHTING/location match, hoặc `locked_fields.asset_id` → `FOUND` | Zero/multiple → `VERIFYING`/`ASSET_UNCLEAR`; chỉ BPTN chọn asset hoặc chọn xác định tại hiện trường kèm lý do (`ONSITE_BY_BPTN`); CLN → `NOT_APPLICABLE` |
| `VAL-ROUTE-001` (`CR-BPTN-02` (v0.5 candidate)) | Ticket trước bước 8 | `can_route`: `review_status ∈ {NOT_REQUIRED, CONFIRMED}` **và** `asset_resolution ∈ {FOUND, ONSITE_BY_BPTN, NOT_APPLICABLE}` **và** `proposed_department_id != null`; `department_id` giao = `proposed_department_id` | `transition()` từ chối (`INVALID_TRANSITION`); không ticket nào vào `ROUTED` |
| `VAL-HOURS-001` (`CR-BPTN-02` (v0.5 candidate)) | Phòng ban + thời điểm | Trong ca phòng ban | Vẫn `ROUTED` + blocker `OUT_OF_HOURS`, tự chuyển đầu ca kế tiếp |
| `VAL-ASSIGNEE-001` | Draft / ticket | Agent không ghi `assignee_id`; draft `assignee_id=null` | `ACTION_DENIED` + audit; state unchanged |
| `VAL-DEPT-SCOPE-001` (`CR-BPTN-02` (v0.5 candidate)) | Actor phòng ban | Chỉ thao tác ticket có `department_id` = phòng ban của actor | `ACTION_DENIED` + audit |

### 7.7 Readiness và state

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-READY-001` | ReadinessEvaluation | Sáu điều kiện bước 10 đều true | Giữ `IN_PROGRESS`, trả `failing_items`, không blocker |
| `VAL-STATE-TRANS-001` | Current/target status + actor | Cặp (from, to) thuộc §8.3, actor đúng vai trò, điều kiện đi kèm thỏa | Vai trò không bao giờ được vào `to` → `ACTION_DENIED` + audit; sai trạng thái nguồn → `INVALID_TRANSITION`; status unchanged |
| `VAL-EVENT-001` (`CR-BPTN-02` (v0.5 candidate)) | Status/blocker change | Đúng một `StatusEvent` cho mỗi thay đổi | Fail closed |
| `VAL-WARN-001` | Warning | Only explained material variance; rule/reason/source visible | Unknown warning reject; warning không che blocker |

### 7.8 Permission và audit

Permission validator phải chạy trước mutation. Action catalog tối thiểu (`CR-BPTN-02` (v0.5 candidate)):

| Action | RESIDENT | BPTN | Agent | DEPARTMENT | WAREHOUSE | BQL | Failure |
|---|---:|---:|---:|---:|---:|---:|---|
| Gửi phản ánh, bổ sung thông tin, đánh giá, báo chưa xong | Allow (ticket của mình) | Deny | Deny | Deny | Deny | Deny | `ACTION_DENIED` |
| Gỡ blocker `VERIFYING` (gộp, chọn loại việc/phòng ban/asset/vị trí, xác định tại hiện trường) | Deny | Allow; đổi giá trị cần lý do | Deny | Deny | Deny | Deny | `ACTION_DENIED` |
| Edit raw content/original evidence | Deny | Deny | Deny | Deny | Deny | Deny | `ACTION_DENIED`, raw unchanged |
| Edit catalog/asset/config | Deny | Deny | Deny; read-only lookup | Deny | Deny | Deny | `ACTION_DENIED` |
| Phân loại, đề xuất phòng ban, tạo draft, đối soát | Deny | Deny | Allow theo pipeline | Deny | Deny | Deny | `ACTION_DENIED` |
| Nhận việc, trả sai phòng ban, tạm hoãn/tiếp tục, cập nhật thực hiện, báo hoàn thành, set `assignee_id` | Deny | Deny | Deny | Allow (ticket đã giao cho phòng ban mình) | Deny | Deny | `ACTION_DENIED` |
| Nhập vật tư (`stock_received`) | Deny | Deny | Deny | Deny | Allow | Deny | `ACTION_DENIED` |
| Đóng, trả làm lại, hủy | Deny | Deny | Deny | Deny | Deny | Allow | `ACTION_DENIED` + audit (bất biến 1) |
| Approve/adjust material/inventory, gửi tin cho cư dân | Deny | Deny | Deny | Deny | Deny | Deny trong MVP | `ACTION_DENIED` |

Denial tạo AuditEvent với `action_result=ACTION_DENIED`, không có data/state side effect.

Audit action catalog: `INGEST`, `RUN_PIPELINE`, `CREATE_PROPOSAL`, `LOOKUP_ASSET`, `CHECK_MATERIAL_STOCK`,
`CREATE_DRAFT`, `RECONCILE`, `ADD_RESIDENT_INFO`, `RATE_TICKET`, `BPTN_RESOLVE`, `RECEIVE_STOCK`, `SET_ASSIGNEE`,
`UPDATE_CHECKLIST`, `UPDATE_MATERIAL`, `ADD_EVIDENCE`, `REPORT_COMPLETE`, `TRANSITION`, `RUN_JOBS`, `ACTION_DENIED`.

---

## 8. State machine contract

`CR-BPTN-02` (v0.5 candidate). Mọi thay đổi trạng thái đi qua một hàm `transition`: kiểm tra bảng §8.3, ghi đúng một `StatusEvent`, phát
`ticket.status_changed`. Chuyển không hợp lệ trả lỗi, không bỏ qua âm thầm.

### 8.1 Pipeline Agent

| Bước | Tên | Hành vi | Khi không đạt |
|---|---|---|---|
| 2 | Kiểm tra dữ liệu | `ticket_id`, `created_at`, nội dung, vị trí sơ bộ (tính cả phần bổ sung) | `NEED_INFO`/`MISSING_INFO` |
| 3 | Kiểm tra trùng | `VAL-DUP-001` | `VERIFYING`/`DUPLICATE` |
| 4 | Phân loại + **đề xuất** phòng ban | Set `proposed_department_id`; bỏ phân loại nếu `locked_fields.category` | `VERIFYING`/`CATEGORY_UNCLEAR` hoặc `OUT_OF_SCOPE` |
| 5 | BPTN review nếu cần | Loại việc và vị trí rõ → `NOT_REQUIRED` | `VERIFYING`/`PENDING_REVIEW` |
| 6 | Tra tài sản | Đèn: `FOUND`; vệ sinh: `NOT_APPLICABLE` | `VERIFYING`/`ASSET_UNCLEAR`; Agent không tự bỏ qua |
| 7 | Vật tư | So định mức và tồn kho | Thiếu: `ON_HOLD`/`WAITING_MATERIAL`; không rõ: cờ, đi tiếp |
| 8 | **Giao** phòng ban | Kiểm tra `can_route`, `department_id = proposed_department_id`, tạo draft, `ROUTED` | Ngoài ca: `ROUTED` + `OUT_OF_HOURS` |
| 9 | Thực hiện | Phòng ban làm, ngoài pipeline Agent | — |
| 10 | Đối soát | Khi phòng ban báo hoàn thành; sáu điều kiện §5.3 | Giữ `IN_PROGRESS`, trả `failing_items`, không blocker |

### 8.2 Status definition

| Status | Nhãn cư dân | Loại | Ý nghĩa |
|---|---|---|---|
| `RECEIVED` | Đã tiếp nhận | chính | Đã lưu phản ánh; pipeline đang chạy |
| `VERIFYING` | Đang xác minh | chính | Chờ BPTN (trùng, loại việc, review, tài sản, sai phòng ban) |
| `ROUTED` | Đã chuyển phòng ban | chính | Đã giao phòng ban (`department_id` set), chờ nhận việc |
| `IN_PROGRESS` | Đang xử lý | chính | Phòng ban đã nhận việc |
| `READY_FOR_REVIEW` | Chờ nghiệm thu | chính | Đối soát đạt; chờ BQL |
| `CLOSED` | Hoàn thành | chính, kết thúc (trừ khi mở lại) | BQL đã đóng |
| `NEED_INFO` | Chờ bổ sung thông tin | phụ | BPTN liên hệ cư dân; cư dân cũng tự bổ sung được |
| `ON_HOLD` | Tạm hoãn | phụ | Chờ vật tư hoặc vướng tại hiện trường |
| `MERGED` | Đã gộp | kết thúc | Trùng với ticket khác |
| `CANCELLED` | Đã hủy | kết thúc | BQL hủy, có lý do |

### 8.3 Transition allowlist

| Từ | Sang | Actor | Điều kiện |
|---|---|---|---|
| (tạo) | `RECEIVED` | SYSTEM | Ingest |
| `RECEIVED` | `NEED_INFO` | SYSTEM | `MISSING_INFO` |
| `NEED_INFO` | `RECEIVED` | SYSTEM | Cư dân bổ sung hoặc BPTN nhập phần thiếu; chạy lại từ bước 2 |
| `RECEIVED` | `VERIFYING` | AGENT | `DUPLICATE`, `CATEGORY_UNCLEAR`, `OUT_OF_SCOPE`, `PENDING_REVIEW`, `ASSET_UNCLEAR` |
| `VERIFYING` | `MERGED` | BPTN | Xác nhận trùng; set `merged_into` |
| `VERIFYING` | `RECEIVED` | SYSTEM | BPTN đã gỡ; chạy lại từ `resume_step` |
| `RECEIVED` | `ON_HOLD` | AGENT | `WAITING_MATERIAL` |
| `ON_HOLD` | `RECEIVED` | SYSTEM | Chỉ `WAITING_MATERIAL`, khi đủ tồn kho; chạy lại từ bước 6 |
| `RECEIVED` | `ROUTED` | SYSTEM | **`can_route` đúng**; `department_id = proposed_department_id`; có thể kèm `OUT_OF_HOURS` |
| `ROUTED` | `IN_PROGRESS` | DEPARTMENT | Nhận việc; set `accepted_at`; gỡ `OUT_OF_HOURS`/`NOT_ACCEPTED` |
| `ROUTED` | `VERIFYING` | DEPARTMENT | `WRONG_DEPT`, bắt buộc lý do; `department_id` về `null` |
| `IN_PROGRESS` | `ON_HOLD` | DEPARTMENT | `BLOCKED_ONSITE`, bắt buộc lý do + `eta` |
| `ON_HOLD` | `IN_PROGRESS` | DEPARTMENT | Chỉ khi blocker là `BLOCKED_ONSITE` |
| `IN_PROGRESS` | `READY_FOR_REVIEW` | AGENT | Đối soát bước 10 đạt |
| `READY_FOR_REVIEW` | `CLOSED` | **BQL** | Set `closed_by`, `closed_at`, `reopen_until` |
| `READY_FOR_REVIEW` | `IN_PROGRESS` | **BQL** | `REWORK`, bắt buộc lý do; `rework_count++`; checklist về `PENDING` |
| `CLOSED` | `READY_FOR_REVIEW` | RESIDENT | `now < reopen_until` |
| mọi trạng thái chưa kết thúc | `CANCELLED` | **BQL** | Bắt buộc `cancel_reason` |

Các dòng do pipeline/hệ thống chạy không gọi được từ ngoài. Vai trò không bao giờ được vào trạng thái đích →
`ACTION_DENIED` + audit; đúng vai trò nhưng sai trạng thái nguồn → `INVALID_TRANSITION`.

Bất biến (có test):
1. Chỉ `actor_role=BQL` chuyển sang `CLOSED` hoặc `CANCELLED`.
2. Agent không bao giờ ghi `assignee_id`.
3. Agent không bao giờ ghi đè `locked_fields`.
4. Nội dung phản ánh gốc không đổi sau khi tạo.
5. Mọi transition có đúng một `StatusEvent`.
6. Không ticket nào vào `ROUTED` mà `can_route` sai, kể cả khi chạy lại sau `WRONG_DEPT` hay `OUT_OF_SCOPE`.

### 8.4 Blocker: người gỡ và điểm chạy lại

| Mã | Người gỡ | Sự kiện gỡ | Chạy lại từ |
|---|---|---|---|
| `MISSING_INFO` | BPTN (cư dân vẫn tự bổ sung được) | `bptn_resolved` (nhập `location`/`info`, kèm lý do) hoặc `resident_info_added` | Bước 2 |
| `DUPLICATE` | BPTN | `bptn_resolved` (bác trùng) | Bước 5 |
| `CATEGORY_UNCLEAR`, `OUT_OF_SCOPE` | BPTN | `bptn_resolved` (chọn loại việc → `review_status=CONFIRMED`) | Bước 4 |
| `PENDING_REVIEW` | BPTN | `bptn_resolved` (sửa hoặc xác nhận → `CONFIRMED`) | Bước 6 |
| `ASSET_UNCLEAR` | BPTN | `bptn_resolved` (chọn asset → `FOUND`, hoặc xác định tại hiện trường kèm lý do → `ONSITE_BY_BPTN`) | Bước 6 |
| `WRONG_DEPT` | BPTN | `bptn_resolved` (chọn lại loại việc và/hoặc phòng ban) | Bước 6 nếu đổi loại việc (reset `asset_resolution`), bước 7 nếu không. Không bao giờ bước 8 |
| `WAITING_MATERIAL` | WAREHOUSE | `stock_received` | Bước 6 |
| `OUT_OF_HOURS` | SYSTEM | Đầu ca phòng ban | — (gỡ blocker, thông báo phòng ban) |
| `NOT_ACCEPTED` | DEPARTMENT | `department_accepted` | — |
| `BLOCKED_ONSITE` | DEPARTMENT | `department_resumed` | — |
| `REWORK` | DEPARTMENT | Đối soát đạt | — |

`resume(ticket)` idempotent: gọi hai lần không tạo hai event.

### 8.5 Retry và leo thang (mặc định tạm, trong `sla_config`)

| Mã | Retry tự động | Leo thang |
|---|---|---|
| `MISSING_INFO`, `CATEGORY_UNCLEAR`, `OUT_OF_SCOPE`, `PENDING_REVIEW`, `ASSET_UNCLEAR`, `WRONG_DEPT`, `DUPLICATE` | Nhắc BPTN mỗi 1h giờ hành chính | 4h giờ hành chính |
| `WAITING_MATERIAL` | Kiểm lại tồn kho đầu mỗi ca | 24h |
| `OUT_OF_HOURS` | Tự chuyển đầu ca | không |
| `NOT_ACCEPTED` | Bắt đầu sau 2h chưa ai nhận; nhắc trưởng phòng mỗi 2h | Sau 3 lần nhắc |
| `BLOCKED_ONSITE` | không | Quá `eta` |
| `REWORK` | không | `rework_count >= 3` |

Job chạy mỗi 5 phút. `auto_retry_count` tối đa 3; vượt thì `escalated=true` và thông báo BQL. Leo thang không đổi
`status`, không tự hủy, không tự đóng.

---

## 9. Output contracts

### 9.1 Classification result

Bắt buộc trả: proposal ID/revision, proposed service/type/playbook/version, `category_source`, asset ID/status/reason, matched rule IDs, reason, source references, `proposed_department_id`, `review_status`, `asset_resolution`, blocker (nếu dừng), synthetic label.

### 9.2 Work order draft result

Bắt buộc trả: draft ID, ticket/proposal/playbook/version/source linkage, scope summary, location, asset ID, `department_id`, `flags`, `assignee_id=null`, material stock status, checklist/material/evidence requirements, source và synthetic label. Không có operational order ID/action.

### 9.3 Readiness result

Bắt buộc trả: sáu điều kiện bước 10, `failing_items`, visible non-blocking warnings, evaluation timestamp. Resident API (`GET /resident/tickets/{id}`) chỉ trả status + nhãn, tên phòng ban **sau bước 8**, `blocker.public_message`, `blocker.eta`, timeline (`to_status`, `public_message`, `created_at`) và hành động được phép; không trả `reason_code`, `internal_note`, `assignee_id`, `proposed_department_id`, vật tư, số lần retry, cờ leo thang.

### 9.4 Permission rejection

Bắt buộc trả: `decision=DENY`, `code=ACTION_DENIED`, requested action, actor ID/role, target entity/field, reason, unchanged status, audit event ID.

---

## 10. Implementation Gaps và dispositions

| Gap ID | Gap từ Phase 1/2 | Agent A disposition | Áp dụng trong contract | Status |
|---|---|---|---|---|
| `GAP-B-01` | Cách biểu diễn material gate/`norm_qty` N/A | `APPROVE` + correction | Gate N/A → zero line; line có numeric planned/issued/used; norm numeric + SYNTHETIC hoặc null + N_A; comparison 1 N/A khi no norm | CLOSED |
| `GAP-B-02` | Cleaning composite và xử lý một/unclear signal | `SIMULATED ASSUMPTION` | Both PRESENT → EXCEPTION; một PRESENT + một ABSENT không exception; bất kỳ UNCLEAR → CHỜ, no standard draft | SUPERSEDED bởi `CR-BPTN-02` (v0.5 candidate) (bỏ luật an toàn) |
| `GAP-B-05` | Readability nào pass | `APPROVE` | READABLE hoặc NOT_APPLICABLE cho structured schema-valid; UNREADABLE không pass; unknown → CHỜ | CLOSED |
| `GAP-C-01` | Draft behavior khi route gate fail | `APPROVE` | Draft retained; route NOT_ROUTED; state/reason theo asset/stock/duty; không READY | CLOSED |
| `GAP-C-02` | Duty capacity oracle | `APPROVE` | Available iff on duty và current open count < max; capacity exceeded giữ IN_PROGRESS | SUPERSEDED bởi `CR-BPTN-02` (v0.5 candidate) (bỏ duty/capacity) |
| `GAP-C-03` | Individual assignment | `APPROVE` | Team-only constants; `assignee_id=null`; non-null rejected/audited | CLOSED |
| `GAP-C-04` | Technical asset unresolved | `APPROVE` | Draft có field asset_id null; state CHỜ; no route; không đoán | CLOSED |

Không còn Implementation Gap chưa có disposition sau Field Matrix và reverse review Playbook v1.1.

---

## 11. Contract-level acceptance checks

(`CR-BPTN-02` (v0.5 candidate))

1. Mọi required field trong playbook phải map tới field path và validator trong contract.
2. Mọi field trong contract phải có source/owner, validation và mục đích nghiệp vụ.
3. Mọi thay đổi status đi qua `transition` theo §8.3 và có đúng một `StatusEvent`.
4. Không ticket nào vào `ROUTED` khi `can_route` sai; `department_id` chỉ set ở bước 8.
5. `READY_FOR_REVIEW` chỉ khi sáu điều kiện bước 10 đều đạt.
6. Chỉ BQL đóng/hủy; raw content/evidence mutation, Agent checklist completion, material approval, outbound action đều
   `ACTION_DENIED` + audit.
7. Ảnh sau xử lý của phòng ban bắt buộc (điều kiện `photo_present`); ảnh cư dân không bắt buộc.
8. Tra tài sản chỉ bắt buộc cho kỹ thuật; khi không xác định được, chỉ BPTN quyết định.
9. Agent không chọn người (`assignee_id`); phòng ban tự phân công.
10. Mọi `public_message` sinh từ template; resident API không lộ dữ liệu nội bộ.
11. Tất cả entity/output đều có nhãn `synthetic=true` và ID mô phỏng.

## 12. Cross-review result

- Mỗi required field trong Playbook v1.1 có field path và validator tương ứng: **PASS**.
- Mỗi field/entity trong contract có mục đích nghiệp vụ hoặc mục đích integrity/audit rõ: **PASS**.
- Canonical rule IDs, evidence IDs, checklist IDs, enum và owner khớp Playbook v1.1: **PASS**.
- Mỗi routing rule cho đúng một state; permission denial giữ state và không tạo business exception: **PASS**.
- Eight-gate READY machine-checkable; route hợp lệ là bắt buộc: **PASS**.
- Raw immutability, permission, audit, asset/duty/stock/route, material three-comparison và evidence/readability validators: **PASS**.
- Không field/rule Playbook nào chưa map; không contract field nào được xác định là không có consumer: **PASS**.
- Agent A final re-read: **PASS; không còn blocking business/schema gap**.

## 13. Open Issues

Các câu hỏi mở của `CR-BPTN-02` (mốc SLA, cửa sổ trùng, hiển thị tên phòng ban, migrate `EXCEPTION`, chấp nhận bỏ nhận diện rủi ro, người duyệt CR) nằm ở [CR-BPTN-02 §10](CR-BPTN-02.md). Ngoài ra `No blocking open issues`.

