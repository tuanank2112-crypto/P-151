# OPERATIONS

## 1. Thứ tự
E1 → E2 → E3 (engine, mỗi gói có test đỏ trước/xanh sau) → E4 portal → cổng toàn bộ → E5 thẩm định → não + version.

## 2. Triển khai
- Không migration, không đổi seed/catalog. Backend khởi động lại là có hành vi mới.
- Ticket cũ đang `EMERGENCY_PENDING_BQL` không được đánh dấu lại (chỉ đánh dấu lúc trở thành khẩn cấp). Chấp nhận.
- Ticket cũ đã `ROUTED` cạnh khẩn cấp không bị kéo về giữ.

## 3. Rollback
Revert commit hồ sơ 23. Dữ liệu ghi thêm (`related_ticket_id` trên blocker khẩn cấp, `duplicate_count`) là trường có sẵn ⇒ code cũ đọc được, không cần dọn.
