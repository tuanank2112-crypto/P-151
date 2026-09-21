-- 003_knowledge.sql — schema tri thức (01-CONTRACTS.md §3): documents,
-- sections, chunks. Nguồn dữ liệu là `knowledge/` (P00) qua
-- `scripts/seed_knowledge.mjs` — KHÔNG hardcode nội dung tri thức ở đây
-- (BB-10).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- immutable_unaccent — BẮT BUỘC, không phải tuỳ chọn tiện tay (Đ25).
-- `unaccent(text)` do extension cung cấp được đánh dấu STABLE, không IMMUTABLE,
-- vì nó tra một dictionary có thể đổi. Postgres CẤM dùng hàm không IMMUTABLE
-- trong biểu thức của cột GENERATED ... STORED, nên cột `chunks.tsv` bên dưới
-- viết thẳng `unaccent(...)` sẽ làm migration CHẾT ngay tại chỗ với
-- `ERROR: generation expression is not immutable` — trên MỌI Postgres, kể cả
-- Neon. Lỗi này chưa từng lộ ra vì migration chưa được chạy lần nào.
-- Bọc lại bằng một hàm khai báo IMMUTABLE là cách vá chuẩn: dictionary
-- `unaccent` của bản demo này cố định, không ai đổi lúc chạy.
--
-- `SET search_path` là để chạy được trên Supabase, nơi extension nằm ở schema
-- `extensions` chứ không phải `public`.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE STRICT PARALLEL SAFE
  SET search_path = public, extensions, pg_catalog
AS $$ SELECT unaccent('unaccent', $1) $$;

CREATE TABLE documents (
  document_id       text PRIMARY KEY,              -- vd 'OCP1-POOL-RULES-001'
  title_vi          text        NOT NULL,
  doc_kind          text        NOT NULL,          -- 'rules' | 'guide' | 'fee_schedule' | 'directory'
  version           text        NOT NULL,          -- vd '1.0'
  status            doc_status  NOT NULL,
  effective_status  effective_status NOT NULL,
  effective_from    date        NOT NULL,
  effective_to      date,                          -- NULL = còn hiệu lực
  allowed_for_rag   boolean     NOT NULL DEFAULT true,
  scope_property    text[]      NOT NULL DEFAULT '{}', -- 'apartment'|'villa'|'commercial'
  supersedes        text        REFERENCES documents(document_id),
  source_note_vi    text        NOT NULL,          -- "Tài liệu mô phỏng, không phải văn bản thật"
  uploaded_by       uuid        REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sections (
  section_id     text PRIMARY KEY,                 -- vd 'POOL-SAFE-03'
  document_id    text NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  ordinal        int  NOT NULL,
  heading_vi     text NOT NULL,
  body_vi        text NOT NULL,
  is_excluded    boolean NOT NULL DEFAULT false,   -- section bị loại khỏi RAG
  exclusion_note_vi text,
  conflict_group text,                             -- cùng giá trị ⇒ cùng cụm mâu thuẫn
  intents        text[] NOT NULL DEFAULT '{}',     -- {'I-03'}
  facility_ids   text[] NOT NULL DEFAULT '{}',
  UNIQUE (document_id, ordinal)
);
CREATE INDEX sections_conflict_group_idx ON sections(conflict_group)
  WHERE conflict_group IS NOT NULL;

CREATE TABLE chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id   text NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
  document_id  text NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  chunk_index  int  NOT NULL,
  content_vi   text NOT NULL,
  tsv          tsvector GENERATED ALWAYS AS
                 (to_tsvector('simple', public.immutable_unaccent(content_vi))) STORED,
  embedding    vector(384),                        -- NULL khi RETRIEVAL_MODE=lexical
  token_count  int NOT NULL,
  UNIQUE (section_id, chunk_index)
);
CREATE INDEX chunks_tsv_idx  ON chunks USING gin(tsv);
CREATE INDEX chunks_vec_idx  ON chunks USING hnsw (embedding vector_cosine_ops);
