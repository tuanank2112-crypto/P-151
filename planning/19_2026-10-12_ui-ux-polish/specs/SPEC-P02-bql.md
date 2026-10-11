# SPEC-P02 — Ban quản lý (WP2)

File được sửa: `portal/src/app/management/management-app.tsx`, `portal/src/lib/backend-map.ts` (chỉ `DeptPerf.rated`), mới `portal/src/lib/bql-view.ts`. CẤM sửa action server và Python.

## §1 Điều hướng
- Bỏ ô **Kho vật tư** khỏi thanh điều hướng BQL (Kho là màn riêng của vai Kho).
- "Tất cả ticket" ⇒ **Danh sách ticket**. Bỏ câu "Bấm bất kỳ dòng nào…" ở tiêu đề phụ.

## §2 Danh sách ticket
- Thanh lọc 2 tầng: (a) chip trạng thái theo `listGroup` (01 §3), không có "Tất cả", chip 0 ticket ẩn; (b) hàng phụ: chọn phòng ban, công tắc "Chỉ khẩn cấp", "Chỉ quá hạn", ô tìm, số dòng bên phải.
- Bảng: **Ticket** (mã + nhãn Khẩn cấp/Quá hạn cạnh mã + tiêu đề 1 dòng + vị trí nhỏ nếu có) · **Phòng ban** (`--` khi chưa có, "Ban quản lý" khi BQL giữ) · **Agent gợi ý** (ẩn cả cột khi mọi dòng "Chưa có") · **Thời gian**. Bỏ cột Trạng thái (chip đã nói trạng thái); nhãn trạng thái chi tiết của backend hiện dạng chữ nhỏ dưới tiêu đề.
- Bộ lọc giữ nguyên khi mở/đóng modal ticket.

## §3 Việc của BQL
- 3 ô: **Cần BQL quyết** · **Chờ nghiệm thu** · **Hoàn tất** theo `bqlBox` (01 §3); bỏ "Đã tiếp nhận" và "Tất cả". Mặc định mở "Cần BQL quyết" nếu > 0, không thì ô đầu có ticket.
- "Cần BQL quyết": khẩn cấp (đóng khẩn cấp / hạ mức, bắt buộc lý do) lên đầu, rồi báo sai phòng (chuyển về Tiếp nhận / giữ phòng), rồi ngoài phạm vi (Đã xử lý xong / Chuyển lại Tiếp nhận) có nhãn "Ngoài phạm vi" (plan D04). Thao tác giữ nguyên action hiện có.
- Ô khẩn cấp xử lý tại chỗ: thẻ Khẩn cấp ở Tổng quan và nhãn Khẩn cấp ở Danh sách dẫn thẳng tới ô này (1 lần bấm).

## §4 Tổng quan
- Tiêu đề phụ: "Tình hình ticket toàn khu đô thị." (bỏ "hôm nay" vì số liệu là toàn bộ).
- Thẻ KPI: nhóm thường (Tổng ticket, Chờ phân loại, Đang xử lý) tông trung tính; nhóm cảnh báo (**Khẩn cấp**, Quá hạn) viền trái + nền đỏ/cam nhạt + số đỏ/cam khi > 0, xám khi = 0. "Khẩn cấp chưa xong" ⇒ "Khẩn cấp". Bấm "Khẩn cấp" ⇒ Việc của BQL / Cần BQL quyết; các thẻ khác ⇒ Danh sách ticket với chip/công tắc tương ứng.
- "Điều phối và phụ tải": bỏ dòng hướng dẫn; mỗi phòng một thanh tiến độ 2 đoạn (Chờ nhận việc / Đang làm) theo `deptLoad`, độ dài tỉ lệ với phòng có `open` lớn nhất, số `open` bên phải, nhãn "x quá hạn" (cam) khi > 0. Bấm ⇒ Danh sách ticket lọc phòng đó, chip Đang xử lý.
- "Cần chú ý": danh sách gọn 1 dòng/ticket: mã · MỘT nhãn (Khẩn cấp ưu tiên hơn Quá hạn) · tiêu đề cắt 1 dòng · phòng ban (`--` nếu chưa có). Không lặp nhãn trạng thái.

## §5 Hiệu suất phòng ban (đợt 1 chỉ sửa hiển thị)
Theo 01 §4. Dashboard đầy đủ ở SPEC-P04.

## Vùng cấm
- Không thêm chip "Tất cả" (00 Vùng cấm).
- Không ẩn ticket ngoài phạm vi khỏi BQL ở đợt 1.
