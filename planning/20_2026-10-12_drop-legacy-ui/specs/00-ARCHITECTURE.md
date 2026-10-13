# 00 — Kiến trúc

## Mục tiêu
1. Chỉ còn hai giao diện: portal Next.js (`portal/`, qua cổng 8000) và app điện thoại (`src/mobile/`, `/app/`). Cả hai chỉ gọi `/api/v1`.
2. Dữ liệu của UI mới nằm ở backend Python, lưu PostgreSQL (`MO_STORE=postgres`). Portal không có DB riêng.

## Non-goals
- Không đổi API, engine, schema `maintops`, migration Alembic.
- Không kết nối, migrate hay ghi Supabase chung.
- Không viết lại app điện thoại.

## Bất biến
- I-1: portal không import `pg`, `drizzle-orm`, không đọc `DATABASE_URL`.
- I-2: backend không mount `/ui`; không đường nào chuyển hướng tới `/ui`.
- I-3: `/api/v1`, `/app/`, `/health`, `/docs` giữ nguyên hành vi.
- I-4: proxy portal giữ vá cookie của `e2ab6e4` (`tests/test_portal_proxy_cookies.py` xanh).

## Vùng cấm
- Không xoá database `portal` trong Postgres local (dữ liệu, không phải mã; người dùng chỉ duyệt xoá mã).
- Không giữ `/ui` "cho chắc" dưới tên khác: người dùng đã quyết bỏ.
