# WP5 - tự đối chiếu SPEC-P03 §5-§7 (số đo: evidence/WP5/ui-check.txt, 75 PASS / 0 FAIL; ảnh cùng thư mục)
| Dòng SPEC | Kết quả | Chứng minh |
|---|---|---|
| 5.1 chỉ Phòng VS/KT, bỏ hàng BQL, bỏ chip BQL | đạt | ui-check "5.1 load rows = 2", "no Ban quản lý chip"; mgmt-1-overview-*.png |
| 5.1 bấm hàng -> tab Tất cả lọc dept + chưa xong (stage<5); xem cả đã xong/hủy | đạt (chip "Gồm đã xong/hủy" - xem Quyết định 2) | "5.1 load ve_sinh/ky_thuat: số = số dòng", "showAll >= filtered"; mgmt-2-all-*.png |
| 5.2 5 ô bấm được, số = số dòng, role=button, Enter/Space, focus ring, con trỏ tay | đạt | "5.2 tile ..." 5 ô x 2 độ rộng + Enter + Space + cursor + outline |
| 5.3 bảng mọi ticket, bấm bất kỳ dòng/mã -> modal, cột Agent gợi ý thật (không %) | đạt (dữ liệu hiện tại chưa có agent_decision nên cột hiện "Chưa có") | "5.3 ..." ; mgmt-3-modal-*.png |
| 5.4 lọc Đã tiếp nhận/Đã hoàn thành/Tất cả, 3 khối | đạt | "5.4 three filters/blocks"; mgmt-4-bql-*.png |
| 5.4 Chờ nghiệm thu: ảnh, checklist, vật tư, 2 mục tích khoá nút, Nghiệm thu đạt, Trả làm lại (lý do) | đạt (nghiệm thu đạt chạy thật: Đã hoàn thành 0 -> 1) | mgmt-4-bql-inspection-ready-1440.png; "approve locked / unlocked" |
| 5.4 Việc của BQL: tiêu đề + nội dung + vị trí + giờ, nhãn Agent/Tiếp nhận chuyển, Đã xử lý xong (note), Chuyển lại Tiếp nhận | đạt (nhãn "Tiếp nhận chuyển" thấy trên SIM-TKT-0005; nhãn "Agent chuyển" CHƯA thấy trên dữ liệu thật - Agent tắt) | ảnh trên; "BQL handled -> Đã hoàn thành count" |
| 5.4 Cần BQL quyết (khẩn cấp: đóng/hạ mức; sai phòng: giữ/chuyển) | đạt hiển thị; nút chưa bấm trong test | ảnh trên |
| 5.5 Hiệu suất: đang xử lý, quá hạn, đã đóng, sao TB, giờ hoàn thành TB theo VS/KT | đạt | "5.5 perf columns"; mgmt-5-teams-*.png (dữ liệu rỗng hiện "Chưa có") |
| 5.6 lối vào Kho vật tư -> /warehouse đầy đủ quyền | đạt | "5.6 management enters /warehouse"; mgmt-6-warehouse-*.png |
| 6 tồn kho: mã, tên, đơn vị, tồn; Thêm vật tư; Nhập kho | đạt | "6 inventory columns", "add item ... added", wh-1..3 |
| 6 yêu cầu vật tư: cần/tồn/thiếu, Duyệt cấp (khoá + "Nhập kho trước" khi thiếu), Nhập đủ <vật tư> điền sẵn số thiếu | đạt hiển thị + khoá; bấm Duyệt cấp thành công CHƯA đo (chỉ có yêu cầu thiếu hàng) | "6 approve locked + hint when short"; wh-4-requests-*.png |
| 7 modal: mã, trạng thái, khẩn cấp, giờ, phòng, nhân viên, vị trí, tiêu đề, nội dung, blocker+publicMessage, stepper, ảnh trước/sau, checklist, vật tư, đánh giá, lịch sử, bổ sung | đạt | mgmt-3-modal-*.png |
| 7 Phân tích Agent = dữ liệu thật; không có -> "Chưa có quyết định của Agent" | đạt nhánh trống đo được; nhánh có dữ liệu viết theo AgentInfo nhưng CHƯA thấy trên dữ liệu thật | "7 modal empty-state" |
| Không rộng quá viewport | đạt sau sửa thanh công cụ kho | "no horizontal overflow on any screenshot" |
