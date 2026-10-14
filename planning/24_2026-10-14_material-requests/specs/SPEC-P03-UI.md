# SPEC-P03 — Portal và app điện thoại

## 1. Portal (`portal/`)
| Màn | Thêm |
|---|---|
| Kho `app/warehouse/warehouse-app.tsx` | Khối **"Phiếu vật tư cần nhập"** (đầu trang, đếm trên chuông): mỗi phiếu = mã `PVT-…`, ticket, phòng, vị trí, nguồn ("Agent" / tên phòng), thời gian chờ, các dòng (mã, tên, cần, tồn, thiếu). Nút **"Nhập đủ"** cho từng dòng mở form nhập kho sẵn có, điền sẵn mã + số thiếu. Không nút duyệt. Dữ liệu: `GET /mo/warehouse/requests` (dựng trong `server/data/warehouse.ts`, thay `requests` cũ dựng từ ticket). |
| Kỹ thuật `technical-app.tsx`, Vệ sinh `cleaning-app.tsx` | Ticket đang làm: nút **"Báo thiếu vật tư"** ⇒ form chọn mã (danh sách mã của phòng, như form vật tư đã dùng) + số cần thêm + ghi chú tuỳ chọn ⇒ `POST material-shortage`. Ticket `WAITING_MATERIAL` hiện nhãn "Chờ kho nhập vật tư". Chuông **"Thông báo kho"** cho CẢ HAI phòng (dùng lại cách của Kỹ thuật ở plan 20): dòng "Kho đã nhập <tên> +<số>" + danh sách ticket kèm "Đã chạy tiếp" / "Vẫn thiếu"; nút đã xem (ack). |
Hành động server mới trong `app/actions/departments.ts` / `warehouse` tương ứng; lỗi hiện nguyên văn (01 §4).

## 2. App điện thoại (`src/mobile/`)
| File | Thêm |
|---|---|
| `js/dept.js` | Ticket đang làm: nút "Báo thiếu vật tư" (form như portal). Chuông đầu màn: số alert chưa xem của phòng; bấm ⇒ danh sách alert (như portal) + "Đã xem". |
| `js/kho.js` | Tab "Nhập vật tư": danh sách lấy từ `GET /mo/warehouse/requests` (mã `PVT-…`, nguồn, dòng thiếu); bấm dòng ⇒ điền sẵn form nhập. |
| `js/api.js` | hàm gọi 4 route của 01 §3. |
Tăng `?v=` và `SHELL_CACHE` theo quy ước hiện có (docs/mobile.md).

## 3. Vùng cấm
- Không khôi phục tab/hàng đợi "duyệt cấp" hay nút "Thêm vật tư mới".
- Không hiện thông báo kho cho cư dân.
