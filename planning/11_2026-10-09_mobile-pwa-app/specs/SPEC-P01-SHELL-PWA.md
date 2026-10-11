# SPEC-P01 — Vỏ app: mount, PWA, đăng nhập, tải lại, offline, ảnh

## §1. Mount
Đúng một dòng ở `01-CONTRACTS.md` §2. KHÔNG sửa gì khác trong `src/main.py`.

## §2. `index.html`
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<meta name="theme-color">`,
  `<link rel="manifest">`, `<link rel="apple-touch-icon" href="icons/apple-touch-icon-180.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">`.
- Font: Be Vietnam Pro từ Google Fonts + fallback `system-ui` (app vẫn đọc được khi không tải được font).
- Khung: `#offline` (banner, ẩn mặc định), `#screen`, `#toast`. Thanh dưới (`#tabbar`) do JS dựng theo vai.
- Vùng an toàn iPhone: `padding-bottom: env(safe-area-inset-bottom)` cho tabbar.

## §3. Service worker (`sw.js`)
- Đăng ký trong `main.js` CHỈ khi `'serviceWorker' in navigator && window.isSecureContext`; lỗi đăng ký ⇒ bỏ qua im lặng (I-7).
- `install`: precache danh sách vỏ cố định (index.html, app.css, js/*.js, manifest, icon) vào `SHELL_CACHE`; `self.skipWaiting()`.
- `activate`: xoá mọi cache `mo-app-shell-*` khác `SHELL_CACHE`; `clients.claim()`.
- `fetch`:
  - URL có pathname bắt đầu `/api/` ⇒ **`return;`** (không `respondWith`, để trình duyệt đi mạng thẳng). BẮT BUỘC (I-3).
  - Request khác method GET ⇒ `return;`.
  - Điều hướng (`request.mode === 'navigate'`) trong scope ⇒ network-first, lỗi mạng ⇒ `index.html` từ cache.
  - File vỏ ⇒ cache-first.
- CẤM: `importScripts` CDN, cache ảnh từ `/api/`, Background Sync.

## §4. Router
Hash router: `#/login`, `#/r` (danh sách cư dân), `#/r/new`, `#/r/<ticket_id>`, `#/b` (BQL), `#/b/<ticket_id>`, `#/web` (vai khác).
- Boot: có token ⇒ `GET /auth/me` ⇒ `role` → `RESIDENT` `#/r`, `BQL` `#/b`, còn lại `#/web`. Không token/401 ⇒ `#/login`.
- Vào route sai vai (cư dân gõ `#/b`) ⇒ chuyển về route của vai mình.
- Nút "Quay lại" Android = `history.back()` tự nhiên nhờ hash.

## §5. Đăng nhập / đăng xuất
- Form: tên đăng nhập, mật khẩu (`autocomplete="username"`/`"current-password"`), nút "Đăng nhập" khoá khi đang gửi.
- Thành công ⇒ `setToken(access_token)`; điều hướng theo `user.role`.
- Màn `#/web`: "Vai <display_name> dùng bản web" + liên kết `/ui/` + nút Đăng xuất. KHÔNG gọi API dữ liệu nào (I-8).
- Đăng xuất ⇒ `POST /auth/logout` (lỗi bỏ qua) ⇒ `clearToken()` ⇒ `#/login`; dừng vòng tải lại.

## §6. Tải lại định kỳ (đồng bộ — G-3)
```js
startRefresh(loader)  // loader = hàm tải lại màn hiện tại (chỉ GET)
stopRefresh()
```
- Chạy `loader` mỗi `REFRESH_MS` khi `document.visibilityState === 'visible'` và online.
- `visibilitychange` → `visible` hoặc sự kiện `online` ⇒ gọi `loader` ngay + đặt lại đồng hồ.
- `hidden` ⇒ dừng đồng hồ (tiết kiệm pin/data).
- Không chồng request: đang tải thì lượt sau bỏ qua.
- KHÔNG tải lại khi người dùng đang gõ form chưa gửi trên màn đó (giữ chữ đang gõ): màn có form mở ⇒ chỉ cập nhật phần trạng thái, hoặc hoãn tới khi đóng form.
- Nút "Tải lại" trên đầu mỗi danh sách = gọi `loader` ngay.
- Hiện "Cập nhật lúc HH:mm:ss" dưới tiêu đề danh sách.

## §7. Offline
- `online`/`offline` ⇒ bật/tắt `#offline` ("Mất kết nối — dữ liệu có thể chưa mới, chưa gửi được thao tác").
- Khi offline: mọi nút ghi `disabled`; dữ liệu đang hiển thị giữ nguyên (không xoá).

## §8. Nén ảnh (`photo.js`)
```js
export async function compressImage(file) // → Blob image/jpeg
```
- Đọc bằng `createImageBitmap(file, { imageOrientation: 'from-image' })`; không có ⇒ `<img>` + `URL.createObjectURL`.
- Cạnh dài > `PHOTO_MAX_EDGE` ⇒ thu theo tỉ lệ; vẽ canvas; `canvas.toBlob(cb, 'image/jpeg', PHOTO_QUALITY)`.
- Không giải mã được (vd HEIC trên Android) ⇒ ném `ApiError(kind='invalid')` "Không đọc được ảnh này, hãy chọn ảnh JPG/PNG".
- Kết quả > 5 MB (hiếm) ⇒ thử lại một lần chất lượng 0.6; vẫn > 5 MB ⇒ lỗi `invalid`.
- Tên file gửi: `photo-<i>.jpg`.
- Input: `<input type="file" accept="image/*" capture="environment" multiple>` (một nút "Chụp ảnh"), thêm nút "Chọn từ thư viện" không có `capture`.

## §9. Giao diện chung
- Bố cục một cột, rộng tối đa 560 px giữa màn; vùng bấm ≥ 44×44 px; chữ thân 16 px (iOS không zoom ô nhập).
- Nhãn trạng thái: dùng `status_label` từ API; màu theo nhóm (mới/đang xử lý/chờ duyệt/khẩn cấp/đóng) — bảng màu từ token.
- Thời gian hiển thị `dd/MM HH:mm` theo giờ máy.
- Hành động huỷ/khẩn cấp: hộp xác nhận dạng sheet dưới màn (`confirmSheet(title, body) → Promise<boolean>`).
