# R01 — Đối chiếu 6 màn với file thiết kế (gate G5)
Handoff: (không có — SO tự thi công, plan.md §2)
Base: 52ae81c (dev, chưa commit)
Head: working tree 2026-10-07

Vai · thi công · Claude Opus 5.5 · Bước 0 exit 0 · đối chiếu từng phần tử trong `<x-dc>` của 6 file với ảnh `../evidence/screens/<màn>-<tab>-<1440|390>.png`.

| Màn (file) | Ảnh | Phần tử thiết kế | Có | Lệch (mã) |
|---|---|---|---|---|
| Đăng nhập (`Main.dc.html`) | `login-*` | gradient 40/24/160, logo nhà + tên cổng + tên khu, thẻ 460px bo 24, "Xin chào," + H1 30px, 2 ô 52px, nút Hiện/Ẩn, hộp lỗi `role=alert`, nút viên thuốc, "Quên mật khẩu?" | 11/11 | dòng "Vai trò: …" khi gõ, 3 câu lỗi riêng → D1 |
| Cư dân (`Resident.dc.html`) | `resident-1..3-*` | header (avatar chữ tắt, pill căn hộ, chuông 3, Đăng xuất); menu 3 ô + đếm; Gửi: 3 thẻ đánh số, nút khẩn cấp tự phát hiện, câu mẫu, dải "Agent nhận diện", 4 ô vị trí + chip chi tiết, cảnh báo vị trí theo mô tả, kéo thả ≤5 ảnh, Tóm tắt sticky + checklist + lỗi, thẻ "Đã gửi"; Của tôi: 4 ô tổng quan lọc được, 5 chip lọc có đếm, thẻ + thanh 6 đoạn (vàng khi tạm hoãn), nhãn "Cần bạn…", chi tiết: 6 chấm, 4 ô thông tin, khối tạm hoãn/huỷ, nghiệm thu đạt/làm lại, đánh giá sao + thẻ nhanh theo số sao + bình luận + cảnh báo <3 sao, "ĐÁNH GIÁ CỦA BẠN", bổ sung thông tin, lịch sử dọc, Hủy ở bước 1–2; Thông báo | đủ | lý do Agent không có nhãn nhóm → D4; thêm ảnh thu nhỏ → D7; "Cần bạn bổ sung thông tin" → D6; thông báo có nội dung thật → D9 |
| Ban tiếp nhận (`Reception.dc.html`) | `reception-1..4-*` | 4 ô menu; Chờ phân loại: khẩn cấp lên đầu, gợi ý + thanh tin cậy + từ khóa, 3 nút chuyển (gợi ý tô xanh), Đánh dấu/Bỏ khẩn cấp, Yêu cầu bổ sung; Đã phân loại: bảng 5 cột + Agent đúng/Đã sửa/Chờ cư dân bổ sung; Hiệu suất: 4 ô + danh sách sửa; Quy tắc: 3 thẻ, xoá ×, thêm | đủ | khung so sánh trùng do Agent đề xuất → D6/Q13; bỏ tab Quy tắc từ khóa → D11; không khớp = "Chưa rõ 0%" thay BQL 38% → D4 |
| Phòng vệ sinh (`Cleaning.dc.html`) | `cleaning-1..3-*` | 3 cột Cần nhận/Đang xử lý/Hoàn thành + badge + "Trống", thẻ (mã, giờ, khẩn cấp, từ khóa · %), giao Tổ A/B/C, Đánh dấu hoàn thành; Phân công tổ: khu vực, số đang/đã, thanh tải x/cap; Lịch sử: pill tổ + hài lòng/chưa/chưa đánh giá | đủ | nhãn "Tạm hoãn" trên thẻ (cờ dữ liệu) |
| Phòng kỹ thuật (`Technical.dc.html`) | `technical-1..3-*` | 3 cột, pill Còn Xh/Quá hạn Xh, chuyên môn, KTV đúng chuyên môn `btn sug`, Yêu cầu vật tư / Đã yêu cầu; Kỹ thuật viên: Đang bận/Sẵn sàng; Vật tư: Chờ cấp → Xác nhận đã nhận | đủ | nhập tên vật tư → D5 |
| Ban quản lý (`Management.dc.html`) | `management-1..5-*` | 5 ô số, thanh theo phòng ban đúng màu, Cần chú ý; Tất cả: 5 chip lọc + bảng 6 cột (gợi ý · %); Việc của BQL: Nhận xử lý → Đánh dấu hoàn thành, chuyển Vệ sinh/Kỹ thuật; Hiệu suất: bảng 6 cột + câu hạn xử lý | đủ | bỏ tab Phân quyền → D11; Cần chú ý thêm đánh giá <3 sao → D8; thêm nhãn "Chờ nghiệm thu", "Đã hủy" → D2 |

Cập nhật 2026-10-07 (Q11–Q13): phòng ban thấy đánh giá, không thấy người gửi; còn 16 tab.

Responsive: 16 tab × 390px, `scrollWidth ≤ 390` (`../evidence/gates/screens.txt`, exit 0); bảng cuộn trong khung `overflow-x: auto`.

Việc KHÔNG làm: so pixel tự động với thiết kế — file `.dc.html` cần `support.js` của công cụ thiết kế (không có trong gói) nên không render được; đối chiếu bằng mắt theo bảng trên.

✅ DUYỆT (tự đo; chờ người dùng duyệt các lệch D1–D9)
