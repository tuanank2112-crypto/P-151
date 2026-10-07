# OPERATIONS — thứ tự, môi trường, migration, rollback

## 1. Thứ tự BẮT BUỘC
1. Người dùng duyệt hồ sơ + P1 (Trường duyệt delta CR, 01 §8) + P5 (cho phép merge `origin/develop`).
2. SO: `git merge origin/develop` vào `feature/nhuy-reasoning-agent` (không xung đột với `77d5279` — develop đã chứa nhánh); chạy cổng §3 trên nền mới ⇒ ghi số baseline vào `plan.md` §4.
3. SO dựng venv (§2).
4. H13 plan 06 (WP14: F1, F3-BLOCKED, F10, F2/F11) thi công ⇒ SO duyệt ✅ (Q10). H14 (WP15) có thể chạy song song với H13 trong worktree riêng như plan 06 §6.
5. H01 (WP1) ⇒ SO đo lại ⇒ ✅ · H02 (WP2) ⇒ ✅ · H03 (WP3, agent KHÁC, chỉ đọc) ⇒ ✅ · WP4 SO đồng bộ não + version.
6. Commit theo gói (Conventional Commits tiếng Anh, stage tường minh); `git push` + PR vào `develop` CHỈ sau khi người dùng cho phép.

## 2. Môi trường
- Repo hiện KHÔNG có `.venv` (đo 2026-10-07; Python 3.11 hệ thống thiếu `langgraph`, `ruff`). SO dựng: `py -3.11 -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt ruff` (`.venv/` đã trong `.gitignore`). Worker dùng đúng `.venv/Scripts/python`; thiếu ⇒ BLOCKED, KHÔNG tự cài.
- Env cho mọi lệnh test: `LLM_MODE=mock MO_STORE=memory MO_PHOTO_STORE=local PYTHONUTF8=1 PYTHONPATH=.`; không mạng, không đọc/in `.env`.
- `--pg`: `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp08_test` (container `p151-pgtest`; tạo DB nếu chưa có). Docker không chạy ⇒ ghi `NOT_RUN` + lý do, KHÔNG đánh ✅ gate `--pg`.
- Bước 0 trong worktree: exit 1 với ĐÚNG MỘT dòng `BRN-002 … khối luật: boot` (CRLF, plan 06 Q21) ⇒ ghi exit, đi tiếp; lệch khác ⇒ DỪNG.

## 3. Cổng chung (mỗi gói thi công)
```
.venv/Scripts/python -m pytest -q -p no:cacheprovider
.venv/Scripts/python -m ruff check src tests
.venv/Scripts/python -m ruff format --check src tests
MO_TEST_DATABASE_URL=… .venv/Scripts/python -m pytest --pg -q -p no:cacheprovider
```
Số test không giảm so với baseline §1 bước 2; 0 skip mới.

## 4. Migration & rollback
- Deploy: `python -m alembic -c src/maintenance/store/alembic.ini upgrade head` (đưa `maintops` lên `0003_emergency_return`, không DDL) TRƯỚC khi khởi động code mới; code mới gặp revision cũ ⇒ từ chối khởi động (`PostgresRepository.check()`).
- Rollback R1 (không phá huỷ, ưu tiên): ẩn nút UI / không gọi 2 route — dữ liệu giữ nguyên, code mới vẫn chạy.
- Rollback R2 (quay code về trước 08 trên DB chung) — PHÁ HUỶ, cần người duyệt: (1) dừng MỌI tiến trình ghi (API, worker, job), chờ giao dịch đang chạy xong; (2) backup `maintops.cases`; (3) BQL xử lý hết ticket còn `VERIFYING/EMERGENCY_PENDING_BQL` có `emergency_return` (restore hoặc đóng) — không làm thì code cũ sẽ coi chúng là khẩn cấp 2b và T05 chạy lại pipeline; (4) SQL gỡ trường ở 01 §9; (5) `alembic downgrade 0002_p1_doc_shape`; (6) khởi động code cũ, đọc thử 1 doc từng loại; giữ writers dừng tới khi bước 6 xong.
- CẤM: chạy code cũ trên DB có `emergency_return` mà chưa qua R2 (`extra="forbid"` ⇒ lỗi giữa request).
