# SPEC-P04 — Các chốt chặn: bỏ reopen (Q03), `SET_ASSIGNEE` → `ACTION_DENIED`, rating một lần, seed CLN-004/TEC-005 (Q12)

| Trường | Giá trị |
|---|---|
| WP | WP2 (§2, §3, §5, §7 phần WP2) · WP3 (§6.1 — D13) · WP5 phần B (§4, §6.2) |
| Nguồn | CR-03 §1 (ngoài phạm vi: reopen, gán người), §2, §4.3, §4.4 (1, 2, 7, 8), §11, §12.1, §14 (`seed/.../tickets.yaml`), AC-15, AC-16; Q03, Q12 |
| Hợp đồng | [`01-CONTRACTS.md`](01-CONTRACTS.md) §1–§4, §7 (`rate`, `reopen`, `set_assignee`), §8 (`ResidentAction`) |
| File được ghi | `src/maintenance/engine.py`, `src/maintenance/models.py`, `src/maintenance/enums.py` (comment), `src/maintenance/catalog.py`, `src/maintenance/views.py`, `seed/maintenance_v1/catalog.yaml`, `seed/maintenance_v1/tickets.yaml`, `tests/test_maintenance/{test_engine,test_acceptance,test_api}.py` (sửa các test nêu ở §7) |

## 1. Vị trí code hiện tại (đo tại `e5ececf`)
| Mục | Vị trí | Hiện trạng |
|---|---|---|
| `reopen()` | `engine.py:500-502` | `transition(READY_FOR_REVIEW)` |
| hàng `(CLOSED, READY_FOR_REVIEW)` | `engine.py:150` | `_rule(Role.RESIDENT)` |
| nhánh đóng T21 đặt `reopen_until` | `engine.py:1414-1418` | `now + reopen_window_days` |
| nhánh reopen | `engine.py:1433-1438` | guard theo `reopen_until` |
| `Ticket.reopen_until` | `models.py:259` | trường |
| `SlaConfig.reopen_window_days` | `catalog.py:109`, `catalog.yaml:93` | `7` |
| `REPORT_NOT_DONE` | `views.py:24, 80-81` | action cư dân |
| `set_assignee()` | `engine.py:638-660`; `PERMISSIONS[SET_ASSIGNEE] = {DEPARTMENT}` (`engine.py:107`) | ghi `assignee_id` |
| `rate()` | `engine.py:478-498` | ghi đè `rating` không guard |
| seed CLN-004 / TEC-005 | `tickets.yaml:85-100`, `238-254` | expected đi flow thường (`ROUTED` / `ASSET_UNCLEAR`) |

## 2. Bỏ reopen (Q03, CR-03 §4.3) — WP2
1. `TRANSITIONS`: xoá hàng `(S.CLOSED, S.READY_FOR_REVIEW)` ⇒ `len == 25` (01 §3.2).
2. `_human_transition`: xoá nhánh `elif key == (S.CLOSED, S.READY_FOR_REVIEW)`; nhánh `(READY_FOR_REVIEW, CLOSED)` thành:
   ```python
   elif key == (S.READY_FOR_REVIEW, S.CLOSED):
       self._apply_transition(work, to, actor_id, role, now, note=note, closed_by=actor_id, closed_at=now,
                              closure_kind=ClosureKind.NORMAL)
   ```
3. `engine.reopen` **giữ chữ ký**, thân:
   ```python
   def reopen(self, ticket_id: str, actor_id: str, *, note: str | None = None) -> Case:
       """[BỎ] CR-BPTN-03 §4.3: không mở lại ticket đã đóng. Giữ chữ ký vì router còn gọi (Q03); luôn 409 INVALID_TRANSITION."""
       self.get(ticket_id)   # 404 trước
       raise InvalidTransitionError("Không còn mở lại ticket đã đóng (CR-BPTN-03 §4.3); cư dân tạo phản ánh mới",
                                    {"from": S.CLOSED, "to": S.READY_FOR_REVIEW, "actor_id": actor_id})
   ```
   Không ghi audit (cặp ngoài bảng = INVALID_TRANSITION, như mọi cặp khác — CR-03 §4.4.8).
4. `models.Ticket`: xoá `reopen_until`. `catalog.SlaConfig`: xoá `reopen_window_days`; `catalog.yaml`: xoá dòng `reopen_window_days: 7` (thay bằng dòng chú thích — 01 §4).
5. `views.py`: `ResidentAction = Literal["ADD_INFO", "RATE"]`; xoá khối `if ticket.reopen_until and now < ticket.reopen_until: actions.append("REPORT_NOT_DONE")`.
6. `enums.py` dòng 24: sửa comment (01 §1).
7. Endpoint `/resident/tickets/{id}/reopen` và nút `Báo chưa xong` (`app.js:551-555`) **không chạm** (Q03; chủ việc gỡ sau) — sau WP2 endpoint trả 409 `INVALID_TRANSITION`.

## 3. `SET_ASSIGNEE` → `ACTION_DENIED` (CR-03 §4.4.2, AC-15) — WP2
1. `PERMISSIONS`: xoá hàng `Action.SET_ASSIGNEE` (01 §3.1) ⇒ default deny mọi vai.
2. `engine.set_assignee` **giữ chữ ký**, thân:
   ```python
   def set_assignee(self, ticket_id: str, actor_id: str, assignee_id: str | None) -> Case:
       """CR-BPTN-03 §4.4.2: không ai gán nhân viên trong phiên bản này. Mọi vai ⇒ ACTION_DENIED có audit."""
       return self._mutate(ticket_id, actor_id, Action.SET_ASSIGNEE, lambda work, now: None,
                           roles=frozenset(), field_name="assignee_id", new_value=assignee_id,
                           reason="Gán nhân viên bị tắt (CR-BPTN-03 §4.4.2)")
   ```
   (`roles=frozenset()` như `attempt()` — `_mutate_locked` deny trước khi chạy `op`; audit `field_name="assignee_id"`, `action_result=ACTION_DENIED`, `reason` chứa `requested=SET_ASSIGNEE`.)
3. `models.Ticket.assignee_id: None = None` (01 §2) — gán trực tiếp từ test cũng `ValidationError`.
4. `views.BqlTicketRow.assignee_id` giữ (V-11), luôn `None`.

## 4. Rating một lần (CR-03 §11, AC-15) — WP5
```python
def rate(self, ticket_id: str, actor_id: str, score: int) -> Case:
    def op(work: Case, now: datetime) -> None:
        if work.ticket.status != S.CLOSED:
            raise GuardError("Chỉ đánh giá được khi ticket đã hoàn thành")
        if work.ticket.rating is not None:                                           # [MỚI]
            raise GuardError("Đã đánh giá; không sửa được đánh giá (CR-BPTN-03 §11)", {"rating": work.ticket.rating})
        # … phần còn lại giữ nguyên (ghi rating + audit RATE_TICKET, old=None) …
    return self._mutate(ticket_id, actor_id, Action.RATE_TICKET, op)
```
- Áp cho cả `CLOSED` với `closure_kind=EMERGENCY_HANDLED` (cư dân vẫn được đánh giá một lần).
- `resident_view.allowed_actions`: `RATE` chỉ khi `rating is None` (đã đúng ở code; giữ).

## 5. `closure_kind` (CR-03 §12.1) — WP2
- T21 (`close`) ⇒ `NORMAL` (§2.2). T10 (`emergency_close`) ⇒ `EMERGENCY_HANDLED` (P02 §4.5, WP4). Validator `(status == CLOSED) == (closure_kind is not None)` (01 §2).
- `cancel`: `closure_kind` giữ `None`.

## 6. Seed `seed/maintenance_v1/tickets.yaml`

### 6.1 WP3 (D13): CLN-004, TEC-005 → Bậc 1; đổi header; bump `dataset_version`
- Dòng 11–12 (chú thích "CR-BPTN-02 (v0.5 candidate)…") thay bằng: `# CR-BPTN-03 (v0.6 candidate): tầng an toàn 2b chạy trước phân loại; CLN-004/TEC-005 là Bậc 1 (EMERGENCY_PENDING_BQL). Nội dung raw giữ nguyên.`
- `dataset_version: maintenanceops-sim-v1.3` (dòng 13).
- Khối CLN-004: giữ `raw`, `flow: REGRESSION`; thay `purpose` và `expected` **nguyên văn**:
  ```yaml
      purpose: "Chất lạ + mùi hắc (S-14, CR-BPTN-03 §6.2): Bậc 1 → VERIFYING / EMERGENCY_PENDING_BQL; không phân loại, không phòng ban, không draft. [Trường rà nhãn — Q12]"
      expected:
        status: VERIFYING
        reason_code: EMERGENCY_PENDING_BQL
        risk_level: EMERGENCY
        playbook_id: null
        proposed_department_id: null
        department_id: null
        review_status: null
        asset_resolution: null
        draft_exists: false
        location: "Tòa SIM-A / Tầng B1 / Hầm xe"
  ```
- Khối TEC-005: giữ `raw`, `flow: REGRESSION`; thay `purpose` và `expected` **nguyên văn**:
  ```yaml
      purpose: "Tia lửa + mùi khét (S-01, S-02, CR-BPTN-03 §6.2): Bậc 1 → VERIFYING / EMERGENCY_PENDING_BQL; dừng trước phân loại nên không tra asset. [Trường rà nhãn — Q12]"
      expected:
        status: VERIFYING
        reason_code: EMERGENCY_PENDING_BQL
        risk_level: EMERGENCY
        playbook_id: null
        proposed_department_id: null
        department_id: null
        review_status: null
        asset_resolution: null
        draft_exists: false
        asset_lookup_status: null
        asset_id: null
  ```
- `Expected`/`observe` phải có khoá `risk_level` (01 §9) trước khi thêm — cùng WP3.
- Số đếm giữ: 12 ticket, 6/6, 4 DEMO + 8 REGRESSION (`test_dataset_shape` không đổi).

### 6.2 WP5: thêm `priority:` theo SPEC-P03 §5 (10 ticket). Không thêm cho CLN-003/CLN-004/TEC-005.

## 7. Test hiện có phải sửa (tên chính xác; không xoá test nào mà không có test thay thế)
| File::test | Sửa | WP |
|---|---|---|
| `test_engine.py::test_invariant_5_event_chain_over_every_fixture_and_scenario` | xoá 2 dòng `clock.advance(days=1)` + `fresh.reopen(tid, RESIDENT)`; giữ `assert_event_chain` | WP2 |
| `test_engine.py::test_invariant_2_agent_never_writes_assignee` | đổi tên `test_invariant_2_nobody_writes_assignee`: với mỗi actor trong `(CLN, AGENT, BPTN, BQL)`: `pytest.raises(ActionDeniedError)` khi `set_assignee(tid, actor, "NV-CLN-07")`; `audit[-1].action_result == "ACTION_DENIED"` và `audit[-1].field_name == "assignee_id"`; `ticket.assignee_id is None`; thêm `with pytest.raises(ValidationError): fresh.get(tid).ticket.assignee_id = "x"` | WP2 |
| `test_engine.py::test_transition_table_matches_the_cr` | `len(TRANSITIONS) == 18 + 7`; thêm `assert ("CLOSED", "READY_FOR_REVIEW") not in TRANSITIONS`; thêm `assert set(BLOCKER_OWNERS) == set(ReasonCode)` | WP2 |
| `test_acceptance.py::test_09_reopen_window` | thay bằng `test_09_no_reopen_and_closure_kind`: close ⇒ `closure_kind == "NORMAL"`; `fresh.reopen(tid, RESIDENT, note="Vẫn còn rác")` ⇒ `InvalidTransitionError`; status `CLOSED`; `resident_view(...).allowed_actions == ["RATE"]` | WP2 |
| `test_api.py::test_12_resident_view_hides_internal_fields` | xoá dòng `engine.get(tid).ticket.assignee_id = "NV-TEC-03"` và phần tử `"NV-TEC-03"`; giữ `"assignee_id"` trong danh sách bí mật | WP2 |
| `test_api.py::test_resident_full_journey_over_http` | `allowed_actions == ["RATE"]` sau close; `== []` sau rating | WP2 |
| `test_api.py::test_bql_filters` | tập `VERIFYING` = `{TEC-002, TEC-005, CLN-004}` | WP3 |
| mới `test_acceptance.py::test_15_rating_only_once` | rate 5 ⇒ ok; rate 4 ⇒ `GuardError`; `rating == 5`; audit `RATE_TICKET` đếm 1 | WP5 |
| mới `test_acceptance.py::test_15_emergency_closed_ticket_can_be_rated_once` | TEC-005 `emergency_close` ⇒ `rate` ok một lần | WP5 |

## 8. BẮT BUỘC / CẤM / Vùng cấm

**BẮT BUỘC**
1. Sau WP2: `python -m pytest -q` xanh toàn bộ (các test ở §7 WP2 đã sửa), `len(TRANSITIONS) == 25`.
2. `grep -rn "reopen_until\|reopen_window_days\|REPORT_NOT_DONE" src/maintenance seed tests` ⇒ 0 dòng sau WP2.
3. `reopen()`/`set_assignee()` giữ nguyên tên, tham số, kiểu trả (router import/gọi không đổi).
4. Seed đổi ở WP3 cùng commit với 2b (không để cây đỏ giữa hai commit).

**CẤM**
1. Xoá endpoint/nút reopen hoặc sửa `src/api`, `src/web` (Q01, Q03).
2. Thay `assignee_id: None` bằng validator "ép null nhưng vẫn nhận chuỗi" — phải là lỗi 422, không âm thầm bỏ giá trị.
3. Đổi `raw.original_description` của CLN-004/TEC-005 (Q12: chỉ đổi expected; nội dung raw là dữ liệu mô phỏng cố định).
4. Thêm fixture mới vào `tickets.yaml` ở P0 (giữ 12; `test_dataset_shape`); ca mới đi vào `test_safety.py`/`test_priority.py`.

**Vùng cấm**
| # | Không làm | Lý do |
|---|---|---|
| P4-01 | Không audit lần gọi `reopen()` | cặp ngoài bảng là INVALID_TRANSITION (409, không audit) đúng như mọi cặp khác; audit chỉ dành cho từ chối theo VAI |
| P4-02 | Không thêm `rating_comment`, `rated_at` | ngoài AC-15; router gửi `score` thôi (C-03) |
| P4-03 | Không cho BQL/BPTN "mở lại" bằng hủy + tạo mới tự động | CR-03 §11: cư dân tạo ticket mới; `follow_up_of` là P1 |
| P4-04 | Không giữ `reopen_window_days` trong YAML "để sau" | `SlaConfig` `extra="forbid"` sẽ ném lỗi nạp; dữ liệu chết gây hiểu nhầm |

## 9. Phân loại lỗi (riêng P04; bảng chung 00 §7)
| Tình huống | Lớp / HTTP | Audit | Caller |
|---|---|---|---|
| `reopen()` (mọi vai, mọi trạng thái) | `InvalidTransitionError` 409 | không | UI ẩn nút; hướng dẫn tạo phản ánh mới |
| `set_assignee()` (mọi vai) | `ActionDeniedError` 403 | có (`field_name=assignee_id`) | bỏ tính năng |
| gán `ticket.assignee_id = "x"` trực tiếp | `pydantic.ValidationError` | — | — |
| `rate()` lần 2 | `GuardError` 409 | không (lần 1 đã audit) | UI ẩn nút RATE |
| `rate()` khi chưa CLOSED | `GuardError` 409 (giữ) | không | — |

## 10. Số đo nghiệm thu (THẬT)
| # | Lệnh (root, venv 3.11, `LLM_MODE=mock`) | Kỳ vọng |
|---|---|---|
| G-01 | 01 §11 M-01, M-05, M-06, M-07 | `25 False` · `False [...]` · 0 dòng · `<class 'NoneType'> True True True False` |
| G-02 | `python -c "from src.maintenance.engine import MaintenanceEngine as E, InvalidTransitionError as I; e=E(); e.reset(); import tests.test_maintenance.helpers as h; t=h.report(e, h.CLEANING); h.to_ready(e, t); e.close(t, h.BQL); c=e.get(t).ticket; print(c.closure_kind)\ntry: e.reopen(t, h.RESIDENT)\nexcept I as x: print(x.code)"` (ghi thành script tạm trong scratchpad) | `NORMAL` rồi `INVALID_TRANSITION` |
| G-03 | `python -c "...e.set_assignee(t, 'SIM-ACTOR-DEPT-CLN-01', 'NV-01')..."` bắt `ActionDeniedError`, in `e.get(t).audit[-1].action_result, e.get(t).audit[-1].field_name` | `ACTION_DENIED assignee_id` |
| G-04 | rate 5 rồi rate 4 | lần 2 `GuardError`; `rating == 5` |
| G-05 | `python -c "from src.maintenance.demo import evaluate; from src.maintenance.engine import MaintenanceEngine as E; r=evaluate(E()); print(r.passed, r.demo_flows_passed, [x.ticket_id for x in r.results if not x.passed])"` | `12 4 []` (sau WP3 và sau WP5) |
| G-06 | `python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_fixtures.py` | 5 passed |
