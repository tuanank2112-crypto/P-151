# OPERATIONS

## 1. Thứ tự
M1 (engine/API, test đỏ trước/xanh sau) → M2 (portal + mobile) → cổng toàn bộ → M3 thẩm định → não + version 1.17.0.

## 2. Triển khai
- Không migration (bảng `stock_alerts` không có CHECK trên `qty_before/qty_after`; đã đọc `0005_stock_alerts.py`).
- Ticket cũ đang `WAITING_MATERIAL` tự hiện thành phiếu (khung nhìn). Không có thông báo `material.shortage` cũ cho chúng — chấp nhận.
- App điện thoại: tăng `?v=`/`SHELL_CACHE` để máy tải lại.

## 3. Rollback
Revert commit hồ sơ 24. Alert đã ghi có `qty_before > 0` vẫn đọc được bởi code cũ? KHÔNG — model cũ ràng buộc `qty_before ≤ 0` sẽ lỗi khi đọc. Rollback ⇒ chạy `delete from maintops.stock_alerts where qty_before > 0` (chỉ bảng thông báo, không đụng ticket/kho) — cần người duyệt trên DB chung.
