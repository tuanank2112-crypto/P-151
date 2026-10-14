# OPERATIONS — chạy trên Postgres local

Thứ tự bắt buộc (PowerShell/bash, từ root repo; KHÔNG sửa `.env`, chỉ ghi đè biến môi trường của tiến trình):
1. `docker compose up -d db` ⇒ container `p151-db-1` healthy.
2. Nâng schema DB local: `DATABASE_URL=postgresql+psycopg2://p151:p151@localhost:5432/p151 python -m alembic -c src/maintenance/store/alembic.ini upgrade head` ⇒ `maintops.alembic_version = 0004_portal_extras`.
3. Backend: `MO_STORE=postgres DATABASE_URL=<như bước 2> MO_PHOTO_STORE=local PORTAL_URL=http://localhost:3000 uvicorn src.main:app --port 8000`.
4. Portal: `cd portal && npm run build && BACKEND_URL=http://localhost:8000 npx next start -p 3000`.
5. Mở http://localhost:8000.

Test PG: `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@localhost:5432/p151_test python -m pytest tests --pg` (conftest chỉ cho host local + tên `_test`).

Rollback: `git revert` commit của hồ sơ này; DB local không cần rollback (không đổi schema).
