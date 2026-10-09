# Kịch bản user test — MaintenanceOps (bản nháp, chờ duyệt trước 08/10)

Dữ liệu và ticket đều MÔ PHỎNG (tiền tố `SIM-`). Không thu thông tin cá nhân thật; không ghi âm/ảnh người thử.

## 1. Mục tiêu và giới hạn
- Kiểm xem người không thuộc nhóm hiểu và thao tác được 4 luồng demo; đo thời gian/số thao tác so với cách làm thủ công; ghi lỗi và chỗ hiểu sai lời hiển thị.
- Giới hạn: bản chạy local/online mô phỏng; kết quả không đại diện vận hành thật. 3–5 người ⇒ chỉ là chỉ báo, không có ý nghĩa thống kê.

## 2. Người tham gia
- 3–5 người độc lập (không phải thành viên nhóm); mỗi thành viên nhóm mời ≥1 người. Ghi vai nhập: cư dân / BPTN / BQL (phòng ban, kho do người điều phối mô phỏng).
- Thiếu người ⇒ ghi số người thật; CẤM tự điền phản hồi.

## 3. Nhiệm vụ (từ bốn nhóm demo, specs/OPERATIONS.md trong hồ sơ 02)
| Mã | Vai | Nhiệm vụ | Thành công khi |
|---|---|---|---|
| T1 | Cư dân | Gửi phản ánh "đèn hành lang tầng 3 không sáng" và xem trạng thái | Thấy trạng thái đúng, hiểu được "đang làm gì" |
| T2 | BPTN | Xử lý ticket thiếu thông tin (NEED_INFO) và ticket tài sản chưa rõ | Ticket đi tiếp đúng bước |
| T3 | BQL | Nghiệm thu rồi đóng ticket đã hoàn thành | Ticket CLOSED, có ghi chú |
| T4 | BPTN/BQL | Xử lý phản ánh có khói/mùi khét (Bậc 2 rồi Bậc 1) | Chọn đúng hành động; người thử nói được vì sao |
Mỗi nhiệm vụ cũng làm bằng cách thủ công (ghi chú giấy/bảng tính) để so sánh.

## 4. Thiết kế so sánh
Đảo thứ tự: người số lẻ làm thủ công trước, người số chẵn dùng sản phẩm trước; ghi thứ tự trong bảng.

## 5. Đo gì (điền số thật, không ước lượng)
Thời gian hoàn thành (giây), số thao tác/click, số lỗi/nhầm, có cần gợi ý không (có/không), 3 câu hỏi: "Em hiểu câu này nghĩa là gì?" (lời hiển thị cho cư dân), "Có bước nào gây nhầm?", "Muốn dùng lại không (1–5)?".

## 6. Bảng ghi (copy mỗi người một dòng/nhiệm vụ)
| Người # | Vai | Thứ tự (TC/SP trước) | Nhiệm vụ | Thủ công: giây / thao tác | Sản phẩm: giây / thao tác | Lỗi | Cần gợi ý | Nhận xét nguyên văn |
|---|---|---|---|---|---|---|---|---|
| (trống) | | | | | | | | |

## 7. Điều kiện chạy
Dùng tài khoản mô phỏng của bản online/local đã duyệt môi trường; không reset DB chung; không dùng ảnh thật. Chức năng chưa tích hợp (D-01 delta/snapshot) KHÔNG đưa vào nhiệm vụ.

## 8. Việc cần người
Duyệt kịch bản; chốt danh sách người tham gia và lịch 10–12/10; chuẩn bị môi trường online ổn định cho lịch test.
