# OPERATIONS

## Thứ tự bắt buộc (đợt 1)
1. Python (`min_qty` + seed) ⇒ `python -m pytest tests -q -p no:cacheprovider` + `ruff check src tests` + `ruff format --check src tests` (LLM_MODE=mock, PYTHONUTF8=1). Chạy `pytest tests`, KHÔNG chạy từ root (thư mục `integration/` làm hỏng thu thập).
2. Portal ⇒ trong `portal/`: `npm run typecheck`, `npm run lint`, `npm test`, `npx next build`.
3. Khởi động lại backend + portal (bộ nhớ, không chạm DB chung) và chụp màn hình các màn đã sửa.

## Chạy thử (memory)
Backend: `MO_STORE=memory DATABASE_URL= MO_PHOTO_STORE=local MO_JOBS_ENABLED=false MO_CUSTOM_MATERIALS=false MO_PORTAL_EXTRAS=true PORTAL_URL=http://127.0.0.1:3000 PYTHONUTF8=1 PYTHONPATH=. python -m uvicorn src.main:app --port 8000`.
Portal: `BACKEND_URL=http://127.0.0.1:8000 SESSION_SECRET=<≥32 ký tự> SESSION_COOKIE_SECURE=false npx next start --port 3000`. Mở http://localhost:8000.

## DB chung (Supabase)
Đợt 1 không có migration. Bảng tồn kho Postgres chỉ seed khi rỗng ⇒ tồn hiện có KHÔNG đổi; `min_qty` đọc từ danh mục YAML.

## Rollback
`git revert <commit đợt 1>`; không có dữ liệu cần khôi phục.
