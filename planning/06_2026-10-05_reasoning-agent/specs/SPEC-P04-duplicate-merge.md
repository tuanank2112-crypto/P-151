# SPEC-P04 (P1-A) — Trùng và gộp đủ CR §8: đếm trùng, PRI-U1, gộp hai chiều, nối bổ sung, hoàn tác T09, hủy gốc, BQL gộp khẩn cấp, đánh giá của ticket MERGED

| Trường | Giá trị |
|---|---|
| WP | WP7 (🟠) — Wave 4, sau WP6; song song WP8/WP9/WP10 (file mixin riêng) |
| Nguồn | CR §4.1 (T08, T09, T23), §5.2 (dòng hoàn tác gộp), §7 (PRI-U1), §8 (1–7), §10, §11, AC-11, AC-15; plan Q01 (Agent chọn ticket trùng), Q10, Q19 |
| File được ghi | `src/maintenance/coordination/merge.py` (thân `_on_duplicate_detected`, `_merge_into`, `_t09_unmerge_by_person`, `_unmerge`, `_release_duplicate_count`, `_unmerge_children_of`, `_apply_pri_u1`, `bql_merge`; helper mới `_count_duplicate`, `_refresh_priority`, `_has_open_merged_children`), `src/maintenance/engine.py` (CHỈ thân `rate` và nhánh `DUPLICATE` của `bptn_resolve` — Wave 4 không WP nào khác sửa `engine.py`), `src/maintenance/priority.py`, `tests/test_maintenance/test_p1_merge.py` (mới), `tests/test_maintenance/test_priority.py` (chỉ THÊM test) |

## 1. Vòng đời

| Sự kiện | Ticket mới/con | Ticket gốc (cùng giao dịch, I-25) |
|---|---|---|
| Bước 4 thấy trùng (Agent chọn trong ứng viên rồi engine kiểm lại, hoặc luật `_find_duplicate_ticket_id` — P02 §6.4) | `VERIFYING/DUPLICATE`, `related_ticket_id=gốc`, `resume_step=5` (như cũ) | `duplicate_count += 1` (+ PRI-U1) |
| BPTN `bptn_resolve(merge=True)` (T08) | `MERGED`, `merged_into=gốc` | `merged_children` nối thêm con; nối bổ sung + ảnh cư dân của con (`merged_from`) |
| BPTN `bptn_resolve(merge=False)` | tiếp từ bước 5 (như cũ), `not_duplicate_of += [gốc]` | `duplicate_count −= 1` |
| BQL `bql_merge(into=…)` (T08 BQL, ticket khẩn cấp) | `MERGED`, `merged_into=into` | như T08 + `duplicate_count += 1` |
| `undo_merge` BPTN/BQL (T09) | `RECEIVED` → chạy lại pipeline (D-05) | `duplicate_count −= 1` nếu gốc chưa kết thúc; `merged_children` GIỮ (lịch sử) |
| BQL `cancel(gốc)` (T23) | mọi con đang `MERGED` vào gốc ⇒ T09 SYSTEM, ghi chú "Ticket gốc bị hủy", chạy lại | — |
| BQL `cancel(ticket đang nghi trùng)` | — | `duplicate_count −= 1` nếu gốc chưa kết thúc |
| Gốc `CLOSED` | cư dân của con đánh giá được trên chính ticket con (một lần) | — |

## 2. `duplicate_count` và PRI-U1

### 2.1 Định nghĩa (D-04)
`duplicate_count` = số phản ánh khác đang được coi là cùng sự cố với ticket này: (đang `VERIFYING/DUPLICATE` trỏ về nó) + (đã `MERGED` vào nó qua T08), KHÔNG tính ticket con do hoàn tác tách (P05 §5). Không bao giờ âm; không ghi lên ticket đã kết thúc (I-26).

### 2.2 Helper (WP7, trong `coordination/merge.py`)
```python
def _count_duplicate(self, root: Case, delta: int, other_id: str, actor_id: str, role: ActorRole, now: datetime,
                     *, why: str) -> None:
    """root là bản làm việc (từ _related_case hoặc ticket chính). Đã kết thúc ⇒ không làm gì."""
    # new = max(0, old + delta); new == old ⇒ không làm gì
    # _set_ticket(root, duplicate_count=new); audit LINK_TICKETS(field "duplicate_count", old, new, reason=f"{why} ({other_id})")
    # self._refresh_priority(root, now)

def _refresh_priority(self, work: Case, now: datetime) -> None:
    """PRI-U1 khi số trùng đổi: category None hoặc risk_level=EMERGENCY ⇒ không làm gì; ngược lại _propose_priority."""

def _has_open_merged_children(self, work: Case) -> bool:
    """Có con nào trong work.ticket.merged_children đang MERGED với merged_into == work? (đọc _case_view)"""
```
- `_on_duplicate_detected(root, work, now)` = `self._count_duplicate(root, +1, work.ticket.ticket_id, AGENT_ID, Role.AGENT, now, why="Phản ánh nghi trùng")`.
- `_refresh_priority(root, now)`: `HUMAN_OVERRIDE` ⇒ không làm gì; nền ưu tiên = job của `root.agent_decision` cho đúng loại (nếu vân tay của record khớp `_content_fingerprint(root)` và trường ưu tiên không bị loại) — nguồn `AGENT_LLM`; ngược lại luật `propose_priority` — nguồn `AGENT_RULE`; rồi `_apply_pri_u1`; ghi như `_propose_priority` (khoá chống ghi lặp).

### 2.3 PRI-U1 (`priority.py`, chữ ký ở 01 §10)
- Tính luật gốc như hiện tại (PRI-H1…D0). Nếu `duplicate_raise_at is not None and duplicate_count >= duplicate_raise_at` và mức gốc khác `HIGH` ⇒ nâng đúng một mức (`LOW→MEDIUM`, `MEDIUM→HIGH`), `reason = gốc.reason + f"; PRI-U1: {duplicate_count} phản ánh trùng ≥ {duplicate_raise_at} (+1 mức)"`, `adjustments=("PRI-U1",)`, `rule_id` GIỮ luật gốc. Mức gốc `HIGH` ⇒ không ghi PRI-U1.
- `_apply_pri_u1(work, priority, reason) -> (priority, reason)` (hook do WP5 gọi trong `_propose_priority` cho CẢ nền Agent lẫn nền luật) = `priority.apply_duplicate_raise(priority, reason, duplicate_count=work.ticket.duplicate_count, raise_at=self.catalog.sla_config.priority.duplicate_raise_at_count)`. Khoá chống ghi lặp theo P02 §6.3 (đường luật so `(priority, priority_rule_id)` như hiện tại) ⇒ chạy lại không thêm `CREATE_PROPOSAL` (giữ `test_10b`). `HUMAN_OVERRIDE` không bao giờ bị ghi đè.
- Ngưỡng là dữ liệu: `sla_config.priority.duplicate_raise_at_count` (mặc định 3, Q19 chờ người dùng). CẤM hardcode 3.

## 3. T08 BPTN — `bptn_resolve(merge=True|False)` (thân nhánh DUPLICATE)
- `merge=True`: giữ audit `BPTN_RESOLVE` sẵn có rồi `_human_transition(work, S.MERGED, …)` ⇒ nhánh `(VERIFYING, MERGED)` ⇒ `_merge_into(…, counted=False)`.
- `_merge_into` (thân WP7), thứ tự kiểm TRƯỚC mọi ghi:
  1. `root_id == work.ticket.ticket_id` ⇒ `GuardError("Không gộp ticket vào chính nó")`.
  2. `self._has_open_merged_children(work)` ⇒ `GuardError("Ticket còn ticket con đang gộp vào nó; hoàn tác gộp các ticket con trước (không gộp dây chuyền)", {"merged_children": …})`.
  3. `root = self._related_case(root_id)` (không có ⇒ `NotFoundError`).
  4. `root.ticket.status in TERMINAL_STATUSES` ⇒ `GuardError(f"Ticket gốc {root_id} đã kết thúc ({status}); không gộp được", {"root_status": status})`.
  5. Ghi: `_apply_transition(work, S.MERGED, actor_id, role, now, note=note, merged_into=root_id)`; `merged_children` của gốc nối thêm con (nếu chưa có) + audit `LINK_TICKETS` trên gốc; `_copy_additions(work, root, now, mode="merge")`; `_copy_resident_photos(work, root, now, mode="merge")`; `counted` ⇒ `_count_duplicate(root, +1, …, why="BQL gộp phản ánh khẩn cấp")`.
- `merge=False`: sau dòng `work.not_duplicate_of.append(...)` có sẵn, nếu `_case_view(gốc)` chưa kết thúc ⇒ `_count_duplicate(self._related_case(gốc), −1, tid, actor_id, Role.BPTN, now, why="BPTN bác trùng")`. Phần còn lại như cũ (chạy tiếp từ bước 5).
- Gốc KHÔNG đổi trạng thái, KHÔNG chạy lại pipeline khi nhận nội dung gộp (CR T08 chỉ đổi ticket con).

## 4. `bql_merge(self, ticket_id: str, actor_id: str, *, into: str, note: str) -> Case` — T08 BQL
```python
def bql_merge(self, ticket_id, actor_id, *, into, note):
    def op(work, now):
        # 409 INVALID: work không ở VERIFYING + EMERGENCY_PENDING_BQL
        # 409 GUARD: _blank(note); into == ticket_id; _has_open_merged_children(work)
        # root = self._related_case(into)                       → 404 khi không có
        # 409 GUARD: root kết thúc; root.ticket.risk_level != EMERGENCY ("chỉ gộp vào phản ánh khẩn cấp đang mở")
        # audit BQL_MERGE trên work: field "merged_into", None → into, reason note
        # self._merge_into(work, into, actor_id, Role.BQL, now, note=note, counted=True)
        # self._release_waiting_for(work, now)                   (hook P1-E, WP5 đặt; WP10 lấp)
    return self._mutate(ticket_id, actor_id, Action.BQL_MERGE, op)
```
Vai sai ⇒ 403 + audit (PERMISSIONS, `_mutate_locked`); BPTN còn bị I-11 (blocker thuộc BQL). Trả về ticket bị gộp.

## 5. T09 người — `undo_merge` (WP5 viết thân một dòng) + `_t09_unmerge_by_person` + `_unmerge`
```python
def _t09_unmerge_by_person(self, work, actor_id, role, now, *, note):
    # role ∉ {BPTN, BQL} ⇒ InvalidTransitionError("Hoàn tác gộp do BPTN/BQL (T09)")
    # role == BPTN và work.ticket.risk_level == EMERGENCY ⇒ self._deny(self.get(tid), actor_id, role, Action.MERGE_UNDO,
    #     "merged_into", None, note, now, message="Ticket khẩn cấp do BQL gộp; chỉ BQL hoàn tác")   (403 + audit)
    # _blank(note) ⇒ GuardError("Hoàn tác gộp bắt buộc ghi lý do")
    # self._unmerge(work, actor_id, role, now, note=note.strip())

def _unmerge(self, work, actor_id, role, now, *, note):
    # root_id = work.ticket.merged_into ; counted = work.ticket.split_from != root_id
    # _apply_transition(work, S.RECEIVED, actor_id, role, now, note=note, merged_into=None)
    # root_id vào work.not_duplicate_of (nếu chưa có)
    # audit MERGE_UNDO trên work: field "merged_into", root_id → None, reason note
    # counted và _case_view(root_id) chưa kết thúc ⇒ _count_duplicate(self._related_case(root_id), −1, tid, actor_id, role, now, why="Hoàn tác gộp")
    # step = 4 nếu (work.ticket.risk_level == RiskLevel.NONE và self._category(work) is not None) ngược lại 2   (D-05)
    # self._run_pipeline(work, step, now)
```
- Ticket khẩn cấp do BQL gộp ⇒ chạy lại từ 2 ⇒ 2b dừng lại `EMERGENCY_PENDING_BQL` (nội dung không đổi, chưa `safety_cleared`) — KHÔNG BAO GIỜ tới bước 8 (I-17, I-10 plan 01).
- Pipeline chạy lại không đề xuất lại cặp đã hoàn tác (`not_duplicate_of`).

## 6. Hủy (T23) — `_release_duplicate_count`, `_unmerge_children_of` (gọi từ `_after_cancel`, WP5)
- `_release_duplicate_count(work, previous_blocker, now)`: `previous_blocker.code == DUPLICATE` và gốc (`related_ticket_id`) chưa kết thúc ⇒ `_count_duplicate(gốc, −1, tid, SYSTEM_ID, Role.SYSTEM, now, why="Ticket nghi trùng bị hủy")`.
- `_unmerge_children_of(root, now)`: duyệt `root.ticket.merged_children` theo `(_created_at(raw) hoặc datetime.max(LOCAL_TZ), ticket_id)` tăng dần; con nào `_case_view` đang `MERGED` và `merged_into == root` ⇒ `self._unmerge(self._related_case(cid), SYSTEM_ID, Role.SYSTEM, now, note="Ticket gốc bị hủy")`. Nhờ `_cases_snapshot` (P02 §2), con chạy sau thấy trạng thái mới của con chạy trước ⇒ hai con cùng sự cố: con sau thành `DUPLICATE` của con trước (không giao trùng hai lần).
- Ticket `MERGED` không hủy trực tiếp (không có dòng `(MERGED, CANCELLED)` — CR §10, giữ). Ticket đang nghi trùng trỏ về gốc vừa hủy: GIỮ `VERIFYING/DUPLICATE` cho BPTN (CR không nói); BPTN `merge=True` ⇒ 409 GUARD gốc đã kết thúc, `merge=False` ⇒ đi tiếp bước 5.

## 7. Đánh giá của ticket MERGED (CR §8.3, §11) — `rate` + view
- `rate` (thân WP7, trong `engine.py`): `MERGED` ⇒ đọc `self._case_view(merged_into)`; gốc khác `CLOSED` ⇒ `GuardError("Chỉ đánh giá khi phản ánh gốc đã hoàn thành", {"root_status": …})`; trạng thái khác `CLOSED`/`MERGED` ⇒ `GuardError` như cũ; đã có `rating` ⇒ `GuardError` như cũ. Điểm lưu trên ticket con. Gốc `CLOSED` với `EMERGENCY_HANDLED` cũng được.
- View (`allowed_actions` "RATE") đã do WP1 làm theo cùng điều kiện (01 §8) — WP7 thêm test end-to-end.

## 8. Luật

**BẮT BUỘC**
1. Mọi ghi lên gốc/con khác đi qua `_related_case` (I-25); không ghi ticket đã kết thúc (I-26).
2. Nội dung/ảnh nối là bản ghi mới `merged_from=<con>` — bản gốc của con không đổi; Agent của gốc không đọc; cư dân gốc không thấy (I-28).
3. Ngưỡng PRI-U1 lấy từ `sla_config`; khoá chống ghi lặp như §2.3.
4. Hoàn tác ticket khẩn cấp: chỉ BQL; chạy lại từ bước 2.

**CẤM**
1. Gộp vào ticket đã kết thúc, gộp dây chuyền, gộp qua `transition()` với BQL/tách sai (dùng `bql_merge`/`undo_split`).
2. Xoá phần tử khỏi `merged_children`; xoá bản ghi `merged_from` khi hoàn tác.
3. Tăng `duplicate_count` khi BPTN xác nhận T08 (đã tính lúc phát hiện) hoặc khi hoàn tác tách.

**Vùng cấm**
| Không làm | Lý do |
|---|---|
| Không cho gốc chạy lại pipeline khi nhận nội dung gộp | CR T08 không đổi gốc; tránh gốc đổi vị trí/loại việc theo lời cư dân khác (V-03) |
| Không tự nhả các ticket nghi trùng khi gốc bị hủy | CR §8.5 chỉ nói con `MERGED`; BPTN đang giữ quyết định |
| Không chép mô tả gốc của con thành addition của gốc | CR §8.2 chỉ "text và ảnh bổ sung"; mô tả gốc xem qua liên kết |
| Không đếm trùng cho ticket khẩn cấp ở bước 4 | ticket Bậc 1 dừng ở 2b, chỉ liên kết (Q11 plan 01); BQL gộp mới tính |
| Không gọi mô hình khi gộp/hoàn tác/hủy gốc | nội dung không đổi; ticket con chạy lại bằng record đã lưu hoặc luật (P02 §5) |

## 9. Phân loại lỗi + hành vi caller

| Thao tác | Điều kiện | Lỗi | HTTP | Caller |
|---|---|---|---|---|
| `bptn_resolve(merge=True)` | gốc đã kết thúc / gộp dây chuyền | `GuardError` | 409 | chọn `merge=false` hoặc hoàn tác con trước |
| `bql_merge` | không phải BQL | `ActionDeniedError` + audit | 403 | ẩn nút |
| `bql_merge` | ticket không ở `EMERGENCY_PENDING_BQL` | `InvalidTransitionError` | 409 | tải lại |
| `bql_merge` | thiếu note / `into` = chính nó / dây chuyền / `into` kết thúc / `into` không khẩn cấp | `GuardError` | 409 | sửa lựa chọn |
| `bql_merge` | `into` không tồn tại | `NotFoundError` | 404 | kiểm id |
| `undo_merge` | vai khác BPTN/BQL | `ActionDeniedError` | 403 | — |
| `undo_merge` | BPTN trên ticket khẩn cấp | `ActionDeniedError` + audit | 403 | để BQL |
| `undo_merge` | không ở `MERGED` | `InvalidTransitionError` | 409 | tải lại |
| `undo_merge` | thiếu note | `GuardError` | 409 | nhập lý do |
| `rate` | ticket `MERGED` mà gốc chưa `CLOSED` | `GuardError` | 409 | chờ |
| mọi thao tác hai ticket | backend khác giữ khoá chéo | `ConcurrencyError` | 409 | tải lại, thử lại một lần |

## 10. Nghiệm thu (lệnh + số kỳ vọng)
- Test (đặc tả ở TESTING §3.5): M-01…M-12 trong `tests/test_maintenance/test_p1_merge.py`; M-03, M-08 chạy cả `memory` và `postgres` (`pytest.param("postgres", marks=pytest.mark.pg)`).
- Lệnh: `python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p1_merge.py; echo "EXIT=$?"` ⇒ `EXIT=0`, số test ≥ 14, 0 skip (không `--pg`: các ca pg bị deselect, ghi số deselected).
- Phải ĐỎ trước (evidence `evidence/WP7/red-before.txt`): chạy file test mới trên commit trước khi sửa thân hook ⇒ ≥ 12 fail.
- Đột biến (evidence `evidence/WP7/mutation-*.txt`, mỗi đột biến làm ĐỎ đúng test nêu, rồi khôi phục): (a) bỏ `+1` trong `_on_duplicate_detected` ⇒ M-01, M-02 đỏ; (b) cho `_content` đọc cả `merged_from` ⇒ M-03 đỏ; (c) `_unmerge` luôn chạy từ bước 4 ⇒ M-07 đỏ.
