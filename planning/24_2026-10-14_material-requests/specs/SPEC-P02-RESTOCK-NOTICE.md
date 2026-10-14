# SPEC-P02 — Thông báo khi kho nhập

## 1. Điều kiện (thay plan 20 SPEC-P01 §1) — `_raise_stock_alerts`
Cùng giao dịch với `add_stock` (I-4). Với mỗi phòng ban `D ∈ {DEPT_CLEANING, DEPT_TECHNICAL}`:
- `waiting_D` = ticket trong `waiting` (đang `WAITING_MATERIAL` có dòng mã này) mà `department_id or proposed_department_id == D`, theo thứ tự `waiting`.
- Tạo alert cho `D` nếu `waiting_D` không rỗng, HOẶC (`tracked` và `before ≤ 0` và mã thuộc `allowed_material_codes(catalog, D)`).
- Cờ `MO_STOCK_ALERTS` tắt ⇒ không tạo (như cũ). `ticket_ids = tuple(waiting_D)`.
- `alert_id = f"SIM-SAL-{item}-{D_suffix}-{now:%Y%m%d%H%M%S%f}"` (khác phòng ⇒ khác id cùng thời điểm).
Tối đa một alert mỗi phòng mỗi lần nhập (I-5).

## 2. Đủ / chưa đủ (tính lúc đọc)
Response của `GET /mo/stock-alerts` thêm trường chỉ đọc `tickets: [{ticket_id, waiting: bool}]` — `waiting = ticket vẫn ON_HOLD/WAITING_MATERIAL`. Không lưu (vùng cấm 00 §5). Ticket không còn ⇒ bỏ qua.

## 3. Quyền (thay `_alert_department`)
| Vai | Xem | Ack |
|---|---|---|
| Phòng ban | phòng mình (bỏ qua `department`) | alert phòng mình |
| BQL | `department` tuỳ chọn; không có ⇒ mọi phòng | mọi alert |
| Kho | như BQL, chỉ xem | không |
| Khác | 403 | 403 |
Ack alert phòng khác ⇒ 403.

## 4. Vùng cấm
- Không tạo alert cho ticket chờ mã khác (chỉ mã vừa nhập).
- Không gửi alert cho cư dân.
