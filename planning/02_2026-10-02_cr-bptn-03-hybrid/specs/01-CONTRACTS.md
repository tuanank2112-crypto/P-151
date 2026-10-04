# 01 — Contracts

## 1. Enum (`src/maintenance/enums.py`)

| Enum | Giá trị |
|---|---|
| `ReasonCode` (+3) | `SAFETY_REVIEW_REQUIRED`, `EMERGENCY_PENDING_BQL`, `WRONG_DEPT_AFTER_START` |
| `RiskLevel` | `NONE`, `UNCLEAR`, `EMERGENCY` |
| `SignalStatus` | `PRESENT`, `ABSENT`, `UNCLEAR` |
| `Priority` | `HIGH`, `MEDIUM`, `LOW` |
| `PrioritySource` | `AGENT_RULE`, `HUMAN_OVERRIDE` |
| `ClosureKind` | `NORMAL`, `EMERGENCY_HANDLED` |
| `Action` (+13) | `ASSESS_SAFETY`, `SAFETY_CONFIRM_SAFE`, `SAFETY_ESCALATE`, `SAFETY_REQUEST_INFO`, `EMERGENCY_CLOSE`, `EMERGENCY_DOWNGRADE`, `CREATE_FOLLOW_UP`, `BQL_MERGE`, `MERGE_UNDO`, `REPORT_WRONG_DEPT`, `BQL_REASSIGN_TO_BPTN`, `BQL_KEEP_DEPARTMENT`, `SET_PRIORITY` |

Chủ blocker: `SAFETY_REVIEW_REQUIRED` → BPTN; `EMERGENCY_PENDING_BQL`, `WRONG_DEPT_AFTER_START` → BQL (`BQL_REASONS`).

## 2. Field mới (`Ticket`, mặc định giữ dữ liệu JSONB cũ đọc được)

`priority`, `priority_source`, `priority_rule_id`, `priority_reason`, `risk_level`, `risk_signals: list[RiskSignal]`,
`risk_amplifiers: list[str]`, `safety_cleared_by`, `safety_cleared_at`, `safety_clear_reason`, `safety_context: bool`,
`wrong_department_return_count: int`, `duplicate_count: int`, `merged_children: list[str]`,
`related_ticket_ids: list[str]`, `follow_up_of`, `closure_kind`. Bỏ `reopen_until` (validator `mode="before"` bỏ khoá
này khi đọc doc cũ).

`RiskSignal = {signal_id: str, status: SignalStatus, source_quote: str (≥1 ký tự), detected_by: "RULE"|"LLM"}`.

`Notification.type` thêm `emergency.created`, `safety.review_escalated`.

Validator: `closure_kind` có iff `CLOSED`; `CLOSED` cần `department_id` trừ `EMERGENCY_HANDLED`.

## 3. Bảng chuyển trạng thái (`engine.TRANSITIONS`) — CR-03 §4.1

Code giữ đúng 21 dòng T02–T22 + T23 hủy từ 7 trạng thái (28 cặp). Khác biệt so với code cũ:

| Dòng | Thay đổi |
|---|---|
| `NEED_INFO→RECEIVED` | thêm actor BQL (T03) |
| `RECEIVED→VERIFYING` | thêm lý do `SAFETY_REVIEW_REQUIRED`, `EMERGENCY_PENDING_BQL` |
| `VERIFYING→RECEIVED` | thêm actor BPTN (xác nhận an toàn), BQL (hạ khẩn cấp) |
| `VERIFYING→NEED_INFO` | MỚI (T06) BPTN/BQL, `MISSING_INFO` |
| `NEED_INFO→VERIFYING` | MỚI (T07) BQL, `EMERGENCY_PENDING_BQL` |
| `VERIFYING→MERGED` | thêm BQL (T08) |
| `MERGED→RECEIVED` | MỚI (T09) BPTN/BQL/SYSTEM |
| `VERIFYING→CLOSED` | MỚI (T10) BQL |
| `IN_PROGRESS→VERIFYING` | MỚI (T16) DEPARTMENT, `WRONG_DEPT_AFTER_START` |
| `VERIFYING→IN_PROGRESS` | MỚI (T17) BQL |
| `IN_PROGRESS→ON_HOLD` | thêm lý do `WAITING_MATERIAL` (T18) |
| `ON_HOLD→IN_PROGRESS` | thêm SYSTEM (T19) |
| `CLOSED→READY_FOR_REVIEW` | XOÁ |

## 4. Hàm engine (chữ ký)

```python
safety_review(ticket_id, actor_id, *, decision: Literal["CONFIRM_SAFE","ESCALATE","REQUEST_INFO"], note: str | None) -> Case
emergency_close(ticket_id, actor_id, *, note: str) -> Case            # T10
emergency_downgrade(ticket_id, actor_id, *, note: str) -> Case        # T05 (BQL)
create_follow_up(ticket_id, actor_id, *, note: str) -> Case           # trả ticket MỚI
bql_merge(ticket_id, actor_id, *, into: str, note: str) -> Case       # T08 (BQL, ticket khẩn cấp)
undo_merge(ticket_id, actor_id, *, note: str) -> Case                 # T09
report_wrong_department(ticket_id, actor_id, *, note: str) -> Case    # T16
bql_wrong_department(ticket_id, actor_id, *, decision: Literal["TO_BPTN","KEEP"], note: str) -> Case  # E02 / T17
set_priority(ticket_id, actor_id, *, priority: Priority, note: str) -> Case
material_short(ticket_id, actor_id, *, note: str) -> Case             # T18 WAITING_MATERIAL
```
Xoá: `reopen()`.

## 5. Endpoint

| Method + path | Vai trò | Hàm |
|---|---|---|
| `POST /mo/tickets/{id}/safety` `{decision, note}` | BPTN, BQL | `safety_review` |
| `POST /mo/tickets/{id}/unmerge` `{note}` | BPTN, BQL | `undo_merge` |
| `POST /mo/tickets/{id}/priority` `{priority, note}` | BPTN, BQL | `set_priority` |
| `POST /mo/tickets/{id}/report-wrong-dept` `{note}` | DEPARTMENT | `report_wrong_department` |
| `POST /mo/tickets/{id}/material-short` `{note}` | DEPARTMENT | `material_short` |
| `POST /bql/tickets/{id}/emergency/close` `{note}` | BQL | `emergency_close` |
| `POST /bql/tickets/{id}/emergency/downgrade` `{note}` | BQL | `emergency_downgrade` |
| `POST /bql/tickets/{id}/follow-up` `{note}` | BQL | `create_follow_up` |
| `POST /bql/tickets/{id}/merge` `{into, note}` | BQL | `bql_merge` |
| `POST /bql/tickets/{id}/wrong-dept` `{decision, note}` | BQL | `bql_wrong_department` |
| `GET /bql/tickets?risk_level=&priority=` | BQL | lọc thêm |
| `GET /bql/safety-clearances` | BQL | danh sách lần xác nhận an toàn |
| ~~`POST /resident/tickets/{id}/reopen`~~ | — | XOÁ |

## 6. Lỗi → HTTP (giữ `_call`)

| Lỗi | HTTP | Caller phải |
|---|---|---|
| `ActionDeniedError` (vai trò sai, BPTN chạm blocker chủ BQL) | 403 | Không thử lại; hiển thị "ngoài quyền" |
| `InvalidTransitionError` | 409 | Tải lại ticket |
| `GuardError` (thiếu ghi chú, sai blocker) | 409 | Sửa input |
| `NotFoundError` | 404 | — |

## 7. Cấu hình (`seed/maintenance_v1/catalog.yaml` → `sla_config`)

| Khóa | Giá trị | Trạng thái |
|---|---|---|
| `safety_review.escalate_after_hours` | 4 | đề xuất D-02 — chờ người dùng chốt |
| `safety_context_need_info.escalate_after_hours` | 12 | đề xuất D-02 — chờ người dùng chốt |
| `priority.duplicate_raise_at_count` | 3 | đề xuất D-03 — chờ người dùng chốt |
| `wrong_dept_return.escalate_at_count` | 2 | đã chốt (CR-03 §12.2) |
| `reopen_window_days` | — | XOÁ |
