# Đối chiếu ghi chú anh Cố + trả lời người dùng (G4) — 2026-10-10

Đo trên UI mới qua **cổng 8000** (backend memory → portal production 3000), HEAD sau sửa WP7. Nguồn: thẩm định cô lập WP7 (agent Opus khác, ảnh `shots/`) + 4 bộ `ui-check-*` chạy lại sau sửa (`../WP7fix/ui-8000-*.txt`, đều EXIT=0).

| # | Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|---|
| R1 | BQL: bỏ thẻ BQL ở phụ tải; bấm Phòng VS/KT ⇒ ticket đã điều phối chưa xử lý xong | ĐẠT | `shots/mgmt-overview-1440.png`; WP7: chỉ 2 dòng phụ tải, bấm VS không ra Chờ nghiệm thu/Hoàn thành |
| R2 | 5 ô tổng quan bấm được | ĐẠT | WP7: số trên ô = số dòng 17/5/8/2/5; `ui-8000-WP5.txt` |
| R3 | Tất cả ticket bấm mã ⇒ chi tiết; Agent cứng bỏ | ĐẠT | `shots/mgmt-modal-1440.png` (khối Agent thật, không %) |
| R4 | Tiếp nhận bấm ticket ⇒ chi tiết (giữ 2 tab cũ — Q11) | ĐẠT | `shots/reception-modal-1440.png` |
| R5 | Role kho `kho`/`123456` | ĐẠT | `shots/r5-kho-1440.png`, `shots/home-kho-390.png` |
| R6 | Bỏ kho vật tư ở site kỹ thuật (BQL + Kho giữ — Q08) | ĐẠT | `shots/technical-queue-1440.png` (tab: Hàng việc · Yêu cầu vật tư · Lịch sử) |
| R7 | Form yêu cầu vật tư + "+ Vật tư khác" | ĐẠT | `shots/technical-request-modal-1440.png`; yêu cầu lần 2 cộng dồn (sửa P6) |
| R8 | Đánh dấu hoàn thành ⇒ Chờ nghiệm thu | ĐẠT | `ui-8000-WP4-*.txt` |
| R9 | Vệ sinh bắt buộc ảnh | ĐẠT | `shots/cleaning-finish-nophoto-1440.png`; backend cũng chặn (`execution_photo`) |
| R10 | Kỹ thuật checklist từ vật tư yêu cầu | ĐẠT | `shots/technical-finish-1440.png` |
| R11 | Việc của BQL: tiêu đề + nội dung, Đã xử lý xong ⇒ Hoàn thành, lọc Đã tiếp nhận/Đã hoàn thành/Tất cả | ĐẠT | `shots/mgmt-bql-1440.png`, `shots/mgmt-bql-done-1440.png` |
| Q10 | Agent thật + Hiệu suất Agent đúng/sai | ĐẠT (mock: trạng thái rỗng; khối có dữ liệu Agent thật chỉ kiểm bằng unit — cần LLM thật để thấy trên UI) | `shots/reception-perf-1440.png` |
| Q12 | Ô Đang xử lý không gồm Chờ nghiệm thu | ĐẠT | WP7 |
| Q13 | Phòng ban xong ⇒ BQL nghiệm thu ⇒ Hoàn thành | ĐẠT | WP7, `ui-8000-WP5.txt` |
| Q14 | Agent/Tiếp nhận chuyển BQL; ô Tiêu đề cư dân | ĐẠT | `shots/resident-compose-1440.png` |
| Q15 | Mọi yêu cầu vật tư chờ Kho/BQL duyệt; duyệt = xuất kho (sửa P7) | ĐẠT (memory). Trên Supabase cờ TẮT tới khi Render chạy code mới (sửa P5) | `test_wp7_*`, `shots/warehouse-requests-1440.png` |
| Q16 | Checklist vật tư bắt buộc tích hết | ĐẠT | WP7 |
| Q17 | Phân công giữ; thẻ + bình luận đánh giá giữ; bỏ xác nhận/hủy/khẩn cấp của cư dân | ĐẠT | `shots/resident-rating-B-1440.png` |
| Q18 | Mã ticket = mã backend | ĐẠT | mọi ảnh (`SIM-TKT-…`) |
| Q19 | UI mới ở cổng 8000, không dùng `/ui/` | ĐẠT | toàn bộ đo qua `http://127.0.0.1:8000` |
| 390px | Không tràn ngang 6 vai | ĐẠT | `shots/home-*-390.png` |

Chưa đo: chạy trên dữ liệu Supabase (G6 — thiếu mật khẩu DB); khối Agent có dữ liệu thật trên UI (cần `LLM_MODE` thật).
