# 00 — Kiến trúc & bất biến

## 1. Mục tiêu
Khi Kho/BQL nhập vật tư mà tồn trước đó đã hết (≤ 0) và Phòng Kỹ thuật dùng vật tư đó, hệ thống ghi một **cảnh báo cấp phòng ban** để nhân viên Kỹ thuật thấy và xác nhận đã đọc.

## 2. Non-goals
- Không gửi push/SMS/Zalo/email (giống `Notification`: chỉ ghi outbox).
- Không đổi `Notification`, `Ticket`, hay hình doc `cases` (Render cũ đọc chung).
- Không tự mở/duyệt ticket nào (việc đó là `resume()` sẵn có của `receive_stock`).
- Không đo thời lượng hết hàng (plan D04).

## 3. Bất biến
- B1: ghi cảnh báo và `add_stock` cùng một transaction; lỗi ⇒ rollback cả hai (fail closed, như `_mutate`).
- B2: nguồn "vật tư Kỹ thuật dùng" duy nhất = `material_policy.allowed_material_codes`.
- B3: cờ tắt ⇒ hành vi `receive_stock` không đổi.
- B4: cảnh báo append-only; chỉ hai cột `acknowledged_*` được cập nhật, một lần.

## 4. Vùng cấm (đã cân nhắc, KHÔNG làm)
- V1 CẤM nhét cảnh báo vào `Notification` bằng `ticket_id` giả: phá FK `notifications → cases` và hình doc.
- V2 CẤM suy `qty_before` bằng một lần đọc riêng NGOÀI transaction: race giữa hai lần nhập.
- V3 CẤM khớp "Kỹ thuật cần dùng" bằng tiền tố mã (`SIM-MAT-LAMP`…): lệch guard plan 16.
- V4 CẤM xoá cảnh báo; đã đọc thì đánh dấu.

## 5. Router đọc
`01-CONTRACTS` → `SPEC-P01` → `SPEC-P02` → `OPERATIONS` → `TESTING-ACCEPTANCE`.
