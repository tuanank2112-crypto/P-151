# `src/web/` — UI tĩnh của backend MaintenanceOps

FastAPI phục vụ thư mục này ở `/ui` (`src/main.py`). Plain JS + Tailwind Play CDN, không có bước build.
Từ v1.3.0 (plan 07) giao diện mang design của `portal/`. Hồ sơ: `planning/07_2026-10-07_web-portal-reskin/`.

## 1. File
| File | Vai trò |
|---|---|
| `index.html` | Khung trang: font Be Vietnam Pro, `theme.css`, config Tailwind (remap palette), header gradient, `#main`, toast, dialog xác nhận |
| `theme.css` | Token + class thiết kế chép từ `portal/src/app/globals.css` (`.hero`, `.card`, `.pill`, `.btn`, `.field`, `.titem`, `.scr-login …`) |
| `app.js` | Toàn bộ màn 5 vai (Cư dân, BPTN, Phòng ban, Kho, BQL), gọi `/api/v1` |
| `js/dark_mode.js`, `js/components/*.js` | KHÔNG còn được nạp (dark mode tắt ở plan 07) |

## 2. Quy tắc khi sửa
- Màu chỉ lấy từ token (`planning/07_…/specs/01-CONTRACTS.md` §1). `slate`/`stone`/`indigo` trong class Tailwind đã được remap sang token portal, nên `text-slate-500` = muted `#5B6578`, `bg-indigo-600` = brand `#1D4ED8`.
- Nút: `BTN.primary|secondary|danger` (`.btn`), ô nhập: `INPUT` (`.field`), khối: `card()`, trạng thái: `badge()` (bảng `STATUS_STYLE` → `PILL`).
- Chuỗi từ API luôn chèn bằng `el()` (text node), không `innerHTML`.
- Class tự viết đụng thuộc tính mà plugin `forms` đặt ⇒ selector `html body .x` (xem `brain4agent/-known-gotchas.md`).
- Sửa `app.js`/`theme.css` ⇒ tăng `?v=` trong `index.html`.

## 3. Chạy và đo
- Xem nhanh, không đụng DB chung: `MO_STORE=memory MO_PHOTO_STORE=local LLM_MODE=mock DATABASE_URL= python -m uvicorn src.main:app --port 8001` ⇒ http://127.0.0.1:8001/ui/ (tài khoản `seed/maintenance_v1/accounts.yaml`, mật khẩu `Demo@2026`).
- Container: `docker compose up -d --build backend` (image chép `src/` lúc build) ⇒ http://localhost:8000/ui/ — dùng Supabase chung.
- Kiểm: `node --check src/web/app.js`; `python -m pytest tests/test_maintenance/test_api.py -q -p no:cacheprovider`.
