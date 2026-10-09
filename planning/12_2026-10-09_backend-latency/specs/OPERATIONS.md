# OPERATIONS — Thứ tự, deploy, rollback

## §1. Thứ tự thi công
SPEC-P02 (route ảnh + engine lô) → SPEC-P03 (gzip, job) → SPEC-P01 (engine đọc). P01 cuối vì đụng lớp lưu trữ, cần `--pg` local.

## §2. Kiểm local
- `python -m pytest -q -p no:cacheprovider` + `ruff check` + `ruff format --check` (venv, `LLM_MODE=mock`, `PYTHONUTF8=1`).
- `MO_TEST_DATABASE_URL=postgresql://p151:p151@localhost:5432/p151_test python -m pytest --pg -q -p no:cacheprovider` (container `db` local; KHÔNG Supabase).
- App điện thoại vẫn chạy: harness plan 11 `run_all.sh` lượt xanh (`:8001`).

## §3. Server (container `backend` trên Supabase CHUNG — chỉ GET để đo)
1. `docker compose build backend && docker compose up -d backend`; chờ `/health` 200.
2. `MSYS_NO_PATHCONV=1 docker exec -i -w /app p151-backend-1 python - < evidence/harness/probe_http.py > evidence/after/probe-8000.txt`.
3. So `evidence/before/probe-8000.txt`. CẤM gửi request ghi lên `:8000` để đo.

## §4. Rollback
Một commit; `git revert <sha>` rồi dựng lại container. Không migration, không đổi dữ liệu ⇒ rollback không cần thao tác DB.
Riêng engine đọc: nếu pooler từ chối kết nối thêm (thấy `too many clients`) ⇒ revert, ghi số đo vào plan.
