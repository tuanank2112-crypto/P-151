Worker · thi công · Sonnet 5.5 · Bước 0 chưa chạy trong worktree (Q21, SO đã đo) · hiểu việc: phạm vi merge.py + engine.py (chỉ `rate` và nhánh DUPLICATE của `bptn_resolve`) + priority.py + test_p1_merge.py mới + test_priority.py (chỉ thêm) · xong khi 2 file test EXIT=0, `--pg` EXIT=0, 3 đột biến đỏ đúng test · cấm split/department/neighbors/agent/models/views/SPEC/plan/test cũ khác
Handoff: handoffs/H07_thi-cong_WP7.md
Base: f1f3725 (HEAD ban đầu 50fe728 khác base, cây sạch ⇒ `git reset --hard f1f3725`)
Head: chưa commit (SO gộp)

| Lệnh | Exit | Kết quả | Evidence |
|---|---|---|---|
| pytest test_p1_merge + test_priority trước khi lấp hook | 1 | 21 failed, 23 passed, 20 deselected | evidence/WP7/red-before.txt |
| pytest 2 file sau khi lấp | 0 | 44 passed, 20 deselected, 0 skip | evidence/WP7/green.txt |
| `--pg` test_p1_merge (DB p151_wp7_test) | 0 | 40 passed (20 memory + 20 postgres) | evidence/WP7/pg.txt |
| đột biến (a) bỏ +1 ở `_on_duplicate_detected` | 1 | 8 failed gồm M-01, M-01b, M-02 | evidence/WP7/mutation-a.txt |
| đột biến (b) `_content` đọc cả `merged_from` | 1 | 1 failed: M-03 | evidence/WP7/mutation-b.txt |
| đột biến (c) `_unmerge` luôn từ bước 4 | 1 | 2 failed: M-07, M-11b | evidence/WP7/mutation-c.txt |
| pytest toàn bộ | 1 | 3270 passed, 1 failed, 0 skip, 68 deselected | evidence/WP7/pytest.txt |
| ruff check + format --check (5 file đụng) | 0 | sạch | evidence/WP7/ruff.txt |
| `grep -c 'NotImplementedError("plan 06' merge.py` | 0 | 0 | — |
| `grep -cP '[\x08\x0b\x0c]'` 5 file | 0 | 0 mỗi file | — |

Fail duy nhất của toàn bộ: tests/test_maintenance/test_p1_infra.py::test_hook_stubs_have_their_stage_one_bodies (test cũ của WP5 ghim thân stub của CẢ 4 mixin). Dòng 405-406 và 413 buộc `_t09_unmerge_by_person`, `_unmerge`, `bql_merge` ném NotImplementedError, mâu thuẫn trực tiếp SPEC-P04 ⇒ theo luật handoff không sửa, ghi vào câu hỏi mở. Đã đo: các dòng 395-398 (hook WP7 no-op) vẫn qua; chỉ dòng 411 đỏ (InvalidTransitionError thay vì NotImplementedError).

git diff --cached --stat: 13 files (+report), 1733 insertions, 17 deletions (merge.py, engine.py, priority.py, test_p1_merge.py mới, test_priority.py, 8 evidence) — SHA chưa có (chưa commit).
Worktree: D:/P151/.claude/worktrees/agent-a70dcd63d06da071f

Bảng phân công: WP7 a–d → 🟠 → Sonnet 5.5 (tự làm, không giao con).

Test: test_p1_merge.py 20 hàm (M-01…M-12 + biến thể 01b, 06b, 09b/c/d, 10b, 11b, 12b) × `memory`; M-03 và M-08 thêm bản `postgres` (+ toàn bộ file chạy 2 kho khi `--pg` vì fixture `repo` tham số hóa: 40 ca). test_priority.py thêm 3 test PRI-U1 (đọc ngưỡng từ `sla_config`, cấm literal 3 trong merge.py).

Việc không làm / lưu ý:
- Không sửa test_p1_infra.py (cấm; xem câu hỏi 1).
- Bước 0 `init_brain --check` không chạy trong worktree (Q21).
- Helper mới ngoài danh sách SPEC: `_count_if_open(root_id, delta, other_id, actor_id, role, now, *, why)` trong merge.py (đọc `_case_view` trước, khóa `_related_case` chỉ khi gốc còn mở; dùng ở `_unmerge`, `_release_duplicate_count`, và nhánh `merge=False` của `bptn_resolve`). Chỉ thêm, không đổi hành vi SPEC.
- `_refresh_priority` bọc `_propose_priority` trong `_activated(root)` để nền Agent (bản ghi lưu còn khớp vân tay) được dùng, đúng §2.2.
- Audit từ chối T09 của BPTN trên ticket khẩn cấp: `_deny` ghi `action=ACTION_DENIED`, `requested=MERGE_UNDO` nằm trong `reason` (hành vi sẵn có của `_deny`); test M-07 khẳng định theo đó.
- Dây chuyền T08 BPTN dùng `_has_open_merged_children` đúng SPEC; M-05 chạy bằng `bql_merge` (khẩn cấp) vì BPTN không tạo được ticket có con đang gộp mà tự nó lại DUPLICATE của ticket khác nếu không có Agent.

Câu hỏi mở cho SO:
1. test_p1_infra.py::test_hook_stubs_have_their_stage_one_bodies phải đổi (dòng 405, 406, 413: bỏ `_t09_unmerge_by_person`, `_unmerge`, `bql_merge` khỏi danh sách "còn NotImplementedError"). WP8/9/10 sẽ làm vỡ cùng test ở phần của họ ⇒ SO sửa một lần khi gộp, hoặc giao WP13.
2. Pipeline chạy lại từ bước ≤4 cho ticket đã từng `VERIFYING/DUPLICATE` rồi ra khỏi trạng thái đó mà không qua bác trùng/hủy (hiện không có đường như vậy khi không có Agent) sẽ đếm +1 lần nữa trên gốc; SPEC không nói. Chưa có ca thực, ghi để WP12 soi.

⏳ Chờ người duyệt.
