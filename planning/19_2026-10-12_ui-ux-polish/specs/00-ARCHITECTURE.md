# 00 — Kiến trúc & bất biến

## Mục tiêu
Làm các màn Tiếp nhận, Kỹ thuật, Vệ sinh, Ban quản lý và Kho dễ đọc, ít thao tác, số liệu không gây hiểu lầm, theo danh sách của người dùng (plan.md, Metadata).

## Non-goals (đợt 1)
- Không đổi quy tắc nghiệp vụ backend (quyền, trạng thái, Agent, an toàn, vật tư). Ngoại lệ duy nhất: trường đọc `min_qty` (01 §5).
- Không đụng app điện thoại `src/mobile/` và web cũ `src/web/`.
- Không thêm thư viện npm/pip.

## Bất biến
1. **Một ticket — một ô.** Mọi nhóm chip/ô trong cùng một thanh lọc là phân hoạch: mỗi ticket thuộc đúng một ô, tổng các ô = tổng danh sách. Hàm phân nhóm là hàm thuần trong `portal/src/lib/` và có test (01 §1–§3).
2. **Số trên ô = số dòng sau khi chọn ô đó.**
3. **Không hiển thị số giả:** dữ liệu chưa có ⇒ `--` hoặc nhãn "N/A"/"Chưa kiểm kê", không phải `0`.
4. **Đỏ/cam chỉ dành cho cảnh báo thật** (khẩn cấp, quá hạn, hết/sắp hết hàng). Số liệu thường dùng tông trung tính.
5. **Không có nút không làm gì.** Thao tác chưa có backend thì không hiện (để đợt 2).
6. Bỏ mọi dòng hướng dẫn kiểu "Bấm vào … để xem …".

## Vùng cấm (đã cân nhắc, KHÔNG làm)
- Không thêm lại chip/ô "Tất cả" ở BQL (người dùng bỏ vì thừa và làm ticket hiện hai chỗ).
- Không ẩn ticket ngoài phạm vi khỏi BQL ở đợt 1 (plan D04: sẽ mồ côi).
- Không dùng ngưỡng tồn chung 30 (plan D02).
- Không vẽ biểu đồ bằng thư viện ngoài (plan D05).

## Thứ tự đọc
01-CONTRACTS → SPEC-P01 → SPEC-P02 → SPEC-P03 → OPERATIONS → TESTING-ACCEPTANCE. SPEC-P04 chỉ đọc khi làm đợt 2.
