# 00 — Kiến trúc & bất biến: chia trang danh sách 20 ticket (plan 10)

## §1. Bối cảnh
- Người dùng, 2026-10-08: "tôi chỉ muốn khoảng 20 ticket 1 lần thôi".
- Bốn màn danh sách của UI tĩnh `src/web/app.js` (cư dân, BPTN, phòng ban, BQL; kho không có danh sách ticket) đều vẽ qua
  MỘT helper `listCard(title, count, items, empty)` (`app.js:500`) và hiện TẤT CẢ dòng.
- Ô đếm (Tổng / Đang xử lý / Khẩn cấp…), lọc bỏ ticket seed (`isSeedTicket`), lọc hàng chờ BPTN, lọc "Chỉ khẩn cấp" và sắp xếp của BQL
  đều tính ở TRÌNH DUYỆT trên toàn bộ danh sách API trả về.
- Sau plan 09, API danh sách trả trong ~0.2 s (66 ticket). Chi phí còn lại khi danh sách dài là DOM: vẽ N thẻ mỗi lần `render()`.

## §2. Mục tiêu
1. Mỗi màn danh sách hiện tối đa **20** ticket một lần, có nút chuyển trang.
2. Ô đếm, bộ lọc, thứ tự sắp xếp, ticket được chọn và màn chi tiết giữ nguyên hành vi hiện tại.
3. Chuyển trang KHÔNG gọi API (không chờ mạng).

## §3. Non-goals
- KHÔNG đổi backend, KHÔNG đổi API (`src/api/`, `src/maintenance/` không chạm).
- KHÔNG chia trang ở server (`limit`/`offset`), KHÔNG đổi số lượng/nội dung API trả.
- KHÔNG đổi giao diện ngoài: khối chuyển trang dưới danh sách + chuyển trang khi cần để luôn thấy ticket đang chọn.
- KHÔNG đổi màn AI logs (đã có `limit=100` ở API).

## §4. Bất biến
- I-1: Ô đếm và pill "`N` phản ánh" của `listCard` vẫn đếm TOÀN BỘ danh sách đã lọc, không phải 20 dòng của trang.
- I-2: Thứ tự dòng = thứ tự hiện tại; trang k gồm dòng `(k-1)*20 … k*20-1` của đúng thứ tự đó.
- I-3: Ticket đang chọn (`state.selected`) luôn nằm trên trang đang hiện sau mỗi `render()` (nếu nó có trong danh sách).
- I-4: ≤ 20 dòng ⇒ không hiện khối chuyển trang (giao diện y như cũ).
- I-5: Trang của mỗi màn nhớ riêng trong `state.pages` (trong bộ nhớ, không `localStorage`); đăng xuất ⇒ xoá.

## §5. Thứ tự đọc
`01-CONTRACTS.md` → `SPEC-P01-pager.md` → `OPERATIONS.md` → `TESTING-ACCEPTANCE.md`.

## §6. Vùng cấm (đã cân nhắc, KHÔNG làm — kèm lý do)
| Ý định | Vì sao không |
|---|---|
| Chia trang ở server (`?limit=20&offset=`) | Ô đếm, lọc seed, lọc BPTN, lọc khẩn cấp, sắp xếp BQL đều chạy ở trình duyệt trên toàn bộ danh sách ⇒ phải chuyển hết lên server + đổi API của 3 router; lợi băng thông nhỏ sau plan 09. Để Idea Vault khi > vài nghìn ticket |
| "Xem thêm" / cuộn vô tận | Danh sách vẫn phình dần, không đạt "20 cái một lần"; khó quay lại đúng chỗ sau `render()` |
| Lưu trang vào `localStorage`/URL | Trang chỉ có nghĩa với danh sách đang lọc lúc đó; mở lại app về trang 1 là đúng mong đợi |
| Gọi `render()` khi bấm chuyển trang | `render()` gọi lại API và vẽ lại màn chi tiết — chậm và nháy; chuyển trang chỉ thay phần danh sách |
| Cho người dùng chọn 10/20/50 dòng | Người dùng chỉ yêu cầu 20; thêm lựa chọn = thêm giao diện không ai xin |
