# OPERATIONS

1. Thứ tự BẮT BUỘC: áp migration 0005 (`alembic upgrade head`) → bật `MO_STOCK_ALERTS=true`. Code mới với cờ tắt chạy được trên DB còn ở 0004.
2. Supabase chung: ghi phải hỏi người dùng (Luật L.3); đợt này KHÔNG tự áp.
3. Rollback: tắt cờ (tức thì, không mất dữ liệu) → nếu cần `alembic downgrade 0004_portal_extras` (mất bảng cảnh báo).
4. Backend memory (dev): bật cờ là đủ.
