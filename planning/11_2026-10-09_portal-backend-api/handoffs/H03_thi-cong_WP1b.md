1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: từ `D:/P151-portal-fe` chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — ghi exit code; KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/11_2026-10-09_portal-backend-api/plan.md` §2 (Q09–Q19) → `specs/00-ARCHITECTURE.md` §2 → `specs/SPEC-P04-backend-ext2.md` (toàn bộ) → `specs/SPEC-P01-backend-ext.md` (mẫu đã thi công ở WP1) → `reports/R01_thi-cong_WP1.md` (quyết định WP1) → `docs/maintenance.md`.

## 1. Bối cảnh
- Worktree `D:/P151-portal-fe`, nhánh `feature/nhuy-portal-fe`, Base `4be6284`. Ghi `git rev-parse HEAD` + `git status --porcelain` trước khi sửa. Worker WP2b sửa `portal/**` song song — KHÔNG chạm `portal/`.
- Một backend memory đang chạy ở cổng 8000 từ worktree này (để người dùng xem UI). Bạn KHÔNG tắt nó; test dùng `TestClient`, không cần server.
- Python `D:/P151/.venv/Scripts/python.exe` (3.11). Env `LLM_MODE=mock MO_STORE=memory MO_PHOTO_STORE=local PYTHONUTF8=1 PYTHONPATH=.`. Không mạng, không đọc `.env`, KHÔNG kết nối Supabase.

## 2. Phạm vi
- ĐƯỢC GHI: `seed/maintenance_v1/staff.yaml` (mới), `src/api/**`, `src/maintenance/engine.py`, `src/maintenance/coordination/**`, `src/maintenance/views.py`, `src/maintenance/store/**` (gồm migration `0004_portal_extras`), `src/maintenance/catalog.py` (chỉ nếu cần đọc staff.yaml), `src/config.py`, `tests/test_maintenance/test_portal_backend_ext2.py` (mới), test cũ bị SPEC buộc đổi khẳng định (liệt kê + lý do), `planning/11_.../evidence/WP1b/*`, `planning/11_.../reports/R03_thi-cong_WP1b.md`.
- CẤM: `portal/**`; thêm trường/giá trị enum vào model doc ticket (`Case`, `Ticket`, `Blocker`, `MaterialLine`…) — trường mới CHỈ ở model response; luật an toàn/Agent prompt/`lexicon.yaml`; commit, push, `git add -A`, `git stash`.

## 3. Việc phải làm
a. Test TRƯỚC `test_portal_backend_ext2.py` phủ SPEC-P04 §1–§5 (engine + API qua `TestClient`, đăng nhập token thật) ⇒ đỏ ⇒ `evidence/WP1b/red-before.txt`.
b. Thi công SPEC-P04 §1–§5. Chỗ SPEC để worker đo và chọn (§2 đường resume) ⇒ ghi "Quyết định của worker".
c. Xong khi (mỗi file evidence kết `EXIT=`, ghi bằng Git Bash redirect, CẤM PowerShell `>`):
   - `pytest tests/test_maintenance/test_portal_backend_ext2.py -v` EXIT=0 ⇒ `green.txt`
   - `pytest -q -p no:cacheprovider` EXIT=0, tổng ≥ 3720 + mới, 0 fail/0 skip ⇒ `pytest.txt`
   - `ruff check src tests` EXIT=0; `ruff format --check` sạch với file bạn sửa ⇒ `ruff.txt`
   - đột biến m4, m5, m6 (SPEC-P04 §7), khôi phục sau ⇒ `mutation-m{4,5,6}.txt`
   - `--pg` nếu dựng được Postgres tạm bằng docker (xoá sau) ⇒ `pytest-pg.txt`, không được ⇒ NOT_RUN + lý do.

## 4. Luật
- Quyền ở engine (`_mutate`/`_deny`), router mỏng; note rỗng ⇒ `GuardError`.
- Lệnh bị từ chối quyền ⇒ không lách, ghi "câu hỏi cần người".

## 5. Tầng: 🟠. Không giao con.

## 6. Mẫu report `reports/R03_thi-cong_WP1b.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H03_thi-cong_WP1b.md` / `Base: <sha>` / `Head: <sha>; working tree chưa commit`; bảng lệnh + exit; test tổng/pass/fail/skip; `git diff --stat` + untracked; route/model response mới (chữ ký JSON); quyết định của worker; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
