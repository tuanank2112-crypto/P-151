# SPEC-P03 §4 self-check (WP4). Browser run: ui-check-cleaning.txt / ui-check-technical.txt (EXIT=0). Base URL http://localhost:3000 (see report, open question 3).

| Dòng SPEC | Kết quả | Ảnh / ghi chú |
|---|---|---|
| 4.1 thẻ: mã, tiêu đề, nội dung, vị trí, giờ, khẩn cấp, statusLabel, hoursLeft, ảnh cư dân, bổ sung, nhân viên | đạt | cleaning-queue-1440/390, technical-queue-1440/390. Vị trí "—" khi backend không có dòng "Vị trí:" (dữ liệu) |
| ROUTED: "Phân công" (từ GET /mo/staff) | đạt | cleaning-assign-modal; khi /mo/staff rỗng/404 hiện "Nhận việc" (chưa thử nhánh này sau khi staff có dữ liệu) |
| ROUTED: "Không phải việc phòng mình" (note) | đạt | cleaning-return-modal (nút khoá khi note rỗng; chưa gửi thật) |
| IN_PROGRESS: "Đánh dấu hoàn thành" | đạt | cleaning-finish-modal, technical-finish-modal |
| IN_PROGRESS: "Báo sai phòng ban" (note) | đạt (mở/huỷ, không gửi) | cleaning-queue-inprogress |
| IN_PROGRESS: đổi người | đạt (nút + modal; không bấm gửi) | technical-queue-after-request |
| IN_PROGRESS kỹ thuật: "Yêu cầu vật tư" | đạt | technical-request-modal |
| ON_HOLD + WAITING_MATERIAL: "Chờ cấp trên duyệt vật tư" / "Chờ kho nhập hàng" + danh sách | đạt | technical-queue-after-request (khối vàng, "thiếu 1") |
| 4.2 tab Phân công tổ (tải = ticket mở) | đạt | cleaning-staff |
| 4.2 tab Lịch sử (READY_FOR_REVIEW/CLOSED + sao/thẻ/bình luận, không danh tính) | đạt phần hiển thị | cleaning-history; chưa có ticket CLOSED có đánh giá để chụp nhánh sao/thẻ |
| 4.3 kỹ thuật không có tab kho | đạt | check "no warehouse tab": tab = Hàng việc / Yêu cầu vật tư / Lịch sử |
| 4.3 modal nhiều dòng, catalog (tên·đơn vị·tồn, đỏ khi 0), −/+, + Thêm dòng, + Vật tư khác (ẩn khi custom=false), ghi chú bắt buộc | đạt | technical-request-modal; ghi chú rỗng => báo lỗi (đã kiểm) |
| 4.3 tab "Yêu cầu vật tư" theo ticket + trạng thái (chờ duyệt / chờ nhập hàng / đã cấp) | đạt | technical-materials |
| 4.4 vệ sinh: ảnh ≥1 bắt buộc + checklist playbook + ghi chú | đạt | thiếu ảnh => lỗi nội dòng, có ảnh => "Chờ nghiệm thu". "Vật tư đã dùng" của vệ sinh: chỉ hiện danh sách vật tư của ticket (không có nhập) — câu hỏi mở 2 |
| 4.4 kỹ thuật: mỗi vật tư cấp là dòng "Đã dùng <tên> — số lượng", tích hết | đạt | technical-finish-modal-390: chưa tích hết => "Phải tích hết checklist vật tư đã dùng." |
| 4.4 không đạt hiện failing_items tiếng Việt; đạt => Chờ nghiệm thu | đạt một phần | lỗi hiện trong form; mục `failing_items` là mã dòng vật tư (SIM-MAT-LINE-…) chưa dịch (lib/ ngoài phạm vi) — câu hỏi mở 1 |
| §1 bấm mã => TicketDetailModal | đạt | cleaning-detail |
| §1 không chữ/số/% giả, không khối Agent viết cứng | đạt | grep nội dung: không có khối Agent trong 2 màn |
| Mọi phần tử bấm được là button + focus ring | đạt | class focus-visible outline trên mọi nút/mã/radio |
| Không tràn ngang 1440/390 | đạt | script đo scrollWidth<=viewport mỗi ảnh |
