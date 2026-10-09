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

## 4. Chia trang danh sách — 20 ticket một lần (plan 10, v1.6.0, 2026-10-08)
Hồ sơ: [`planning/10_2026-10-08_list-paging/`](../planning/10_2026-10-08_list-paging/plan.md).
- `listCard(title, count, items, empty, paging)` — `paging = { key, ids }` (`ids[i]` là ticket của `items[i]`): chỉ gắn `PAGE_SIZE = 20` dòng; pill `count`
  và mọi ô đếm vẫn là TOÀN BỘ. Dùng ở 4 màn: `resident`, `bptn`, `department` (qua `internalList(..., pageKey)`), `bql`.
- Bấm "‹ Trước / Sau ›" chỉ thay dòng trong `<ul data-list=key>` — KHÔNG `render()`, KHÔNG gọi API.
- Mỗi `render()` mở đúng trang chứa `state.selected`. Mọi màn tự chọn ticket đầu khi chưa chọn ⇒ sau đăng nhập/đổi lọc luôn về trang 1;
  `state.pages` + reset ở `signOut()`/lọc BQL chỉ là phòng hờ (hiện không đổi được gì nhìn thấy — plan 10 Q07).
- Kiểm: `bash planning/10_2026-10-08_list-paging/evidence/harness/run_all.sh <python> <scratch>` (backend memory `:8001`, P1–P8 + 3 phép phá);
  trên `:8000` chỉ dùng `server_readonly.mjs` (không gửi form).

## 5. Form BPTN — lý do bắt buộc (plan 13, v1.8.1, 2026-10-09)
Hồ sơ: [`planning/13_2026-10-09_bptn-reason-web/`](../planning/13_2026-10-09_bptn-reason-web/plan.md).
- `bptnForm` → `send(body)`: trim chuỗi, `compact`, rồi nếu có một trong `VALUE_KEYS` (`location`, `info`, `category`, `department`, `asset_id`,
  `asset_onsite`) mà `note` rỗng ⇒ toast "Nhập lý do…", KHÔNG gọi API. Cùng luật với `src/mobile/js/bptn.js` và engine `bptn_resolve` (409 GUARD_FAILED).
- An toàn Bậc 2 → `safety(decision, data, message, required)`: CONFIRM_SAFE và REQUEST_INFO bắt buộc lý do (`required` + chặn chỉ khoảng trắng);
  ESCALATE không bắt buộc (engine `note_required=False`).
- Đổi luật lý do ở engine ⇒ sửa CẢ `VALUE_KEYS` ở web và app. Kiểm: `bash planning/13_2026-10-09_bptn-reason-web/evidence/harness/run_all.sh <python> <scratch>`
  (`:8001`, W1–W6 + 2 phép phá). Web ẩn ticket mẫu (`isSeedTicket`) ⇒ harness tự tạo ticket thật.
