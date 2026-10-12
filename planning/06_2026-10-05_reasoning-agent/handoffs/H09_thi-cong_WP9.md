1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` §2.3, §5, §6, §7 → `specs/SPEC-P02-engine-integration.md` §2, §3 → `specs/SPEC-P06-department.md` (TOÀN BỘ) → `specs/TESTING-ACCEPTANCE.md` §1, §3.8, §5, §10 → `specs/OPERATIONS.md` §2 (dòng WP9), §7.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (worktree riêng; 3 worker khác làm WP7/WP8/WP10 song song ở file mixin khác). Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base giao>`; cây bẩn ⇒ DỪNG, báo.
- Base giao có WP0–WP6: thân T15 đã chuyển vào hook `_t15_return_wrong_department`, stub T16/T17/`bql_wrong_department`/`_carry_over_material_qty` ở `src/maintenance/coordination/department.py`; chỗ gọi đã đặt trong `engine.py`; `ExecutionSnapshot` trong `models.py`.
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (KHÔNG đọc/in `.env`, KHÔNG gọi mạng).
- `--pg`: container `p151-pgtest` (127.0.0.1:55433, `p151`/`p151`); DB RIÊNG `p151_wp9_test` (`docker exec p151-pgtest createdb -U p151 p151_wp9_test`); `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp9_test`. CẤM đụng DB khác.

## 2. PHẠM VI
- ĐƯỢC GHI: `src/maintenance/coordination/department.py`, `tests/test_maintenance/test_p1_department.py` (mới) + `planning/06_2026-10-05_reasoning-agent/evidence/WP9/*`, `…/reports/R09_thi-cong_WP9.md`.
- CẤM: `engine.py`, `agent/**`, `models.py`, `merge.py`, `split.py`, `neighbors.py`, `src/api/**`, `src/web/**`, SPEC, `plan.md`, mọi test cũ. Vùng cấm + lý do: SPEC-P06 §7.

## 3. VIỆC PHẢI LÀM
a. `test_p1_department.py` D-01…D-10 (TESTING §3.8; D-04 `memory` + `postgres`; tên hàm mang ID) TRƯỚC; chạy ⇒ D-02, D-03, D-05…D-08 đỏ ⇒ `evidence/WP9/red-before.txt`.
b. Lấp thân SPEC-P06 §2–§6 (T15 đếm + E03 theo `sla_config.wrong_dept_return.escalate_at_count` — CẤM hardcode 2; T16; T17; `bql_wrong_department` kiểm `decision` TRƯỚC mọi thứ; E02 + `_take_execution_snapshot`; `_carry_over_material_qty`).
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p1_department.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP9/green.txt`; `--pg` cùng file ⇒ `EXIT=0` ⇒ `evidence/WP9/pg.txt`.
c. Đột biến SPEC-P06 §9: (a) bỏ `escalated=True` ⇒ D-02 đỏ; (b) E02 không chụp snapshot ⇒ D-07 đỏ; (c) T16 đặt `department_id=None` ⇒ D-04 đỏ ⇒ `evidence/WP9/mutation-{a,b,c}.txt`; khôi phục sau mỗi cái.
d. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP9/pytest.txt` (+`EXIT=$?`): 0 fail/skip, tổng ≥ nền + mới; ruff check + format ⇒ `evidence/WP9/ruff.txt` `EXIT=0`; `grep -c 'NotImplementedError("plan 06' src/maintenance/coordination/department.py` = 0.

## 4. LUẬT
- Không gọi Agent ở T16/T17/E02; T16 giữ nguyên dữ liệu thực hiện; E02 chụp snapshot TRƯỚC khi đặt lại checklist.
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho mã; mọi file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- Hook/chỗ gọi trong `engine.py` thiếu hoặc sai ⇒ KHÔNG sửa `engine.py`; ghi "Câu hỏi mở" (SO xử), làm phần còn lại. Test cũ đỏ ⇒ sửa code của bạn; không skip/xfail.
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file — SO gộp + commit. Không sửa SPEC/plan. Evidence = output máy.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP9 a–d | 🟠 | SPEC vòng đời + bảng lỗi đầy đủ, test tự biết đúng/sai |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H09_thi-cong_WP9.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip (+deselected); `git diff --cached --stat`; đường worktree; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R09_thi-cong_WP9.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP9/pytest.txt`
