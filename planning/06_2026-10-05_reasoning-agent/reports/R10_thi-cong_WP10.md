Worker · thi công · Claude Sonnet 5.5 · Bước 0 exit 1 (đúng một dòng BRN-002 khối luật boot, do CRLF Q21; đi tiếp) · hiểu việc: phạm vi = neighbors.py + 2 file test + evidence/report; xong khi = 2 file test xanh (memory + pg) + 3 đột biến đỏ + toàn bộ pytest/ruff; cấm = engine.py, seed, agent, SPEC, plan, test cũ, không bật cờ trong YAML
Handoff: handoffs/H10_thi-cong_WP10.md
Base: f1f3725 (worktree lúc nhận ở 50fe728, cây sạch, đã `git reset --hard f1f3725`)
Head: chưa commit (SO gộp)

## Lệnh + exit
| Lệnh | Exit | Kết quả | Evidence |
|---|---|---|---|
| 2 file test trên thân stub WP6 | 1 | 16 failed (E-01..E-08 + F-01..F-06 đỏ) | evidence/WP10/red-before.txt |
| `pytest` 2 file mới | 0 | 16 passed, 5 deselected | evidence/WP10/green.txt |
| `pytest --pg` 2 file (DB p151_wp10_test) | 0 | 21 passed, 0 deselected | evidence/WP10/pg.txt |
| đột biến (a) bỏ `follow_up_of` khỏi `exclude` | 1 | F-05 đỏ (1 failed) | evidence/WP10/mutation-a.txt |
| đột biến (b) nhả khi còn khẩn cấp khác | 1 | E-06 đỏ (1 failed) | evidence/WP10/mutation-b.txt |
| đột biến (c) cờ TẮT mà vẫn giữ | 1 | E-00, E-02, E-08 đỏ (3 failed) — E-02 đỏ như yêu cầu | evidence/WP10/mutation-c.txt |
| `pytest -q -p no:cacheprovider` toàn bộ | 1 | 3263 passed, 1 failed, 53 deselected, 0 skip | evidence/WP10/pytest.txt |
| `ruff check` + `ruff format --check` 3 file | 0 / 0 | sạch | evidence/WP10/ruff.txt |
| `grep -cP '[\x08\x0b\x0c]'` 3 file ghi | 0 | 0 / 0 / 0 | — |
| `grep -c 'NotImplementedError("plan 06' neighbors.py` | — | 0 | — |

Đột biến (b) lần đầu SỐNG (E-06 xanh) vì ticket bị nhả rồi bị giữ lại ở bước 8 (cờ BẬT); đã siết E-06 thêm khẳng định "chưa từng có sự kiện ON_HOLD→RECEIVED", chạy lại ⇒ đỏ. Evidence mutation-b là lần chạy sau khi siết. Đột biến (c) đỏ cả E-00, E-08 ngoài E-02.

Test: tổng toàn bộ 3264 chạy (3263 pass, 1 fail, 0 skip, 53 deselected --pg). Test mới 16 (memory) / 21 (pg).

## git diff --stat (chưa stage khi viết dòng này; xem `git diff --cached --stat` sau khi stage)
Stage tường minh 3 file code/test + evidence + report.

## Worktree
D:/P151/.claude/worktrees/agent-abe287e60e536a8c0

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP10 a–d | 🟠 | Sonnet 5.5 (tự làm, không phân việc xuống) |

## Việc KHÔNG làm + lý do
- KHÔNG sửa `tests/test_maintenance/test_p1_infra.py::test_hook_stubs_have_their_stage_one_bodies` (cấm sửa test cũ): test này khẳng định thân stub WP5 (`_link_emergency_both_ways(...) is None` ngoài thao tác, `create_follow_up` ném `NotImplementedError`) nên ĐỎ khi WP10 lấp thân. Đây là test duy nhất đỏ trong toàn bộ suite. SO sửa khi gộp (bỏ 3 dòng hook P1-E và dòng `create_follow_up` khỏi test; WP7/8/9 sẽ đỏ cùng test này ở dòng của họ).
- KHÔNG đụng `engine.py`, seed, YAML, SPEC, plan. Cờ `hold_near_open_emergency` vẫn false trong YAML; test bật cờ bằng bản sao catalog trên engine của test.
- A-20 (`create_follow_up` trong LockProbe): đã có F-06, không thêm vào `test_agent_engine.py` (test cũ).

## Quyết định tự chọn (SO có thể đổi)
- `_link_emergency_both_ways` tính `_related_ticket_ids(emergency)` tại hook rồi gộp với `ticket_ids` truyền vào (Q23(2)); chỉ thêm liên kết + audit. `evaluate` 12/12 giữ nguyên, `expected` fixture không đổi ⇒ không có dừng báo SO theo Q23(2). TEC-006 vẫn ROUTED và liên kết hai chiều với CLN-004 (E-08).
- `create_follow_up`: không retry khi vân tay lệch (mixin không import `_StaleDecision`); nội dung đổi giữa chừng ⇒ `_prepared(..., retry_on_stale=False)` ⇒ luật quyết (`FALLBACK_RULE/STALE`), đúng như `receive`. Quyết định tính ngoài khoá trên case tạm `PENDING-FOLLOWUP`, gắn vào ticket thật bằng `self._local.prepared[new_id]`.
- Chỉ sửa test có thêm hai ca ngoài ma trận: `test_e00_*` (cờ YAML vẫn false, `_open_emergencies_at` đúng) và `test_e05b_*` (T05 hạ khẩn cấp cũng nhả).
- Lưu ý hành vi: bổ sung của cư dân có `submitted_at >= safety_cleared_at` được 2b đọc lại (đúng luật CR §5.2); test F-01 đặt bổ sung trước lúc BQL xác nhận.
- Follow-up từ ticket chỉ có "Có mùi khét" ra `VERIFYING/OUT_OF_SCOPE` (luật không có playbook cho mùi khét) — dừng hợp lệ; F-05 dùng câu "đèn không sáng và có mùi khét" để đi tới ROUTED.

## Câu hỏi cần người
1. SO sửa `test_hook_stubs_have_their_stage_one_bodies` (xem trên) khi gộp 4 WP.
2. Bật `hold_near_open_emergency` sau này ⇒ Trường sửa `expected` TEC-006 (SPEC-P07 §4.3); hiện không cần.

⏳ Chờ người duyệt.
