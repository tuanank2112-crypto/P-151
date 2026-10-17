# MaintenanceOps Agent — Data Contract v1

> **Document status:** IMPLEMENTED (phần Active, v1.17.9) · phần Historical giữ để truy vết
> **Version:** 1.2-implemented (phần Active) · 1.2-candidate (lịch sử)
> **Ngày cập nhật:** 2026-10-17 (phần Active)
> **MVP baseline:** v0.3/Data Contract v1.1 đã freeze; v0.6/Data Contract v1.2 candidate theo `CR-BPTN-03`
> **Freeze history:** v1.1 — 28/09/2026; v1.2 chưa freeze
> **Owner duy nhất:** Agent B — AI/Data Owner  
> **Business reviewer:** Agent A — Product/BA Owner  
> **Data classification:** `SIMULATED` — toàn bộ instance, workflow, rule, checklist, vật tư, bằng chứng, định mức và kết quả trong contract này là dữ liệu mô phỏng; không phải dữ liệu hoặc quy trình vận hành thật của Vinhomes.

## Hiện trạng thực tế (audit 2026-10-17, đối chiếu code v1.17.9)

> Các câu "CR-03 `PROPOSED` / chưa có người duyệt / NOT READY" trong phần còn lại của file là **lịch sử tại 2026-10-01**. Hiện trạng:
> - **Duyệt:** CR-BPTN-03 được duyệt cho phạm vi MVP 04/10 và D-01–D-07 (D-08: leader Lê Thị Châm Anh, ngày duyệt báo 2026-10-02, ghi nhận 2026-10-03). Chưa phải sign-off toàn bộ gate Day05/Day06.
> - **Code:** engine CR-03 đã cài (xem [`maintenance.md`](maintenance.md)); phiên bản dự án 1.17.9. Dữ liệu chạy trên PostgreSQL/Supabase; production ở Vercel (xem [README](../README.md)).
> - **UI:** UI hiện hành là [`portal/`](portal.md) (Next.js, gọi backend `/api/v1`) và PWA [`src/mobile/`](mobile.md). UI tĩnh `src/web/` đã xoá (2026-10-12); [`web.md`](web.md) chỉ còn là lịch sử.
> - **Vai trò thật trên UI:** cư dân, Tiếp nhận (BPTN), Vệ sinh, Kỹ thuật, Quản lý (BQL), Kho. **Kho có màn hình** (tồn kho, duyệt cấp vật tư), khác câu "Kho không có màn hình" ở bản 0.6.
> - **Agent:** LangGraph + LLM (`gpt-6-luna` trên production); ngữ nghĩa do LLM suy luận, tầng an toàn chỉ là lưới sàn hẹp (luật + từ vựng).
> - **Khi lệch:** theo thứ tự code → `CR-BPTN-03.md` → file này.

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1-draft | 2026-09-27 | Phase 1: entity map sơ bộ theo PRD v0.2 và decisions đã khóa | DRAFT |
| 0.9 | 2026-09-27 | Phase 2: áp dụng Field Matrix v1; hoàn thiện field-level schema, validators, state machine, permission/immutability/audit và dispositions cho Implementation Gaps | CROSS-REVIEW DRAFT |
| 1.0 | 2026-09-27 | Phase 3: reverse-review Playbook; align canonical field/rule/evidence IDs, checklist timing và material mode | FINAL |
| 1.1 | 2026-09-27 | Re-baseline hai playbook; thêm Asset, DutyAvailability, stock gate, team-only routing và route readiness | FINAL |
| 1.1-freeze | 2026-09-28 | Đóng OD-09 và đưa Data Contract v1.1 vào frozen baseline MaintenanceOps MVP v0.3 | FROZEN |
| 1.2-candidate | 2026-10-01 | Thay team/duty contract bằng department flow; thêm safety, priority, blocker, merge, resident addition, close/cancel/rating | DRAFT · CHỜ PHÊ DUYỆT CR-03 |
| 1.2-p14 | 2026-10-10 | `Asset` theo KHU VỰC (plan 14): thêm `name`, `area`; `location_normalized` chỉ còn ở asset `RETIRED_SIMULATED`; lookup so khu vực của vị trí; mỗi khu vực ≤1 asset active. Xem §5.4, VAL-ASSET-001 | ÁP DỤNG (người dùng chốt 2026-10-10) |
| 1.2-implemented | 2026-10-17 | Viết lại Active theo `models.py`/`enums.py` (17 ReasonCode, split, StockAlert, RatingDetail, 6 điều kiện readiness) | HIỆN HÀNH |

---

# Active Data Contract v1.2 — hiện hành (khớp `src/maintenance/models.py`, `SCHEMA_VERSION="1.2"`, audit 2026-10-17)

> Nguồn chân lý là code: [`src/maintenance/enums.py`](../src/maintenance/enums.py), [`models.py`](../src/maintenance/models.py), [`store/base.py`](../src/maintenance/store/base.py). Mọi model là Pydantic `extra="forbid"`; sai schema là `ValidationError` lúc nạp. Khi tài liệu này lệch code thì code thắng và ghi drift tại đây.

## A. Canonical enums (`enums.py`)

```text
TicketStatus = RECEIVED | VERIFYING | NEED_INFO | ON_HOLD | ROUTED | IN_PROGRESS | READY_FOR_REVIEW | MERGED | CLOSED | CANCELLED
  (terminal: CLOSED, MERGED, CANCELLED; side: NEED_INFO, ON_HOLD)
RiskLevel = NONE | UNCLEAR | EMERGENCY          SignalStatus = PRESENT | ABSENT | UNCLEAR     DetectedBy = RULE | LLM
Priority = HIGH | MEDIUM | LOW                  PrioritySource = AGENT_RULE | AGENT_LLM | HUMAN_OVERRIDE
ClosureKind = NORMAL | EMERGENCY_HANDLED
Department = DEPT_CLEANING | DEPT_TECHNICAL
BlockerOwner = RESIDENT | BPTN | DEPARTMENT | WAREHOUSE | SYSTEM | BQL
ServiceCategory = VE_SINH | KY_THUAT | UNKNOWN  TicketType = COMMON_AREA_CLEANING | COMMON_AREA_LIGHTING | UNKNOWN
PlaybookId = PB-CLN-01 | PB-TEC-01              ReviewStatus = NOT_REQUIRED | PENDING_REVIEW | CONFIRMED
AssetResolution = FOUND | ONSITE_BY_BPTN | NOT_APPLICABLE
AssetLookupStatus = MATCHED | NOT_FOUND | AMBIGUOUS | LOCKED_BY_BPTN | CHECK_ONSITE | NOT_APPLICABLE
MaterialStockStatus = SUFFICIENT | INSUFFICIENT | UNKNOWN | NOT_APPLICABLE
TicketFlag = ASSET_CHECK_ONSITE | STOCK_CHECK_ON_ACCEPT | AGENT_FALLBACK | AGENT_DISAGREEMENT
ActorRole = SYSTEM | AGENT | RESIDENT | BPTN | DEPARTMENT | WAREHOUSE | BQL | QA_INTERNAL
```

`ReasonCode` (17): `MISSING_INFO`, `DUPLICATE`, `CATEGORY_UNCLEAR`, `OUT_OF_SCOPE`, `PENDING_REVIEW`, `ASSET_UNCLEAR`, `WAITING_MATERIAL`, `OUT_OF_HOURS`, `NOT_ACCEPTED`, `WRONG_DEPT`, `BLOCKED_ONSITE`, `REWORK`, `SAFETY_REVIEW_REQUIRED`, `EMERGENCY_PENDING_BQL`, `WRONG_DEPT_AFTER_START`, `WAITING_EMERGENCY` (ON_HOLD, chủ SYSTEM, plan 06).
Nhóm blocker: `BPTN_REASONS` (BPTN gỡ), `SAFETY_REASONS` (không `resume()`/job nào gỡ), `BQL_REASONS` (BPTN bị `ACTION_DENIED`).

Phiên bản: `SCHEMA_VERSION="1.2"`, `PLAYBOOK_VERSION="1.1"`.

## B. Ticket (`models.Ticket`)

| Field | Rule |
|---|---|
| `ticket_id`, `raw: RawTicket`, `raw_integrity_marker`, `resident_id`, `source_revision`, `dataset_version` | Required. `RawTicket` = `ticket_id`, `created_at`, `original_description` (≤ `MAX_DESCRIPTION_CHARS`, quá dài là 422, không cắt), `original_evidence_refs`, `channel`. Bất biến |
| `status` | `TicketStatus` |
| `blocker: Blocker \| None` | `code`, `owner_role`, `since`, `resume_step` (2–8), `auto_retry_count`, `next_retry_at`, `escalate_at`, `escalated`, `eta`, `public_message`, `internal_note`, `related_ticket_id`, `resolved_at/by`. Mã được phép theo `BLOCKER_CODES_BY_STATUS`; trạng thái cần blocker theo `STATUSES_REQUIRING_BLOCKER` |
| `proposed_department_id`, `department_id` | `Department`; `department_id` chỉ đặt ở bước 8; bắt buộc từ `ROUTED` trở đi, trừ `CLOSED + EMERGENCY_HANDLED` |
| `assignee_id` | Kiểu `None`: giá trị khác null là `ValidationError` |
| `locked_fields: LockedFields` | BPTN khoá `category`, `location`, `asset_id`, `department` |
| `review_status`, `asset_resolution` | Bước 5, bước 6 |
| `flags[]` | `TicketFlag` |
| `risk_level`, `risk_signals[]`, `safety_cleared_by/at/reason`, `safety_context` | Ba field `safety_cleared_*` cùng đặt hoặc cùng null; `safety_context` chỉ true khi `NEED_INFO` |
| `priority`, `priority_source`, `priority_rule_id`, `priority_reason` | `priority` và `priority_source` cùng đặt/null; `HUMAN_OVERRIDE` bắt buộc `priority_reason` |
| `merged_into`, `merged_children[]`, `related_ticket_ids[]`, `duplicate_count` | `MERGED` iff `merged_into`; không tự liên kết; không lặp id |
| `split_from`, `split_children[]`, `split_category` | Tách phản ánh hai việc: `split_category` đặt iff ticket thuộc một lần tách; không đồng thời có `split_from` và `split_children`; `split_category` ∈ `VE_SINH\|KY_THUAT` |
| `follow_up_of`, `closure_kind`, `closed_by/at`, `cancel_reason` | `CLOSED` iff `closed_by`+`closed_at`+`closure_kind`; `CANCELLED` bắt buộc `cancel_reason` |
| `rework_count`, `wrong_department_return_count`, `dispatched_at`, `accepted_at` | Số nguyên ≥ 0 / mốc thời gian |
| `rating` | 1–5, ghi một lần (guard ở `engine.rate`) |
| `playbook_id`/`asset_id` (trên `Case`/draft) | Ticket vệ sinh phải có `asset_id=null` |

Chi tiết đánh giá nằm ở bảng riêng: `RatingDetail(ticket_id, tags[], comment, created_at)` (`maintops.rating_details`).

## C. ResidentAddition

`addition_id: SIM-ADD-*`, `ticket_id`, `content` (không rỗng, ≤ `MAX_DESCRIPTION_CHARS`), `submitted_by`, `submitted_at`, `merged_from?`, `copied_from?` (không cùng đặt). Append-only; ảnh bổ sung là `EvidenceRecord` nguồn `RESIDENT_ORIGINAL`. Sau append hệ thống chuyển theo T03 và quét safety lại.

## D. RiskSignal và Safety

`RiskSignal`: `signal_id` ∈ `S-nn | T2-0n`, `status`, `source_quote` (nguyên văn, giữ dấu; S-14 nối hai đoạn bằng ` | `), `detected_by`, `rule_id` (`S-xx|T2-xx|B-01|B-02|B-04|LLM`). Rule `PRESENT` không bị LLM hạ. Mỗi quyết định người (`SAFETY_CONFIRM_SAFE`, `SAFETY_ESCALATE`, `SAFETY_REQUEST_INFO`, `EMERGENCY_CLOSE`, `EMERGENCY_DOWNGRADE`) ghi `AuditEvent` có lý do.

## E. AgentClassificationProposal

`proposal_id: SIM-ACP-*`, `ticket_id`, `proposal_revision ≥ 1`, `service_category_proposed`, `ticket_type_proposed`, `playbook_id`, `playbook_version="1.1"`, `category_source ∈ AGENT|BPTN_LOCKED|AGENT_SPLIT|AGENT_LLM`, `asset_type?`, `reported_symptom?`, `location_proposed?`, `asset_id?`, `asset_lookup_status`, `asset_match_reason`, `matched_rule_ids[≥1]`, `classification_reason`, `source_references[≥1]`, `created_at`. `ClassificationRecord` thêm `rule_id`, `needs_review` (đề xuất chỉ từ LLM ⇒ bước 5 hỏi BPTN), `proposer`, `notes`. Không còn `routing_team_id`, `duty_lookup_status`, `duty_source_ref`, team capacity.

## F. WorkOrderDraft

`work_order_draft_id: SIM-WOD-*`, `ticket_id`, `proposal_id`, `playbook_id/version`, `source_revision`, `draft_revision ≥ 1`, `draft_status="DRAFT"`, `scope_summary`, `matched_rule_ids`, `source_references`, `location`, `asset_id?`, `department_id: Department`, `flags[]`, `assignee_id=null`, `material_stock_status`, `checklist_template_id`, `checklist_item_ids[≥1]`, `material_requirement_mode (TRACKED|N_A)`, `material_gate_status (RECONCILED|NEEDS_CLARIFICATION|N/A)`, `material_line_ids[]`, `evidence_requirements[≥1]`, `readiness_evaluation?`, `non_blocking_warnings[]`. Draft chỉ tạo cùng bước 8 khi `can_route=true`.

## G. Asset, vật tư, kho

- `Asset`: `asset_id: SIM-ASSET-*`, `asset_type=LIGHTING`, `name`, `area` (nhãn của `rules.AREA_PATTERNS`), `location_normalized?` (chỉ asset ngừng dùng), `asset_status ∈ ACTIVE_SIMULATED|RETIRED_SIMULATED`, `linked_playbook_id=PB-TEC-01`, `source_ref`, `synthetic`, `read_only=true`. Mỗi khu vực tối đa một asset ACTIVE (13 khu vực); `SIM-ASSET-LIGHT-001…006` RETIRED.
- `MaterialCatalogItem`: `item_code: SIM-*`, `item_name`, `unit`, `norm_qty` (số iff `norm_label=SYNTHETIC`), `simulated_stock_qty` (`null` = không rõ), `min_qty` (ngưỡng cảnh báo kho; `null` = không cảnh báo).
- `MaterialLine`: `material_line_id: SIM-MAT-*`, `planned_qty`, `issued_qty`, `used_qty`, `material_stock_status`, `comparison_results` (0 hoặc đúng 3 phép), `reconciliation_status`. Từ plan 15–16 số **thực dùng** do phòng ban ghi một lần (`material-usage`), không đối chiếu định mức/đề xuất; phép so duy nhất còn chặn là đã dùng ≠ đã xuất mà không có lý do.
- `StockAlert` (`SIM-SAL-*`, bảng `0005/0006`): `item_code`, `item_name`, `department_id`, `qty_added`, `qty_before`, `qty_after`, `received_by`, `ticket_ids[]` (ticket đang chờ mặt hàng này; engine chạy lại chúng), `acknowledged_by/at`.
- `MaterialRequestView` (`PVT-<ticket_id>`): view dẫn xuất từ ticket `ON_HOLD + WAITING_MATERIAL`, KHÔNG lưu; `source ∈ AGENT|DEPARTMENT`, `lines[]` (`needed_qty`, `stock_qty`, `shortage_qty`), `status=OPEN`.

## H. Báo cáo phòng ban, evidence, rating

- `ChecklistItem` (`SIM-CHK-*`): `status ∈ PENDING|COMPLETED`; template `PB-CLN-01-CHK-V1`, `PB-TEC-01-CHK-V1` (3 mục mỗi template).
- `EvidenceRecord` (`SIM-EVD-*`): `evidence_type ∈ PROCESSING_NOTE|RESULT_NOTE|SIMULATED_IMAGE|RESIDENT_ORIGINAL`, `source ∈ RESIDENT_ORIGINAL|DEPARTMENT_EXECUTION|SYSTEM_SIMULATED`, `merged_from`/`copied_from` chỉ dùng cho `RESIDENT_ORIGINAL`. Ảnh lưu theo `MO_PHOTO_STORE` (local|supabase), không phân tích nội dung.
- `ReadinessEvaluation` (bước 10) gồm 6 điều kiện bắt buộc: `department_accepted`, `checklist_complete`, `photo_present` (≥ 1 ảnh), `materials_entered`, `variance_explained`, `no_open_blocker`; `processing_note_present` chỉ ghi nhận (ghi chú tuỳ chọn).
- Rating: `Ticket.rating` 1–5 một lần + `RatingDetail`.

## I. Merge, split, status, audit, notification

- Mỗi transition tạo đúng một `StatusEvent` (`SIM-EVT-*`: `from_status`, `to_status`, `reason_code`, `actor_role/id`, `public_message`, `internal_note`, `public`, `created_at`). Action bị từ chối tạo `AuditEvent` (`ACTION_DENIED`), không tạo `StatusEvent`.
- `AuditEvent` (`SIM-AUD-*`): `entity_type/id`, `action: Action`, `actor_id/role`, `timestamp`, `field_name`, `old_value`, `new_value`, `reason` (không rỗng), `rule_id`, `playbook_version`, `schema_version="1.2"`, `run_id`.
- `Action` bổ sung cho P1: `AGENT_DECISION`, `BQL_MERGE`, `MERGE_UNDO`, `CREATE_FOLLOW_UP`, `REPORT_WRONG_DEPT`, `BQL_KEEP_DEPARTMENT`, `BQL_REASSIGN_TO_BPTN`, `SPLIT_TICKET`, `SPLIT_UNDO`, `LINK_TICKETS`.
- `ExecutionSnapshot` (`SIM-SNP-*`): bản sao sâu dữ liệu thực hiện khi BQL gửi ticket đã bắt đầu về BPTN.
- `Notification` (`SIM-NTF-*`): `type ∈ ticket.status_changed|department.dispatch|department.reconcile_failed|reminder|escalation|emergency.created|safety.review_escalated|material.shortage`, `audience: BlockerOwner`.
- Tách phản ánh hai việc: `SPLIT_PAIR = (VE_SINH, KY_THUAT)`; ticket gốc giữ phần tử 0, ticket con nhận phần tử 1.

## J. State and permission validators

1. Chỉ transition trong bảng `TRANSITIONS` (CR-03 §4.1); ngoài bảng → `INVALID_TRANSITION`.
2. Actor sai → `ACTION_DENIED`; BPTN bị chặn khi ticket mang blocker thuộc `BQL_REASONS`.
3. Chỉ BQL tạo `CLOSED`/`CANCELLED`.
4. Blocker `SAFETY_REASONS` không bị `resume()`/job gỡ.
5. `ROUTED|IN_PROGRESS|READY_FOR_REVIEW|CLOSED` cần `department_id`, trừ `CLOSED + EMERGENCY_HANDLED`.
6. `SET_ASSIGNEE` luôn bị từ chối; `assignee_id` luôn null.
7. Mọi ghi qua `_mutate` (bản sao sâu → audit → commit, fail closed) và giữ `engine.lock`; mọi đổi trạng thái qua `_apply_transition`.
8. `MERGED` không hủy trực tiếp; hoàn tác trước. Không có transition reopen.
9. View cư dân dùng allow-list, loại bỏ risk/reason/internal/material/assignee/retry.
10. Guard vật tư (`material_policy.py`): mã thuộc phòng ban, số nguyên dương, Kỹ thuật ≥ 1; lỗi `material_required`/`material_invalid`.

## K. Persistence

`CaseRepository` theo `MO_STORE` (`memory` mặc định | `postgres` schema `maintops`, Alembic `0001…0006`); ảnh theo `MO_PHOTO_STORE`. `PostgresRepository.list()` cache theo `xmin`, object từ `list()` chỉ đọc. Serverless dùng `MO_DB_POOL=none`. Xem [`../brain4agent/-data-architecture.md`](../brain4agent/-data-architecture.md).

## L. Đã bỏ khỏi contract hiện hành

`DutyAvailability`, `routing_team_id`, `SIM-TEAM-*`, `SIM-DUTY-*`, team capacity; bốn state v0.3 và `route_status` như bộ quyết định chính; draft tồn tại khi route không hợp lệ; evidence ảnh tùy chọn; reopen; `AssignmentScope`/`assignment_mode`; đối chiếu vật tư theo định mức/đề xuất Agent (plan 15).

## M. Contract status

Contract bám code ở `SCHEMA_VERSION=1.2`; D-02/D-03/D-05/D-09 đã cài (xem [`03_lean_prd.md`](03_lean_prd.md) §7). Drift đã biết: `src/main.py` đặt `version="0.5.0-candidate"` cho FastAPI, khác version dự án 1.17.9.

---

# Historical appendix — Data Contract v1.1

> Nội dung dưới đây là contract đã freeze cho MVP v0.3. `DutyAvailability`, team route, bốn state và draft-without-route chỉ có giá trị lịch sử, không được dùng để triển khai v0.6 candidate.

## 1. Mục đích, phạm vi và ranh giới

Data Contract này là đầu vào thống nhất cho AI, UI và QA của prototype mô phỏng. Contract chỉ bao phủ:

- `PB-CLN-01`: vệ sinh khu vực chung và exception chất không rõ nguồn gốc có dấu hiệu nguy hại.
- `PB-TEC-01`: đèn khu vực chung không hoạt động và exception mùi khét/tia lửa/dây điện hở.
- Bốn state: `IN_PROGRESS`, `CHỜ XÁC MINH`, `READY_FOR_REVIEW`, `EXCEPTION`.
- Mười một entity bắt buộc, gồm `Asset`, `DutyAvailability`, và các value object phục vụ validation, routing, state, warning và explainability.
- Dataset fixture gồm 12 ticket mô phỏng: 6 vệ sinh, 6 kỹ thuật; 4 demo flow chính và 8 regression cases.

Contract không định nghĩa UI, integration thật, work order thật, SOP hiện trường, SLA thật, định mức/tồn kho thật, employee assignment, computer vision, outbound messaging, tài chính hoặc use case ngoài hai playbook trên.

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

- Stored state dùng đúng nhãn `CHỜ XÁC MINH`; không tạo alias hoặc top-level state hàng đợi khác.
- Permission denial canonical code là `ACTION_DENIED`. Tên cũ `ACTION_OUT_OF_AUTHORITY` chỉ là deprecated documentation alias, không được emit trong v1.
- Timestamp dùng ISO 8601 có timezone.
- JSON-like object được mô tả ở mức schema; tài liệu này không phải code implementation.

---

## 3. Entity map và quan hệ

| Entity bắt buộc | Vai trò | Quan hệ chính | Write owner | Rào chắn |
|---|---|---|---|---|
| `Ticket` | Raw ticket, admin layer và current state | Parent của mọi case entity | Raw: ingest-only; admin: BPTN; state: SYSTEM_DERIVED | Raw immutable; state chỉ qua validator |
| `AgentClassificationProposal` | Proposal service/type/playbook + rule/source | N—1 Ticket; 1—0..1 logical draft | Agent | Không ghi đè admin/source; không confidence-only |
| `WorkOrderDraft` | Draft mô phỏng, idempotent, readiness aggregate | N—1 Ticket/proposal; parent checklist/material/evidence requirements | Agent/SYSTEM_DERIVED | Không phải work order thật; chỉ tạo sau pre-draft gate |
| `Asset` | Catalog tài sản vật lý mô phỏng cho kỹ thuật | Lookup theo type/location/playbook | Static simulated config, read-only | ID `SIM-ASSET-*`; không CRUD/runtime write |
| `DutyAvailability` | Team/shift/capacity mô phỏng | Lookup theo service/team | Static simulated config, read-only | ID `SIM-DUTY-*`/`SIM-TEAM-*`; team-only |
| `ChecklistTemplate` | Template checklist versioned của playbook | 1—N ChecklistItem | Static simulated config | Không chứa SOP kỹ thuật thật |
| `ChecklistItem` | Instance checklist execution | N—1 WorkOrderDraft/template item | HUMAN_EXECUTION | Agent không tự `COMPLETED` |
| `MaterialLine` | Material record và ba comparison | N—1 WorkOrderDraft | HUMAN_EXECUTION input; Agent derive comparisons | Không approval/inventory/violation conclusion |
| `EvidenceRecord` | Original hoặc execution evidence | N—1 Ticket; 0..1 WorkOrderDraft requirement | Ingest hoặc HUMAN_EXECUTION | Checklist không thay evidence; ảnh optional |
| `ExceptionRecord` | Blocking exception route BQL | N—1 Ticket | Agent create; BQL resolve | Agent không resolve; permission denial không tạo record này |
| `AuditEvent` | Append-only event cho edit/decision/transition/rejection | N—1 Ticket; target polymorphic | SYSTEM | Audit fail → business mutation fail closed |

### 3.1 Supporting value objects, không mở rộng workflow

- `AdministrativeNormalization`: embedded, versioned dưới `Ticket`.
- `RuleSignal`: embedded dưới `AgentClassificationProposal`.
- `EvidenceRequirement`, `ReadinessEvaluation`, `NonBlockingWarning`: embedded dưới `WorkOrderDraft`.
- `MaterialComparisonResult`: embedded dưới `MaterialLine`.

```text
Ticket
  ├── 0..N AgentClassificationProposal
  ├── 0..N WorkOrderDraft revisions
  │     ├── 1 ChecklistTemplate reference
  │     ├── 1..N ChecklistItem
  │     ├── 0..N MaterialLine
  │     └── 1..N EvidenceRequirement links
  ├── 0..1 Asset reference (technical only)
  ├── 0..1 DutyAvailability/team route reference
  ├── 0..N EvidenceRecord
  ├── 0..N ExceptionRecord
  └── 1..N AuditEvent
```

---

## 4. Enum và controlled vocabulary

| Enum | Giá trị hợp lệ |
|---|---|
| `TicketState` | `IN_PROGRESS`, `CHỜ XÁC MINH`, `READY_FOR_REVIEW`, `EXCEPTION` |
| `ServiceCategory` | `VE_SINH`, `KY_THUAT`, `UNKNOWN` |
| `TicketType` | `COMMON_AREA_CLEANING`, `COMMON_AREA_LIGHTING`, `UNKNOWN` |
| `PlaybookId` | `PB-CLN-01`, `PB-TEC-01` |
| `ConfirmationStatus` | `PENDING`, `CONFIRMED` |
| `SignalStatus` | `PRESENT`, `ABSENT`, `UNCLEAR` |
| `ChecklistStatus` | `PENDING`, `COMPLETED` |
| `MaterialGateStatus` | `RECONCILED`, `NEEDS_CLARIFICATION`, `N/A` |
| `NormLabel` | `SYNTHETIC`, `N_A` |
| `ComparisonType` | `PLANNED_VS_NORM`, `ISSUED_VS_PLANNED`, `USED_VS_ISSUED` |
| `ComparisonStatus` | `MATCH`, `VARIANCE`, `N/A` |
| `EvidenceType` | `PROCESSING_NOTE`, `RESULT_NOTE`, `SIMULATED_IMAGE`, `RESIDENT_ORIGINAL` |
| `EvidenceValidationStatus` | `PRESENT`, `MISSING`, `INVALID_TYPE`, `SOURCE_UNVERIFIED` |
| `ReadabilityStatus` | `READABLE`, `UNREADABLE`, `NOT_APPLICABLE` |
| `EvidenceSource` | `RESIDENT_ORIGINAL`, `HUMAN_EXECUTION`, `SYSTEM_SIMULATED` |
| `ExceptionType` | `CLEANING_HAZARD`, `ELECTRICAL_HIGH_RISK` |
| `RiskLevel` | `HIGH_RISK` |
| `ExceptionStatus` | `OPEN`, `RESOLVED_BY_BQL` |
| `WarningType` | `EXPLAINED_MATERIAL_VARIANCE` |
| `ActorRole` | `SYSTEM`, `BPTN`, `AGENT`, `HUMAN_EXECUTION`, `BQL`, `QA_INTERNAL` |
| `ActionResult` | `ALLOWED`, `ACTION_DENIED` |
| `AssetLookupStatus` | `MATCHED`, `NOT_FOUND`, `AMBIGUOUS`, `NOT_APPLICABLE` |
| `DutyLookupStatus` | `AVAILABLE`, `NO_AVAILABLE_TEAM`, `CAPACITY_EXCEEDED`, `DUTY_UNKNOWN` |
| `MaterialStockStatus` | `SUFFICIENT`, `INSUFFICIENT`, `UNKNOWN`, `NOT_APPLICABLE` |
| `RouteStatus` | `ROUTED`, `NOT_ROUTED` |
| `QueueStatus` | `NOT_QUEUED`, `PENDING_BQL_REVIEW` |

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
| `synthetic` | boolean | R | `true` | SYSTEM_INGEST | False/missing → schema reject | Toàn entity | `true` |

#### 5.1.1 `Ticket.administrative_normalization`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `administrative_revision` | integer | R khi object tồn tại | integer ≥ 1 | SYSTEM | Tăng đơn điệu; mỗi change có audit | Draft `administrative_revision` | `2` |
| `service_category_normalized` | enum | `R-PRE_DRAFT` | `ServiceCategory` | BPTN confirm/edit | Không `UNKNOWN`; phải tương thích playbook; edit có reason/audit | Proposal | `VE_SINH` |
| `ticket_type_normalized` | enum | `R-PRE_DRAFT` | `TicketType` | BPTN confirm/edit | Không `UNKNOWN`; phải tương thích playbook; audit | Proposal | `COMMON_AREA_CLEANING` |
| `location_normalized` | string/object | `R-PRE_DRAFT` cả hai playbook | — | BPTN | Non-empty, không `UNKNOWN`; nguồn đã xác minh; audit | Draft scope | `Tòa SIM-A / sảnh chung` |
| `priority` | string/null | O | chưa khóa | BPTN | Agent không ghi/derive; không tham gia state gate | — | `null` |
| `confirmation_status` | enum | `R-PRE_DRAFT` | `PENDING|CONFIRMED` | BPTN/SYSTEM | `PENDING` chặn draft → `CHỜ XÁC MINH` | Proposal | `CONFIRMED` |
| `confirmed_by` | string/null | C: required iff `CONFIRMED` | actor ID | BPTN | Actor tồn tại và role BPTN | AuditEvent | `SIM-ACTOR-BPTN-01` |
| `confirmed_at` | datetime/null | C: required iff `CONFIRMED` | ISO 8601 | SYSTEM | Có timezone, không trước proposal | AuditEvent | `2026-09-27T08:03:00+07:00` |
| `source_references` | array<string> | R khi confirm/edit | — | BPTN | Ít nhất một ref hiện hữu; không tự bịa | Ticket/raw source | `["ticket.original_description"]` |
| `change_reason` | string | C: required khi giá trị confirmed khác proposal hoặc admin edit | — | BPTN | Non-empty; đồng nhất AuditEvent.reason | AuditEvent | `Chuẩn hóa theo fixture đã xác minh` |

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
| `asset_id` | string/null | C: field bắt buộc cho TEC, nullable khi unresolved | `SIM-ASSET-*` | SYSTEM_DERIVED lookup | CLN phải null; TEC chỉ non-null khi exact one match | Asset FK | `SIM-ASSET-LIGHT-001` |
| `asset_lookup_status` | enum | R | `AssetLookupStatus` | SYSTEM_DERIVED | CLN=`NOT_APPLICABLE`; TEC phải được lookup | Route gate | `MATCHED` |
| `asset_match_reason` | string | R | — | SYSTEM_DERIVED | Non-empty; nêu exact match/not found/ambiguous | Explainability | `Một asset LIGHTING khớp vị trí` |
| `routing_team_id` | string/null | R key | `SIM-TEAM-*` | SYSTEM_DERIVED lookup | Non-null chỉ khi duty match một team phù hợp | DutyAvailability | `SIM-TEAM-TEC-01` |
| `duty_lookup_status` | enum | R | `DutyLookupStatus` | SYSTEM_DERIVED | Lookup bắt buộc cho cả hai playbook | Route gate | `AVAILABLE` |
| `duty_source_ref` | string | R khi lookup có dữ liệu | `SIM-DUTY-*`/source path | SYSTEM_DERIVED | Ref tồn tại; unknown phải nêu missing source | DutyAvailability | `SIM-DUTY-TEC-01` |
| `route_status` | enum | R | `ROUTED|NOT_ROUTED` | SYSTEM_DERIVED | Chỉ ROUTED khi asset/stock/duty gates pass | Draft/readiness | `ROUTED` |
| `matched_rule_ids` | array<string> | R | playbook rule IDs | AGENT_PROPOSAL | Non-empty; mọi ID tồn tại trong playbook | Rule trace | `["PB-CLN-R-TRG-01"]` |
| `classification_reason` | string | R | — | AGENT_PROPOSAL | Non-empty, không chứa unsupported fact | Explainability | `Khớp phản ánh vệ sinh khu vực chung` |
| `source_references` | array<string> | R | — | AGENT_PROPOSAL | Non-empty; ref tồn tại | Ticket/raw | `["ticket.original_description"]` |
| `rule_signals` | array<RuleSignal> | R | signal catalog | AGENT_PROPOSAL/SYSTEM_DERIVED | Đủ signal bắt buộc theo playbook; `UNCLEAR` không bị coi là false | Exception validator | xem dưới |
| `confirmation_status` | enum | `R-PRE_DRAFT` | `PENDING|CONFIRMED` | BPTN/SYSTEM | PENDING → no draft/`CHỜ XÁC MINH` | Ticket admin | `CONFIRMED` |
| `confirmed_by` | string/null | C iff CONFIRMED | BPTN actor | BPTN | Actor role BPTN | Audit | `SIM-ACTOR-BPTN-01` |
| `confirmed_at` | datetime/null | C iff CONFIRMED | ISO 8601 | SYSTEM | Không trước proposal creation | Audit | `2026-09-27T08:03:00+07:00` |
| `created_at` | datetime | R | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:01:00+07:00` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

`RuleSignal` có `signal_code`, `status: PRESENT|ABSENT|UNCLEAR`, `source_references[]`, `evaluated_at`, `rule_id`. Signal catalog v1:

- CLN: `UNKNOWN_SUBSTANCE_PRESENT`, `HAZARD_SIGNAL_PRESENT`.
- TEC: `BURNING_SMELL_PRESENT`, `SPARK_PRESENT`, `EXPOSED_WIRE_PRESENT`.

### 5.3 `WorkOrderDraft`

| Field | Type | Required/gate | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `work_order_draft_id` | string | R | `SIM-WOD-*` | SYSTEM | Unique logical draft ID | PK | `SIM-WOD-CLN-001` |
| `ticket_id` | string | R | — | SYSTEM | Ticket tồn tại | Ticket FK | `SIM-TKT-CLN-001` |
| `proposal_id` | string | R | — | SYSTEM | Proposal confirmed | Proposal FK | `SIM-ACP-001` |
| `playbook_id` | enum | R | `PlaybookId` | AGENT_PROPOSAL | Khớp proposal/admin | Template FK | `PB-CLN-01` |
| `playbook_version` | string | R | `1.1` | SYSTEM | Khớp proposal/template | Template FK | `1.1` |
| `administrative_revision` | integer | R | ≥1 | SYSTEM | Ref đúng confirmed administrative revision | Ticket admin | `2` |
| `source_revision` | string | R | — | SYSTEM | Khớp Ticket source revision | Ticket | `SRC-001` |
| `idempotency_key` | string | R | derived | SYSTEM | Chính xác `ticket_id + playbook_version + source_revision`; unique cho logical draft | Idempotency | `SIM-TKT-CLN-001|1.1|SRC-001` |
| `draft_revision` | integer | R | ≥1 | SYSTEM | Retry cùng input không tạo duplicate; revision tăng khi authorized source/admin revision đổi | Audit | `1` |
| `draft_status` | enum | R | const `DRAFT` | SYSTEM | Không có status operational khác | — | `DRAFT` |
| `scope_summary` | string | R | — | AGENT_PROPOSAL | Non-empty; mọi fact có source/proposal ref; không chẩn đoán | Source refs | `Ghi nhận vệ sinh tại vị trí đã chuẩn hóa` |
| `generation_reason` | string | R | — | AGENT_PROPOSAL | Non-empty | Explainability | `Pre-draft gates passed` |
| `matched_rule_ids` | array<string> | R | — | AGENT_PROPOSAL | Rule tồn tại | Playbook | `["PB-CLN-R-TRG-01"]` |
| `source_references` | array<string> | R | — | AGENT_PROPOSAL | Non-empty, ref tồn tại | Ticket/proposal | `["ticket.original_description"]` |
| `asset_id` | string/null | R key | `SIM-ASSET-*`/null | SYSTEM_DERIVED | TEC non-null khi MATCHED; unresolved được null; CLN null | Asset FK | `null` |
| `routing_team_id` | string/null | R key | `SIM-TEAM-*`/null | SYSTEM_DERIVED | Non-null chỉ khi `route_status=ROUTED` | Duty/team | `SIM-TEAM-CLN-01` |
| `duty_status` | enum | R | `DutyLookupStatus` | SYSTEM_DERIVED | Phản ánh exact duty lookup | Route gate | `AVAILABLE` |
| `assignment_mode` | enum | R | const `SIMULATED_TEAM_ROUTE` | SYSTEM | Giá trị khác reject | Routing boundary | `SIMULATED_TEAM_ROUTE` |
| `assignment_scope` | enum | R | const `TEAM_ONLY` | SYSTEM | Giá trị khác reject | Routing boundary | `TEAM_ONLY` |
| `assignee_id` | null | R | const `null` | SYSTEM | Bất kỳ non-null value → `ACTION_DENIED`/schema reject | Permission | `null` |
| `material_stock_status` | enum | R | `MaterialStockStatus` | SYSTEM_DERIVED | `INSUFFICIENT|UNKNOWN` chặn route | MaterialLine | `SUFFICIENT` |
| `route_status` | enum | R | `RouteStatus` | SYSTEM_DERIVED | ROUTED chỉ khi all route gates pass | Readiness | `ROUTED` |
| `queue_status` | enum | R | `QueueStatus` | SYSTEM_DERIVED | Field phụ, không phải top-level state | Queue UI | `NOT_QUEUED` |
| `queue_reason` | string/null | C khi NOT_ROUTED | reason catalog | SYSTEM_DERIVED | `NO_AVAILABLE_TEAM|DUTY_UNKNOWN|TEAM_CAPACITY_EXCEEDED|ASSET_NOT_FOUND|ASSET_AMBIGUOUS|MATERIAL_SHORTAGE|MATERIAL_STOCK_UNKNOWN` | Explainability | `null` |
| `checklist_template_id` | string | R | template ID | SYSTEM | Template đúng playbook/version | ChecklistTemplate | `PB-CLN-01-CHK-V1` |
| `checklist_item_ids` | array<string> | R khi tạo draft | — | SYSTEM | Sinh đủ mọi required template item; ≥1; item initial PENDING | ChecklistItem | `["SIM-CHK-CLN-001-01", ...]` |
| `material_requirement_mode` | enum | R | `TRACKED|N_A` | Static playbook/System | N_A yêu cầu zero line | Material gate | `TRACKED` |
| `material_gate_status` | enum | `R-READY` | `MaterialGateStatus` | SYSTEM_DERIVED | READY chỉ `RECONCILED|N/A`; N/A → zero line | MaterialLine | `RECONCILED` |
| `material_line_ids` | array<string> | C | — | SYSTEM | N/A = `[]`; otherwise refs cùng draft | MaterialLine | `["SIM-MAT-001"]` |
| `evidence_requirements` | array<EvidenceRequirement> | R | catalog §6.2 | Static config | Đủ exact requirements playbook; image không required | EvidenceRecord | xem §6.2 |
| `readiness_evaluation` | object | R after evaluation | — | SYSTEM_DERIVED | Theo eight gates; không phải human acceptance | State validator | xem dưới |
| `blocking_exception_active` | boolean | `R-READY` | false để pass | SYSTEM_DERIVED | True iff có ExceptionRecord OPEN; READY yêu cầu false | ExceptionRecord | `false` |
| `non_blocking_warnings` | array<NonBlockingWarning> | O | only explained variance | SYSTEM_DERIVED | Warning visible; không tự override blocker | Material comparison | `[]` |
| `created_at` | datetime | R | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:04:00+07:00` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

`ReadinessEvaluation` bắt buộc chứa tám boolean gates: `playbook_present`, `work_order_draft_present`, `required_fields_complete`, `route_valid`, `checklist_complete`, `minimum_evidence_complete`, `material_reconciled_or_na`, `no_blocking_exception`; cùng `evaluated_at`, `rule_ids`, `source_references`, `target_state`, `reason`. `READY_FOR_REVIEW` chỉ khi cả tám đều true và `route_status=ROUTED`.

`NonBlockingWarning` gồm `warning_id`, `warning_type=EXPLAINED_MATERIAL_VARIANCE`, `blocking=false`, `rule_id`, `reason`, `material_line_ids`, `comparison_types`, `created_at`, `synthetic=true`.

### 5.4 `Asset`

| Field | Type | Required | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `asset_id` | string | R | `SIM-ASSET-*` | Static fixture | Unique, immutable | Proposal/draft | `SIM-ASSET-LIGHT-HALLWAY` |
| `asset_type` | enum | R | MVP ưu tiên `LIGHTING` | Static fixture | TEC lookup allowlist | Playbook | `LIGHTING` |
| `name` | string | R | — | Static fixture | Non-empty; nhãn BPTN chọn (plan 14) | UI | `Đèn hành lang` |
| `area` | string | R | nhãn `rules.AREA_PATTERNS` | Static fixture | Khu vực hợp lệ; ≤1 asset ACTIVE mỗi khu vực (plan 14) | Lookup | `Hành lang` |
| `location_normalized` | string/null | O | — | Static fixture | Chỉ asset `RETIRED_SIMULATED` (lịch sử, trước plan 14) | Lịch sử | `Tòa S1 / Tầng 3 / Hành lang` |
| `asset_status` | enum | R | `ACTIVE_SIMULATED` \| `RETIRED_SIMULATED` | Static fixture | RETIRED không lookup, không chọn, không trả UI | Lookup | `ACTIVE_SIMULATED` |
| `linked_playbook_id` | enum | R | const `PB-TEC-01` | Static fixture | CLN link reject | Playbook | `PB-TEC-01` |
| `source_ref` | string | R | — | Static fixture | Ref tồn tại | Audit/explainability | `fixture.asset.001` |
| `synthetic` | boolean | R | true | Static fixture | False/missing reject | All output | `true` |
| `read_only` | boolean | R | true | Static fixture | Runtime write → `ACTION_DENIED` | Permission | `true` |

### 5.5 `DutyAvailability`

| Field | Type | Required | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `duty_id` | string | R | `SIM-DUTY-*` | Static fixture | Unique, immutable | Proposal/draft | `SIM-DUTY-TEC-01` |
| `team_id` | string | R | `SIM-TEAM-*` | Static fixture | Non-empty; team-only target | Route | `SIM-TEAM-TEC-01` |
| `service_category` | enum | R | `VE_SINH|KY_THUAT` | Static fixture | Khớp playbook | Proposal | `KY_THUAT` |
| `shift_window` | object/string | R | simulated | Static fixture | Parseable simulated window; không phải lịch thật | Duty lookup | `SIM-SHIFT-AM` |
| `availability_status` | enum | R | `AVAILABLE|NOT_ON_DUTY|UNKNOWN` | Static fixture | UNKNOWN không được coi là absent/available | Resolver | `AVAILABLE` |
| `current_open_ticket_count` | integer/null | C | ≥0 | Static fixture | Required khi status known | Capacity | `1` |
| `max_open_ticket_count` | integer/null | C | ≥0 | Static fixture | Required khi status known; available capacity iff current < max | Capacity | `3` |
| `source_ref` | string | R | — | Static fixture | Ref tồn tại | Audit | `fixture.duty.tec.01` |
| `synthetic` | boolean | R | true | Static fixture | False/missing reject | All output | `true` |
| `assignment_scope` | enum | R | const `TEAM_ONLY` | Static fixture | Giá trị khác reject | Routing boundary | `TEAM_ONLY` |

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

Mỗi `items[]` có `template_item_id`, `label`, `required`, `update_owner=HUMAN_EXECUTION`, `completion_status_enum=[PENDING,COMPLETED]`.

### 5.7 `ChecklistItem`

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

### 5.8 `MaterialLine`

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
| `simulated_stock_qty` | number/null | C: pre-route | ≥0 hoặc null | Static fixture | Null chỉ khi stock unknown/not applicable | Stock gate | `5` |
| `material_stock_status` | enum | R pre-route | `MaterialStockStatus` | SYSTEM_DERIVED | SUFFICIENT/NOT_APPLICABLE mới pass route | Draft route | `SUFFICIENT` |
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

### 5.9 `EvidenceRecord`

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

### 5.10 `ExceptionRecord`

| Field | Type | Required | Enum/const | Source/owner | Validation rule | Liên kết | Ví dụ |
|---|---|---|---|---|---|---|---|
| `exception_id` | string | R | `SIM-EXC-*` | SYSTEM | Unique | PK | `SIM-EXC-TEC-001` |
| `ticket_id` | string | R | — | SYSTEM | Ticket tồn tại | Ticket FK | `SIM-TKT-TEC-EX-001` |
| `exception_type` | enum | R | `ExceptionType` | SYSTEM_DERIVED | Khớp exact rule | State | `ELECTRICAL_HIGH_RISK` |
| `rule_id` | string | R | playbook exception rule | SYSTEM_DERIVED | Rule tồn tại/versioned | Playbook trace | `PB-TEC-R-EX-01` |
| `blocking` | boolean | R | true | SYSTEM | False reject | READY gate | `true` |
| `reason` | string | R | — | SYSTEM_DERIVED | Non-empty, trung tính; no diagnosis/right-wrong conclusion | Explainability | `Phát hiện tín hiệu rủi ro đã định nghĩa` |
| `source_references` | array<string> | R | — | SYSTEM_DERIVED | Non-empty, refs hiện hữu | Ticket/proposal | `["proposal.rule_signals[SPARK_PRESENT]"]` |
| `risk_level` | enum | R | `HIGH_RISK` | Static rule | Cleaning/technical risk only | Routing | `HIGH_RISK` |
| `authorized_handler` | enum | R | const `BQL` | Static rule | Agent/non-BQL cannot resolve | Permission | `BQL` |
| `status` | enum | R | `OPEN|RESOLVED_BY_BQL` | BQL transition | Agent cannot set resolved | State machine | `OPEN` |
| `missing_information` | array<string> | O | — | SYSTEM_DERIVED/BQL | Chỉ nêu field/source cần xác minh; không high-risk instruction | Clarification | `[]` |
| `resolution_note` | string/null | C iff resolved | — | BQL | Non-empty, audited; không do Agent ghi | State transition | `BQL proxy đã ghi resolution mô phỏng` |
| `resolved_by` | string/null | C iff resolved | BQL actor | BQL | Actor role BQL | Audit | `SIM-ACTOR-BQL-01` |
| `resolved_at` | datetime/null | C iff resolved | ISO 8601 | SYSTEM | Có timezone | Audit | `2026-09-27T08:30:00+07:00` |
| `synthetic` | boolean | R | true | SYSTEM | Missing/false reject | — | `true` |

Không có `correct_source`, `approved`, `accepted`, `technical_diagnosis` hoặc `resident_message` field.

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
| `schema_version` | string | R | `1.1` | SYSTEM | Exact contract version | Contract | `1.1` |
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

Các label trên là documentation gates mô phỏng, không phải SOP xử lý hiện trường hoặc xác nhận chất lượng.

### 6.2 Evidence requirement catalog

| Requirement ID | Playbook | Allowed evidence type | Minimum condition | Missing/wrong type | Image |
|---|---|---|---|---|---|
| `CLN-EVD-PROCESSING-NOTE` | `PB-CLN-01` | `PROCESSING_NOTE` | Non-empty; đúng ticket/draft; actor/time/readability valid | `IN_PROGRESS` | Optional, không satisfy requirement |
| `TEC-EVD-RESULT-NOTE` | `PB-TEC-01` | `RESULT_NOTE` | Non-empty; đúng ticket/draft; actor/time/readability valid | `IN_PROGRESS` | Optional, không satisfy requirement |

### 6.3 Exception signal contract

| Rule | Playbook | Condition | Output/state | Prohibited output |
|---|---|---|---|---|
| `PB-CLN-R-EX-01` | CLN | `UNKNOWN_SUBSTANCE_PRESENT=PRESENT` **AND** `HAZARD_SIGNAL_PRESENT=PRESENT` | `ExceptionRecord(CLEANING_HAZARD)`, `EXCEPTION` | Standard handling instruction |
| `PB-CLN-R-RISK-01` | CLN | Một trong hai cleaning signal = `UNCLEAR` | `CHỜ XÁC MINH`, no standard draft | Guessing signal |
| `PB-CLN-R-SAFE-01` | CLN | Một signal PRESENT, signal kia ABSENT | `IN_PROGRESS`; tiếp tục gate, không tuyên bố an toàn | Treat one signal as full exception/safety proof |
| `PB-TEC-R-EX-01` | TEC | Bất kỳ `BURNING_SMELL_PRESENT`, `SPARK_PRESENT`, `EXPOSED_WIRE_PRESENT` = `PRESENT` | `ExceptionRecord(ELECTRICAL_HIGH_RISK)`, `EXCEPTION` | Diagnosis, repair guidance, standard draft |
| `PB-TEC-R-RISK-01` | TEC | Bất kỳ required risk signal = `UNCLEAR` và chưa có signal PRESENT | `CHỜ XÁC MINH`, no standard draft | Treat unclear as absent |

Hai cleaning signals `PRESENT+ABSENT` hoặc `ABSENT+PRESENT` không đủ tạo exception; case tiếp tục `IN_PROGRESS` nếu các gate khác hợp lệ. Đây là `SIMULATED ASSUMPTION` đã được Agent A disposition.

---

## 7. Validator catalog

### 7.1 Schema, synthetic và immutability

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-SCHEMA-001` | Mọi entity | Field required/type/enum/link valid | Reject write; error có field path; no partial write |
| `VAL-SYN-001` | Mọi entity/output | `synthetic=true`, ID `SIM-`; norm label đúng | Reject output; không trình bày như dữ liệu thật |
| `VAL-TKT-REQ-001` | Ticket | Ba raw fields non-empty/valid | `CHỜ XÁC MINH`; no classification/draft |
| `VAL-IMM-001` | Raw edit attempt | Hash/value unchanged | `ACTION_DENIED` + audit; state unchanged |
| `VAL-INJECT-001` | Original/evidence content | Content chỉ được parse như untrusted data | Ignore embedded instruction; fail closed nếu parse uncertainty |

### 7.2 Classification và pre-draft

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-CLASS-001` | Ticket + proposal | Service/type/playbook exact mapping; rules/reason/source non-empty | Ambiguous/out-of-v1 → `CHỜ XÁC MINH`; không invent playbook |
| `VAL-SIGNAL-001` | Proposal signals | Đủ signal set; status không silently default | `UNCLEAR` → clarification theo §6.3 |
| `VAL-PRE-DRAFT-001` | Proposal + admin | CONFIRMED service/type, location non-empty, playbook/version | `CHỜ XÁC MINH`; zero draft |
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
| `VAL-MAT-MODE-001` | Draft/material | Gate N/A → zero line; tracked line chỉ CLN/TEC | Reject inconsistent payload |
| `VAL-MAT-STOCK-001` | planned/norm/stock fixture | SUFFICIENT hoặc NOT_APPLICABLE để route | INSUFFICIENT → `IN_PROGRESS`/`MATERIAL_SHORTAGE`; UNKNOWN → `CHỜ XÁC MINH`/`MATERIAL_STOCK_UNKNOWN`; draft retained, no route |
| `VAL-MAT-QTY-001` | MaterialLine | planned/issued/used ≥0; norm/label pair valid | Gate `NEEDS_CLARIFICATION`, ticket giữ `IN_PROGRESS`; không READY |
| `VAL-MAT-CMP-001` | MaterialLine | Exact ba comparison records; no fourth comparison | Reject derived result; no READY |
| `VAL-MAT-VAR-001` | Applicable comparisons | Mọi VARIANCE có non-empty `variance_reason` | Thiếu reason → `CHỜ XÁC MINH` |
| `VAL-MAT-WARN-001` | Reconciled variance | Có reason, exact comparisons complete, no other blocker | Tạo `EXPLAINED_MATERIAL_VARIANCE`; warning không chặn READY |
| `VAL-MAT-PERM-001` | Agent material action | Chỉ detect/describe | Approve/adjust/inventory/violation action → `ACTION_DENIED` + audit |

### 7.5 Evidence và readability

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-EVD-LINK-001` | EvidenceRecord | Ticket/draft/requirement cùng case/playbook | Reject record sai link; requirement không được satisfy; `IN_PROGRESS` nếu requirement known |
| `VAL-EVD-TYPE-001` | Requirement + record | Type thuộc allowlist requirement | `INVALID_TYPE`; `IN_PROGRESS` |
| `VAL-EVD-CONTENT-001` | content/metadata | Non-empty, schema-valid | `MISSING`; `IN_PROGRESS` |
| `VAL-EVD-READ-001` | readability | READABLE; hoặc NOT_APPLICABLE cho structured text/metadata schema-valid | UNREADABLE → not PRESENT/`IN_PROGRESS`; source/readability không xác minh được → `CHỜ XÁC MINH` |
| `VAL-EVD-READY-001` | All requirements | Mỗi independent requirement có đúng một hoặc nhiều valid record, ít nhất một PRESENT | Missing known → `IN_PROGRESS`; unknown requirement/source → `CHỜ XÁC MINH` |
| `VAL-EVD-IMG-001` | Image absence | Không required requirement nào là image | Không block, không warning |

### 7.6 Asset, duty, route và exception

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-CLN-EX-001` | CLN signals | Both PRESENT → exact exception | `EXCEPTION`; no standard draft |
| `VAL-TEC-EX-001` | TEC signals | Any PRESENT → exact exception | `EXCEPTION`; no diagnosis/guidance |
| `VAL-ASSET-001` | TEC proposal + Asset Catalog | Exact one active LIGHTING asset whose `area` = khu vực của location (plan 14; trước: trùng trọn location) | Zero/multiple → `CHỜ XÁC MINH`, asset_id null, no route; CLN → NOT_APPLICABLE |
| `VAL-DUTY-001` | Service + DutyAvailability | Team phù hợp, AVAILABLE và current < max | No team → `IN_PROGRESS`/`NO_AVAILABLE_TEAM`; unknown → `CHỜ XÁC MINH`/`DUTY_UNKNOWN`; capacity → `IN_PROGRESS` |
| `VAL-ROUTE-001` | Asset/stock/duty + draft | All applicable gates pass; team-only constants; assignee null | `NOT_ROUTED`; draft retained; no READY |
| `VAL-ASSIGNEE-001` | Draft/route payload | `assignee_id=null` | Non-null → `ACTION_DENIED`/schema reject; audit; state unchanged |
| `VAL-EXC-RESOLVE-001` | Resolution request | Actor BQL; exception OPEN; resolution note/time valid | Non-BQL/Agent → `ACTION_DENIED`; exception unchanged |

### 7.7 Readiness và state

| Validator | Input | Pass condition | Failure behavior |
|---|---|---|---|
| `VAL-READY-001` | ReadinessEvaluation | Eight gates true và `route_status=ROUTED` | Chọn non-READY state theo resolver §8 |
| `VAL-STATE-TRANS-001` | Current/target state | Transition thuộc allowlist; actor/context hợp lệ | Reject + audit; current state unchanged |
| `VAL-WARN-001` | Warning | Only explained material variance; rule/reason/source visible | Unknown warning reject; warning không che blocker |

### 7.8 Permission và audit

Permission validator phải chạy trước mutation. Action catalog tối thiểu:

| Action | BPTN | Agent | HUMAN_EXECUTION | BQL | Failure |
|---|---:|---:|---:|---:|---|
| View raw ticket | Allow read-only | Allow read-only | Allow read-only theo case | Allow read-only | Default deny unknown role |
| Edit admin allowlist/confirm proposal | Allow + reason/audit | Deny | Deny | Deny trong MVP | `ACTION_DENIED` |
| Edit raw content/original evidence | Deny | Deny | Deny | Deny | `ACTION_DENIED`, raw unchanged |
| Edit Playbook Registry/Asset/Duty fixture | Deny | Deny; read-only lookup | Deny | Deny | `ACTION_DENIED`, fixture unchanged |
| Create classification proposal/draft | Deny | Allow theo gates | Deny | Deny | `ACTION_DENIED` |
| Propose team route | Deny | Allow nếu asset/stock/duty pass | Deny | Review only | `ACTION_DENIED` |
| Assign individual employee | Deny | Deny | Deny | Deny trong MVP | `ACTION_DENIED`; `assignee_id` remains null |
| Update checklist/material/add execution evidence | Deny | Validate only | Allow + audit | Request follow-up only | `ACTION_DENIED` |
| Mark READY via deterministic gate | Deny | Allow derived transition | Deny | Review only | `ACTION_DENIED` |
| Resolve exception | Deny | Deny | Deny | Allow + audit | `ACTION_DENIED` |
| Accept/close ticket | Deny | Deny | Deny | Không phải action/state trong MVP | `ACTION_DENIED` |
| Approve/adjust material/inventory | Deny | Deny | Deny | Deny trong MVP | `ACTION_DENIED` |
| Send resident message/request resident image | Deny | Deny | Deny | Ngoài scope contract | `ACTION_DENIED` |

Forbidden Agent actions gồm: edit raw/admin/human fields; tự complete checklist; resolve exception; accept/close; technical quality confirmation; approve/adjust material; modify inventory; outbound message; request resident image. Denial tạo AuditEvent với `action_result=ACTION_DENIED`, không data/state side effect và không tạo `ExceptionRecord`.

Audit action catalog: `INGEST`, `CREATE_PROPOSAL`, `CONFIRM_NORMALIZATION`, `UPDATE_ADMIN_FIELD`, `LOOKUP_ASSET`, `CHECK_MATERIAL_STOCK`, `LOOKUP_DUTY`, `CREATE_DRAFT`, `PROPOSE_TEAM_ROUTE`, `UPDATE_CHECKLIST`, `UPDATE_MATERIAL`, `ADD_EVIDENCE`, `VALIDATE_EVIDENCE`, `RECONCILE_MATERIAL`, `TRANSITION_STATE`, `CREATE_EXCEPTION`, `RESOLVE_EXCEPTION`, `ACTION_DENIED`, `SYSTEM_ERROR`.

---

## 8. State machine contract

### 8.1 Resolver priority

1. Permission failure: emit `ACTION_DENIED`, audit; **không đổi state** và không tạo business exception.
2. Raw schema/required failure: `CHỜ XÁC MINH`; không classification/draft.
3. Sau khi đủ raw fields, exception safety/business rule có source rõ: `EXCEPTION`; chặn standard draft/flow.
4. Asset not found/ambiguous, duty unknown, stock unknown, signal/source unclear, classification ambiguous, proposal chưa confirm, thiếu location, variance reason hoặc evidence/source: `CHỜ XÁC MINH`; draft có thể tồn tại nếu confirmation/location đã pass nhưng không route.
5. No available team, team capacity exceeded, stock insufficient hoặc execution known-incomplete: `IN_PROGRESS`; draft tồn tại, route invalid khi áp dụng.
6. Eight gates all true và `route_status=ROUTED`: `READY_FOR_REVIEW`; explained material variance có thể còn active và phải hiển thị.
7. System/validator error: fail closed, không tạo route/READY; giữ prior safe state và tạo audit/error.

### 8.2 State definition

| State | Entry condition | Allowed mutation/action | Prohibited |
|---|---|---|---|
| `IN_PROGRESS` | Raw valid; no-team/capacity/stock shortage; execution incomplete; hoặc revalidation | Agent proposal/draft/lookup/re-route; BPTN confirm; HUMAN_EXECUTION update | Agent accept/close/approve/send; raw edit |
| `CHỜ XÁC MINH` | Missing/unknown/unclear input, asset, duty, stock, variance reason hoặc evidence/source | Authorized human bổ sung editable layer; Agent revalidate | Agent tự điền; direct READY; raw edit |
| `READY_FOR_REVIEW` | Eight gates true và route hợp lệ | BQL review; authorized change quay lại IN_PROGRESS rồi re-evaluate | Diễn giải như accepted/completed/closed/material-approved |
| `EXCEPTION` | Exact CLN/TEC high-risk rule | BQL resolution/request verification | Agent resolve, diagnosis, standard high-risk guidance |

### 8.3 Transition allowlist

| From | Trigger/actor | Guard | To | Audit required |
|---|---|---|---|---|
| Ingest event | SYSTEM | Ticket accepted | `IN_PROGRESS` | Yes |
| `IN_PROGRESS` | Agent validator | Missing/unclear/ambiguous/pre-draft gap | `CHỜ XÁC MINH` | Yes |
| `IN_PROGRESS` | Agent validator | Exact exception rule | `EXCEPTION` | Yes + ExceptionRecord |
| `IN_PROGRESS` | Agent validator | Eight gates pass, route valid | `READY_FOR_REVIEW` | Yes + readiness detail |
| `CHỜ XÁC MINH` | Authorized human + Agent | Data saved in editable layer, audit complete, revalidation starts | `IN_PROGRESS` | Yes |
| `CHỜ XÁC MINH` | Agent validator | Newly verified exception rule | `EXCEPTION` | Yes + ExceptionRecord |
| `EXCEPTION` | BQL + Agent | BQL resolution allows standard flow; revalidation | `IN_PROGRESS` | Yes |
| `EXCEPTION` | BQL | Requests missing verification | `CHỜ XÁC MINH` | Yes |
| `READY_FOR_REVIEW` | Authorized human + Agent | Legitimate admin/execution update | `IN_PROGRESS` | Yes |
| `READY_FOR_REVIEW` | Agent validator | Newly detected exact exception before BQL outcome | `EXCEPTION` | Yes + ExceptionRecord |

Invalid transitions: direct `CHỜ XÁC MINH→READY_FOR_REVIEW`; Agent-resolved `EXCEPTION→READY_FOR_REVIEW`; any transition to `CLOSED|COMPLETED|ACCEPTED|MATERIAL_APPROVED`; manual state override; READY khi bất kỳ gate false.

---

## 9. Output contracts

### 9.1 Classification result

Bắt buộc trả: proposal ID/revision, proposed service/type/playbook/version, asset ID/status/reason, routing team/duty status/source, route status, matched rule IDs, reason, source references, complete rule signals, confirmation status, target state/reason, synthetic label.

### 9.2 Work order draft result

Bắt buộc trả: draft ID, ticket/proposal/playbook/version/admin/source linkage, idempotency key, scope summary, asset ID, routing team, duty status, assignment constants, `assignee_id=null`, material stock status, route/queue fields, checklist/material/evidence requirements, generation reason/source và synthetic label. Không có operational order ID/action.

### 9.3 Readiness result

Bắt buộc trả: eight-gate breakdown gồm route, failing field/requirement/item IDs, exact target state, rule IDs/reason/source, active blocking exception IDs, visible non-blocking warnings, evaluation timestamp và audit event ID.

### 9.4 Permission rejection

Bắt buộc trả: `decision=DENY`, `code=ACTION_DENIED`, requested action, actor ID/role, target entity/field, reason, unchanged state, audit event ID. Không tạo `ExceptionRecord` chỉ vì permission denial.

---

## 10. Implementation Gaps và dispositions

| Gap ID | Gap từ Phase 1/2 | Agent A disposition | Áp dụng trong contract | Status |
|---|---|---|---|---|
| `GAP-B-01` | Cách biểu diễn material gate/`norm_qty` N/A | `APPROVE` + correction | Gate N/A → zero line; line có numeric planned/issued/used; norm numeric + SYNTHETIC hoặc null + N_A; comparison 1 N/A khi no norm | CLOSED |
| `GAP-B-02` | Cleaning composite và xử lý một/unclear signal | `SIMULATED ASSUMPTION` | Both PRESENT → EXCEPTION; một PRESENT + một ABSENT không exception; bất kỳ UNCLEAR → CHỜ, no standard draft | CLOSED |
| `GAP-B-05` | Readability nào pass | `APPROVE` | READABLE hoặc NOT_APPLICABLE cho structured schema-valid; UNREADABLE không pass; unknown → CHỜ | CLOSED |
| `GAP-C-01` | Draft behavior khi route gate fail | `APPROVE` | Draft retained; route NOT_ROUTED; state/reason theo asset/stock/duty; không READY | CLOSED |
| `GAP-C-02` | Duty capacity oracle | `APPROVE` | Available iff on duty và current open count < max; capacity exceeded giữ IN_PROGRESS | CLOSED |
| `GAP-C-03` | Individual assignment | `APPROVE` | Team-only constants; `assignee_id=null`; non-null rejected/audited | CLOSED |
| `GAP-C-04` | Technical asset unresolved | `APPROVE` | Draft có field asset_id null; state CHỜ; no route; không đoán | CLOSED |

Không còn Implementation Gap chưa có disposition sau Field Matrix và reverse review Playbook v1.1.

---

## 11. Contract-level acceptance checks

1. Mọi required field trong playbook phải map tới field path và validator trong contract.
2. Mọi field trong contract phải có source/owner, validation và mục đích nghiệp vụ; field không có consumer phải bị remove.
3. Mỗi state-affecting rule phải có đúng một state outcome; warning/permission annotations không được giả thành business exception.
4. `READY_FOR_REVIEW` chỉ khi eight gates machine-checkable đều pass, gồm route hợp lệ.
5. Raw content/evidence mutation, Agent checklist completion, exception resolution, acceptance/close/material approval/outbound action đều `ACTION_DENIED` + audit.
6. Không evidence requirement nào bắt buộc ảnh.
7. Duty lookup chạy cho cả hai playbook; asset lookup chỉ bắt buộc cho kỹ thuật.
8. Route chỉ dùng `SIM-TEAM-*`, `TEAM_ONLY`, `SIMULATED_TEAM_ROUTE`, `assignee_id=null`.
9. Material chỉ có ba post-execution comparisons; pre-route stock gate không phê duyệt tồn kho.
10. Mọi content/evidence là untrusted data; embedded instruction không thay policy.
11. Tất cả entity/output đều có nhãn `synthetic=true` và ID mô phỏng.

---

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

`No blocking open issues`.
