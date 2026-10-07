# 00 — Kiến trúc: reskin `src/web/` theo design `portal/`

## 1. Mục tiêu
UI tĩnh của backend (`src/web/index.html` + `app.js`, phục vụ ở `/ui`) mang cùng ngôn ngữ thiết kế với `portal/`:
font Be Vietnam Pro, nền `#F3F5F9`, chữ `#13203A`, brand `#1D4ED8`, header gradient `#9CCBFF → #5E9BFF` có
"Xin chào, <tên>", card trắng bo 22px, nút pill, ô nhập `.field`, nhãn trạng thái dạng `.pill`.

## 2. Non-goals
- KHÔNG đổi API gọi, luồng nghiệp vụ, quyền, nội dung chữ nghiệp vụ của bất kỳ màn nào.
- KHÔNG đổi bố cục danh sách | chi tiết (list-pane 5/12, detail-pane 7/12).
- KHÔNG gộp hai app, KHÔNG để `src/web/` import file từ `portal/` (hai app độc lập, plan 06 A1).
- KHÔNG thêm bước build (giữ Tailwind Play CDN như hiện tại).

## 3. Bất biến
| # | Bất biến |
|---|---|
| B1 | Mọi chuỗi từ API vẫn chèn bằng text node (`el()`), không `innerHTML` — giữ nguyên quy tắc đầu `app.js`. |
| B2 | DOM id ở 01-CONTRACTS §2 giữ nguyên (test `tests/test_maintenance/test_api.py` và code dựa vào). |
| B3 | Màu chỉ lấy từ token 01-CONTRACTS §1 (chép từ `portal/src/app/globals.css`), không chọn "màu gần giống". |
| B4 | Màu không là tín hiệu duy nhất: badge trạng thái vẫn có chữ. |
| B5 | Không tràn ngang trang ở 390px. |

## 4. Thứ tự đọc
`01-CONTRACTS.md` → `SPEC-P01-RESKIN.md` → `OPERATIONS.md` → `TESTING-ACCEPTANCE.md`.

## 5. Vùng cấm (đã cân nhắc, KHÔNG làm)
| # | Việc | Lý do |
|---|---|---|
| V1 | Chuông thông báo, tile menu tròn của portal | Không có dữ liệu/tab tương ứng — nút giả (plan Q05) |
| V2 | Giữ dark mode | Thiết kế không có bản tối (plan Q04) |
| V3 | Dựng lại từng màn theo layout portal (bảng Ban tiếp nhận, tab BQL…) | Khác mô hình dữ liệu; ngoài phạm vi reskin (plan Q02) |
| V4 | Sửa `js/components/*.js` | Không được `index.html` nạp |
