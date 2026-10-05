1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng `BRN-002 … khối luật: boot` (CRLF, Q21) ⇒ ghi exit và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 (Q28) → `specs/SPEC-P08-audit-fixes.md` §5–§9 → `reports/R12_tham-dinh_WP12.md` §5 (F4–F9) → `specs/SPEC-P04-duplicate-merge.md` §2.1, §8 → `specs/SPEC-P05-split-two-jobs.md` §3, §5, §7 → `specs/SPEC-P07-neighbors-follow-up.md` §6.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151`. Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base>`; cây bẩn ⇒ DỪNG, báo.
- Thẩm định R12 tìm ra lỗi ở luồng gộp/tách/follow-up (số đếm trùng sai sau hoàn tác tách, hoàn tác tách lần 2 ném lỗi 422, gộp dây chuyền, tách câu nhắc hai nơi, follow-up mất khoá vị trí). Probe tái hiện ở `planning/06_2026-10-05_reasoning-agent/evidence/WP12/probes/` (chỉ đọc).
- Python: gọi NGUYÊN VĂN `C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe` (KHÔNG dùng biến làm tên lệnh), env `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.`. Không mạng, không đọc/in `.env`.
- `--pg`: chỉ `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp15_test` (container `p151-pgtest`; tạo DB nếu chưa có).

## 2. PHẠM VI
- ĐƯỢC GHI: `src/maintenance/coordination/split.py`, `merge.py`, `neighbors.py`, `tests/test_maintenance/test_p1_audit_fixes_coord.py` (mới), test cũ mà §5–§7 buộc đổi khẳng định (liệt kê trong report), `…/evidence/WP15/*`, `…/reports/R15_thi-cong_WP15.md`.
- CẤM: `engine.py`, `agent/**`, `safety.py`, `lexicon.yaml` (WP14 đang sửa song song), `src/api/**`, `src/web/**`, SPEC, `plan.md`, `git stash`, commit, push, `git add -A`. Cần đổi `engine.py` ⇒ DỪNG, báo SO.

## 3. VIỆC PHẢI LÀM
a. Viết test TRƯỚC cho F4, F5, F6, F7, F8, F9 theo nghiệm thu SPEC-P08 §5–§7 (chép logic probe vào test, không import evidence); chạy ⇒ đỏ ⇒ `evidence/WP15/red-before.txt`.
b. Sửa đúng SPEC-P08 §5–§7. Xong khi: file test mới `EXIT=0` ⇒ `evidence/WP15/green.txt`; probe `extra_undo_split.py`, `extra_dup_count_walk.py`, `extra_followup_split_safety.py`, `break6_wrong_split.py` trên HEAD của bạn: các mục F4–F9 đạt ⇒ `evidence/WP15/probes-after.txt`.
c. `REF-split-verdict.py --variants` (`PYTHONPATH=.`) ⇒ `VARIANT_FAILURES=0`, 32 MUST_SPLIT vẫn tách ⇒ `evidence/WP15/split-verdict.txt`.
d. Đột biến (mỗi cái phải làm đỏ test mới, khôi phục sau): (a) bỏ `_release_duplicate_count` trong `undo_split`; (b) bỏ điều kiện 6 "hai nơi"; (c) bỏ chép khoá vị trí ở follow-up ⇒ `evidence/WP15/mutation-{a,b,c}.txt`.
e. Cổng chung SPEC-P08 §9: pytest toàn bộ, `--pg` toàn bộ, ruff check + format ⇒ `evidence/WP15/{pytest,pg,ruff}.txt` (mỗi file kết bằng `EXIT=`).

## 4. LUẬT
- Bất biến P04 §2.1 về `duplicate_count` là chuẩn duy nhất; không thêm trường mới vào model.
- `\b` trong regex: ghi file bằng Write/Edit; `grep -cP '[\x08\x0b\x0c]'` = 0 mọi file đã ghi.
- Lệnh bị từ chối quyền ⇒ không lách, ghi "câu hỏi cần người".

## 5. TẦNG: 🟠 (có SPEC + test tự biết đúng/sai; tự làm, không giao con).

## 6. MẪU REPORT `reports/R15_thi-cong_WP15.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H14_thi-cong_WP15.md` / `Base: <sha>` / `Head: chưa commit (SO gộp)`; bảng lệnh + exit + kết quả; test tổng/pass/fail/skip; `git diff --cached --stat`; test cũ đã đổi khẳng định + lý do; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
