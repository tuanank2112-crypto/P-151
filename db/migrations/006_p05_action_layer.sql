-- 006_p05_action_layer.sql — Lớp hành động P05 (Đ48, SPEC-P05-Action-Layer.md
-- §4). Bảng RIÊNG của gói P05 (VC-09) — TUYỆT ĐỐI không trộn với bảng của P02
-- (`conversations`/`answer_turns`/`review_queue`). Idempotent: chạy lại an
-- toàn nhờ `IF NOT EXISTS` / `ADD VALUE IF NOT EXISTS` / `ON CONFLICT`.
--
-- Dữ liệu vận hành (giờ nhận đăng ký, giờ hoạt động, hạn mức…) là DỮ LIỆU
-- SEED trong bảng `facilities`, KHÔNG phải câu nội quy viết tay trong code —
-- giữ BB-10 `matches: 0` (scripts/check_no_hardcoded_knowledge.sh chỉ soi
-- app/ và lib/, không soi db/migrations/).

-- ── 1. `Decision` thêm 'action' (Đ48 mục 3) ─────────────────────────────
ALTER TYPE turn_decision ADD VALUE IF NOT EXISTS 'action';

-- ── 2. Bảng `facilities` — nguồn chính sách tĩnh của mỗi tiện ích ───────
CREATE TABLE IF NOT EXISTS facilities (
  facility_id       text PRIMARY KEY,
  name_vi           text NOT NULL,
  zone              text NOT NULL,
  is_bookable       boolean NOT NULL DEFAULT true,
  has_authoritative_rules boolean NOT NULL DEFAULT true,
  aliases_vi        text[] NOT NULL DEFAULT '{}',
  intake_windows    jsonb NOT NULL DEFAULT '[]'::jsonb,
  operating_hours   jsonb NOT NULL DEFAULT '[]'::jsonb,
  slot_granularity_minutes int NOT NULL DEFAULT 60,
  capacity_per_slot int NOT NULL DEFAULT 1,
  min_lead_time_minutes int NOT NULL DEFAULT 0,
  max_advance_days  int NOT NULL DEFAULT 14,
  max_active_bookings int NOT NULL DEFAULT 3,
  max_bookings_per_week int NOT NULL DEFAULT 5,
  min_age           int,
  requires_adult_supervision_under_age int,
  is_cancellable    boolean NOT NULL DEFAULT true,
  cancel_deadline_before_slot_minutes int NOT NULL DEFAULT 60,
  source_document_id text,
  source_section_id  text,
  policy_version    text NOT NULL DEFAULT 'p05-seed-2026-09-23'
);

-- ── 3. Bảng `bookings` + `receipts` (SPEC-P05 §4) ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_state') THEN
    CREATE TYPE booking_state AS ENUM ('confirmed', 'cancelled');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      text NOT NULL,
  property_id      text NOT NULL,
  resident_id      text NOT NULL,
  slot_start       timestamptz NOT NULL,
  slot_end         timestamptz NOT NULL,
  party_size       int  NOT NULL CHECK (party_size > 0),
  state            booking_state NOT NULL DEFAULT 'confirmed',
  idempotency_key  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  cancelled_at     timestamptz,
  CONSTRAINT bookings_idem_uniq UNIQUE (idempotency_key)
);

-- `bookings_slot_uniq` — chặn cùng một tiện ích + property đặt hai lần cùng
-- khung giờ, chỉ tính hàng đang 'confirmed'. SPEC-P05 §4 viết dạng
-- `EXCLUDE USING btree (...) WHERE (state = 'confirmed')`; cài đặt ở đây
-- dùng UNIQUE INDEX riêng phần (partial unique index) vì nó cho ĐÚNG cùng
-- ngữ nghĩa cho tổ hợp toàn cờ '=' mà KHÔNG cần cài thêm extension
-- `btree_gist` (EXCLUDE USING btree đòi hỏi opclass hỗ trợ — chỉ có sẵn qua
-- btree_gist trên đa số bản Postgres quản lý, kể cả Supabase mặc định chưa
-- bật). Ghi rõ vào report: đây là một lựa chọn cài đặt tương đương, không
-- đổi hợp đồng.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_uniq
  ON bookings (facility_id, property_id, slot_start)
  WHERE (state = 'confirmed');

CREATE TABLE IF NOT EXISTS receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid NOT NULL REFERENCES bookings(id),
  receipt_code   text NOT NULL UNIQUE,      -- 'RC-' || 8 ký tự hoa
  action         text NOT NULL CHECK (action IN ('create','cancel')),
  capability_id  text NOT NULL,
  params_json    jsonb NOT NULL,
  result_json    jsonb NOT NULL,
  actor_user_id  uuid NOT NULL REFERENCES users(id),
  undo_capability_id text,                  -- null ⇒ không hoàn tác được
  undone_by      uuid REFERENCES receipts(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 4. `precheck_log` — dấu vết BB-03 (assertPrechecked) ────────────────
CREATE TABLE IF NOT EXISTS precheck_log (
  id                bigserial PRIMARY KEY,
  session_id        text NOT NULL,
  capability_id     text NOT NULL,
  params_fingerprint text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS precheck_log_lookup_idx
  ON precheck_log (session_id, capability_id, params_fingerprint);

-- ── 5. `pending_actions` — xác nhận hành động không hoàn tác (Đ48 mục 5) ─
CREATE TABLE IF NOT EXISTS pending_actions (
  conversation_id uuid PRIMARY KEY,
  capability      text NOT NULL,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL
);

-- ── 6. Seed 14 tiện ích (SPEC-P00 §3.4 + §4; ref-01 cho FAC-PINGPONG) ───
-- `source_document_id`/`source_section_id` trỏ vào `knowledge/manifest.json`
-- (đo bằng `node scripts/report_facility_rules.mjs .`, 2026-09-23):
-- 13 tiện ích true, FAC-PICKLEBALL false (BB-01, mồ côi có chủ ý).
-- Giờ giấc của các tiện ích KHÁC FAC-PINGPONG là DỮ LIỆU VẬN HÀNH hợp lý do
-- gói này chọn (SPEC-P05 §0 — mô phỏng, không phải nội quy thật), giữ
-- nguyên tắc BB-02: cửa nhận đăng ký (intake) luôn HẸP HƠN giờ hoạt động
-- (operating), không bao giờ trùng khít, để `validate_policy.mjs` đo được
-- "separated: true".
INSERT INTO facilities (
  facility_id, name_vi, zone, is_bookable, has_authoritative_rules, aliases_vi,
  intake_windows, operating_hours, slot_granularity_minutes, capacity_per_slot,
  min_lead_time_minutes, max_advance_days, max_active_bookings, max_bookings_per_week,
  min_age, requires_adult_supervision_under_age, is_cancellable,
  cancel_deadline_before_slot_minutes, source_document_id, source_section_id, policy_version
) VALUES
  ('FAC-PINGPONG', 'Sân bóng bàn', 'Khu phức hợp Thể thao', true, true,
   ARRAY['sân bóng bàn','bóng bàn','pingpong','ping pong'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"08:30","end_time":"17:30"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"22:00"}]'::jsonb,
   60, 4, 30, 14, 3, 5, NULL, NULL, true, 60,
   'OCP1-SPORTS-COMPLEX-RULES-001', 'SPORTS-PINGPONG-06', 'p05-seed-2026-09-23'),

  ('FAC-BASKETBALL', 'Sân bóng rổ', 'Khu phức hợp Thể thao', true, true,
   ARRAY['sân bóng rổ','bóng rổ','basketball'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"06:00","end_time":"21:00"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"22:00"}]'::jsonb,
   60, 10, 30, 14, 3, 5, NULL, NULL, true, 60,
   'OCP1-SPORTS-COMPLEX-RULES-001', 'SPORTS-BALL-05', 'p05-seed-2026-09-23'),

  ('FAC-VOLLEYBALL', 'Sân bóng chuyền', 'Khu phức hợp Thể thao', true, true,
   ARRAY['sân bóng chuyền','bóng chuyền','volleyball'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"06:00","end_time":"21:00"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"22:00"}]'::jsonb,
   60, 12, 30, 14, 3, 5, NULL, NULL, true, 60,
   'OCP1-SPORTS-COMPLEX-RULES-001', 'SPORTS-BALL-05', 'p05-seed-2026-09-23'),

  ('FAC-FISHING-LAKE', 'Sàn câu cá', 'Sàn Câu cá', true, true,
   ARRAY['câu cá','sàn câu cá','fishing'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"06:00","end_time":"18:00"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"05:00","close_time":"19:00"}]'::jsonb,
   120, 8, 60, 7, 2, 3, 12, 12, true, 120,
   'OCP1-FISHING-DECK-RULES-001', 'FISH-SCOPE-01', 'p05-seed-2026-09-23'),

  ('FAC-PICKLEBALL', 'Sân pickleball', 'Khu phức hợp Thể thao', true, false,
   ARRAY['sân pickleball','pickleball'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"06:00","end_time":"21:00"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"22:00"}]'::jsonb,
   60, 4, 30, 14, 3, 5, NULL, NULL, true, 60,
   NULL, NULL, 'p05-seed-2026-09-23'),

  ('FAC-BBQ', 'Vườn Nướng BBQ', 'Vườn Nướng BBQ', true, true,
   ARRAY['bbq','vườn nướng','khu bbq','nướng bbq'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"08:00","end_time":"20:00"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"10:00","close_time":"22:00"}]'::jsonb,
   120, 6, 1440, 30, 1, 2, NULL, NULL, true, 720,
   'OCP1-BBQ-GARDEN-RULES-001', 'BBQ-SCOPE-01', 'p05-seed-2026-09-23'),

  ('FAC-SALT-LAKE', 'Biển hồ nước mặn', 'Biển hồ nước mặn', true, true,
   ARRAY['hồ nước mặn','biển hồ','salt lake','hồ bơi nước mặn'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"06:00","end_time":"18:00"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"19:00"}]'::jsonb,
   60, 20, 30, 14, 3, 5, NULL, NULL, true, 60,
   'OCP1-SALTWATER-LAKE-RULES-001', 'LAKE-SCOPE-01', 'p05-seed-2026-09-23'),

  ('FAC-KAYAK', 'Bến Thuyền Kayak', 'Bến Thuyền Kayak', true, true,
   ARRAY['kayak','bến thuyền kayak','chèo kayak'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"06:00","end_time":"17:00"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"18:00"}]'::jsonb,
   60, 6, 60, 14, 2, 3, 16, 16, true, 120,
   'OCP1-KAYAK-DOCK-RULES-001', 'KAYAK-SCOPE-01', 'p05-seed-2026-09-23'),

  ('FAC-BADMINTON', 'Sân cầu lông', 'Khu phức hợp Thể thao', true, true,
   ARRAY['sân cầu lông','cầu lông','badminton'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"06:00","end_time":"21:00"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"22:00"}]'::jsonb,
   60, 4, 30, 14, 3, 5, NULL, NULL, true, 60,
   'OCP1-SPORTS-COMPLEX-RULES-001', 'SPORTS-BADMINTON-04', 'p05-seed-2026-09-23'),

  ('FAC-POOL-KTP', 'Bể bơi Khu tháp phía Tây', 'Bể bơi', true, true,
   ARRAY['bể bơi ktp','hồ bơi ktp','pool ktp'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"05:30","end_time":"20:30"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"21:00"}]'::jsonb,
   60, 30, 15, 7, 5, 7, NULL, 10, true, 30,
   'OCP1-POOL-RULES-001', 'POOL-SCOPE-01', 'p05-seed-2026-09-23'),

  ('FAC-POOL-TP', 'Bể bơi Khu tháp trung tâm', 'Bể bơi', true, true,
   ARRAY['bể bơi tp','hồ bơi tp','pool tp'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"05:30","end_time":"20:30"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"21:00"}]'::jsonb,
   60, 30, 15, 7, 5, 7, NULL, 10, true, 30,
   'OCP1-POOL-RULES-001', 'POOL-SCOPE-01', 'p05-seed-2026-09-23'),

  ('FAC-TENNIS', 'Sân tennis', 'Khu phức hợp Thể thao', true, true,
   ARRAY['sân tennis','tennis'],
   '[{"days_of_week":[0,1,2,3,4,5,6],"start_time":"06:00","end_time":"21:00"}]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"22:00"}]'::jsonb,
   60, 4, 30, 14, 3, 5, NULL, NULL, true, 60,
   'OCP1-SPORTS-COMPLEX-RULES-001', 'SPORTS-TENNIS-03', 'p05-seed-2026-09-23'),

  ('FAC-PLAYGROUND', 'Sân chơi trẻ em', 'Sân chơi trẻ em', false, true,
   ARRAY['sân chơi trẻ em','khu vui chơi trẻ em','playground'],
   '[]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"20:00"}]'::jsonb,
   0, 0, 0, 0, 0, 0, NULL, 6, false, 0,
   'OCP1-CHILDREN-PLAYGROUND-RULES-001', 'PLAY-SCOPE-01', 'p05-seed-2026-09-23'),

  ('FAC-OUTDOOR-GYM', 'Gym ngoài trời', 'Gym ngoài trời', false, true,
   ARRAY['gym ngoài trời','khu gym ngoài trời','outdoor gym'],
   '[]'::jsonb,
   '[{"days_of_week":[0,1,2,3,4,5,6],"open_time":"06:00","close_time":"20:00"}]'::jsonb,
   0, 0, 0, 0, 0, 0, 12, 15, false, 0,
   'OCP1-OUTDOOR-GYM-RULES-001', 'GYM-SCOPE-01', 'p05-seed-2026-09-23')
ON CONFLICT (facility_id) DO NOTHING;
