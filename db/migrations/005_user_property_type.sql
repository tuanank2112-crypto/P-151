-- 005_user_property_type.sql — Đ29: `users.property_type`, nguồn cho E-6.
--
-- VÌ SAO CÓ FILE NÀY dù 001/002 đã khai cùng cột: DB Supabase đã được migrate
-- TRƯỚC khi lỗi này lộ ra, nên bản đang sống không có cột. File 001/002 lo cho
-- DB dựng MỚI; file này lo cho DB ĐÃ CHẠY. Viết idempotent nên chạy ở cả hai
-- trường hợp đều an toàn.
--
-- Căn nguyên (đo 2026-09-21): 01-CONTRACTS §5 E-6 đối chiếu
-- `documents.scope_property` với `principal.property_type`, nhưng §6 không cho
-- bảng `users` cột nào giữ giá trị đó. 19/19 tài liệu có `scope_property` khác
-- rỗng ⇒ phiên đăng nhập với `property_type = '{}'` loại sạch mọi tài liệu,
-- và cư dân không bao giờ nhận được câu trả lời nào.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_type') THEN
    CREATE TYPE property_type AS ENUM ('apartment', 'villa', 'commercial');
  END IF;
END
$$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS property_type property_type[] NOT NULL DEFAULT '{}';

-- Hai tài khoản demo (NG-09). Chỉ đặt cho hàng đang rỗng — không ghi đè giá
-- trị ai đó đã chỉnh tay.
UPDATE users
   SET property_type = ARRAY['apartment']::property_type[]
 WHERE role = 'resident' AND property_type = '{}';

UPDATE users
   SET property_type = ARRAY['apartment', 'villa', 'commercial']::property_type[]
 WHERE role = 'bql' AND property_type = '{}';
