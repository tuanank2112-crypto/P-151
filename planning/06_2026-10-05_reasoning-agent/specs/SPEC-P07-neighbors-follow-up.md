# SPEC-P07 (P1-E + P1-F) — Ticket thường cạnh khẩn cấp đang mở (liên kết hai chiều + giữ — CHỜ DUYỆT) và ticket sửa chữa tiếp theo

| Trường | Giá trị |
|---|---|
| WP | WP10 (🟠) — Wave 4 sau WP6; song song WP7/WP8/WP9 |
| Nguồn | P1-E: **bổ sung** (người dùng yêu cầu; CHỜ DUYỆT Q18 — cờ mặc định TẮT); CR §8.6 (ticket khẩn cấp chỉ liên kết). P1-F: CR §6.5 dòng "Tạo ticket sửa chữa tiếp theo", §11, §12.1 `follow_up_of`, AC-09 |
| File được ghi | `src/maintenance/coordination/neighbors.py` (thân `_link_emergency_both_ways`, `_hold_for_emergency`, `_release_waiting_for`, `create_follow_up`, helper `_open_emergencies_at`), `tests/test_maintenance/test_p1_neighbors.py`, `tests/test_maintenance/test_p1_follow_up.py` (mới) |
| CẤM chạm | `engine.py` (chỗ gọi WP5 đã đặt), `seed/**` (fixture: §4.3), `agent/**` |

## 1. P1-E — Hành vi
| Thời điểm | Hành vi (cờ `agent_policy.hold_near_open_emergency`) |
|---|---|
| Ticket vào khẩn cấp (2b EMERGENCY; E01; T07) | `related_ticket_ids` của ticket khẩn cấp như hiện tại (ticket mở cùng vị trí, tạo trước, trong cửa sổ); THÊM: mỗi ticket đó nhận id khẩn cấp vào `related_ticket_ids` (hai chiều) — LUÔN, không phụ thuộc cờ |
| Ticket thường tới bước 8 khi cùng vị trí có khẩn cấp ĐANG MỞ | LUÔN liên kết hai chiều; cờ BẬT ⇒ dừng `ON_HOLD/WAITING_EMERGENCY` (T11, chủ SYSTEM, `resume_step=8`); cờ TẮT ⇒ giao như hiện tại |
| BQL xử lý khẩn cấp (T05 hạ, T10 đóng, T23 hủy, `bql_merge`) | nhả mọi ticket `WAITING_EMERGENCY` liên kết với nó mà vị trí không còn khẩn cấp mở nào khác ⇒ chạy lại từ bước 8 |

## 2. `_open_emergencies_at(self, location: str, *, exclude: set[str]) -> list[str]`
Duyệt `self._cases_snapshot()`: ticket chưa kết thúc, `blocker.code == EMERGENCY_PENDING_BQL`, `effective_location == location`, id ∉ `exclude`; trả id theo `created_at` tăng dần. Không giới hạn cửa sổ thời gian (khẩn cấp đang mở là đang mở).

## 3. Hook
- `_link_emergency_both_ways(self, emergency, ticket_ids, now)`: với mỗi id: `other = self._related_case(id)`; bỏ nếu kết thúc (I-26); `self._link_pair(emergency, other, now, AGENT_ID, Role.AGENT, why=f"Cùng vị trí với khẩn cấp {emergency.ticket.ticket_id}")`.
- `_hold_for_emergency(self, work, now) -> bool` (đầu bước 8):
  1. `loc = self.effective_location(work)`; `exclude = {work.ticket.ticket_id, work.ticket.follow_up_of} - {None}` (ticket tiếp theo KHÔNG chờ chính ticket khẩn cấp nguồn của nó).
  2. `ids = self._open_emergencies_at(loc, exclude=exclude)`; rỗng ⇒ `False`.
  3. Mỗi id: `self._link_pair(work, self._related_case(id), …, why="Khẩn cấp đang mở cùng vị trí")`.
  4. Cờ TẮT ⇒ `False` (giao như cũ). Cờ BẬT ⇒ `self._stop(work, S.ON_HOLD, R.WAITING_EMERGENCY, now, resume_step=8, note=f"Chờ BQL xử lý khẩn cấp {ids[0]} cùng vị trí")` ⇒ `True`.
- `_release_waiting_for(self, emergency, now)`: với mỗi `id ∈ emergency.ticket.related_ticket_ids`: `v = self._case_view(id)`; bỏ nếu không `ON_HOLD/WAITING_EMERGENCY`; còn khẩn cấp mở khác cùng vị trí (`_open_emergencies_at(loc, exclude={emergency id, id})` khác rỗng) ⇒ giữ, `_link_pair(v-bản-khoá, khẩn-cấp-còn-mở)`; ngược lại `o = self._related_case(id)`; `_apply_transition(o, S.RECEIVED, SYSTEM_ID, Role.SYSTEM, now, note=f"Khẩn cấp {emergency_id} đã được BQL xử lý")`; `_run_pipeline(o, 8, now)`.
- `_cleared(WAITING_EMERGENCY)` = False (nhánh mặc định sẵn có); `_schedule` ⇒ None; không `escalate_at` (BQL đã nhận `emergency.created`). `resume()`/job KHÔNG nhả (V-10 của 00).

## 4. P1-E — luật, vận hành
### 4.1 BẮT BUỘC / CẤM
**BẮT BUỘC:** liên kết hai chiều luôn bật; giữ chỉ khi cờ bật; nhả theo sự kiện BQL; ticket tiếp theo không chờ nguồn của nó; mọi ghi qua `_related_case` (I-25).
**CẤM:** nhả theo giờ; giữ ticket đã `ROUTED`/`IN_PROGRESS` (chỉ chặn ở bước 8, trước khi giao); dùng cờ khác ngoài `agent_policy.hold_near_open_emergency`.
### 4.2 Vùng cấm
| Không làm | Lý do |
|---|---|
| Không gộp tự động ticket thường vào ticket khẩn cấp | CR §8.6: khẩn cấp chỉ liên kết; BQL gộp khẩn cấp với khẩn cấp |
| Không để BPTN nhả tay `WAITING_EMERGENCY` | chủ SYSTEM, nhả theo quyết định của BQL; tránh giao thợ vào chỗ nguy hiểm |
| Không bật cờ mặc định | là bổ sung chưa duyệt (Q18); bật làm đổi kết quả fixture §4.3 |
### 4.3 Ảnh hưởng fixture (đo trên seed `82f01f0`)
`SIM-TKT-TEC-006` (09:30, `Tòa S1 / Tầng B1 / Hầm xe`) tới bước 8 khi `SIM-TKT-CLN-004` (09:20, cùng vị trí) đang `EMERGENCY_PENDING_BQL`. Cờ TẮT: TEC-006 vẫn `ROUTED` (expected không đổi), hai ticket liên kết hai chiều. Cờ BẬT (sau khi người dùng duyệt Q18): TEC-006 thành `ON_HOLD/WAITING_EMERGENCY` ⇒ Trường sửa `expected` của TEC-006 trong `seed/maintenance_v1/tickets.yaml` + `seed/maintenance_cr03/tickets.yaml` (ngoài hồ sơ này).

## 5. Hủy / đóng / hạ khẩn cấp — nơi gọi `_release_waiting_for` (WP5 đã đặt)
`_after_cancel` (khi blocker cũ `EMERGENCY_PENDING_BQL`), nhánh T05 người (sau `_run_pipeline` của chính ticket hạ), nhánh T10 (sau `_apply_transition`), `bql_merge` (sau `_merge_into`, với ticket bị gộp làm `emergency`).

## 6. P1-F — `create_follow_up(self, ticket_id: str, actor_id: str, *, note: str) -> Case`
**Ngoài khoá (WP10, theo P02 §5):** `gate` = vai BQL và nguồn đang `VERIFYING/EMERGENCY_PENDING_BQL`. Dựng case TẠM y hệt bước 2–5 dưới với id giả `"PENDING-FOLLOWUP"`, `record = self.agent.decide(self._decision_input(temp, now))` (có Agent) — vân tay không chứa id nên khớp case thật.
**Trong `_mutate(ticket_id, actor_id, Action.CREATE_FOLLOW_UP, op)`:**
1. INVALID nếu nguồn không `VERIFYING` + `EMERGENCY_PENDING_BQL`; GUARD nếu `note` rỗng.
2. `number = self.repo.next_ticket_number()`; `raw = RawTicket(ticket_id=f"SIM-TKT-{number:04d}", created_at=now.astimezone(LOCAL_TZ).isoformat(timespec="seconds"), original_description=src.ticket.raw.original_description, original_evidence_refs=src.ticket.raw.original_evidence_refs, channel="follow_up")`.
3. `new = self._build_case(raw, None, src.ticket.resident_id, now, public_message=follow_up_created_message(src_id), notify_extra={"follow_up_of": src_id}, reason=f"Ticket sửa chữa tiếp theo của {src_id}")`.
4. `_copy_additions(src, new, now, mode="copy")`; `_copy_resident_photos(src, new, now, mode="copy")`.
5. `_set_ticket(new, follow_up_of=src_id, safety_cleared_by=actor_id, safety_cleared_at=now, safety_clear_reason=note.strip(), risk_level=RiskLevel.NONE)`; `new.not_duplicate_of.append(src_id)`.
6. Audit `CREATE_FOLLOW_UP` trên nguồn (`field_name="follow_up"`, None → id mới, reason note) và trên ticket mới (`field_name="follow_up_of"`, None → nguồn). `_link_pair(src, new, now, actor_id, Role.BQL, why="Ticket sửa chữa tiếp theo")`.
7. Có record ⇒ `self._local.prepared[new_id] = record` (P02 §4.3). `self._insert_case(new)`; `self._run_pipeline(new, 2, now)` — 2b tự bỏ qua (bổ sung chép có `submitted_at` < `safety_cleared_at`), bước 2 vị trí, 3 phân loại (Agent hoặc luật), … 8 (bỏ qua chờ khẩn cấp nguồn — §3).
8. Nguồn KHÔNG đổi trạng thái (BQL đóng riêng bằng T10). Method trả `self.get(id mới)` sau commit.
- Nội dung bổ sung dài: mô tả gốc ≤ 5000 ký tự (giới hạn `RawTicket`) nên chép thẳng; bổ sung đi `additions` (`copied_from`) (D-13).

## 7. P1-F — luật
**BẮT BUỘC:** chỉ BQL; ghi chú bắt buộc; kế thừa `safety_cleared_*` (by = BQL, reason = note); ticket mới chạy pipeline ngay trong cùng giao dịch; nguồn và mới liên kết hai chiều; quyết định Agent tính NGOÀI khoá.
**CẤM:** tạo từ ticket không khẩn cấp hoặc đã `CLOSED` (ngoài phạm vi — 00 §2); đổi trạng thái nguồn; cho cư dân tự tạo liên kết `follow_up_of`.
**Vùng cấm:**
| Không làm | Lý do |
|---|---|
| Không cho ticket tiếp theo chạy 2b trên nội dung cũ | BQL đã xác nhận an toàn (CR §6.5 "kế thừa safety_cleared_*") |
| Không chép ảnh phòng ban (`DEPARTMENT_EXECUTION`) | chỉ ảnh cư dân là phản ánh gốc |

## 8. Phân loại lỗi + hành vi caller
| Thao tác | Điều kiện | Lỗi | HTTP | Caller |
|---|---|---|---|---|
| `create_follow_up` | không phải BQL | `ActionDeniedError` + audit | 403 | ẩn nút |
| `create_follow_up` | nguồn không khẩn cấp | `InvalidTransitionError` | 409 | tải lại |
| `create_follow_up` | thiếu note | `GuardError` | 409 | nhập ghi chú |
| `create_follow_up` | DB lỗi giữa chừng | `StoreUnavailableError` / `ConcurrencyError` | 503 / 409 | tải lại; không có ticket mới nào được tạo (một giao dịch) |
| giữ/nhả `WAITING_EMERGENCY` | — | không có lỗi riêng; lỗi giao dịch lan lên hành động BQL | — | BQL thao tác lại |

## 9. Nghiệm thu
- `pytest -q tests/test_maintenance/test_p1_neighbors.py tests/test_maintenance/test_p1_follow_up.py` ⇒ E-01…E-08, F-01…F-06 (TESTING §3.9, §3.10); F-03 `memory` + `postgres`.
- Phải ĐỎ trước: test mới trên base WP6 ⇒ E-01 (liên kết một chiều), F-01 (`NotImplementedError`) đỏ.
- Đột biến: (a) bỏ `follow_up_of` khỏi `exclude` ⇒ F-05 đỏ; (b) nhả khi còn khẩn cấp khác ⇒ E-06 đỏ; (c) cờ TẮT mà vẫn giữ ⇒ E-02 đỏ.
