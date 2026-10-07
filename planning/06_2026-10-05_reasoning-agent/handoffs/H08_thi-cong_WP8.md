1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 (Q03, Q04) → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` §1, §6 → `specs/SPEC-P02-engine-integration.md` §2, §3, §4.5, §6.3 → `specs/SPEC-P05-split-two-jobs.md` (TOÀN BỘ) + `specs/REF-split-verdict.py` → `specs/TESTING-ACCEPTANCE.md` §1, §2, §3.7, §5, §10 → `specs/OPERATIONS.md` §2 (dòng WP8), §7.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (worktree riêng; 3 worker khác làm WP7/WP9/WP10 song song ở file mixin khác). Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base giao>`; cây bẩn ⇒ DỪNG, báo.
- Base giao có WP0–WP6: stub `_try_split`/`undo_split` ở `src/maintenance/coordination/split.py`, chỗ gọi ở bước 3 trong `engine.py`; `rules.split_verdict`; Agent + client giả (`MirrorClient`, `ScriptedClient`), helper `agent_engine`/`decision`.
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (KHÔNG đọc/in `.env`, KHÔNG gọi mạng).
- `--pg`: container `p151-pgtest` (127.0.0.1:55433, `p151`/`p151`); DB RIÊNG `p151_wp8_test` (`docker exec p151-pgtest createdb -U p151 p151_wp8_test`); `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp8_test`. CẤM đụng DB khác.

## 2. PHẠM VI
- ĐƯỢC GHI: `src/maintenance/coordination/split.py`, `tests/test_maintenance/test_p1_split.py` (mới), `tests/test_maintenance/test_acceptance.py` (CHỈ 2 câu ví dụ SPEC-P05 §8, giữ assert) + `planning/06_2026-10-05_reasoning-agent/evidence/WP8/*`, `…/reports/R08_thi-cong_WP8.md`.
- CẤM: `engine.py`, `agent/**`, `proposer.py`, `lexicon.yaml`, `merge.py`, `department.py`, `neighbors.py`, SPEC, `plan.md`, test cũ khác. Vùng cấm + lý do: SPEC-P05 §7.

## 3. VIỆC PHẢI LÀM
a. `test_p1_split.py` S-01…S-12 (TESTING §3.7; ≥ 30 câu tách thật qua `receive` với `MirrorClient` VÀ đường luật, ≥ 15 câu không tách, ca G-1; S-11 `memory` + `postgres`; tên hàm mang ID) TRƯỚC; chạy ⇒ S-01 đỏ ⇒ `evidence/WP8/red-before.txt`.
b. Lấp `_try_split` (§3 đủ 5 điều kiện), `_split_mixed_report` (§3.1 đúng thứ tự 1–8), `_rebind_after_split`, `undo_split` (§5); đổi 2 câu `test_acceptance.py` (§8).
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p1_split.py tests/test_maintenance/test_acceptance.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP8/green.txt`; `--pg` file `test_p1_split.py` ⇒ `EXIT=0` ⇒ `evidence/WP8/pg.txt`.
c. Đột biến SPEC-P05 §10: (a) bỏ điều kiện 4 ⇒ S-03 đỏ; (b) bỏ điều kiện 3 ⇒ S-08 đỏ; (c) bỏ `self.llm is None` ở nhánh luật ⇒ S-05 đỏ ⇒ `evidence/WP8/mutation-{a,b,c}.txt`; khôi phục sau mỗi cái.
d. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP8/pytest.txt` (+`EXIT=$?`): 0 fail/skip, tổng ≥ nền + mới; REF `$PY planning/06_2026-10-05_reasoning-agent/specs/REF-split-verdict.py --variants | tail -3` ⇒ `VARIANT_FAILURES=0` ⇒ `evidence/WP8/ref.txt`; ruff check + format ⇒ `evidence/WP8/ruff.txt` `EXIT=0`; `grep -c 'NotImplementedError("plan 06' src/maintenance/coordination/split.py` = 0.

## 4. LUẬT
- Gốc = `SPLIT_PAIR[0]`, con = `SPLIT_PAIR[1]`; gốc + con MỘT giao dịch (`_insert_case`); KHÔNG gọi mô hình cho ticket con; không tách lần hai; không ghi loại tách vào `locked_fields`.
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho mã; mọi file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- Hook/chỗ gọi trong `engine.py` thiếu hoặc sai ⇒ KHÔNG sửa `engine.py`; ghi "Câu hỏi mở" (SO xử), làm phần còn lại. Test cũ đỏ ⇒ sửa code của bạn; không skip/xfail.
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file — SO gộp + commit. Không sửa SPEC/plan. Evidence = output máy.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP8 a–d | 🟠 | SPEC thứ tự bước + REF đo được, test tự biết đúng/sai |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H08_thi-cong_WP8.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip (+deselected); `git diff --cached --stat`; đường worktree; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R08_thi-cong_WP8.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP8/pytest.txt`
