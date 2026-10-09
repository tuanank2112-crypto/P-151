1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 (Q19 = 3) → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` §6, §10 → `specs/SPEC-P02-engine-integration.md` §2, §3, §6.3–§6.4 → `specs/SPEC-P04-duplicate-merge.md` (TOÀN BỘ) → `specs/TESTING-ACCEPTANCE.md` §1, §3.6, §5, §10 → `specs/OPERATIONS.md` §2 (dòng WP7), §7.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (worktree riêng; 3 worker khác làm WP8/WP9/WP10 song song ở file mixin khác). Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base giao>`; cây bẩn ⇒ DỪNG, báo.
- Base giao có WP0–WP6: hook + stub ở `src/maintenance/coordination/merge.py`, chỗ gọi đã đặt trong `engine.py`; Agent tích hợp (client giả ở `agent/client.py`, helper `agent_engine`/`decision` ở `tests/test_maintenance/helpers.py`).
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (KHÔNG đọc/in `.env`, KHÔNG gọi mạng).
- `--pg`: container `p151-pgtest` (127.0.0.1:55433, `p151`/`p151`); DB RIÊNG `p151_wp7_test` (`docker exec p151-pgtest createdb -U p151 p151_wp7_test`, có rồi bỏ qua); `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp7_test`. CẤM đụng DB khác.

## 2. PHẠM VI
- ĐƯỢC GHI: dòng "File được ghi" của SPEC-P04 — `src/maintenance/coordination/merge.py`, `src/maintenance/engine.py` (CHỈ thân `rate` + nhánh `DUPLICATE` của `bptn_resolve`), `src/maintenance/priority.py`, `tests/test_maintenance/test_p1_merge.py` (mới), `tests/test_maintenance/test_priority.py` (CHỈ THÊM test) + `planning/06_2026-10-05_reasoning-agent/evidence/WP7/*`, `…/reports/R07_thi-cong_WP7.md`.
- CẤM: `split.py`, `department.py`, `neighbors.py`, phần khác của `engine.py`, `agent/**`, `models.py`, `views.py`, SPEC, `plan.md`, test cũ khác. Vùng cấm + lý do: SPEC-P04 §8.

## 3. VIỆC PHẢI LÀM
a. `test_p1_merge.py` M-01…M-12 (TESTING §3.6; M-03, M-08 chạy `memory` + `postgres`; tên hàm mang ID; ≥ 14 test) + test PRI-U1 thêm vào `test_priority.py`, TRƯỚC khi lấp hook; chạy ⇒ ≥ 12 fail ⇒ `evidence/WP7/red-before.txt`.
b. Lấp thân SPEC-P04 §2–§7 (`_count_duplicate`, `_refresh_priority`, `_has_open_merged_children`, mọi hook merge, `bql_merge`, `_t09_unmerge_by_person`, `_unmerge`, hủy gốc, `rate`, PRI-U1 ở `priority.py` theo 01 §10 — ngưỡng đọc `sla_config.priority.duplicate_raise_at_count`, CẤM hardcode 3).
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p1_merge.py tests/test_maintenance/test_priority.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP7/green.txt`; `--pg` file `test_p1_merge.py` ⇒ `EXIT=0` ⇒ `evidence/WP7/pg.txt`.
c. Đột biến SPEC-P04 §10: (a) bỏ `+1` trong `_on_duplicate_detected` ⇒ M-01, M-02 đỏ; (b) cho `_content` đọc cả `merged_from` ⇒ M-03 đỏ (sửa tạm `engine.py`, khôi phục ngay); (c) `_unmerge` luôn chạy từ bước 4 ⇒ M-07 đỏ ⇒ `evidence/WP7/mutation-{a,b,c}.txt`.
d. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP7/pytest.txt` (+`EXIT=$?`): 0 fail/skip, tổng ≥ nền + mới; ruff check + format ⇒ `evidence/WP7/ruff.txt` `EXIT=0`; `grep -c 'NotImplementedError("plan 06' src/maintenance/coordination/merge.py` = 0.

## 4. LUẬT
- Mọi ghi gốc/con khác qua `_related_case` (I-25); không ghi ticket đã kết thúc (I-26); không gọi mô hình khi gộp/hoàn tác/hủy.
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho mã; mọi file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- Test cũ đỏ ⇒ sửa code; SPEC buộc đổi test cũ ⇒ DỪNG, "Câu hỏi mở". Không skip/xfail.
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file — SO gộp + commit. Không sửa SPEC/plan. Evidence = output máy.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP7 a–d | 🟠 | SPEC chữ ký + bảng lỗi đầy đủ, test tự biết đúng/sai |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H07_thi-cong_WP7.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip (+deselected); `git diff --cached --stat`; đường worktree; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R07_thi-cong_WP7.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP7/pytest.txt`
