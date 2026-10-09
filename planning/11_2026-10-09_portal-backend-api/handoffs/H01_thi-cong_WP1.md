1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: từ `D:/P151-portal-fe` chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — ghi exit code; KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/11_2026-10-09_portal-backend-api/plan.md` §2 → `specs/00-ARCHITECTURE.md` §2–§3 → `specs/SPEC-P01-backend-ext.md` (toàn bộ) → `specs/TESTING-ACCEPTANCE.md` §1–§2 (dòng WP1) → `docs/maintenance.md` (đọc trước khi sửa `src/maintenance/`).

## 1. Bối cảnh
- Worktree `D:/P151-portal-fe`, nhánh `feature/nhuy-portal-fe`, Base `da20de9`. Ghi `git rev-parse HEAD` + `git status --porcelain` trước khi sửa. Một worker khác (WP2) đang sửa `portal/**` song song — KHÔNG chạm `portal/`.
- Portal Next.js sẽ gọi backend Python; backend cần thêm tài khoản portal, luồng "Việc của BQL", vật tư ngoài danh mục, 2 route sai phòng ban (SPEC-P01 §1–§4).
- Python: `D:/P151/.venv/Scripts/python.exe` (3.11). Env: `LLM_MODE=mock MO_STORE=memory MO_PHOTO_STORE=local PYTHONUTF8=1 PYTHONPATH=.`. Không mạng, không đọc `.env`, KHÔNG kết nối Supabase.

## 2. Phạm vi
- ĐƯỢC GHI: đúng danh sách file WP1 ở plan.md §3; `planning/11_.../evidence/WP1/*`; `planning/11_.../reports/R01_thi-cong_WP1.md`.
- CẤM: `portal/**`, luật an toàn/Agent/prompt/`lexicon.yaml`, thêm trường hoặc giá trị enum vào model doc ticket (`Case`, `Ticket`, `Blocker`, `MaterialLine`…), đổi tài khoản cũ, `git stash`, commit, push, `git add -A`.

## 3. Việc phải làm
a. Viết test TRƯỚC: `tests/test_maintenance/test_portal_backend_ext.py` phủ SPEC-P01 nghiệm thu §1, §2, §3, §4 (engine + API qua `TestClient`, đăng nhập bằng token thật). Chạy ⇒ đỏ ⇒ `evidence/WP1/red-before.txt`.
b. Thi công SPEC-P01 §1–§4. Migration `0003_material_items` theo mẫu revision có sẵn trong `src/maintenance/store/migrations/versions/` (chỉ CREATE TABLE). Postgres store: viết SQL nhưng chỉ test được với `--pg` (không có container ⇒ ghi NOT_RUN).
c. Tương thích (SPEC-P01 §2 nghiệm thu cuối): trong test, `git show da20de9:src/maintenance/models.py` không import được trực tiếp ⇒ thay bằng khẳng định: `Case.model_dump(mode="json")` sau mỗi bước chỉ có các khoá có trong `Case.model_fields`/`Ticket.model_fields`/`Blocker.model_fields` ở Base (liệt kê tĩnh trong test) — không khoá mới.
d. Xong khi (mỗi file evidence kết `EXIT=`):
   - `pytest tests/test_maintenance/test_portal_backend_ext.py -v` EXIT=0 ⇒ `evidence/WP1/green.txt`
   - `pytest -q -p no:cacheprovider` EXIT=0, tổng ≥ 3664 + số test mới, 0 fail/0 skip ⇒ `evidence/WP1/pytest.txt`
   - `ruff check src tests` + `ruff format --check src tests` — file bạn sửa phải sạch; `src/main.py` lệch định dạng có sẵn từ develop (không sửa) ⇒ `evidence/WP1/ruff.txt`
   - Đột biến (khôi phục sau): (m1) bỏ kiểm `escalated` ở `to-bql`; (m2) `handled` không đòi OUT_OF_SCOPE; (m3) tạo vật tư trùng tên ra mã mới ⇒ mỗi cái làm đỏ ≥1 test ⇒ `evidence/WP1/mutation-m{1,2,3}.txt`
   - Ghi evidence bằng redirect của Git Bash (UTF-8). CẤM PowerShell `>` (ra UTF-16).

## 4. Luật
- Quyền kiểm ở engine (`_mutate`/`_deny`), router mỏng. Note rỗng ⇒ `GuardError`.
- Lệnh bị từ chối quyền ⇒ không lách, ghi vào "câu hỏi cần người".
- Thiếu chi tiết trong SPEC ⇒ chọn phương án an toàn, ghi rõ trong report mục "Quyết định của worker".

## 5. Tầng: 🟠 (spec + test tự biết đúng/sai). Không giao con.

## 6. Mẫu report `planning/11_2026-10-09_portal-backend-api/reports/R01_thi-cong_WP1.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H01_thi-cong_WP1.md` / `Base: <sha>` / `Head: <sha>; working tree chưa commit`; bảng lệnh + exit + kết quả; test tổng/pass/fail/skip; `git diff --stat` + file untracked; route/method mới (chữ ký); quyết định của worker; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
