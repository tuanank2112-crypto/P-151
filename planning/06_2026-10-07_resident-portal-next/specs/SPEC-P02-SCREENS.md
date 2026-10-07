# SPEC-P02 — Màn hình (đối chiếu từng file thiết kế)

Nguồn: `design-ticket-cu-dan/design-ticket-cu-dan/design/<File>.dc.html`. Markup/CSS trong `<x-dc>` + `<helmet><style>`,
hành vi trong `renderVals()`. Bản thật dùng lại NGUYÊN class CSS của thiết kế (chép vào `portal/src/app/globals.css`) để
màu, bo góc, kích thước khớp từng pixel; Tailwind dùng cho bố cục mới phát sinh.

## 1. Khung chung (`portal/src/components/shell.tsx`)
Đầu trang gradient `#9CCBFF → #5E9BFF` (padding 32/24/112), avatar 72px (chữ viết tắt), "Xin chào," + tên 32px,
pill vai trò, chuông 56px có badge, nút "Đăng xuất" (Server Action). Menu `nav.card` đè lên đầu trang (margin −80px),
lưới `repeat(auto-fit, minmax(140px,1fr))`, ô `.tile` 72px; mục chọn `.tile.on`; số đếm `.cnt` chỉ hiện khi > 0.
Tiêu đề trang 28px + mô tả 15px `#5B6578` (trừ Cư dân dùng tiêu đề trong từng tab như thiết kế).

## 2. Từng màn
| Màn | Route | File thiết kế | Tab / phần bắt buộc |
|---|---|---|---|
| Đăng nhập | `/login` | `Main.dc.html` | Gradient 40/24/160, form 460px bo 24, ô 52px, nút Hiện/Ẩn mật khẩu, hộp lỗi `role=alert`, "Quên mật khẩu? …" |
| Cư dân | `/resident` | `Resident.dc.html` | Gửi phản ánh (3 thẻ đánh số + tóm tắt sticky, câu mẫu, nút khẩn cấp tự phát hiện, 4 ô vị trí + chip chi tiết, cảnh báo vị trí theo mô tả, kéo thả ≤5 ảnh, checklist, thẻ "Đã gửi"); Phản ánh của tôi (4 ô tổng quan lọc được, chip lọc có đếm, danh sách thẻ có thanh 6 đoạn, chi tiết: bước 6 chấm, thông tin 4 ô, nghiệm thu, đánh giá sao + thẻ nhanh + bình luận, đánh giá đã gửi, bổ sung thông tin, lịch sử dọc, huỷ ở bước 1–2); Thông báo |
| Ban tiếp nhận | `/reception` | `Reception.dc.html` | Chờ phân loại (khẩn cấp lên đầu, gợi ý + thanh tin cậy + từ khóa, nút chuyển phòng ban — gợi ý tô xanh, đánh dấu khẩn cấp, yêu cầu bổ sung, gộp [D6]); Đã phân loại (bảng 5 cột, kết quả Agent đúng/Đã sửa/Chờ cư dân bổ sung); Hiệu suất Agent (4 ô + danh sách lần sửa). KHÔNG có tab Quy tắc từ khóa (Q12); thay ô Gộp bằng khung so sánh trùng do Agent đề xuất (Q13) |
| Ban quản lý | `/management` | `Management.dc.html` | Tổng quan (5 ô, thanh theo phòng ban, Cần chú ý: khẩn cấp/quá hạn/đánh giá thấp [D8]); Tất cả ticket (chip lọc + bảng 6 cột); Việc của BQL (Nhận xử lý → Đánh dấu hoàn thành, chuyển Vệ sinh/Kỹ thuật); Hiệu suất phòng ban (bảng 6 cột). KHÔNG có tab Phân quyền (Q12) |
| Phòng vệ sinh | `/cleaning` | `Cleaning.dc.html` | Hàng việc 3 cột (khẩn cấp lên đầu, giao Tổ A/B/C, Đánh dấu hoàn thành); Phân công tổ (tải x/cap); Lịch sử (đánh giá cư dân) |
| Phòng kỹ thuật | `/technical` | `Technical.dc.html` | Hàng việc 3 cột có pill "Còn Xh / Quá hạn Xh", chuyên môn, KTV đúng chuyên môn viền `btn sug`, Yêu cầu vật tư [D5]; Kỹ thuật viên (Đang bận / Sẵn sàng); Yêu cầu vật tư (Chờ cấp → Xác nhận đã nhận) |

## 3. Quy tắc tính toán (đúng `renderVals()`)
- Cư dân: số trên ô "Phản ánh của tôi" = chưa huỷ và stage < 6. Bộ lọc `run/accept/rate/done` như `inFilter`. Sao: 4–5 ⇒ thẻ tốt `GOOD_TAGS`, 1–3 ⇒ `BAD_TAGS`; đổi số sao ⇒ xoá thẻ đã chọn.
- Ban tiếp nhận: % đúng = đã chuyển có `dept` mà `dept = ai_dept`; "Số lần sửa" = `dept ≠ ai_dept`.
- BQL: "Quá hạn Xh" = giờ đã trôi (làm tròn xuống) khi quá hạn; TB thời gian xử lý = trung bình `(done_at − created_at)` giờ của ticket stage ≥ 5; "Cư dân hài lòng" = tỉ lệ đánh giá ≥ 4 sao trên số ticket đã đánh giá.
- Vệ sinh lịch sử: ≥ 4 sao "Cư dân hài lòng" (`good`), 1–3 "Cư dân chưa hài lòng" (`bad`), chưa đánh giá `none`; dưới mỗi dòng là khối "ĐÁNH GIÁ CỦA CƯ DÂN" (sao, thẻ, bình luận). Thẻ cột "Hoàn thành" của CẢ hai phòng ban hiện cùng khối đó, hoặc "Chờ cư dân nghiệm thu." / "Cư dân chưa đánh giá." (plan Q11, D10).
- Kỹ thuật: `left = SLA − giờ đã trôi`; < 0 ⇒ `sla-late` "Quá hạn Nh".

## 4. Responsive & truy cập
Bảng nằm trong khung `overflow-x: auto`; cột/thẻ dùng `flex-wrap` như thiết kế; nút tối thiểu 44px; mọi nút icon có `aria-label`.

## 5. Vùng cấm
- CẤM thay class/màu thiết kế bằng giá trị Tailwind "gần giống" (sai lệch màu); dùng nguyên class.
- CẤM thêm tab/màn không có trong thiết kế ngoài D5–D8 (00-ARCHITECTURE §5).
