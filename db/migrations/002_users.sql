-- 002_users.sql — bảng `users` (01-CONTRACTS.md §6), tách đứng trước
-- 003_knowledge.sql vì `documents.uploaded_by` (§3.1) tham chiếu `users(id)`.
--
-- GHI CHÚ SPEC (báo trong report R03, không tự sửa specs/): 01-CONTRACTS.md
-- trình bày `documents` (§3.1) TRƯỚC `users` (§6) trong cùng một tài liệu,
-- nhưng `documents.uploaded_by REFERENCES users(id)` đòi `users` phải tồn tại
-- trước. Nếu chép nguyên thứ tự hiển thị trong 01-CONTRACTS.md thành một
-- script SQL duy nhất, lệnh CREATE TABLE documents sẽ lỗi
-- "relation users does not exist". Thứ tự file migration ở đây (users →
-- knowledge → operational) giữ NGUYÊN VẸN từng cột/kiểu của cả hai bảng,
-- chỉ đổi thứ tự file để chạy được — không đổi nội dung hợp đồng.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,                      -- scrypt
  role          user_role NOT NULL,
  display_name  text NOT NULL,
  resident_id   text,                               -- NULL với vai bql
  owned_property_ids text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
