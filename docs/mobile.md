# `src/mobile/` — App điện thoại (PWA) cho mọi vai vận hành

FastAPI phục vụ thư mục này ở `/app/` (`src/main.py`), cùng origin với API `/api/v1` và UI web `/ui/`.
Plain JS (ES module) + CSS, KHÔNG Tailwind, KHÔNG bước build. Hồ sơ: [`planning/11_2026-10-09_mobile-pwa-app/`](../planning/11_2026-10-09_mobile-pwa-app/plan.md).
**Giao diện = thiết kế `portal/`** (đợt 2, [`specs/SPEC-P04-PORTAL-UI.md`](../planning/11_2026-10-09_mobile-pwa-app/specs/SPEC-P04-PORTAL-UI.md)): class chép nguyên từ
`portal/src/app/globals.css`, icon từ `portal/src/components/icons.tsx`, bố cục từ `shell.tsx`/`resident-app.tsx`/`management-app.tsx`.
Backend vẫn là FastAPI gốc (Docker `:8000`); app KHÔNG gọi API/DB của portal.

## 1. Nguyên tắc (đọc trước khi sửa)
- App là **client mỏng**: chỉ gọi endpoint có sẵn (`/auth/*`, `/resident/*`, `/bql/*`, `/mo/*` của phòng ban/BPTN/kho, ảnh) — bảng ở
  [`specs/SPEC-P05-ALL-ROLES.md`](../planning/11_2026-10-09_mobile-pwa-app/specs/SPEC-P05-ALL-ROLES.md) §2–§4.
  Mọi luật nghiệp vụ nằm trong engine; web và app cùng API ⇒ cùng DB ⇒ đồng bộ, không có cơ chế đồng bộ riêng.
- **Service worker không bao giờ trả `/api/` từ cache** (`sw.js`: `if (url.pathname.startsWith('/api/')) return;` đứng trước mọi `respondWith`).
  Test `test_sw_never_caches_api` khoá điều này.
- Nút ghi dùng `writeButton()`/`lockWhile()` (`js/ui.js`): khoá ngay lần chạm đầu (chống gửi đôi ⇒ ticket trùng), khoá khi offline.
- Chuỗi từ API chỉ chèn qua `el()` (text node). Icon SVG tĩnh là chỗ duy nhất dùng `innerHTML`.
- Thay nội dung một khối bằng `fill(node, …)`, KHÔNG `node.replaceChildren(…)` khi có thể có con `null` (DOM in thành chữ "null").
- Không ghi khi offline, không hàng đợi offline, không realtime (vùng cấm, `specs/00-ARCHITECTURE.md` §6).
- Đổi màu/kiểu: sửa Part A của `app.css` CHỈ khi portal đổi (giữ giá trị y hệt); bố cục điện thoại ở Part B.
  Không làm phần portal mà API không có (nút khẩn cấp, tag đánh giá, cư dân nghiệm thu, Thông báo) — SPEC-P04 §8.

## 2. File
| File | Vai trò |
|---|---|
| `index.html` | Vỏ: viewport/safe-area, manifest, apple-touch-icon, `#offline`, `#topbar` (Header gradient), `#tabbar` (NavTiles, PHẢI đứng trước `#screen`), `#screen`, `#toast`, `#sheet` |
| `app.css` | Part A = class portal chép nguyên (`.tile .card .pill .btn`, `.scr-login`, `.scr-resident`, `.scr-management`); Part B = bố cục điện thoại; Part C = offline/toast/sheet |
| `manifest.json` | `start_url`/`scope` = `/app/`, `display: standalone`, icon 192/512/maskable |
| `sw.js` | Cache vỏ app (`SHELL_CACHE = 'mo-app-shell-vN'`), điều hướng network-first, file vỏ cache-first |
| `icons/` | PNG dựng bằng `planning/11_…/evidence/harness/make_icons.mjs` (Playwright trong `portal/`) |
| `js/main.js` | Boot, router hash (gắn lớp `scr-*` cho `#screen`), Header + NavTiles (`ctx.chrome`, `ctx.counts`), đăng nhập/xuất, vòng tải lại `REFRESH_MS = 30000`, banner offline, đăng ký SW, bảng lỗi |
| `js/api.js` | `api()`, `apiForm()`, `apiImage()`, `ApiError.kind`, token `localStorage['mo-app-token']` |
| `js/ui.js` | `el`, `fill`, `icon` (path portal), `person`, `pageHead`, `stepHead`, `infoGrid`, `notice`, `history`, `pill`, `toast`, `confirmSheet`, `writeButton`, `lockWhile`, `refreshButton`, `pagedList` (20 + "Xem thêm") |
| `js/photo.js` | `compressImage` (cạnh dài ≤1600 px, JPEG 0.82), `photoPicker` (Chụp ảnh / Chọn ảnh, tối đa 5) |
| `js/resident.js` | `#/r` ô tổng quan + chip lọc + thẻ có 6 vạch tiến độ · `#/r/new` 3 thẻ đánh số (Mô tả / Vị trí tòa-tầng-khu vực / Ảnh) + Tóm tắt · `#/r/<id>` stepper 6 bước, bổ sung, thêm ảnh, đánh giá sao, lịch sử. Ánh xạ trạng thái → bước: SPEC-P04 §4 |
| `js/bql.js` | `#/b` ô số liệu + 3 tile lọc Cần tôi / Khẩn cấp / Tất cả · `#/b/<id>` nghiệm thu, trả làm lại, hủy, đóng/hạ mức khẩn cấp |
| `js/staff.js` | Dùng chung cho vai nội bộ: nhãn (lý do, ưu tiên, loại việc, checklist, vật tư — chép từ `src/web/app.js`), pill, ảnh nội bộ, `queueScreen` (danh sách + tile `#staff-tabs`), `caseScreen` (khung chi tiết), `writer` (ghi → toast → tải lại) |
| `js/dept.js` | Phòng ban `#/d`: 4 tile Chờ nhận / Đang làm / Chờ nghiệm thu / Tất cả, không ô số liệu (Q32) · `#/d/<id>`: nhận việc, **ảnh sau xử lý (đầu tiên)**, checklist, vật tư (+ xác nhận vật tư thực tế), ghi chú, tự kiểm, báo hoàn thành, vướng / sai phòng ban |
| `js/bptn.js` | BPTN `#/p`: Cần xử lý / An toàn B2 / Tất cả · `#/p/<id>`: form theo mã vướng (an toàn Bậc 2, thiếu thông tin, trùng, loại việc, tài sản, sai phòng ban) |
| `js/kho.js` | Kho `#/k`: Chờ vật tư / Tồn kho (nhập kho) · `#/k/<id>`: vật tư thiếu + nhập kho điền sẵn |

Chỉ `qa01` (QA_INTERNAL) đăng nhập ⇒ `#/web` (nút sang `/ui/`), không gọi API dữ liệu.

## 3. Quy tắc khi sửa
- Đổi bất kỳ file vỏ nào ⇒ tăng `?v=N` ở **mọi** chỗ cùng lúc (`index.html`, mọi `import` trong `js/*.js`, danh sách `SHELL` trong `sw.js`)
  và tăng `SHELL_CACHE`. Specifier import phải giống hệt nhau giữa các file, nếu không trình duyệt nạp HAI bản `api.js` (mất token chung).
- Hành động nghiệp vụ: điều kiện hiện nút theo `specs/SPEC-P02` §4 / `SPEC-P03` §3; server là trọng tài (403/409 ⇒ toast + tải lại).
  Ảnh cư dân: hiện khi ticket chưa kết thúc (guard `engine.add_resident_photo`), KHÔNG theo `ADD_INFO` (chỉ có ở `NEED_INFO`).
- Trên điện thoại, khối thao tác nằm trong thẻ chi tiết ngay sau lưới thông tin (trước nội dung/ảnh/lịch sử).
- BPTN chọn/sửa giá trị (vị trí, thông tin, loại việc, phòng ban, tài sản) ⇒ engine BẮT BUỘC lý do (`409 GUARD_FAILED`); app chặn trước khi gửi.
- Cư dân: KHÔNG có hàng chip lọc (Q30); 4 ô tổng quan lọc, dòng `#resident-filter` có "Bỏ lọc".
- Bước "Vị trí" chỉ ghép dòng `Vị trí: Tòa S1 / Tầng 3 / Hành lang` vào `original_description` (không trường API mới); tòa lấy từ `catalog.yaml site.buildings`.
- Giữ các id/selector harness dùng (SPEC-P04 §7); Header dựng bằng `fill(bar, …)` (mốc phép phá `d-null-text`).
- Vòng tải lại bỏ qua khi màn đang có chữ/ảnh chưa gửi (`screenIsDirty()`; `photoPicker` đặt `data-dirty="1"`).

## 4. Chạy và đo
- Local, không đụng DB chung: `MO_STORE=memory MO_PHOTO_STORE=local LLM_MODE=mock DATABASE_URL= python -m uvicorn src.main:app --host 0.0.0.0 --port 8001`
  ⇒ http://127.0.0.1:8001/app/ (tài khoản `cudan01`, `bql01`, `vesinh01`, `kythuat01`, `bptn01`, `kho01`, mật khẩu `Demo@2026`). Thử trên điện thoại khi chưa deploy: `specs/OPERATIONS.md` §2.
- Kiểm: `python -m pytest tests/test_maintenance/test_mobile_static.py -q -p no:cacheprovider`;
  `bash planning/11_2026-10-09_mobile-pwa-app/evidence/harness/run_all.sh <python> <scratch>` (M1–M17 + 5 phép phá, ~20 phút, chạy 06:00–22:00).
- Docker (backend thật, DB Supabase CHUNG — chỉ đọc khi thử): `docker compose up -d --build backend` ⇒ http://localhost:8000/app/.
  Image phải dựng từ nhánh có ghim `sqlalchemy<2.1` (xem `brain4agent/-known-gotchas.md`).
- Cài lên màn hình chính + service worker cần HTTPS (hoặc `localhost` qua USB forward); qua `http://<LAN-IP>` app vẫn chạy đủ chức năng, chỉ không cài được.
