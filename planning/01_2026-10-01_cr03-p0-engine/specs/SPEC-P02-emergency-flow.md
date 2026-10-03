# SPEC-P02 — Đường an toàn/khẩn cấp: blocker, hành động BPTN/BQL, chặn resume/job, thời hạn, outbox, nhãn

| Trường | Giá trị |
|---|---|
| WP | WP4 (🟠 worker-sonnet) — sau WP3; hằng số/bảng đã có từ WP2 (01 §1–§3) |
| Nguồn | CR-03 §2, §3.2, §4.1 (T03/T05/T06/T07/T10), §4.2 (E01, E03), §4.4 (4, 5, 6, 8), §5.2, §6.4, §6.5, §11, §13; AC-06, AC-07, AC-08, AC-09 (đóng/hạ), AC-16, AC-17 (risk ẩn); Q02, Q03, Q08, Q10 |
| File được ghi | `src/maintenance/engine.py` (chỉ §4–§6), `src/maintenance/views.py` (§9), `src/maintenance/i18n/vi.yaml` (đã thêm ở WP2 — 01 §6), `tests/test_maintenance/test_emergency.py` (mới) |

## 1. Vòng đời blocker an toàn

| Blocker | Vào bằng | Chủ | Ai gỡ, bằng gì | Thời hạn (E03) | Tự động? |
|---|---|---|---|---|---|
| `SAFETY_REVIEW_REQUIRED` (Bậc 2) | 2b UNCLEAR (T04, AGENT) | BPTN | BPTN/BQL: `safety_confirm_safe` (T05) · `safety_escalate` (E01) · `safety_request_info` (T06) | `escalate_at = since + sla.safety_review.escalate_after_hours` (4 h **lịch**) ⇒ `escalated=True` + outbox `safety.review_escalated` (BQL); status KHÔNG đổi | job chỉ leo thang; **không gỡ** |
| `EMERGENCY_PENDING_BQL` (Bậc 1) | 2b EMERGENCY (T04, AGENT) · E01 · T07 | BQL | **chỉ BQL**: `emergency_downgrade` (T05) · `emergency_close` (T10) · `cancel` (T23) | không (`escalate_at=None`; BQL được báo ngay qua `emergency.created`) | **không bao giờ** (`_cleared` False; `_due` False) |
| `MISSING_INFO` + `safety_context=True` | T06 | RESIDENT | cư dân bổ sung (`add_resident_info` → `_resume`, chạy lại 2b) · BQL: `safety_confirm_safe` (T03) · `safety_escalate` (T07) · `cancel` | `escalate_at = since + sla.missing_info.safety_context.escalate_after_hours` (12 h) ⇒ `escalated=True` + outbox `escalation` (payload `safety_context: true`); **không tự coi là an toàn** | nhắc 24 h như MISSING_INFO thường; `_cleared` đòi có addition sau `blocker.since` (§5.2) |

Bất biến I-10/I-11 (00 §3) áp cho toàn bộ bảng.

## 2. Ma trận vai × hành động (CR-03 §2, §6.4, §6.5)

| Hành động | AGENT/SYSTEM | RESIDENT | BPTN | DEPARTMENT | BQL |
|---|---|---|---|---|---|
| vào `SAFETY_REVIEW_REQUIRED`/`EMERGENCY_PENDING_BQL` (2b) | pipeline | — | — | — | — |
| `safety_confirm_safe` trên Bậc 2 | 403 | 403 | ✅ | 403 | ✅ (V-08: không cần `escalated`) |
| `safety_escalate` trên Bậc 2 (E01) | 403 | 403 | ✅ | 403 | ✅ |
| `safety_request_info` (T06) | 403 | 403 | ✅ | 403 | ✅ |
| `safety_confirm_safe` trên NEED_INFO safety (T03) | 403 | 403 | **403** | 403 | ✅ |
| `safety_escalate` trên NEED_INFO safety (T07) | 403 | 403 | **403** | 403 | ✅ |
| `emergency_downgrade` / `emergency_close` | 403 | 403 | **403 + audit** (I-11) | 403 | ✅ |
| **mọi** method ghi khi blocker ∈ `BQL_REASONS` | tuỳ method | tuỳ method | **403 + audit** | tuỳ | ✅ |
| `resume()` / `run_jobs()` gỡ blocker an toàn | **không gỡ** (no-op/chỉ leo thang) | — | — | — | — |

## 3. Tiền kiểm chung `_safety_precheck` (tên cố định)

```python
def _safety_precheck(self, ticket_id: str, actor_id: str, action: Action, *, statuses: frozenset[TicketStatus],
                     codes: frozenset[ReasonCode], note: str | None, note_required: bool,
                     require_safety_context: bool = False, bql_only_when: frozenset[TicketStatus] = frozenset()) -> Case:
    """Gọi TRONG `with self.lock`. Thứ tự: 404 → 403 (vai theo PERMISSIONS[action]; BPTN khi blocker ∈ BQL_REASONS;
    vai ≠ BQL khi status ∈ bql_only_when) → 409 INVALID (status/blocker/safety_context không khớp) → 409 GUARD (note).
    403 đi qua self._deny(case, actor_id, role, action, "blocker", <mã blocker đích hoặc None>, note, now, message=...)
    để có audit ACTION_DENIED (00 §7). Trả `case` để wrapper tiếp tục."""
```
Wrapper nào cũng theo khung: `with self.lock: self._safety_precheck(...); return self.transition(...)` hoặc `return self._mutate(...)`. `transition`/`_mutate` giữ lock lồng (RLock) và lặp lại kiểm vai — chấp nhận (rẻ, an toàn).

## 4. Năm method công khai (chữ ký ở 01 §7) và nhánh `_human_transition`

### 4.1 `safety_confirm_safe(ticket_id, actor_id, *, note)`
```python
with self.lock:
    case = self.get(ticket_id)
    if case.ticket.status == S.NEED_INFO:    # T03 — chỉ BQL
        self._safety_precheck(ticket_id, actor_id, Action.SAFETY_CONFIRM_SAFE, statuses={S.NEED_INFO}, codes={R.MISSING_INFO},
                              note=note, note_required=True, require_safety_context=True, bql_only_when={S.NEED_INFO})
        return self.transition(ticket_id, S.RECEIVED, actor_id, note=note, expected_from=S.NEED_INFO)
    self._safety_precheck(ticket_id, actor_id, Action.SAFETY_CONFIRM_SAFE, statuses={S.VERIFYING},
                          codes={R.SAFETY_REVIEW_REQUIRED}, note=note, note_required=True)   # blocker EMERGENCY ⇒ 409 GUARD "dùng emergency_downgrade"
    return self.transition(ticket_id, S.RECEIVED, actor_id, note=note, expected_from=S.VERIFYING)
```
Nhánh `_human_transition` **key `(VERIFYING, RECEIVED)`** (T05 người):
```python
elif key == (S.VERIFYING, S.RECEIVED):
    if role == Role.SYSTEM or blocker is None or blocker.code not in SAFETY_REASONS:
        raise InvalidTransitionError("VERIFYING → RECEIVED do người chỉ khi blocker là SAFETY_REVIEW_REQUIRED/EMERGENCY_PENDING_BQL")
    if _blank(note):
        raise GuardError("Xác nhận an toàn / hạ khẩn cấp bắt buộc ghi lý do")
    action = Action.EMERGENCY_DOWNGRADE if blocker.code == R.EMERGENCY_PENDING_BQL else Action.SAFETY_CONFIRM_SAFE
    self._audit(work, action, "Ticket", ticket.ticket_id, actor_id, role, "safety_cleared_by", None, actor_id, note.strip(), now=now)
    self._apply_transition(work, S.RECEIVED, actor_id, role, now, note=note, safety_cleared_by=actor_id,
                           safety_cleared_at=now, safety_clear_reason=note.strip(), risk_level=RiskLevel.NONE)
    self._run_pipeline(work, 2, now)        # 2b tự bỏ qua (P01 §5.2) → bước 2 (vị trí) → 3 …
```
(BPTN trên `EMERGENCY_PENDING_BQL` không tới được đây: `_mutate_locked` đã deny — §5.1.)

Nhánh **key `(NEED_INFO, RECEIVED)`** (T03, BQL):
```python
elif key == (S.NEED_INFO, S.RECEIVED):
    if role != Role.BQL or not ticket.safety_context:
        raise InvalidTransitionError("NEED_INFO → RECEIVED do người chỉ với BQL khi safety_context=true (T03)")
    if _blank(note):
        raise GuardError("BQL xác nhận an toàn bắt buộc ghi lý do")
    self._audit(work, Action.SAFETY_CONFIRM_SAFE, "Ticket", ticket.ticket_id, actor_id, role, "safety_cleared_by", None, actor_id, note.strip(), now=now)
    self._apply_transition(work, S.RECEIVED, actor_id, role, now, note=note, safety_cleared_by=actor_id,
                           safety_cleared_at=now, safety_clear_reason=note.strip(), risk_level=RiskLevel.NONE, safety_context=False)
    self._run_pipeline(work, 2, now)        # thường dừng lại ở MISSING_INFO 72 h (không còn safety_context) nếu vẫn thiếu vị trí
```

### 4.2 `safety_escalate(ticket_id, actor_id, *, note=None)`
```python
with self.lock:
    case = self.get(ticket_id)
    if case.ticket.status == S.NEED_INFO:    # T07 — chỉ BQL
        self._safety_precheck(ticket_id, actor_id, Action.SAFETY_ESCALATE, statuses={S.NEED_INFO}, codes={R.MISSING_INFO},
                              note=note, note_required=False, require_safety_context=True, bql_only_when={S.NEED_INFO})
        return self.transition(ticket_id, S.VERIFYING, actor_id, note=note, expected_from=S.NEED_INFO)
    self._safety_precheck(ticket_id, actor_id, Action.SAFETY_ESCALATE, statuses={S.VERIFYING}, codes={R.SAFETY_REVIEW_REQUIRED},
                          note=note, note_required=False)
    role = self._role(actor_id)

    def op(work: Case, now: datetime) -> None:      # E01: đổi chủ blocker, KHÔNG đổi status
        ticket, blocker = work.ticket, work.ticket.blocker
        if ticket.status != S.VERIFYING or blocker is None or blocker.code != R.SAFETY_REVIEW_REQUIRED:
            raise GuardError("Chỉ nâng khẩn cấp từ SAFETY_REVIEW_REQUIRED", {"status": ticket.status})
        emergency = self._new_blocker(work, R.EMERGENCY_PENDING_BQL, now, resume_step=2, note=note)
        self._audit(work, Action.SAFETY_ESCALATE, "Ticket", ticket.ticket_id, actor_id, role, "blocker.code",
                    R.SAFETY_REVIEW_REQUIRED, R.EMERGENCY_PENDING_BQL, note.strip() if not _blank(note) else "Nâng Bậc 2 thành khẩn cấp (E01)", now=now)
        self._set_blocker(work, emergency, actor_id, role, now, note=note, risk_level=RiskLevel.EMERGENCY)   # một StatusEvent public (mã đổi)
        self._notify(work, "emergency.created", BlockerOwner.BQL, now,
                     {"risk_level": RiskLevel.EMERGENCY, "escalated_by": actor_id, "from": R.SAFETY_REVIEW_REQUIRED})

    return self._mutate(ticket_id, actor_id, Action.SAFETY_ESCALATE, op)
```
Nhánh **key `(NEED_INFO, VERIFYING)`** (T07, BQL):
```python
elif key == (S.NEED_INFO, S.VERIFYING):
    if role != Role.BQL or not ticket.safety_context or blocker is None or blocker.code != R.MISSING_INFO:
        raise InvalidTransitionError("NEED_INFO → VERIFYING chỉ với BQL khi safety_context=true (T07)")
    emergency = self._new_blocker(work, R.EMERGENCY_PENDING_BQL, now, resume_step=2, note=note)
    self._audit(work, Action.SAFETY_ESCALATE, "Ticket", ticket.ticket_id, actor_id, role, "blocker.code", R.MISSING_INFO, R.EMERGENCY_PENDING_BQL,
                note.strip() if not _blank(note) else "Cư dân không trả lời; BQL nâng khẩn cấp (T07)", now=now)
    self._apply_transition(work, S.VERIFYING, actor_id, role, now, blocker=emergency, note=note,
                           risk_level=RiskLevel.EMERGENCY, safety_context=False)
    self._notify(work, "emergency.created", BlockerOwner.BQL, now, {"risk_level": RiskLevel.EMERGENCY, "escalated_by": actor_id, "from": R.MISSING_INFO})
```

### 4.3 `safety_request_info(ticket_id, actor_id, *, note)` — T06
```python
with self.lock:
    self._safety_precheck(ticket_id, actor_id, Action.SAFETY_REQUEST_INFO, statuses={S.VERIFYING}, codes={R.SAFETY_REVIEW_REQUIRED},
                          note=note, note_required=True)
    return self.transition(ticket_id, S.NEED_INFO, actor_id, note=note, expected_from=S.VERIFYING)
```
Nhánh **key `(VERIFYING, NEED_INFO)`**:
```python
elif key == (S.VERIFYING, S.NEED_INFO):
    if blocker is None or blocker.code != R.SAFETY_REVIEW_REQUIRED:
        raise InvalidTransitionError("VERIFYING → NEED_INFO chỉ từ SAFETY_REVIEW_REQUIRED ở P0 (T06)")
    if _blank(note):
        raise GuardError("Yêu cầu cư dân bổ sung bắt buộc ghi lý do")
    missing = [f for f in self._missing_fields(work) if f.startswith("location")]
    ask = self._new_blocker(work, R.MISSING_INFO, now, resume_step=2, fields=["safety_details", *missing], note=note, safety_context=True)
    self._audit(work, Action.SAFETY_REQUEST_INFO, "Ticket", ticket.ticket_id, actor_id, role, "blocker.code",
                R.SAFETY_REVIEW_REQUIRED, R.MISSING_INFO, note.strip(), now=now)
    self._apply_transition(work, S.NEED_INFO, actor_id, role, now, blocker=ask, note=note, safety_context=True)
```
`public_message` của blocker = `reason_messages.MISSING_INFO` với `fields` = `field_labels.safety_details` (+ phần vị trí) — cư dân chỉ thấy lời xin mô tả rõ hơn, không thấy mã rủi ro.

### 4.4 `emergency_downgrade(ticket_id, actor_id, *, note)` — T05 (BQL)
```python
with self.lock:
    self._safety_precheck(ticket_id, actor_id, Action.EMERGENCY_DOWNGRADE, statuses={S.VERIFYING}, codes={R.EMERGENCY_PENDING_BQL},
                          note=note, note_required=True)
    return self.transition(ticket_id, S.RECEIVED, actor_id, note=note, expected_from=S.VERIFYING)   # nhánh 4.1 (action = EMERGENCY_DOWNGRADE)
```

### 4.5 `emergency_close(ticket_id, actor_id, *, note)` — T10 (BQL)
```python
with self.lock:
    self._safety_precheck(ticket_id, actor_id, Action.EMERGENCY_CLOSE, statuses={S.VERIFYING}, codes={R.EMERGENCY_PENDING_BQL},
                          note=note, note_required=True)
    return self.transition(ticket_id, S.CLOSED, actor_id, note=note, expected_from=S.VERIFYING)
```
Nhánh **key `(VERIFYING, CLOSED)`**:
```python
elif key == (S.VERIFYING, S.CLOSED):
    if blocker is None or blocker.code != R.EMERGENCY_PENDING_BQL:
        raise InvalidTransitionError("Chỉ đóng từ VERIFYING khi ticket khẩn cấp (T10)")
    if _blank(note):
        raise GuardError("Đóng khẩn cấp bắt buộc ghi kết quả xử lý")
    self._audit(work, Action.EMERGENCY_CLOSE, "Ticket", ticket.ticket_id, actor_id, role, "closure_kind", None, ClosureKind.EMERGENCY_HANDLED, note.strip(), now=now)
    self._apply_transition(work, S.CLOSED, actor_id, role, now, note=note, closed_by=actor_id, closed_at=now,
                           closure_kind=ClosureKind.EMERGENCY_HANDLED)      # blocker=None mặc định; department_id vẫn None (01 §2 validator)
```
Nhánh **key `(READY_FOR_REVIEW, CLOSED)`** (T21) sửa thành: `self._apply_transition(work, to, actor_id, role, now, note=note, closed_by=actor_id, closed_at=now, closure_kind=ClosureKind.NORMAL)` (bỏ `reopen_until` — SPEC-P04 §5).

## 5. Chặn resume()/job và các điểm sửa trong engine

### 5.1 `_mutate_locked` — I-11 (sau `_scope_error`)
```python
blocker = case.ticket.blocker
if role == Role.BPTN and blocker is not None and blocker.code in BQL_REASONS:
    self._deny(case, actor_id, role, action, field_name, new_value, reason, now,
               message=f"Blocker {blocker.code} thuộc BQL; BPTN không được tác động (CR-03 §4.4.5)")
```
Áp cho MỌI method đi qua `_mutate` (kể cả `transition`, `bptn_resolve`, `set_priority`, `attempt`). Kết quả: `ActionDeniedError` + `AuditEvent(action_result=ACTION_DENIED, reason="… (requested=<action>)")`, status không đổi.

### 5.2 `_cleared`
```python
def _cleared(self, work, blocker, now) -> bool:
    code = blocker.code
    if code in SAFETY_REASONS:
        return False                                   # I-10: chỉ người gỡ qua §4
    if code == R.MISSING_INFO:
        if work.ticket.safety_context and not any(a.submitted_at > blocker.since for a in work.additions):
            return False                               # chưa có bổ sung sau khi hỏi: job KHÔNG được tự gỡ (AC-08)
        return not self._missing_fields(work)
    # … giữ nguyên các nhánh còn lại …
```
Lý do nhánh MISSING_INFO: với T06 trên ticket đã có vị trí, `_missing_fields` rỗng ngay ⇒ không có dòng này job nhắc 24 h sẽ tự "gỡ" mà cư dân chưa trả lời.

### 5.3 `_resume` và `_new_blocker`
- `_resume`: `self._apply_transition(work, S.RECEIVED, SYSTEM_ID, Role.SYSTEM, now, note=f"Gỡ {code}", safety_context=False)` (reset cờ khi cư dân bổ sung); `resume_step` cho `MISSING_INFO` giữ 2 ⇒ 2b chạy lại trên nội dung mới (AC-08).
- `_new_blocker(self, work, code, now, *, resume_step=None, note=None, eta=None, related_ticket_id=None, fields=None, safety_context: bool = False)`: nhánh MISSING_INFO: `hours = sla.missing_info.safety_context.escalate_after_hours if safety_context else sla.missing_info.escalate_after_hours`. Nhánh SAFETY_REASONS: P01 §5.5.
- `_schedule`: `SAFETY_REASONS → None`.

### 5.4 Job (`run_jobs` → `_due` → `_tick` → `_escalate`) — không sửa luồng, chỉ:
- `_escalate`: `kind = "safety.review_escalated" if blocker.code == R.SAFETY_REVIEW_REQUIRED else "escalation"`; payload thêm `"safety_context": work.ticket.safety_context`.
- Kết quả bắt buộc: ticket `EMERGENCY_PENDING_BQL` không bao giờ `_due` (không có `next_retry_at`/`escalate_at`); ticket `SAFETY_REVIEW_REQUIRED` `_due` đúng một lần (lúc `escalate_at`) ⇒ `escalated=True`, status giữ `VERIFYING`, blocker giữ nguyên mã.

### 5.5 `bptn_resolve` — không sửa: blocker an toàn ∉ `BPTN_REASONS` ⇒ `GuardError("Không có blocker nào chờ BPTN")` (409). Ghi test.

## 6. Thời hạn (Q10; đọc từ `sla_config`, không hardcode)
| Blocker | Mốc | Cách tính | Khi chạm | Không được |
|---|---|---|---|---|
| `SAFETY_REVIEW_REQUIRED` | `escalate_at` | `since + 4 h` **lịch** (`timedelta`), KHÔNG `business_hours.add` | `escalated=True`, outbox `safety.review_escalated` → BQL; BQL làm 3 lựa chọn (§4.1–4.3) | đổi status; gỡ blocker |
| `MISSING_INFO` + `safety_context` | `escalate_at` | `since + 12 h` | `escalated=True`, outbox `escalation` (`safety_context: true`) → BQL; BQL: T07 / T03 / T23 | tự coi là an toàn; `_cleared` True khi chưa có addition |
| `MISSING_INFO` thường | — | 72 h (giữ) | giữ | — |
| `EMERGENCY_PENDING_BQL` | — | không có mốc | — | — |

## 7. Bảng chạy lại sau khi gỡ (CR-03 §5.2 sau thiết kế — D2)
| Blocker được gỡ | Bởi | Chạy lại từ | Ghi chú |
|---|---|---|---|
| `MISSING_INFO` (cư dân bổ sung) | `_resume` | 2 (2b + 2) | 2b chạy trên **toàn bộ** nội dung nếu chưa từng cleared, trên phần mới nếu đã cleared |
| `MISSING_INFO` safety (BQL T03) | nhánh 4.1 | 2 | 2b bỏ qua (cleared); thường dừng lại MISSING_INFO 72 h nếu vẫn thiếu vị trí |
| `SAFETY_REVIEW_REQUIRED` (T05) | nhánh 4.1 | 2 | 2b bỏ qua ⇒ hiệu quả = "bước 3, bỏ qua 2b" của CR-03 + bảo đảm vị trí |
| `EMERGENCY_PENDING_BQL` (T05 hạ) | nhánh 4.1 | 2 | như trên; `related_ticket_ids` giữ nguyên (không xoá) |
| `EMERGENCY_PENDING_BQL` (T10 đóng) | 4.5 | — | kết thúc |
| `CATEGORY_UNCLEAR`/`OUT_OF_SCOPE`/`DUPLICATE`/`PENDING_REVIEW`/`ASSET_UNCLEAR`/`WRONG_DEPT`/`WAITING_MATERIAL` | giữ | 4 / 5 / 6 / 6 / 6-7 / 6 | không đổi; 2b không chạy lại (P1-04) |

## 8. Outbox (`Notification`) mới
| type | audience | Khi | payload (khoá bắt buộc) |
|---|---|---|---|
| `emergency.created` | `BQL` | 2b EMERGENCY; E01; T07 | `risk_level: "EMERGENCY"`, `signal_ids: [...]` (2b) hoặc `from: <mã blocker trước>` + `escalated_by` (E01/T07), `related_ticket_ids` (2b) |
| `safety.review_escalated` | `BQL` | `_escalate` trên `SAFETY_REVIEW_REQUIRED` | `reason_code`, `why`, `safety_context: false` |
| `escalation` (giữ) | `BQL` | `MISSING_INFO` safety quá 12 h | `reason_code: MISSING_INFO`, `safety_context: true`, `why` |
`ticket.status_changed` (cư dân) vẫn phát ở mọi `_apply_transition` như cũ (kể cả T04 an toàn — lời từ i18n).

## 9. Hiển thị (views.py, i18n) — phần P0 của CR-03 §13
- `resident_view`: `status_label = _templates()["safety_status_label"]` ("Đang được kiểm tra") khi `ticket.blocker and ticket.blocker.code in SAFETY_REASONS`; `public_message` = `blocker.public_message` (= `reason_messages.SAFETY_REVIEW_REQUIRED/EMERGENCY_PENDING_BQL` = "Phản ánh đang được kiểm tra."). Timeline giữ nhãn theo status (`VERIFYING` → "Đang xác minh"). `allowed_actions`: không có gì khi VERIFYING; `ADD_INFO` khi NEED_INFO (kể cả safety_context); `RATE` khi CLOSED (kể cả `EMERGENCY_HANDLED`) và `rating is None`.
- `ResidentTicketView` **không thêm trường**. Test AC-17: `json.dumps(view)` không chứa bất kỳ chuỗi nào trong `{"EMERGENCY", "SAFETY", "risk", "S-0", "T2-", "khẩn cấp", "nguy hiểm", "priority", "HIGH", "reason_code", "internal_note"}`.
- `bql_rows`: thêm `risk_level`, `priority`, `priority_source`, `blocker_owner_role`, `safety_cleared_by`, `closure_kind`; bộ lọc `risk_level`/`priority`/`blocker_owner_role` (01 §8). Hộp "cần tôi xử lý" của BQL = `blocker_owner_role == BQL`; của BPTN = `BPTN` (router/UI dùng sau).

## 10. BẮT BUỘC / CẤM / Vùng cấm

**BẮT BUỘC**
1. Mỗi hành động người = **một** `StatusEvent` (T03/T05/T06/T07/T10) hoặc một `_set_blocker` event (E01) + **một** `AuditEvent` mang action ngữ nghĩa (`SAFETY_CONFIRM_SAFE`/`SAFETY_ESCALATE`/`SAFETY_REQUEST_INFO`/`EMERGENCY_DOWNGRADE`/`EMERGENCY_CLOSE`), `reason` = note của người.
2. Lý do bắt buộc (`GuardError` khi trống) ở T03, T05 (cả hai bậc), T06, T10. E01/T07: tuỳ chọn (CR-03 không đánh dấu `*`).
3. Sau T05/T03 pipeline chạy lại NGAY trong cùng `_mutate` (như `_resume` làm) — không để ticket nằm ở `RECEIVED` chờ job.
4. `safety_cleared_*` ghi đè mỗi lần xác nhận (giữ bản mới nhất); lịch sử nằm trong audit.
5. Mọi wrapper gọi `self.get(ticket_id)` trước (404 trước 403).

**CẤM**
1. Để `_resume`/`_tick`/`receive_stock`/`bptn_resolve` chạm blocker an toàn.
2. Cho BPTN đi qua nhánh T03/T07 (chỉ BQL) — kiểm bằng `rule.actors` của `TRANSITIONS` (01 §3.2) + `bql_only_when`.
3. Tạo `WorkOrderDraft`/`proposed_department_id` cho ticket đang `EMERGENCY_PENDING_BQL`.
4. Gửi `emergency.created` cho audience khác BQL; nhắc cư dân về rủi ro.
5. Hạ `risk_level` ở bất kỳ chỗ nào ngoài nhánh 4.1 (xác nhận an toàn/hạ khẩn cấp có lý do).

**Vùng cấm**
| # | Không làm | Lý do |
|---|---|---|
| P2-01 | Không gộp `safety_confirm_safe` và `emergency_downgrade` thành một method | Q02: router/UI cần hai nút khác tên, hai audit khác action; cùng nhánh `_human_transition` là đủ |
| P2-02 | Không thêm method "rút lại nâng khẩn cấp" cho BPTN | CR-03 §6.4: "BPTN không rút lại"; BQL hạ bằng `emergency_downgrade` |
| P2-03 | Không cho T06 từ blocker khác `SAFETY_REVIEW_REQUIRED` | ngoài P0; mở sau khi có AC riêng |
| P2-04 | Không xoá `related_ticket_ids` khi hạ khẩn cấp | thông tin liên kết vẫn đúng; BQL/P1 dùng cho gộp |
| P2-05 | Không tạo `Notification` kiểu `emergency.closed` | §13 không liệt kê; `ticket.status_changed` đã phát |
| P2-06 | Không chặn `cancel` (T23) trên ticket khẩn cấp | CR-03 §6.5 cho BQL hủy; đã có `cancel_reason` bắt buộc |

## 11. Phân loại lỗi (riêng P02; bảng chung 00 §7)
| Tình huống | Lớp / HTTP | Audit | Caller |
|---|---|---|---|
| BPTN gọi bất kỳ method ghi trên ticket `EMERGENCY_PENDING_BQL` | `ActionDeniedError` 403 | có | ẩn nút; không retry |
| BPTN gọi `safety_confirm_safe`/`safety_escalate` khi ticket `NEED_INFO` safety | 403 | có | chỉ BQL |
| BQL gọi `safety_confirm_safe` trên ticket Bậc 1 | `GuardError` 409 ("dùng emergency_downgrade") | không | đổi method |
| `emergency_close` không có note | `GuardError` 409 | không | nhập kết quả xử lý |
| `transition(tid, "CLOSED")` từ `VERIFYING` khi blocker ≠ EMERGENCY | `InvalidTransitionError` 409 | không | tải lại ticket |
| `transition(tid, "RECEIVED")` bởi SYSTEM actor qua API | `InvalidTransitionError` 409 | không | không dùng SYSTEM từ ngoài |
| `resume()` (QA) trên ticket an toàn | 200, **không đổi gì** (idempotent) | không | — |
| `bptn_resolve` trên blocker an toàn | `GuardError` 409 | không | dùng method an toàn |

## 12. Số đo nghiệm thu (THẬT — kịch bản để `test_emergency.py` mã hoá; mọi mốc tính từ `MONDAY_9AM` của `helpers.Clock`)
| # | Kịch bản | Kỳ vọng máy đo |
|---|---|---|
| E-01 | `receive("Hình như có mùi khét ở hành lang tầng 3 tòa SIM-A.")` → `safety_confirm_safe(BPTN, note="Đã gọi cư dân, chỉ là mùi sơn")` | nội dung không khớp playbook đèn (không có "đèn/bóng đèn") ⇒ sau khi gỡ, bước 3 dừng `VERIFYING/OUT_OF_SCOPE`. Đo: `[e.to_status for e in events][-3:] == ["VERIFYING", "RECEIVED", "VERIFYING"]`, `blocker.code == OUT_OF_SCOPE`, `risk_level == NONE`, `safety_cleared_by == BPTN`, audit chứa `SAFETY_CONFIRM_SAFE`, `ASSESS_SAFETY` đúng **1** lần (2b không chạy lại) |
| E-02 | như E-01 với `"Hình như có mùi khét, đèn hành lang tầng 3 tòa SIM-A không sáng."` → confirm safe | `status == ROUTED`, `department_id == DEPT_TECHNICAL`, `priority == HIGH` (PRI-H1), `risk_level == NONE` |
| E-03 | E-02 nhưng `safety_confirm_safe(BPTN, note="  ")` | `GuardError`; status vẫn `VERIFYING/SAFETY_REVIEW_REQUIRED` |
| E-04 | Bậc 2 → `safety_escalate(BPTN)` | status `VERIFYING`, `blocker.code == EMERGENCY_PENDING_BQL`, `blocker.owner_role == BQL`, `risk_level == EMERGENCY`, `len(events)` tăng đúng 1, có `emergency.created` audience BQL; sau đó `safety_confirm_safe(BPTN, note="x")` ⇒ `ActionDeniedError`, `audit[-1].action_result == ACTION_DENIED` |
| E-05 | Bậc 2 → `safety_request_info(BPTN, note="Hỏi rõ mùi")` | `NEED_INFO/MISSING_INFO`, `safety_context is True`, `blocker.escalate_at == now + 12h`, `public_message` bắt đầu `"Vui lòng bổ sung: mô tả rõ hơn"`; `run_jobs(now + 13h)` ⇒ `escalated is True`, status vẫn `NEED_INFO`, notification cuối `type == "escalation"`, `payload["safety_context"] is True`; `resume(tid)` ⇒ không đổi |
| E-06 | E-05 → `add_resident_info(RESIDENT, "Vẫn còn mùi khét rõ, rất nồng")` | 2b chạy lại (`ASSESS_SAFETY` ×2) ⇒ `VERIFYING/EMERGENCY_PENDING_BQL` (S-01 PRESENT), `safety_context is False` |
| E-07 | E-05 → `safety_escalate(BQL)` (T07) | `VERIFYING/EMERGENCY_PENDING_BQL`; `safety_escalate(BPTN)` trước đó ⇒ `ActionDeniedError` |
| E-08 | E-05 → `safety_confirm_safe(BQL, note="Gọi cư dân, an toàn")` (T03) | → `RECEIVED` → pipeline: với E-02 text ⇒ `ROUTED`; `safety_cleared_by == BQL` |
| E-09 | Bậc 2, `run_jobs(now + 4h)` | `escalated is True`, notification cuối `type == "safety.review_escalated"`, status `VERIFYING`, blocker `SAFETY_REVIEW_REQUIRED`; `run_jobs(now + 3h59m)` ⇒ `[]` |
| E-10 | fixture `SIM-TKT-TEC-005`: `resume(tid)` ×3, `run_jobs(now + 30 ngày)` | status/blocker không đổi, `len(events)` không đổi; `run_jobs` trả list không chứa tid |
| E-11 | TEC-005 → `emergency_close(BQL, note="Đã cắt điện hộp đèn, kỹ thuật xử lý tại chỗ")` | `CLOSED`, `closure_kind == EMERGENCY_HANDLED`, `department_id is None`, `blocker is None`, `closed_by == BQL`; `emergency_close(BQL, note="")` trước đó ⇒ `GuardError`; resident view: `status_label == "Hoàn thành"`, `allowed_actions == ["RATE"]` |
| E-12 | TEC-005 → `emergency_downgrade(BQL, note="Báo nhầm: khét từ bếp căn hộ")` | → pipeline: `VERIFYING/ASSET_UNCLEAR` (hai asset cùng vị trí như trước CR-03), `risk_level == NONE`, `safety_cleared_by == BQL`, `related_ticket_ids` giữ |
| E-13 | TEC-005 → `emergency_downgrade(BPTN, note="x")` / `emergency_close(BPTN, …)` / `bptn_resolve(BPTN)` / `set_priority(BPTN, HIGH, note="x")` | lần lượt 403+audit / 403+audit / `GuardError` 409 / 403+audit; status không đổi |
| E-14 | Cặp ngoài bảng qua `transition`: BQL `(ROUTED→CLOSED)`, BQL `(VERIFYING→CLOSED)` khi blocker `ASSET_UNCLEAR`, BQL `(NEED_INFO→VERIFYING)` khi `safety_context=False`, RESIDENT `(CLOSED→READY_FOR_REVIEW)` | 409 `INVALID_TRANSITION` cho 3 ca đầu; ca cuối 403 (`reachable` rỗng) + audit |
| E-15 | resident view của TEC-005 (fixture) | `status_label == "Đang được kiểm tra"`, `public_message == "Phản ánh đang được kiểm tra."`, `department_name is None`, chuỗi cấm §9 không xuất hiện |
