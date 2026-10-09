# OPERATIONS — chạy, migrate, seed, rollback

## 1. Biến môi trường (`portal/.env.local`, KHÔNG commit; mẫu `portal/.env.example`)
| Biến | Bắt buộc | Ví dụ |
|---|---|---|
| `DATABASE_URL` | ✔ | `postgres://p151:p151@localhost:5432/portal` |
| `TEST_DATABASE_URL` | cho `npm run test:db` | `postgres://p151:p151@localhost:5432/portal_test` (tên DB PHẢI kết thúc `_test`, test tự kiểm) |

## 2. Thứ tự bắt buộc (local)
```bash
docker compose up -d db                     # Postgres 16 của repo (container p151-db-1)
docker exec p151-db-1 psql -U p151 -d p151 -c "create database portal" -c "create database portal_test"   # một lần
cd portal && npm ci
npm run db:migrate                          # drizzle migrator, đọc portal/drizzle/*.sql
npm run db:seed                             # chỉ seed khi rỗng; --reset để làm lại dữ liệu mẫu
npm run dev                                 # http://localhost:3000
```
Đổi schema: sửa `src/db/schema.ts` → `npm run db:generate` → commit file SQL mới trong `drizzle/` → `npm run db:migrate`.
CẤM sửa tay file SQL đã commit; CẤM `drizzle-kit push` trên DB dùng chung.

## 2b. Docker Compose (2026-10-07)
`docker compose up -d --build` dựng service `portal` (`portal/Dockerfile`, cổng `${PORTAL_PORT:-3000}`): khi start chạy `db:migrate`
(tự `create database portal` nếu volume mới) → `db:seed` (bỏ qua khi có dữ liệu) → `next start`. `DATABASE_URL` trỏ service `db`
trong mạng compose, KHÔNG đọc `.env` gốc (tránh Supabase của backend). `SESSION_COOKIE_SECURE=false` để mở qua HTTP bằng IP LAN.

## 3. Production (chưa làm trong đợt này)
`npm run build && npm run start` sau `db:migrate`. Cookie `secure` tự bật khi `NODE_ENV=production`. Seed `--reset` bị chặn ở production.

## 4. Rollback
- Code: revert commit của `portal/` — không ảnh hưởng backend Python (thư mục độc lập).
- DB: app chỉ dùng DB `portal`/`portal_test`; rollback = `drop database portal` rồi migrate + seed lại. KHÔNG đụng DB `p151`, `p151_test`.
