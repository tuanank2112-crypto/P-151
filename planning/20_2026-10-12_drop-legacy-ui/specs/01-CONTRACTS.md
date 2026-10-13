# 01 — Contracts

## §1 Định tuyến gốc của backend (`src/main.py`)
| Điều kiện | `GET /` | Đường khác ngoài API |
|---|---|---|
| `PORTAL_URL` không đặt | 307 `Location: /app/` | 404 `{"detail":"Not found"}` |
| `PORTAL_URL` đặt, portal trả lời | chuyển tiếp portal | chuyển tiếp portal |
| `PORTAL_URL` đặt, portal không kết nối được (`ConnectError`/`ConnectTimeout`) | 503 `{"detail":"Portal service is unavailable"}` | 503 như cột trái |
`GET /ui/` và `/ui/app.js`: không còn mount ⇒ đi qua bảng trên (404 hoặc chuyển tiếp portal).

## §2 App điện thoại
- Không phần tử nào có `href` chứa `/ui`. `staff.js` không còn export `webButton`.
- Màn `#/web` (`renderWeb`, id `web-only`) giữ, chỉ còn chữ hướng dẫn dùng portal + nút Đăng xuất.
- Phiên bản cache: mọi `?v=17` và `mo-app-shell-v17` ⇒ `18`.

## §3 Portal
- `package.json`: bỏ deps `drizzle-orm`, `pg`, `@types/pg`, `drizzle-kit`; bỏ scripts `test:db`, `db:generate`, `db:migrate`, `db:seed`, `e2e`.
- Xoá: `src/db/`, `drizzle/`, `drizzle.config.ts`, `scripts/migrate.mts`, `scripts/seed.mts`, `scripts/e2e-flow.mts`, `src/lib/agent.ts`, `tests/unit/agent.test.ts`, `tests/db/`, `.env.example` dòng DB.
- `vitest.config.mts`: bỏ project `db`.
- `next.config.ts`: bỏ rewrite `/ui/:path*`.
- `Dockerfile`: bỏ `ENV DATABASE_URL`; `CMD ["npx", "next", "start", "-p", "3000"]`.
