1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21, SO đo ở root `D:/P151` = exit 0) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 → `specs/00-ARCHITECTURE.md` (I-30, V-10) → `specs/01-CONTRACTS.md` §4.1, §12 → `specs/OPERATIONS.md` §2 (dòng WP4), §4, §5, §6, §7 → `specs/TESTING-ACCEPTANCE.md` §1, §3.12, §5 (dòng WP4), §10.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (có thể là worktree riêng). Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và `git status --porcelain` rỗng ⇒ `git reset --hard <base giao>`; cây bẩn ⇒ DỪNG, báo.
- Nền đo (SO 21:05): `pytest -q` ⇒ `2971 passed, 29 deselected`; ruff sạch.
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (`.env` của máy bật openai + khoá thật — KHÔNG đọc/in/chép/sửa `.env`, KHÔNG gọi mạng).
- Postgres test (`--pg`): container tạm `p151-pgtest` do SO dựng (`127.0.0.1:55433`, user/pass `p151`). Bạn dùng DB RIÊNG: `docker exec p151-pgtest createdb -U p151 p151_wp4_test` (đã có thì bỏ qua) rồi `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp4_test`. CẤM đụng container/DB khác. Docker không chạy được ⇒ ghi "⬜ --pg chưa chạy" + output lỗi, KHÔNG dừng phần còn lại.
- J-01 đọc `tests/test_maintenance/data/case_pre_p1.json` (WP0 sinh song song). Chưa có trong cây ⇒ tự sinh bằng lệnh OPERATIONS §3.3 TRƯỚC mọi sửa, KHÔNG stage file đó.

## 2. PHẠM VI
- ĐƯỢC GHI: `src/config.py`, `.env.example`, `src/maintenance/store/postgres.py` (CHỈ `HEAD_REVISION`), `src/maintenance/store/migrations/versions/0002_p1_doc_shape.py` (mới), `tests/test_maintenance/test_p1_store.py` (mới), `planning/06_2026-10-05_reasoning-agent/evidence/WP4/*`, `…/reports/R03_thi-cong_WP4.md`.
- CẤM: `.env` thật, `models.py` (WP1 làm song song), mọi file khác, SPEC, `plan.md`. Vùng cấm + lý do: 00 §6 (V-10), 01 §12–§14, OPERATIONS §8.

## 3. VIỆC PHẢI LÀM
a. Viết `test_p1_store.py` J-01…J-05 (TESTING §3.12; tên hàm mang ID; J-02, J-04 dùng mẫu `STORES`/`pytest.mark.pg` như `test_cr03_store.py`) TRƯỚC khi sửa; chạy ⇒ J-03 đỏ ⇒ `evidence/WP4/red-before.txt`.
   Lưu ý J-01: doc cũ phải đọc được bằng model hiện tại VÀ (sau khi WP1 gộp) bằng model mới — test chỉ dùng `Case.model_validate` + round-trip, không giả định trường P1.
b. `Settings` thêm 4 trường 01 §4.1 (đúng tên/kiểu/ràng buộc); `.env.example` thêm khối OPERATIONS §4 dạng `KEY=giá trị` + chú thích tiếng Anh (KHÔNG ghi khoá thật; `OPENAI_API_KEY=` để trống).
c. Revision đánh dấu 01 §12.3 (thân `pass`, docstring đúng câu), `HEAD_REVISION = "0002_p1_doc_shape"`.
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p1_store.py tests/test_maintenance/test_persistence_guards.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP4/green.txt`.
d. `--pg`: `MO_TEST_DATABASE_URL=… $PY -m pytest --pg -q -p no:cacheprovider tests/test_maintenance/test_p1_store.py tests/test_maintenance/test_store_postgres.py tests/test_maintenance/test_persistence_guards.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP4/pg.txt`.
e. Đột biến: `upgrade()` chứa `op.execute("select 1")` ⇒ J-05 đỏ ⇒ `evidence/WP4/mutation-j05.txt`; khôi phục.
f. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP4/pytest.txt` (+`EXIT=$?`): 0 fail/skip, tổng ≥ 2971 + mới; ruff check + format ⇒ `evidence/WP4/ruff.txt` `EXIT=0`.

## 4. LUẬT
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho mã; file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file — SO gộp + commit.
- Không sửa SPEC/plan; SPEC mâu thuẫn ⇒ "Câu hỏi mở", làm phần độc lập. Evidence = output máy, CẤM sửa tay; không ghi URL có mật khẩu thật (DB test `p151:p151` được phép).

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP4 a–f | 🟠 | SPEC đủ chữ ký + test tự biết đúng/sai |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H03_thi-cong_WP4.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip (+ deselected); `git diff --cached --stat`; đường worktree; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R03_thi-cong_WP4.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP4/pytest.txt`
