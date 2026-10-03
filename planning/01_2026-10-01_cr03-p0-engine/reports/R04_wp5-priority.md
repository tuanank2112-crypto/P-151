Vai: worker · loại: thi công · họ/model: Claude Sonnet 5.5 (🟠) · Bước 0 exit: 0 · hiểu việc: cài priority theo luật PRI-H1/H2/M1/M2/L1/D0 ở bước 3, `set_priority` (BPTN/BQL, lý do bắt buộc, HUMAN_OVERRIDE), khoá sắp xếp hàng đợi, `rate()` một lần, dòng `priority:` trong seed và 2 assert hoãn E-02/E-13; xong khi pytest/ruff exit 0, tổng >= 292+mới, R-01..R-07 + G-04/G-05 đúng, 2 lần làm đỏ, set_priority qua `_mutate`, một commit local; CẤM PRI-U1/U2, api/web/docs/.gitignore/specs/plan/rules/proposer/safety, push
Handoff: H04_wp5-priority.md
Base: 8c91c2d9cd2612c07768d77c62c63885709560b5
Head: 2f2a1106e5db9af07ff48bfcbd549f5e8c41a7dd

## Lệnh + exit (output máy ở `evidence/WP5/*.txt`, đã commit trong Head)
| Lệnh | Kết quả | File |
|---|---|---|
| `init_brain.js --check` | exit 0 | — |
| `python -m pytest -q -p no:cacheprovider` | `313 passed`, EXIT=0 | `pytest.txt` |
| `pytest --collect-only -q \| grep -c "::"` | 313 (G1 >= 240) | `collect.txt` |
| `ruff check` / `ruff format --check src tests` | `All checks passed!` EXIT=0 / `52 files already formatted` EXIT=0 | `ruff.txt` |
| `pytest test_priority.py` (R-07) | `19 passed`, EXIT=0 | `pytest-priority.txt` |
| REF `priority_cases` (R-01) | PR-01..PR-08 `ok` 8/8, `TOTAL=84 BAD=0 TIER1_MISS=0` | `ref-priority.txt` |
| R-02 (fixture) | 9 ticket có priority đúng bảng P03 §5; CLN-003/CLN-004/TEC-005 `None` | `contracts.txt` |
| G-04 | lần 2 `GuardError GUARD_FAILED`, `rating 5` | `contracts.txt` |
| G-05 `evaluate` | `12 4 []` | `contracts.txt` |
| AST: `set_priority` dùng `self._mutate(` | True | `contracts.txt` |

Test: tổng 313 · pass 313 · fail 0 · skip 0 (nền WP4 292; +21: 19 trong `test_priority.py` gồm 8 mẫu tham số hoá, 2 test rating). R-03 (`test_queue_sort_order_and_related_ids`), R-04 (`test_human_override_needs_note_and_sticks`), R-05 (`test_set_priority_denied_for_other_roles`), R-06 (`test_h2_end_to_end`) xanh.
`grep -cP '[\x08\x0c\x0b]'` trên các file ghi: 0.

Làm đỏ:
- (a) bỏ guard `rating is not None` ⇒ `test_15_rating_only_once`, `test_15_emergency_closed_ticket_can_be_rated_once` đỏ, `2 failed, 311 passed`, EXIT=1 (`red-rate-overwrite.txt`).
- (b) đảo khoá sắp xếp (priority trước risk) ⇒ 4 test đỏ (`test_queue_sort_order_and_related_ids`, `test_bql_rows_sorted`, `test_bql_rows_expose_risk_owner_and_filters`, `test_p0_contract_queue_sort_key_and_bql_row_fields`), `4 failed, 309 passed`, EXIT=1 (`red-sort-order.txt`).
- Hoàn tác ⇒ `313 passed` EXIT=0, ruff EXIT=0 (`green-after-restore.txt`).

## git diff --stat 8c91c2d..2f2a110
```
 brain4agent/memory/hot/today.md           |   1 +
 planning/.../evidence/WP5/*.txt (9 file)  |  50 +
 seed/maintenance_v1/tickets.yaml          |   9 +
 src/maintenance/engine.py                 |  76 +
 src/maintenance/priority.py               |  48 +  (mới)
 src/maintenance/views.py                  |   5 +-
 tests/test_maintenance/test_acceptance.py |  24 +-
 tests/test_maintenance/test_emergency.py  |   4 +
 tests/test_maintenance/test_engine.py     |  11 +-
 tests/test_maintenance/test_priority.py   | 171 +  (mới)
 18 files changed, 394 insertions(+), 8 deletions(-)
```
Cây còn lại không đụng: `D docs/flow_*.png` x2, `?? docs/Activity Diagram.png`.

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP5 priority + rating + seed + test | 🟠 | Claude Sonnet 5.5 (🟠), không giao xuống thấp hơn |

## Việc KHÔNG làm + lý do
- PRI-U1/PRI-U2 và bước "7b" tính lại priority: P1 / vùng cấm P3-01, P3-02.
- Không thêm notification cho HIGH; không `StatusEvent` cho `set_priority`.

## Drift
1. Lỗi tiềm ẩn đã sửa trong engine: `_propose_priority` dùng `_set_ticket`, thay đối tượng `work.ticket`; `bptn_resolve` giữ biến cục bộ `ticket` cũ nên các ghi sau (blocker, review_status) mất. Thêm `ticket = work.ticket` sau khối `_bind_category`/`_propose_department` trong `bptn_resolve` (4 test acceptance từng đỏ vì vậy). Nằm trong `engine.py` (được ghi).
2. Test cũ ngoài danh sách P04 §7 phải đổi vì hệ quả bắt buộc của priority (ghi tên): `test_acceptance.py::test_10b_rejected_duplicate_resumes_at_step_5` (CREATE_PROPOSAL 2 -> 3: thêm audit priority theo P03 §3.1); `test_engine.py::test_p0_contract_ticket_cross_field_validators` và `::test_p0_contract_queue_sort_key_and_bql_row_fields` (test WP2 của chính tôi: ticket nay đã có priority, nên ca "priority không source/reason" và khoá sắp xếp phải đặt `priority=None` tường minh). `test_acceptance.py` và `test_engine.py` nằm ngoài phần được phép của H04 ngoài 2 test rating; xin SO xác nhận.
3. `queue_sort_key`: 01 §8 viết `fromisoformat(...).isoformat()`, P03 §4 viết chuẩn hoá về UTC. Theo P03 (đúng khi lệch múi giờ); fixture đều +07 nên không khác kết quả.
4. P03 §1.1 R-01: `reason` chỉ nêu cụm khớp chuẩn hoá (P3-04), ví dụ `PRI-M2: ảnh hưởng sử dụng ('nhieu rac')`.
5. Phiên làm việc bị ngắt giữa chừng một lần; chạy lại pytest/ruff trên cây dở (313 xanh) rồi làm nốt evidence + 2 lần làm đỏ + commit.

## Câu hỏi mở
- Xác nhận drift 2 (sửa test_acceptance/test_engine ngoài danh sách).

⏳ Chờ người duyệt.

SO đo lại 2026-10-02: pytest 313 passed EXIT=0 · ruff EXIT=0 · format EXIT=0 · diff 8c91c2d..2f2a110 18 file. Drift 1 (sửa biến ticket cũ trong bptn_resolve) đúng phạm vi; drift 2 (3 test cũ đổi kỳ vọng do priority) chấp nhận; drift 3 (UTC theo P03 §4) chấp nhận. Evidence làm đỏ (a)(b) có.
✅ DUYỆT
