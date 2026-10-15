# portal — Cổng phản ánh cư dân

Next.js 16 + TypeScript + Tailwind v4. Không có database riêng: mọi dữ liệu đi qua backend Python (`BACKEND_URL`, `/api/v1`), backend lưu PostgreSQL khi `MO_STORE=postgres`. Tài liệu đầy đủ: [`../docs/portal.md`](../docs/portal.md).

```bash
npm ci && cp .env.example .env.local
npm run dev
```
Tài khoản: các tài khoản trong `../seed/maintenance_v1/accounts.yaml` (vd `cudan01`, `bptn01`, `vesinh01`, `kythuat01`, `kho01`, `bql01`).
