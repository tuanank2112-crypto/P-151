-- 007_chunk_heading_tsv.sql — Đ59 (2026-09-23, chủ tịch duyệt): tiêu đề mục
-- vào chỉ mục tìm kiếm (G53). 01-CONTRACTS.md §3.3 khối Đ59.
--
-- Trước: `chunks.tsv` chỉ dựng từ `content_vi` ⇒ câu hỏi khớp gần nguyên văn
-- tiêu đề mục vẫn xếp hạng thấp (MOVE-TIME-03 hạng 13, TOP_K = 8).
-- Sau: tsv = tiêu đề (trọng số A) || nội dung (trọng số mặc định D, NHƯ CŨ) ⇒
-- câu hỏi không khớp tiêu đề giữ điểm y như trước; khớp tiêu đề được cộng thêm.
--
-- `heading_vi` là cột SAO từ `sections.heading_vi` vì cột GENERATED không JOIN
-- được bảng khác. MỌI câu INSERT INTO chunks BẮT BUỘC ghi cột này.
-- Hàm bỏ dấu là `public.immutable_unaccent()` — trùng hàm lúc truy vấn (G18).
--
-- Idempotent: chạy lại an toàn (`IF NOT EXISTS` / `IF EXISTS`; tsv + index
-- được dựng lại từ đầu mỗi lần). scripts/migrate.mjs bọc file trong MỘT
-- transaction. KHÔNG sửa 001–006 (Đ30 checksum).

ALTER TABLE chunks ADD COLUMN IF NOT EXISTS heading_vi text NOT NULL DEFAULT '';

UPDATE chunks c
SET heading_vi = s.heading_vi
FROM sections s
WHERE s.section_id = c.section_id
  AND c.heading_vi IS DISTINCT FROM s.heading_vi;

DROP INDEX IF EXISTS chunks_tsv_idx;
ALTER TABLE chunks DROP COLUMN IF EXISTS tsv;
ALTER TABLE chunks ADD COLUMN tsv tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', public.immutable_unaccent(heading_vi)), 'A')
  || to_tsvector('simple', public.immutable_unaccent(content_vi))
) STORED;
CREATE INDEX chunks_tsv_idx ON chunks USING gin(tsv);
