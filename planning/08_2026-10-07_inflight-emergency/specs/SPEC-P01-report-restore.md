# SPEC-P01 — Báo khẩn cấp (E03), trả về chỗ cũ (E04), đổi các method cũ

| Mục | Giá trị |
|---|---|
| Gói | WP1 (🟠) engine · WP2 (🟢) route theo 01 §6 |
| Contract | 01 §1–§5, §9 |
| Bất biến | 00 §4 I-1…I-9 |

## 1. `report_emergency(ticket_id, actor_id, *, note) -> Case` (E03)
### 1.1 Bảng nguồn (ai báo được ở đâu)
| Trạng thái | Blocker lúc báo | DEPARTMENT (của ticket) | BPTN | BQL | Cách đổi |
|---|---|---|---|---|---|
| `ROUTED` | None / `OUT_OF_HOURS` / `NOT_ACCEPTED` | ✅ | ✅ | ✅ | T15 qua `_apply_transition` |
| `IN_PROGRESS` | None / `REWORK` | ✅ | ✅ | ✅ | T16 |
| `ON_HOLD` | `BLOCKED_ONSITE` / `WAITING_MATERIAL` / `WAITING_EMERGENCY` | ✅ | ✅ | ✅ | T24 |
| `READY_FOR_REVIEW` | None | 403 | ✅ | ✅ | T25 |
| `VERIFYING` | mã thuộc `BPTN_REASONS` | 403 | ✅ | ✅ | `_set_blocker` (giữ `VERIFYING`) |
| `VERIFYING` | `WRONG_DEPT_AFTER_START` | 403 | 403 (I-11) | ✅ | `_set_blocker` |
| `VERIFYING` | `SAFETY_REVIEW_REQUIRED` | — | — | — | 409 "dùng safety_escalate (E01)" |
| `VERIFYING` | `EMERGENCY_PENDING_BQL` | — | — | — | 409 "đã khẩn cấp" |
| `RECEIVED`, `NEED_INFO`, `MERGED`, `CLOSED`, `CANCELLED` | bất kỳ | — | — | — | 409 |
Phòng ban ở `ON_HOLD` trước khi giao (`department_id is None`) ⇒ `_scope_error` ⇒ 403.

### 1.2 Thứ tự kiểm (dưới `self.lock`, trước khi ghi — như `_safety_precheck`)
1. ticket không tồn tại ⇒ 404 (`self.get`).
2. vai ∉ `PERMISSIONS[REPORT_EMERGENCY]` ⇒ `_deny` 403.
3. `_scope_error(case, actor_id, role)` ⇒ `_deny` 403.
4. DEPARTMENT và trạng thái ∉ {`ROUTED`,`IN_PROGRESS`,`ON_HOLD`} ⇒ `_deny` 403; BPTN và blocker ∈ `BQL_REASONS` ⇒ `_deny` 403.
5. (trạng thái, blocker) không phải dòng ✅ của §1.1 ⇒ `InvalidTransitionError` 409 (thông điệp nêu trạng thái/blocker; ca `SAFETY_REVIEW_REQUIRED` nêu E01).
6. `note` rỗng/chỉ khoảng trắng ⇒ `GuardError`; dài > 500 ⇒ `GuardError`.

### 1.3 Ghi (một `_mutate(ticket_id, actor_id, Action.REPORT_EMERGENCY, op)`)
1. `ret = EmergencyReturn(status=t.status, blocker=t.blocker, reported_by=actor_id, reported_role=role, reported_at=now, note=note.strip())` — `blocker` là bản sao đầy đủ (model frozen/deep copy của `_mutate`).
2. `em = self._new_blocker(work, R.EMERGENCY_PENDING_BQL, now, resume_step=2, note=note)` (cùng tham số E01, `engine.py:1127`).
3. `t.status != VERIFYING` ⇒ `self._apply_transition(work, S.VERIFYING, actor_id, role, now, blocker=em, note=note, risk_level=RiskLevel.EMERGENCY, emergency_return=ret)`; ngược lại ⇒ `self._set_blocker(work, em, actor_id, role, now, note=note, risk_level=RiskLevel.EMERGENCY, emergency_return=ret)`.
4. `ticket.related_ticket_ids = self._related_ticket_ids(work)` rồi `self._link_emergency_both_ways(work, list(ticket.related_ticket_ids), now)` (y như 2b, `engine.py:3160-3169`).
5. `self._notify(work, "emergency.created", BlockerOwner.BQL, now, payload 01 §5)`; `self._audit(... Action.REPORT_EMERGENCY ...)` theo 01 §5.
- KHÔNG đụng trường liệt kê ở I-4. KHÔNG thêm `RiskSignal`.

## 2. `emergency_restore(ticket_id, actor_id, *, note) -> Case` (E04)
### 2.1 Thứ tự kiểm
1. 404 · 2. vai ≠ BQL ⇒ `_deny` 403 · 3. không phải (`VERIFYING` + `EMERGENCY_PENDING_BQL` + `emergency_return is not None`) ⇒ 409 (khẩn cấp do 2b ⇒ thông điệp "dùng emergency_downgrade") · 4. `note` rỗng/>500 ⇒ `GuardError`.
### 2.2 Ghi (một `_mutate`, `Action.EMERGENCY_RESTORE`)
1. `ret = t.emergency_return`; `changes = dict(risk_level=RiskLevel.NONE, safety_cleared_by=actor_id, safety_cleared_at=now, safety_clear_reason=note.strip(), emergency_return=None)`.
2. `ret.status == VERIFYING` ⇒ `self._set_blocker(work, ret.blocker, actor_id, role, now, note=note, **changes)`.
3. `ret.status == ROUTED` ⇒ `self._apply_transition(work, S.ROUTED, …, blocker=ret.blocker, note=note, department_id=t.department_id, **changes)` (T26; kiểm `route_blockers` sẵn có — fail ⇒ 409, không ghi gì).
4. trạng thái khác ⇒ `self._apply_transition(work, ret.status, …, blocker=ret.blocker, note=note, **changes)` (T17/T27/T28).
5. `self._release_waiting_for(work, now)` (như T10, `engine.py:2607`); audit theo 01 §5.
- KHÔNG `_run_pipeline`, KHÔNG gọi mô hình, KHÔNG dời `eta`/`escalate_at`/`next_retry_at` của blocker cũ (đã quá hạn ⇒ `run_jobs` xử như ca quá hạn bình thường).

## 3. Đổi method cũ
| Method | Đổi | Lý do |
|---|---|---|
| `emergency_downgrade` (T05) | `emergency_return is not None` ⇒ 409 "dùng emergency_restore" — kiểm cả trong `gate` lẫn `_emergency_downgrade` | T05 chạy lại pipeline (Q04) |
| `emergency_close` (T10) | Không đổi; `emergency_return` GIỮ làm vết | — |
| hủy (BQL) | Không đổi; `emergency_return` GIỮ | — |
| `bql_merge` / T08 | ticket có `emergency_return` ⇒ 409 | Gộp ticket đang làm mất dữ liệu thực hiện |
| `transition()` chung | dòng `method_only` không tới được; `reason_actors` không vào `reachable` | I-8 |

## 4. Bảng lỗi → hành vi bắt buộc của caller
| Lỗi | HTTP | Ghi gì | Caller phải |
|---|---|---|---|
| Không có ticket | 404 | — | báo "không tìm thấy" |
| Vai/phạm vi sai | 403 | audit `ACTION_DENIED` (I-7) | ẩn nút; không retry |
| Trạng thái/blocker không áp dụng | 409 | — | tải lại ticket; dùng hành động thông điệp nêu (E01/T05/T10) |
| Lý do rỗng/quá dài | 409 GUARD (ánh xạ `_call` hiện có) | — | yêu cầu nhập lý do |
| Audit/notify sink lỗi | 500 `AuditWriteError` | rollback toàn bộ | retry nguyên thao tác |

## 5. Vùng cấm (đã cân nhắc, KHÔNG làm)
- CẤM restore bằng T05 + `_run_pipeline`: phân loại/đặt vật tư/giao lần hai, mất `accepted_at`.
- CẤM thao tác "rút lại báo khẩn" cho người báo; CẤM DEPARTMENT/BPTN gỡ `EMERGENCY_PENDING_BQL` (I-1).
- CẤM thêm vai vào `actors` của T15/T16 thay cho `reason_actors`: BPTN/BQL sẽ gọi được T15/T16 (sai phòng ban) qua `transition()`.
- CẤM tạo `RiskSignal` cho báo khẩn của người (S-xx thuộc luật/Agent; lý do nằm ở `note` + audit).
- CẤM đổi tồn kho khi đóng ticket báo khẩn (P4).
- CẤM sửa `safety.py`, `lexicon.yaml`, `agent/**` (Q07).
