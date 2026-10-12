# 01 — Contracts (bất biến; đổi = sửa SPEC trước)

## 1. Enum (`src/maintenance/enums.py`)
```python
class Action(StrEnum):            # thêm 2 thành viên, giữ nguyên các thành viên cũ
    REPORT_EMERGENCY = "REPORT_EMERGENCY"
    EMERGENCY_RESTORE = "EMERGENCY_RESTORE"
```
`PERMISSIONS` (`engine.py`): `Action.REPORT_EMERGENCY: frozenset({Role.DEPARTMENT, Role.BPTN, Role.BQL})`, `Action.EMERGENCY_RESTORE: frozenset({Role.BQL})`. KHÔNG thêm `ReasonCode` mới — dùng `EMERGENCY_PENDING_BQL`.

## 2. Model (`src/maintenance/models.py`)
```python
REPORTABLE_STATUSES = frozenset({ROUTED, IN_PROGRESS, ON_HOLD, READY_FOR_REVIEW, VERIFYING})  # enums.py hoặc models.py

class EmergencyReturn(Entity):
    """Chỗ ticket đứng trước khi người báo khẩn (plan 08). BQL trả về đúng chỗ này."""
    status: TicketStatus                 # ∈ REPORTABLE_STATUSES
    blocker: Blocker | None              # bản sao NGUYÊN VẸN blocker lúc báo (since/eta/escalate_at… giữ nguyên)
    reported_by: str
    reported_role: ActorRole             # ∈ {DEPARTMENT, BPTN, BQL}
    reported_at: AwareDatetime
    note: str = Field(min_length=1, max_length=500)

class Ticket(Entity):
    ...
    emergency_return: EmergencyReturn | None = None   # đặt bởi report_emergency; xoá bởi emergency_restore
```
Validator BẮT BUỘC thêm vào `Ticket._status_rules`:
- `emergency_return` khác None ⇒ (`status == VERIFYING` và `blocker.code == EMERGENCY_PENDING_BQL`) HOẶC `status ∈ {CLOSED, CANCELLED}` (giữ làm vết).
- `emergency_return.status ∈ REPORTABLE_STATUSES`; `emergency_return.blocker` (nếu có) có `code ∈ BLOCKER_CODES_BY_STATUS[emergency_return.status]`; `status == VERIFYING` ⇒ blocker khác None và `code ∉ SAFETY_REASONS`.

## 3. `TransitionRule` và bảng dòng chuyển (`engine.py`)
```python
@dataclass(frozen=True)
class TransitionRule:
    actors: frozenset[ActorRole]
    reasons: frozenset[ReasonCode] = frozenset()
    reason_required: bool = False
    pipeline_only: bool = False
    method_only: bool = False                                                   # MỚI
    reason_actors: Mapping[ReasonCode, frozenset[ActorRole]] = MappingProxyType({})  # MỚI
```
- `_apply_transition`: `allowed = rule.reason_actors.get(reason, rule.actors)`; `role not in allowed` ⇒ `InvalidTransitionError` (như dòng `role not in rule.actors` hiện tại).
- `transition()` (đường chung): `reachable` bỏ qua dòng `method_only`; dòng `method_only` xử như `pipeline_only` (không tới được). `reason_actors` KHÔNG tham gia `reachable`.

| Mã | Dòng | Loại | actors | reasons | reason_actors | method_only |
|---|---|---|---|---|---|---|
| T15 | `ROUTED→VERIFYING` | SỬA | `{DEPARTMENT}` | `{WRONG_DEPT, EMERGENCY_PENDING_BQL}` | `{EMERGENCY_PENDING_BQL: {DEPARTMENT,BPTN,BQL}}` | False |
| T16 | `IN_PROGRESS→VERIFYING` | SỬA | `{DEPARTMENT}` | `{WRONG_DEPT_AFTER_START, EMERGENCY_PENDING_BQL}` | `{EMERGENCY_PENDING_BQL: {DEPARTMENT,BPTN,BQL}}` | False |
| T17 | `VERIFYING→IN_PROGRESS` | SỬA | `{BQL}` | `{REWORK}` | — | False |
| T24 | `ON_HOLD→VERIFYING` | MỚI | `{DEPARTMENT,BPTN,BQL}` | `{EMERGENCY_PENDING_BQL}` (bắt buộc) | — | True |
| T25 | `READY_FOR_REVIEW→VERIFYING` | MỚI | `{BPTN,BQL}` | `{EMERGENCY_PENDING_BQL}` (bắt buộc) | — | True |
| T26 | `VERIFYING→ROUTED` | MỚI | `{BQL}` | `{OUT_OF_HOURS, NOT_ACCEPTED}` | — | True |
| T27 | `VERIFYING→ON_HOLD` | MỚI | `{BQL}` | `{WAITING_MATERIAL, WAITING_EMERGENCY, BLOCKED_ONSITE}` (bắt buộc) | — | True |
| T28 | `VERIFYING→READY_FOR_REVIEW` | MỚI | `{BQL}` | `{}` | — | True |
`len(TRANSITIONS)`: 30 ⇒ 35 (I-9). Hai test đang khẳng định `23 + 7` (`tests/test_maintenance/test_engine.py:134`, `test_p1_contracts.py:57`) đổi thành `28 + 7`.

## 4. Engine (`class EmergencyMixin` trong `src/maintenance/coordination/emergency.py`; thêm vào `class MaintenanceEngine(MergeMixin, SplitMixin, DepartmentMixin, NeighborMixin, EmergencyMixin)` — `engine.py:428`)
```python
def report_emergency(self, ticket_id: str, actor_id: str, *, note: str) -> Case: ...
def emergency_restore(self, ticket_id: str, actor_id: str, *, note: str) -> Case: ...
```
Thuật toán, thứ tự kiểm, lỗi: SPEC-P01 §1–§3. Hai method đều không gọi mô hình, chạy trọn trong `self.lock`.

## 5. Thông báo và audit
- `emergency.created` (chủ `BlockerOwner.BQL`) payload: `{"risk_level": "EMERGENCY", "reported_by": <actor_id>, "from_status": <status cũ>, "related_ticket_ids": [...]}`.
- `ticket.status_changed` (cư dân): do `_apply_transition` tự gửi khi đổi trạng thái; đổi blocker trong `VERIFYING` dùng `_set_blocker` (public khi mã blocker đổi).
- Audit: `Action.REPORT_EMERGENCY` field `blocker.code` cũ → `EMERGENCY_PENDING_BQL`; `Action.EMERGENCY_RESTORE` field `blocker.code` `EMERGENCY_PENDING_BQL` → mã cũ (hoặc `None`). Ghi chú cư dân KHÔNG chứa `note` nội bộ.

## 6. API (`src/api/routers/maintenance.py`, chỉ bọc engine qua `_call`)
| Route | Body | Gọi | Vai |
|---|---|---|---|
| `POST /mo/tickets/{ticket_id}/emergency/report` | `RequiredNoteBody` | `engine.report_emergency` | DEPARTMENT, BPTN, BQL (engine kiểm) |
| `POST /bql/tickets/{ticket_id}/emergency/restore` | `RequiredNoteBody` | `engine.emergency_restore` | BQL (engine kiểm) |
Mã HTTP theo ánh xạ `_call` sẵn có (404/403/409/422) — KHÔNG tự bắt lỗi trong route.

## 7. Bàn giao UI (Trí — không thi công trong hồ sơ này)
- Nút "Báo khẩn cấp" (bắt buộc lý do) ở: màn phòng ban (ticket `ROUTED`/`IN_PROGRESS`/`ON_HOLD` của phòng mình), màn BPTN và BQL (mọi trạng thái ở 01 §2 `REPORTABLE_STATUSES`, trừ `VERIFYING` với `SAFETY_REVIEW_REQUIRED` — ở đó dùng nút "Nâng khẩn cấp" E01 sẵn có).
- Màn BQL ticket khẩn cấp có `emergency_return`: hiện "Báo bởi … lúc … · trước đó: <trạng thái>"; nút "Báo nhầm — trả về <trạng thái>" gọi `restore`; ẩn nút "Hạ khẩn cấp" (T05).

## 8. Delta CR-BPTN-03 đề xuất (Trường duyệt — P1; chưa sửa `docs/CR-BPTN-03.md`)
- §4.1: thêm T24–T28 như 01 §3; T15/T16 nhận thêm lý do `EMERGENCY_PENDING_BQL` (người báo: phòng ban của ticket, BPTN, BQL); T17 nhận blocker `REWORK` khi BQL trả về.
- §4.2 sự kiện: **E03** "Báo khẩn cấp khi đã giao" (DEPARTMENT|BPTN|BQL; lý do bắt buộc; không rút lại) · **E04** "BQL trả về chỗ cũ" (chỉ ticket có `emergency_return`; không chạy lại pipeline; đặt `safety_cleared_*`, `risk_level=NONE`).
- §6.5: T05 "hạ xuống" KHÔNG áp cho ticket có `emergency_return` (dùng E04).

## 9. Lưu trữ
- Postgres: revision `0003_emergency_return` (`down_revision = "0002_p1_doc_shape"`, `upgrade/downgrade` rỗng, docstring như 0002); `HEAD_REVISION = "0003_emergency_return"` (`store/postgres.py:42`).
- Gỡ trường trước khi chạy code cũ (phá huỷ, cần người duyệt — OPERATIONS §4): `UPDATE maintops.cases SET doc = doc #- '{ticket,emergency_return}' WHERE doc->'ticket' ? 'emergency_return';`
