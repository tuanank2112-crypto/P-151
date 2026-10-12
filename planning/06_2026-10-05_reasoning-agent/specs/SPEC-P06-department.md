# SPEC-P06 (P1-D) — Điều phối phòng ban: T15 đếm + leo thang lần 2, T16 báo sai sau khi nhận, T17 BQL giữ, E02 BQL chuyển về BPTN

| Trường | Giá trị |
|---|---|
| WP | WP9 (🟠) — Wave 4 sau WP6; song song WP7/WP8/WP10 |
| Nguồn | CR §2 (dòng Phòng ban, BQL), §3.2 (`WRONG_DEPT_AFTER_START` chủ BQL), §4.1 T15/T16/T17, §4.2 E02/E03, §4.4.5, §9.2, §9.3, §12.2 (`wrong_dept_return.escalate_at_count = 2` đã chốt), AC-13 |
| File được ghi | `src/maintenance/coordination/department.py` (thân `_t15_return_wrong_department`, `_t16_report_wrong_department`, `_t17_keep_department`, `bql_wrong_department`, `_carry_over_material_qty`, helper `_take_execution_snapshot`), `tests/test_maintenance/test_p1_department.py` (mới) |
| CẤM chạm | `engine.py` (WP5 đã đặt chỗ gọi + chuyển thân T15 vào hook), `agent/**`, `src/api/**`, `src/web/**` |
| Agent | KHÔNG tham gia quyết định ở đây (luồng người). Sau E02, BPTN chọn lại loại việc/phòng ban ⇒ khoá đổi ⇒ quyết định Agent mới tính NGOÀI khoá (P02 §5) rồi chạy từ bước 6/7 |

## 1. Vòng đời
| Sự kiện | Actor | Từ → đến | Blocker sau | Hiệu lực |
|---|---|---|---|---|
| T15 trả sai phòng ban (chưa nhận) | DEPARTMENT đang được giao | ROUTED → VERIFYING | `WRONG_DEPT` (BPTN, `resume_step=6`) | như hiện tại + `wrong_department_return_count += 1`; đạt ngưỡng ⇒ E03 |
| T16 báo cần BQL xem (đã nhận) | DEPARTMENT đang giữ | IN_PROGRESS → VERIFYING | `WRONG_DEPT_AFTER_START` (BQL) | GIỮ `department_id`, `accepted_at`, checklist, vật tư, bằng chứng; báo BQL |
| T17 BQL giữ phòng ban | BQL | VERIFYING → IN_PROGRESS | không | phòng ban làm tiếp; dữ liệu giữ nguyên |
| E02 BQL chuyển về BPTN | BQL | VERIFYING (giữ) | `WRONG_DEPT` (BPTN, `resume_step=6`) | chụp `ExecutionSnapshot`; `department_id=None`, `dispatched_at=None`, `accepted_at=None`; checklist về `PENDING`; mở vòng bằng chứng mới |

## 2. T15 — `_t15_return_wrong_department(self, work, actor_id, role, now, *, note) -> None`
- Giữ NGUYÊN thân hiện tại (WP5 đã chuyển vào hook): `note` rỗng ⇒ `GuardError("Trả lại sai phòng ban phải có lý do")`; blocker `WRONG_DEPT` `resume_step=6`; `_apply_transition(…, department_id=None, dispatched_at=None)`.
- THÊM (WP9): `count = ticket.wrong_department_return_count + 1` truyền vào `_apply_transition(…, wrong_department_return_count=count)`; `count >= self.catalog.sla_config.wrong_dept_return.escalate_at_count` ⇒ sau chuyển: `work.ticket.blocker.escalated = True` và `self._notify(work, "escalation", BlockerOwner.BQL, now, {"reason_code": R.WRONG_DEPT, "wrong_department_return_count": count})` (E03, không đổi trạng thái).
- `return_wrong_department` đã ghim `expected_from=S.ROUTED` (WP5) ⇒ gọi trên `IN_PROGRESS` ⇒ `InvalidTransitionError` 409 (không ngầm thành T16).

## 3. T16 — `report_wrong_department` (WP5 viết một dòng) + `_t16_report_wrong_department(self, work, actor_id, role, now, *, note)`
1. `_blank(note)` ⇒ `GuardError("Báo sai phòng ban sau khi nhận việc phải có lý do")`.
2. `blocker = self._new_blocker(work, R.WRONG_DEPT_AFTER_START, now, resume_step=6, note=note)` (chủ BQL theo `BLOCKER_OWNERS`; không SLA nhắc — BQL được báo ngay).
3. Audit `REPORT_WRONG_DEPT` (`field_name="blocker.code"`, old = mã blocker hiện có hoặc None, new = `WRONG_DEPT_AFTER_START`, reason = note).
4. `_apply_transition(work, S.VERIFYING, actor_id, role, now, blocker=blocker, note=note)` — KHÔNG đổi `department_id`/`accepted_at`/checklist/vật tư/bằng chứng.
5. `_notify(work, "escalation", BlockerOwner.BQL, now, {"reason_code": R.WRONG_DEPT_AFTER_START, "department_id": work.ticket.department_id})`.
- Ticket `IN_PROGRESS` đang có `REWORK` ⇒ blocker thay bằng `WRONG_DEPT_AFTER_START` (dấu `REWORK` mất; `rework_count`, `evidence_round_start` giữ).
- BPTN mọi hành động trên ticket này ⇒ 403 + audit (I-11, `BQL_REASONS` có sẵn).

## 4. BQL quyết — `bql_wrong_department(self, ticket_id, actor_id, *, decision: Literal["KEEP", "TO_BPTN"], note: str) -> Case`
Kiểm `decision` TRƯỚC mọi thứ: khác `"KEEP"`/`"TO_BPTN"` ⇒ `GuardError(f"decision không hợp lệ: {decision!r}")` (tiền lệ `set_priority`).
- `KEEP` (T17): `return self.transition(ticket_id, S.IN_PROGRESS, actor_id, note=note, expected_from=S.VERIFYING)` ⇒ nhánh `(VERIFYING, IN_PROGRESS)` ⇒ `_t17_keep_department`: blocker phải `WRONG_DEPT_AFTER_START` (khác ⇒ `InvalidTransitionError("BQL giữ phòng ban chỉ khi phòng ban báo sai sau khi nhận (T17)")`), `note` rỗng ⇒ `GuardError`; audit `BQL_KEEP_DEPARTMENT` (`blocker.code` WRONG_DEPT_AFTER_START → None); `_apply_transition(work, S.IN_PROGRESS, …, note=note)` (blocker None).
- `TO_BPTN` (E02) qua `_mutate(ticket_id, actor_id, Action.BQL_REASSIGN_TO_BPTN, op)`:
  1. INVALID nếu không `VERIFYING` + `WRONG_DEPT_AFTER_START`; GUARD nếu `note` rỗng.
  2. `_take_execution_snapshot(work, actor_id, now)` → nối `ExecutionSnapshot` (§5) vào `work.execution_snapshots`.
  3. Mọi `checklist_items`: `status=PENDING, updated_by=None, updated_at=None` (giữ `note` cũ? KHÔNG — `note=None`; bản cũ nằm trong snapshot).
  4. `work.evidence_round_start = len(work.evidence)`.
  5. `wrong = self._new_blocker(work, R.WRONG_DEPT, now, resume_step=6, note=note)`; audit `BQL_REASSIGN_TO_BPTN` (`blocker.code` WRONG_DEPT_AFTER_START → WRONG_DEPT); `self._set_blocker(work, wrong, actor_id, Role.BQL, now, note=note, department_id=None, dispatched_at=None, accepted_at=None)` (một StatusEvent public; trạng thái giữ VERIFYING).
  6. BPTN sau đó `bptn_resolve(category=… | department=…)` ⇒ resume 6 (đổi loại) hoặc 7 (giữ loại) như hiện tại; bước 7 dựng lại dòng vật tư ⇒ `_carry_over_material_qty` mang `issued_qty/used_qty/variance_reason` theo `item_code`.

## 5. `ExecutionSnapshot` (01 §2.3) — `_take_execution_snapshot(self, work, actor_id, now) -> ExecutionSnapshot`
```python
class ExecutionSnapshot(Entity):
    model_config = ConfigDict(extra="forbid", frozen=True)
    snapshot_id: Annotated[str, _sim_id("SIM-SNP-")]     # f"SIM-SNP-{_suffix(tid)}-{len(case.execution_snapshots)+1:02d}"
    ticket_id: str
    reason: Literal["BQL_REASSIGN_TO_BPTN"]
    taken_at: AwareDatetime
    taken_by: str
    department_id: Department
    work_order_draft_id: str | None
    playbook_id: PlaybookId | None
    checklist_items: list[ChecklistItem]
    material_lines: list[MaterialLine]
    evidence_ids: list[str]                              # mọi evidence_id hiện có (ảnh, ghi chú)
    synthetic: Synthetic = True
```
Bản sâu (`model_copy(deep=True)`) của checklist và dòng vật tư TẠI THỜI ĐIỂM E02. Cư dân không thấy (allow-list view không đổi).

## 6. `_carry_over_material_qty(self, old_lines, new_lines) -> None`
Với mỗi dòng mới, nếu có dòng cũ cùng `item_code` có `issued_qty` hoặc `used_qty` khác None ⇒ chép `issued_qty`, `used_qty`, `variance_reason`. Không cộng dồn, không tạo dòng cho mã không còn trong kế hoạch (dòng cũ vẫn trong snapshot).

## 7. Luật
**BẮT BUỘC:** T16 giữ nguyên dữ liệu thực hiện; E02 chụp snapshot TRƯỚC khi đặt lại checklist; T15 đếm ở mọi lần trả; ngưỡng đọc từ `sla_config.wrong_dept_return.escalate_at_count`; `decision` lạ ⇒ 409 trước 404.
**CẤM:** dùng chung đường/nút với T22 (rework); phòng ban tự trả lại sau khi nhận bằng T15; xoá dữ liệu thực hiện khi E02; hardcode số 2.
**Vùng cấm:**
| Không làm | Lý do |
|---|---|
| Không cho phòng ban tự chuyển ticket đã nhận sang phòng ban khác | CR §9.3: BQL quyết |
| Không giữ checklist đã hoàn tất cho phòng ban mới | phòng ban mới phải tự làm và tự chụp (D-09); dữ liệu cũ ở snapshot |
| Không gọi Agent khi T16/T17/E02 | quyết định của người; Agent chỉ chạy lại khi BPTN đổi khoá |

## 8. Phân loại lỗi + hành vi caller
| Thao tác | Điều kiện | Lỗi | HTTP | Caller |
|---|---|---|---|---|
| `return_wrong_department` | ticket `IN_PROGRESS` | `InvalidTransitionError` | 409 | dùng "Báo cần BQL xem" |
| `report_wrong_department` | phòng ban khác / vai khác | `ActionDeniedError` + audit | 403 | ẩn nút |
| `report_wrong_department` | không `IN_PROGRESS` | `InvalidTransitionError` | 409 | tải lại |
| `report_wrong_department` | thiếu note | `GuardError` | 409 | nhập lý do |
| `bql_wrong_department` | `decision` lạ | `GuardError` | 409 (router: 422 trước) | sửa body |
| `bql_wrong_department` | không phải BQL | `ActionDeniedError` + audit | 403 | — |
| `bql_wrong_department` | sai trạng thái/blocker | `InvalidTransitionError` | 409 | tải lại |

## 9. Nghiệm thu
- `pytest -q tests/test_maintenance/test_p1_department.py` ⇒ D-01…D-10 (TESTING §3.8) xanh; D-04 chạy `memory` + `postgres`.
- Phải ĐỎ trước (`evidence/WP9/red-before.txt`): test mới trên base WP6 ⇒ D-02, D-03, D-05…D-08 đỏ (`NotImplementedError` / đếm sai).
- Đột biến: (a) bỏ `escalated=True` ⇒ D-02 đỏ; (b) E02 không chụp snapshot ⇒ D-07 đỏ; (c) T16 đặt `department_id=None` ⇒ D-04 đỏ.
