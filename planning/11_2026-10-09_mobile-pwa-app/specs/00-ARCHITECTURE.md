# 00 — Kiến trúc: App điện thoại (PWA) cho Cư dân và BQL

## §0. Router thứ tự đọc
1. File này (mục tiêu, bất biến, vùng cấm).
2. `01-CONTRACTS.md` (file, route, endpoint, lỗi) — nguồn chân lý cho chữ ký.
3. `SPEC-P01-SHELL-PWA.md` → `SPEC-P02-RESIDENT.md` → `SPEC-P03-BQL.md`.
4. `OPERATIONS.md`, `TESTING-ACCEPTANCE.md`.
Đọc kèm (chỉ đọc, KHÔNG sửa): `src/api/routers/maintenance.py` (router `resident_router` dòng 654–733, `bql_router` dòng 736–800),
`src/api/auth.py`, `src/maintenance/views.py` (`ResidentTicketView`, `BqlTicketRow`), `src/web/app.js` (cách web gọi cùng API — mẫu tham khảo).

## §1. Bối cảnh
- Backend FastAPI (`src/main.py`) phục vụ API `/api/v1` và UI web tĩnh `src/web/` ở `/ui/` (desktop, 5 vai).
- Lưu trữ: `MO_STORE=memory|postgres` (Supabase), ảnh `MO_PHOTO_STORE=local|supabase`. Một tiến trình uvicorn, ghi tuần tự qua `engine.lock`.
- Đăng nhập: `POST /api/v1/auth/login` ⇒ Bearer token, session trong RAM, TTL 8 h (`auth.py:29`).
- `portal/` (Next.js) có DB RIÊNG, không nối engine ⇒ KHÔNG phải nền cho app này.

## §2. Mục tiêu
- G-1 Cư dân dùng điện thoại: gửi phản ánh (kèm ảnh chụp), theo dõi trạng thái, bổ sung thông tin/ảnh, đánh giá.
- G-2 BQL có giao diện điện thoại: xem việc cần mình, xử lý 5 hành động (nghiệm thu, trả làm lại, hủy, đóng khẩn cấp, hạ mức khẩn cấp).
- G-3 Dữ liệu app ≡ dữ liệu web: thao tác trên web hiện trên app trong ≤35 s khi app đang mở (và ngay khi mở lại app), và ngược lại.
- G-4 Cài được lên màn hình chính khi chạy trên HTTPS; chạy được (không cài) qua `http://<LAN-IP>` để thử local.

## §3. Non-goals (đợt này)
- Màn BPTN, Phòng ban, Kho, QA trên app (dùng `/ui/`).
- Push notification, realtime, hàng đợi ghi offline, đưa lên App Store/CH Play.
- Đổi API, engine, auth, schema DB. Dark mode.

## §4. Kiến trúc
```text
Điện thoại (PWA /app/)  ─┐
                         ├─ HTTPS ─▶ FastAPI (một tiến trình) ─▶ engine CR-03 ─▶ CaseRepository ─▶ Postgres/Supabase
Máy tính (web /ui/)     ─┘            /api/v1/resident/*, /bql/*, /mo/*, /auth/*          ảnh ─▶ Supabase Storage
```
Cùng origin ⇒ không CORS; cùng API ⇒ cùng DB ⇒ đồng bộ không cần cơ chế riêng.

## §5. Bất biến (BẮT BUỘC)
- **I-1** App CHỈ gọi endpoint đã liệt kê ở `01-CONTRACTS.md` §5–§6. Không endpoint mới, không tham số mới.
- **I-2** App KHÔNG tự suy ra trạng thái sau thao tác: mọi ghi xong ⇒ dùng body trả về hoặc gọi lại GET. Server là nguồn chân lý.
- **I-3** Service worker KHÔNG bao giờ trả `/api/` từ cache (kể cả khi offline).
- **I-4** Mọi chuỗi từ API chèn bằng `textContent`/text node. CẤM `innerHTML` với dữ liệu API.
- **I-5** Nút ghi khoá ngay khi bấm cho đến khi request kết thúc (chống gửi đôi ⇒ ticket trùng).
- **I-6** Không ghi khi `navigator.onLine === false`.
- **I-7** App vẫn chạy đủ chức năng khi service worker KHÔNG đăng ký được (HTTP qua LAN).
- **I-8** Vai ngoài RESIDENT/BQL không thấy dữ liệu nào trên app (chỉ màn "Dùng bản web").

## §6. Vùng cấm (đã cân nhắc, quyết định KHÔNG làm)
| # | Không làm | Lý do |
|---|---|---|
| V1 | Dựng app trên `portal/` (Next.js) | DB riêng ⇒ không đồng bộ với BQL/engine |
| V2 | React Native/Flutter/Expo | Thêm build, store, 1–2 tuần; PWA đủ nhu cầu (plan Q01) |
| V3 | Tailwind Play CDN hoặc framework JS (React/Vue) | Chậm trên điện thoại, cần mạng; repo chọn không bước build |
| V4 | Cache response API trong SW / IndexedDB | Lệch DB (Q07) |
| V5 | Hàng đợi ghi offline | Phát lại muộn có thể đụng guard an toàn/state machine (Q08) |
| V6 | Tăng số worker uvicorn | `engine.lock` là khoá trong tiến trình — nhiều worker phá tuần tự ghi |
| V7 | Dùng chung `src/web/app.js` cho app | 2290 dòng desktop 5 vai; sửa chung dễ làm vỡ web (plan 08/10 vừa nghiệm thu) |
| V8 | Thêm BPTN/Phòng ban vào app "cho đủ" | Người dùng chỉ yêu cầu Cư dân + BQL |
| V9 | Đổi `localStorage` → cookie HttpOnly | Cần đổi `auth.py` (cấm chạm); ghi Idea Vault |
