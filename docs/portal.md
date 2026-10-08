# portal — Cổng phản ánh cư dân (Next.js)

Website thật dựng từ bộ thiết kế `design-ticket-cu-dan/design-ticket-cu-dan/` (`HANDOFF.md` + 6 file `design/*.dc.html`).
Một PostgreSQL dùng chung cho 5 vai trò. Độc lập với backend Python `src/` (KHÔNG nối engine MaintenanceOps / CR-BPTN-03).
Hồ sơ thiết kế + quyết định: [`planning/06_2026-10-07_resident-portal-next/`](../planning/06_2026-10-07_resident-portal-next/plan.md).

## 1. Chạy
**Bằng Docker (đơn giản nhất):** `docker compose up -d --build` ⇒ http://localhost:3000. Service `portal` tự tạo DB `portal`
trên service `db`, migrate, seed (chỉ khi rỗng) rồi `next start`. `localhost:8000` là UI CŨ của backend Python (`src/web/`), không phải portal.

**Chạy dev trên máy:**
```bash
docker compose up -d db                       # Postgres 16 của repo (container p151-db-1)
docker exec p151-db-1 psql -U p151 -d p151 -c "create database portal" -c "create database portal_test"   # một lần
cd portal && npm ci && cp .env.example .env.local
npm run db:migrate && npm run db:seed         # seed chỉ chạy khi DB rỗng; --reset để làm lại
npm run dev                                   # http://localhost:3000
```
Tài khoản mẫu (mật khẩu `123456`): `cudan`, `tiepnhan`, `quanly`, `vesinh`, `kythuat`, `kho` (thủ kho).

## 2. Lệnh
| Lệnh | Việc |
|---|---|
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint (config Next) |
| `npm test` | Unit: Agent, SLA, định dạng, ma trận quyền, kiểm ảnh, mật khẩu |
| `npm run test:db` | Toàn bộ workflow trên Postgres thật (`TEST_DATABASE_URL`, tên DB phải kết thúc `_test`) |
| `npm run db:generate` / `db:migrate [-- --test]` / `db:seed [-- --reset]` | Migration Drizzle (SQL trong `drizzle/`), seed dữ liệu mẫu |
| `npm run e2e -- --base=URL` | Luồng đầy đủ qua giao diện (Playwright) — cần DB vừa `--reset` |
| `npm run screenshots -- [role…] --base=URL` | Chụp mọi tab ở 1440/390px vào `planning/06_…/evidence/screens/`, lỗi nếu trang tràn ngang |

## 3. Cấu trúc
```text
portal/
├── drizzle/                 # migration SQL (CẤM sửa tay file đã commit)
├── scripts/                 # migrate.mts, seed.mts, e2e-flow.mts, screens.mts
├── tests/unit, tests/db     # vitest (2 project)
└── src/
    ├── db/                  # schema.ts (11 bảng, có `warehouse_stock`), client.ts, index.ts (pool dùng chung), seed.ts
    ├── lib/                 # thuần, dùng cả client: agent.ts, duplicates.ts, inspection.ts (gate nghiệm thu), constants.ts (gồm `STOCK_CATALOG`), sla.ts, format.ts, permissions.ts, photos.ts, dto.ts, result.ts
    ├── server/              # chỉ server: workflow.ts (MỌI ghi), queries.ts (đọc theo vai), session.ts, password.ts, act.ts
    ├── components/          # shell (header/menu/skeleton), board, icons, photo-strip, ticket-detail-modal, toast, use-action
    └── app/                 # login, resident, reception, management, cleaning, technical, warehouse, api/photos/[id], actions/*
```

## 4. Màn hình ↔ thiết kế
| Route | Vai | File thiết kế |
|---|---|---|
| `/login` | — | `Main.dc.html` |
| `/resident` | resident | `Resident.dc.html` |
| `/reception` | reception | `Reception.dc.html` (bỏ tab Quy tắc từ khóa) |
| `/management` | management | `Management.dc.html` (bỏ tab Phân quyền) |
| `/cleaning` | cleaning | `Cleaning.dc.html` |
| `/technical` | technical | `Technical.dc.html` |
| `/warehouse` | warehouse | — (không có thiết kế; theo style chung) |
CSS của thiết kế được chép nguyên vào `src/app/globals.css` (class dùng chung + khối riêng `.scr-<màn>`). Lệch có chủ đích D1–D9: `planning/06_…/specs/00-ARCHITECTURE.md` §5.

## 5. Mô hình ticket
`stage` 1 Tiếp nhận → 2 Thẩm định (đã chuyển phòng ban) → 3 Phân công → 4 Đang xử lý → 5 Nghiệm thu (phòng ban báo xong) → 6 Hoàn tất; cờ `need_info`, `paused`, `cancelled` (+`merged_into`).

### Nghiệm thu của BQL (`src/lib/inspection.ts`, tab "Việc của BQL")
- 4 gate **hệ thống tự kiểm** từ dữ liệu (`autoGates`): đúng phòng ban (không bị báo sai phòng), có ảnh sau xử lý (`after_*`), vật tư đã nhận đủ, xong trong SLA (`doneHours ≤ 4h/48h`). Gate ✕ chỉ cảnh báo, KHÔNG khoá.
- 2 gate **BQL tự tích tại hiện trường** (`SITE_CHECKS`): nút "Nghiệm thu đạt" khoá tới khi tích đủ. Trạng thái tích chỉ ở client, không lưu DB.
- CẤM quay lại tích ✓ cứng: `tests/unit/inspection.test.ts` đỏ khi gate ảnh luôn đạt.

### Kho vật tư (`/warehouse`, vai `warehouse`)
- Bảng `warehouse_stock` (migration `0002`). Seed nạp từ `STOCK_CATALOG`; form "Yêu cầu vật tư" của Kỹ thuật chọn từ cùng danh mục (+ nhập vật tư ngoài danh mục).
- Hạn chế đã biết: ô "Nguồn cấp / ghi chú" khi nhập kho bị bỏ qua (`receiveStock` chưa có bảng lịch sử nhập kho); yêu cầu vật tư không trừ tồn kho.
Bảng ánh xạ nhãn từng dashboard + tiền điều kiện từng action: `specs/01-CONTRACTS.md` §2, §4.
Mọi ghi đi qua `src/server/workflow.ts`: kiểm quyền → `SELECT … FOR UPDATE` → kiểm phạm vi/stage → `UPDATE … WHERE stage = <cũ>` → 1 dòng `history`. Lỗi trả `ActionResult` (`UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | INVALID_INPUT | CONFLICT`); ticket ngoài phạm vi luôn là `NOT_FOUND`.

## 6. Agent phân loại (`src/lib/agent.ts`)
`classify(text, rules, home) → { dept, confidence, keywords, urgent, locationFromText }`. Từ khóa theo phòng ban ở bảng `keywords` (Ban tiếp nhận sửa). So khớp **nguyên từ** (Unicode), tin cậy `min(97, round(48 + 38·best/total + 5·min(best,3)))`, không khớp ⇒ `dept=null`, 0%. Hạn: khẩn cấp 4 giờ, thường 48 giờ.

### Agent phát hiện trùng (`src/lib/duplicates.ts`)
Ticket mới được so với ticket cũ hơn còn mở trong 7 ngày: cùng phòng ban gợi ý + cùng vị trí (tòa + tầng / thang máy) + ≥1 từ khóa chung.
Thẻ chờ phân loại hiện hai ticket cạnh nhau với lý do và %; Ban tiếp nhận chỉ duyệt "Đúng, gộp" hoặc "Không trùng" (lưu `dup_dismissed`).
Server chặn gộp cặp Agent không đề xuất. Từ khóa của Agent KHÔNG còn sửa trên UI: đổi qua `SEED_KEYWORDS` (`src/db/seed.ts`) hoặc SQL bảng `keywords`.

## 7. Bảo mật
- **Phòng vệ sinh / kỹ thuật không biết ai gửi** (plan Q11): `deptData()` không trả tên, tài khoản, `resident_id`; tên file ảnh thành "Ảnh N". Họ VẪN thấy số sao, thẻ nhận xét và bình luận của việc phòng mình (`RatingSummary`). Số căn hộ chỉ có trong vị trí khi sự cố "Trong căn hộ". Khoá bằng `tests/db/queries.test.ts`.
Session cookie `httpOnly` ↔ bảng `sessions` (lưu SHA-256 token, hạn 7 ngày); mật khẩu scrypt; lỗi đăng nhập chung một câu. Ảnh: kiểm magic bytes JPG/PNG/WEBP, ≤5 ảnh × 5 MB, trả qua `/api/photos/[id]` có kiểm phạm vi và `Cache-Control: private, no-store`.
