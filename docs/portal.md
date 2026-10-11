# portal — Cổng phản ánh cư dân (Next.js) — UI mới, gọi backend

Website dựng từ bộ thiết kế `design-ticket-cu-dan/` (Trí). Từ hồ sơ 11 (v1.7.0) portal **không còn DB riêng**: mọi dữ liệu
(ticket, người dùng, ảnh, vật tư, đánh giá) đi qua API backend Python `/api/v1` (engine CR-BPTN-03, Agent LLM,
tầng an toàn). Backend trỏ Supabase ⇒ portal hiện dữ liệu thật. Yêu cầu giao diện: ghi chú anh Cố (Google Doc
`1tlvFRnAioxn7LFHTNlM9TQgYzIDzx25ZC4pFxqB3qiA`). Hồ sơ + quyết định Q01–Q19:
[`planning/11_2026-10-09_portal-backend-api/`](../planning/11_2026-10-09_portal-backend-api/plan.md). Hồ sơ dựng ban đầu:
[`planning/06_2026-10-07_resident-portal-next/`](../planning/06_2026-10-07_resident-portal-next/plan.md).

## 1. Chạy — UI mới mở ở cổng 8000
Backend cổng 8000 có `PORTAL_URL` ⇒ mọi đường ngoài `/api/v1`, `/ui`, `/health`, `/docs` chuyển tiếp sang portal (cổng 3000).
```bash
# backend (store memory, LLM mock) — từ root repo
MO_STORE=memory MO_PHOTO_STORE=local LLM_MODE=mock DATABASE_URL= MO_CUSTOM_MATERIALS=true MO_PORTAL_EXTRAS=true \
  PORTAL_URL=http://127.0.0.1:3000 PYTHONUTF8=1 PYTHONPATH=. .venv/Scripts/python.exe -m uvicorn src.main:app --port 8000
# portal — PHẢI chạy production khi xem qua 8000
cd portal && npm ci && BACKEND_URL=http://127.0.0.1:8000 npx next build \
  && BACKEND_URL=http://127.0.0.1:8000 SESSION_SECRET=<chuỗi bí mật> npx next start --port 3000
```
Mở http://localhost:8000. Tài khoản (mật khẩu `123456`): `cudan`, `tiepnhan`, `quanly`, `vesinh`, `kythuat`, `kho`
(tài khoản cũ `cudan01`…/`Demo@2026` vẫn dùng được).
- `next dev` chỉ mở thẳng `http://localhost:3000`: qua cổng 8000 trang KHÔNG hydrate (WebSocket HMR không đi qua proxy).
- Dữ liệu Supabase (đo 2026-10-10, đọc ✅): backend chạy từ worktree với `--env-file /d/P151/.env` (chứa `DATABASE_URL=postgresql+psycopg2://…?sslmode=require`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), shell đặt `MO_STORE=postgres MO_PHOTO_STORE=supabase MO_JOBS_ENABLED=false MO_ALLOW_RESET=false
  MO_SEED_ON_EMPTY=false`. Scheme `postgresql://` trơn làm backend đòi driver `psycopg` (exit 3). Mọi thao tác bấm trên UI ghi thật vào DB nhóm. Vật tư "+" và phân công/thẻ đánh giá cần bảng `0003`/`0004` trên Supabase rồi bật
  `MO_CUSTOM_MATERIALS`/`MO_PORTAL_EXTRAS` — OPERATIONS §3 của hồ sơ 11 (mọi bước cần người dùng gật).

## 2. Lệnh
| Lệnh | Việc |
|---|---|
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit: ánh xạ backend → DTO, lọc ô tổng quan, phiên ký HMAC, action, gate nghiệm thu |
| `npx tsx scripts/ui-check-WP3.mts --base=URL` | Kiểm Cư dân + Tiếp nhận trên trình duyệt (Playwright), ảnh 1440/390 |
| `npx tsx scripts/ui-check-WP4.mts cleaning\|technical --base=URL` | Kiểm Vệ sinh / Kỹ thuật |
| `npx tsx scripts/ui-check-WP5.mts --base=URL` | Kiểm Quản lý + Kho + modal |
`db:*`, `test:db`, `e2e`, `screenshots` là công cụ của bản DB riêng cũ — không dùng cho luồng hiện tại.

## 3. Cấu trúc
```text
portal/src/
├── server/        # chỉ server: backend.ts (fetch + Bearer + lỗi), session.ts + session-token.ts (cookie ký HMAC chứa token
│                  #   backend), act.ts, uploads.ts, data/<vai>.ts (loader đọc theo vai), data/types.ts (kiểu JSON backend)
├── lib/           # thuần: backend-map.ts (status→stage, nhãn, splitReport, Agent đúng/sai, lọc ô tổng quan, readinessMessages),
│                  #   dto.ts, constants.ts, inspection.ts, sla.ts, format.ts, result.ts
├── app/actions/   # server action mỗi vai ⇒ gọi /api/v1 (bảng 01-CONTRACTS §7 + SPEC-P04)
├── app/api/       # photos/[ticketId]/[evidenceId] (proxy ảnh kèm Bearer), session/expired
└── components/    # shell, board, ticket-detail-modal (khối Agent THẬT), ticket-evidence, photo-strip, use-action…
```
`src/db/**`, `drizzle/**`: lịch sử bản DB riêng, KHÔNG import ở luồng chạy (grep nghiệm thu = 0).
`.gitignore` có `!portal/src/server/data/` (dòng `data/` từng nuốt thư mục này).

## 4. Màn hình (SPEC-P03 hồ sơ 11)
Ảnh toàn bộ màn hình theo vai (desktop + mobile): [`docs/screenshots/`](screenshots/README.md).
| Route | Vai | Điểm chính |
|---|---|---|
| `/resident` | cư dân | Tiêu đề + nội dung góp ý + nơi + ảnh; bổ sung; đánh giá sao + thẻ + bình luận. Không khẩn cấp tự chọn, không xác nhận/hủy |
| `/reception` | tiếp nhận | Chờ phân loại (nút theo blocker, khối Agent thật), Đã phân loại, Hiệu suất Agent (ô "Agent gợi ý đúng": % + ✓ số đúng / ✗ số sai cạnh nhau) |
| `/cleaning`, `/technical` | phòng ban | Nhận việc cả phòng (không gán từng nhân viên; `/mo/staff`, `/assign` backend còn nhưng portal không gọi), yêu cầu vật tư (+ ngoài danh mục, chờ duyệt cấp), form hoàn thành (vệ sinh: ảnh bắt buộc + vật tư đã dùng; kỹ thuật: checklist vật tư tích hết) |
| `/management` | BQL | 5 ô tổng quan bấm được, phụ tải VS/KT bấm được, Tất cả ticket → modal, Việc của BQL (Đã tiếp nhận / Đã hoàn thành / Tất cả), Hiệu suất phòng ban, lối vào Kho |
| `/warehouse` | kho, BQL | Tồn kho, nhập kho, thêm vật tư, Duyệt cấp yêu cầu |

## 5. Ánh xạ trạng thái
`status` backend → stepper 6 bước: RECEIVED/NEED_INFO=1, VERIFYING=2, ROUTED=3, IN_PROGRESS/ON_HOLD=4, READY_FOR_REVIEW=5,
CLOSED=6; CANCELLED/MERGED ⇒ `cancelled`. Mã ticket = `ticket_id` backend. "BQL đã xử lý" = CLOSED + `EMERGENCY_HANDLED`
+ mức an toàn khác EMERGENCY (Q09) — không tính khẩn cấp.

## 6. Bảo mật
- Quyền do backend quyết (403/409); portal chỉ ẩn/hiện nút. Cư dân chỉ gọi `/resident/*`.
- Phòng ban không thấy danh tính cư dân (sao/thẻ/bình luận vẫn thấy).
- Token backend chỉ nằm trong cookie httpOnly ký HMAC (`SESSION_SECRET`, bắt buộc ở production); không ra trình duyệt.
  Backend khởi động lại ⇒ token chết ⇒ portal tự về `/login`.
- Ảnh luôn qua proxy có phiên, `Cache-Control: private, no-store`.
