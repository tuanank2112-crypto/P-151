-- 004_operational.sql — hội thoại, lượt trả lời, hàng đợi duyệt, audit log
-- (01-CONTRACTS.md §6, trừ bảng `users` đã tách sang 002_users.sql).
-- Bảng của P05 (`bookings`, `receipts`) CỐ Ý không nằm ở đây (Đ03, VC-09) —
-- xem SPEC-P05-Action-Layer.md §4.

CREATE TABLE conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_vi   text NOT NULL DEFAULT 'Hội thoại mới',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user','assistant')),
  content_vi      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON messages(conversation_id, created_at);

-- Bảng TRUNG TÂM. Mỗi câu hỏi ⇒ đúng một dòng, kể cả khi từ chối (BB-11).
CREATE TABLE answer_turns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_message_id    uuid NOT NULL REFERENCES messages(id),
  assistant_message_id uuid REFERENCES messages(id),        -- NULL khi escalate
  question_vi        text NOT NULL,
  detected_intent    text,                                   -- 'I-01'..'I-05' | NULL
  lifecycle_state    lifecycle_state NOT NULL,
  decision           turn_decision   NOT NULL,
  reason_code        reason_code,                            -- NULL khi decision='answer'
  -- 4 tín hiệu của Đ07. Lưu để tái tạo được quyết định, KHÔNG để hiển thị (BB-05)
  s1_retrieval_top1  numeric(6,4) NOT NULL DEFAULT 0,
  s2_eligible_ratio  numeric(6,4) NOT NULL DEFAULT 0,
  s3_faithfulness    numeric(6,4) NOT NULL DEFAULT 0,
  s4_conflict        boolean      NOT NULL DEFAULT false,
  confidence         numeric(6,4) NOT NULL DEFAULT 0,
  gate_triggered     text,                                   -- 'G1_conflict' | ... | NULL
  citations          jsonb NOT NULL DEFAULT '[]'::jsonb,     -- Citation[]
  claims             jsonb NOT NULL DEFAULT '[]'::jsonb,     -- ClaimVerdict[]
  rejection_histogram jsonb NOT NULL DEFAULT '{}'::jsonb,
  pipeline_steps     jsonb NOT NULL DEFAULT '[]'::jsonb,     -- PipelineStep[] (BB-08)
  latency_ms         int  NOT NULL DEFAULT 0,
  is_golden_run      boolean NOT NULL DEFAULT false,
  golden_case_id     text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX answer_turns_intent_idx ON answer_turns(detected_intent, created_at);
CREATE INDEX answer_turns_reason_idx ON answer_turns(reason_code, created_at);
CREATE INDEX answer_turns_golden_idx ON answer_turns(is_golden_run, golden_case_id);

CREATE TABLE review_queue (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_turn_id uuid NOT NULL UNIQUE REFERENCES answer_turns(id) ON DELETE CASCADE,
  state          review_state NOT NULL DEFAULT 'pending',
  original_draft_vi text NOT NULL,
  edited_draft_vi   text,
  reviewer_id    uuid REFERENCES users(id),
  reject_reason_vi text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz
);

CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  level      text NOT NULL CHECK (level IN ('info','warn','error')),
  actor_id   uuid REFERENCES users(id),
  actor_role text NOT NULL,                        -- 'resident'|'bql'|'system'
  event      text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
