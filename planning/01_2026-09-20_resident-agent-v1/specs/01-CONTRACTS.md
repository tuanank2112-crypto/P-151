# 01 — HỢP ĐỒNG DỮ LIỆU, ENUM, SCHEMA, 3 AGENT

> Phụ thuộc: đọc [`00-ARCHITECTURE.md`](00-ARCHITECTURE.md) trước.
> File này là **hợp đồng bất biến**. Đổi bất cứ gì ở đây là breaking change: phải
> tăng revision Knowledge Pack, chạy lại toàn bộ Golden, và ghi vào `plan.md` §2.
> Kế thừa kỷ luật từ `docs/MVP_DATA_SCOPE_LOCK.md` §11.

---

## 1. Nguyên tắc

1. **Tên tiếng Anh, nội dung tiếng Việt.** Cột DB, trường JSON, tên hàm: `snake_case`
   tiếng Anh. Chuỗi hiển thị cho người: tiếng Việt.
2. **Mọi thứ do ta định nghĩa.** Không một endpoint, mã lỗi, hay tên trường nào trong
   file này mô tả hệ thống có thật của Vinhomes. Tất cả là **hợp đồng ta tự đặt ra cho
   backend mô phỏng** (Đ02).
3. **Thời gian:** cột timestamp dùng `timestamptz`, lưu UTC. Hiển thị theo
   `Asia/Ho_Chi_Minh`. Trong JSON dùng ISO-8601 có offset.
4. **ID:** `uuid` sinh bởi `gen_random_uuid()` cho bản ghi hệ thống; ID tri thức
   (`document_id`, `section_id`) là **chuỗi người đọc được, ổn định, do P00 đặt**.

---

## 2. Enum `reason_code` — 15 mã, tập đóng `[Đ12, BB-09]`

### 2.1 — Nhóm A: 10 mã canonical giữ nguyên từ v0.2

Nguồn: [`../../../docs/PRD_ResidentGPT_MVP.md`](../../../docs/PRD_ResidentGPT_MVP.md)
§8 "Canonical reason-code enum". **CẤM đổi tên, CẤM tạo alias, CẤM đổi nghĩa** — trừ
đúng một mã đã nêu ở §2.2.

| # | Mã | Nghĩa dùng trong v1.0 | Đổi nghĩa so với v0.2? |
| :-- | :-- | :-- | :-- |
| A1 | `pii_or_account_specific` | **Xem §2.2 — mã DUY NHẤT bị đảo nội hàm** | ⚠️ **CÓ** |
| A2 | `legal_or_compensation_escalation` | Bồi thường, tranh chấp, diễn giải pháp lý, xác định trách nhiệm/lỗi, chế tài cá nhân, sự vụ đã khởi kiện | Không |
| A3 | `unsupported_intent` | Câu hỏi/yêu cầu nằm ngoài 5 intent `I-01…I-05` | Không |
| A4 | `intent_unresolved` | Không suy được ý định kể cả sau khi hỏi lại | Không |
| A5 | `no_eligible_source` | Không có section nào qua đủ 7 điều kiện eligibility (§5.3) — **hoặc** bản nháp có claim không neo được vào evidence (§8.3) | Mở rộng, không đổi nghĩa gốc |
| A6 | `source_conflict` | ≥2 section đều `Approved` + `Current` nhưng nội dung mâu thuẫn | Không |
| A7 | `source_expired_or_unknown` | Section duy nhất trả lời được có `effective_status ≠ Current`, hoặc không xác định được bản nào hiện hành | Không |
| A8 | `system_error` | Lỗi hạ tầng/model/retrieval. Xem bảng lỗi §9 | Không |
| A9 | `emergency_or_life_safety` | Khẩn cấp, an toàn tính mạng. **Ưu tiên cao nhất, chặn trước mọi gate khác** | Không |
| A10 | `reviewer_rejected_draft` | BQL bấm Từ chối trong hàng đợi HITL | Không |

> **`clarification_required` KHÔNG phải reason code.** Nó là **lifecycle state/event**.
> Neo: `PRD` §8, câu cuối khối "Canonical reason-code enum". Nó sống ở cột
> `answer_turns.lifecycle_state`, không ở cột `reason_code`. Vi phạm điều này làm
> mẫu số của dashboard R10 sai.

### 2.2 — `pii_or_account_specific`: định nghĩa MỚI `[Đ06]` 🔴

**Định nghĩa v1.0 (dùng cái này):**

> Kích hoạt khi câu hỏi hoặc hành động **yêu cầu đọc hoặc ghi dữ liệu thuộc sở hữu
> của một chủ thể KHÁC** với người đang đăng nhập.

Kiểm bằng máy, không bằng cảm tính:

```ts
// lib/pipeline/ownership.ts
export type OwnershipVerdict =
  | { ok: true }
  | { ok: false; reason_code: "pii_or_account_specific"; offending_subject: string };

/**
 * principal      = người đang đăng nhập (từ cookie phiên)
 * targetSubjects = mọi resident_id / property_id / unit_code mà A1 rút được từ câu hỏi
 * CHẶN khi tồn tại một target không nằm trong quyền sở hữu của principal.
 */
export function checkOwnership(
  principal: { resident_id: string; owned_property_ids: string[]; role: "resident" | "bql" },
  targetSubjects: { resident_ids: string[]; property_ids: string[] }
): OwnershipVerdict;
```

Bảng phân xử, dùng để viết test:

| Câu hỏi của `resident@demo.local` (sở hữu `S1.120817`) | v0.2 làm gì | **v1.0 làm gì** |
| :-- | :-- | :-- |
| "Phí quản lý căn **của tôi** tháng này bao nhiêu?" | ❌ Chặn (`pii_or_account_specific`) | ✅ **Cho qua** — chính chủ |
| "Thẻ cư dân **của tôi** còn hạn không?" | ❌ Chặn | ✅ **Cho qua** |
| "Căn **S1.120901** nợ phí bao nhiêu?" | ❌ Chặn | ❌ **Chặn** — căn khác |
| "Cho tôi số điện thoại của **chị hàng xóm tầng 9**" | ❌ Chặn | ❌ **Chặn** — cư dân khác |
| "Trẻ dưới 12 tuổi có được vào bể bơi một mình không?" | ✅ Cho qua | ✅ Cho qua — không chạm dữ liệu ai |

**Khác v0.2 ở đâu, chính xác:**

- v0.2 (neo: `PRD` §6 NFR-05; §7 AC-09; §8 SR-08; `MVP_DATA_SCOPE_LOCK.md` §7 điều 7)
  đặt ranh giới ở **loại dữ liệu**: hễ là "account/personal data cần xác minh danh
  tính" thì chặn. Lý do nền: actor v0.2 là **nhân viên BQL — bên thứ ba** đang soạn
  nháp trả lời hộ, chưa xác thực được người hỏi là ai.
- v1.0 đặt ranh giới ở **chủ sở hữu dữ liệu**: chặn khi chạm dữ liệu **người khác**.
  Lý do: principal bây giờ là **chính chủ đã đăng nhập**. Giữ định nghĩa cũ thì agent
  tự chặn đúng ca dùng của chính nó.
- **Mức nghiêm giữ nguyên** — vẫn là hard-block, vẫn không tạo câu trả lời thực chất,
  vẫn ghi log.
- Phân tích đầy đủ: `H01_conflict_ledger.md` §b.3, dòng `pii_or_account_specific`.

**Vùng cấm:** CẤM "khôi phục" định nghĩa cũ với lý do "an toàn hơn". Giữ định nghĩa
cũ là **mâu thuẫn logic**, không phải lựa chọn bảo thủ (Đ06 — không lật được).

### 2.3 — Nhóm B: 5 mã hành động MỚI `[Đ12]`

Chỉ gói P05 sinh ra các mã này. Khoảng trống được chứng minh ở `H01` §b.4.

| # | Mã | Khi nào | Hành vi BẮT BUỘC của caller |
| :-- | :-- | :-- | :-- |
| B1 | `action_quota_exceeded` | Vượt hạn mức đặt chỗ (ngày/tuần/đang hoạt động) | Dừng. Nói rõ hạn mức và `quota_resets_at`. CẤM thử lại |
| B2 | `action_irreversible_requires_confirmation` | Lệnh không hoàn tác được và cư dân chưa xác nhận tường minh | Dừng, hỏi xác nhận. CẤM tự xác nhận hộ |
| B3 | `action_partial_execution_unknown` | Lệnh đã gửi, kết quả không xác định (timeout sau khi ghi) | **CẤM retry.** Gọi lệnh đọc trạng thái, báo cư dân, ghi `audit_log` mức `warn` |
| B4 | `action_authorization_missing` | Vai/uỷ quyền không đủ cho `capability_id` này | Dừng. CẤM hạ cấp thành lệnh khác "gần giống" |
| B5 | `action_duplicate_suspected` | Trùng `idempotency_key` hoặc trùng `(facility_id, slot_start, property_id)` | Trả về biên nhận **đã có**, không tạo mới |

**Vùng cấm:** CẤM ánh xạ B1–B5 về `system_error` cho gọn. Mất phân biệt "chưa chạm"
và "đã chạm một phần" là đúng lỗ hổng mà `H01` §b.2 chỉ ra ở `system_error`.

### 2.4 — DDL enum

```sql
CREATE TYPE reason_code AS ENUM (
  'pii_or_account_specific',
  'legal_or_compensation_escalation',
  'unsupported_intent',
  'intent_unresolved',
  'no_eligible_source',
  'source_conflict',
  'source_expired_or_unknown',
  'system_error',
  'emergency_or_life_safety',
  'reviewer_rejected_draft',
  'action_quota_exceeded',
  'action_irreversible_requires_confirmation',
  'action_partial_execution_unknown',
  'action_authorization_missing',
  'action_duplicate_suspected'
);

CREATE TYPE lifecycle_state AS ENUM (
  'answered', 'clarification_required', 'escalated', 'failed'
);

CREATE TYPE turn_decision AS ENUM ('answer', 'clarify', 'escalate');
CREATE TYPE user_role       AS ENUM ('resident', 'bql');
CREATE TYPE doc_status      AS ENUM ('Draft', 'Approved', 'Deprecated');
CREATE TYPE effective_status AS ENUM ('Current', 'Expired', 'Unknown');
CREATE TYPE review_state    AS ENUM ('pending', 'approved', 'edited_approved', 'rejected');
```

---

## 3. Schema tri thức

### 3.1 — `documents`

```sql
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
```

### 3.2 — `sections`

```sql
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
```

**`conflict_group` là cơ chế phát hiện mâu thuẫn — tất định, không dùng LLM (VC-04).**
Hai section cùng `conflict_group`, cùng lọt vào top-k, cả hai đều eligible ⇒
`source_conflict`. Không cần "semantic conflict detection hoàn hảo" — đúng như
`UI_Flow_ResidentGPT_MVP.md` §Final Validation mục 6 đã chấp nhận.

### 3.3 — `chunks`

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id   text NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
  document_id  text NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  chunk_index  int  NOT NULL,
  content_vi   text NOT NULL,
  tsv          tsvector GENERATED ALWAYS AS
                 (to_tsvector('simple', unaccent(content_vi))) STORED,
  embedding    vector(384),                        -- NULL khi RETRIEVAL_MODE=lexical
  token_count  int NOT NULL,
  UNIQUE (section_id, chunk_index)
);
CREATE INDEX chunks_tsv_idx  ON chunks USING gin(tsv);
CREATE INDEX chunks_vec_idx  ON chunks USING hnsw (embedding vector_cosine_ops);
```

---

## 4. Retrieval — hợp đồng tất định

### 4.1 — Hai chế độ

Biến môi trường `RETRIEVAL_MODE` ∈ `lexical` | `hybrid`. **Mặc định `lexical`.**

Lý do mặc định lexical: Postgres không có cấu hình full-text tiếng Việt, nhưng
`to_tsvector('simple', unaccent(...))` vẫn tách từ theo khoảng trắng và bỏ dấu — với
corpus ~19 tài liệu thì đủ, **và nó chạy được trên Vercel không cần tải model**.
`hybrid` bật thêm vector; nếu embedding `NULL` thì tự rơi về lexical, **không ném lỗi**.

### 4.2 — Truy vấn chuẩn (lexical)

```sql
-- $1 = query tiếng Việt, $2 = TOP_K (mặc định 8)
SELECT c.id, c.section_id, c.document_id, c.content_vi,
       ts_rank_cd(c.tsv, plainto_tsquery('simple', unaccent($1)), 32) AS score
FROM chunks c
WHERE c.tsv @@ plainto_tsquery('simple', unaccent($1))
ORDER BY score DESC
LIMIT $2;
```

**Cờ chuẩn hoá `32` là bắt buộc.** Postgres định nghĩa bit 32 = chia rank cho
`rank + 1`, nên `score ∈ (0, 1)`. Đây là điều kiện để `S1` trong công thức confidence
(`SPEC-P02` §6.1) có miền giá trị xác định. Bỏ cờ 32 ⇒ `score` không chặn trên ⇒
công thức confidence vô nghĩa.

### 4.3 — Embedding (chỉ khi `hybrid`)

| Hạng mục | Chốt |
| :-- | :-- |
| Model | `Xenova/multilingual-e5-small` qua `@xenova/transformers` |
| Số chiều | **384** (khớp `vector(384)` ở §3.3) |
| Chạy ở đâu | **Chỉ trong `scripts/seed_knowledge.mjs` trên máy dev**, ghi sẵn vào DB |
| Query embedding | Cũng chỉ ở local (`npm run dev`). Trên Vercel: `RETRIEVAL_MODE=lexical` |

**CẤM dùng Claude để tạo embedding** — Anthropic không có endpoint embedding. Đây là
lỗi hay gặp, ghi ra đây để khỏi mất một buổi.

Điểm hybrid: `S1 = max(0.5 × score_lexical + 0.5 × cosine_sim)` trên tập hợp nhất
top-8 của mỗi nhánh. Cả hai số hạng đều ∈ (0,1) nên `S1 ∈ (0,1)`.

---

## 5. Cổng eligibility — 7 điều kiện, tất định `[VC-04]`

Kế thừa nguyên văn `docs/MVP_DATA_SCOPE_LOCK.md` §7. Một chunk chỉ được dùng để sinh
câu trả lời thực chất khi **đồng thời**:

| # | Điều kiện | SQL / kiểm |
| :-- | :-- | :-- |
| E-1 | `documents.status = 'Approved'` | SQL |
| E-2 | `documents.effective_status = 'Current'` **và** (`effective_to IS NULL` hoặc `effective_to >= current_date`) | SQL |
| E-3 | `documents.allowed_for_rag = true` | SQL |
| E-4 | `sections.is_excluded = false` | SQL |
| E-5 | Không có section khác cùng `conflict_group` cũng lọt vào tập eligible | SQL (`GROUP BY conflict_group HAVING count(*) > 1`) |
| E-6 | Phạm vi khớp: `documents.scope_property` ∩ `principal.property_type ≠ ∅` **hoặc** `scope_property = '{}'` | SQL |
| E-7 | `checkOwnership()` trả `ok: true` (§2.2) | TS, chạy **trước** truy vấn |

Hàm bắt buộc:

```ts
// lib/pipeline/eligibility.ts
export type RejectionReason =
  | "not_approved" | "expired_or_unknown" | "not_allowed_for_rag"
  | "section_excluded" | "conflict" | "scope_mismatch";

export interface EligibilityResult {
  eligible: RetrievedChunk[];
  rejected: Array<{ chunk: RetrievedChunk; reason: RejectionReason }>;
  rejection_histogram: Record<RejectionReason, number>;
  conflict_groups: string[];          // rỗng ⇒ không mâu thuẫn
}

export function applyEligibility(
  retrieved: RetrievedChunk[],
  principal: Principal,
  now: Date
): EligibilityResult;
```

`rejection_histogram` **không phải để debug** — nó là đầu vào bắt buộc của cổng
escalate (`SPEC-P02` §6.2) để phân biệt `no_eligible_source` với
`source_expired_or_unknown`. Thiếu nó thì D4 ở `00-ARCHITECTURE` §7 trả sai mã.

---

## 6. Schema vận hành

```sql
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
```

Bảng của P05 (`bookings`, `receipts`) đặc tả ở
[`SPEC-P05-Action-Layer.md`](SPEC-P05-Action-Layer.md) §4 — **cố ý tách khỏi file này**
để cắt P05 không phải sửa contract lõi (Đ03, VC-09).

---

## 7. Kiểu TypeScript dùng chung

```ts
// lib/types.ts — nguồn chân lý kiểu. Mọi nơi khác import từ đây.

export type ReasonCode =
  | "pii_or_account_specific" | "legal_or_compensation_escalation"
  | "unsupported_intent" | "intent_unresolved" | "no_eligible_source"
  | "source_conflict" | "source_expired_or_unknown" | "system_error"
  | "emergency_or_life_safety" | "reviewer_rejected_draft"
  | "action_quota_exceeded" | "action_irreversible_requires_confirmation"
  | "action_partial_execution_unknown" | "action_authorization_missing"
  | "action_duplicate_suspected";

export type IntentId = "I-01" | "I-02" | "I-03" | "I-04" | "I-05";
export type Decision = "answer" | "clarify" | "escalate";

export interface Principal {
  user_id: string;
  role: "resident" | "bql";
  resident_id: string | null;
  owned_property_ids: string[];
  property_type: Array<"apartment" | "villa" | "commercial">;
}

export interface RetrievedChunk {
  chunk_id: string; section_id: string; document_id: string;
  content_vi: string; score: number;          // ∈ (0,1) — xem §4.2
}

export interface Citation {
  document_id: string; section_id: string;
  document_title_vi: string; heading_vi: string;
  snippet_vi: string;                          // ≤ 300 ký tự, cắt theo câu
}

export interface ClaimVerdict {
  claim_vi: string;
  verdict: "supported" | "unsupported" | "contradicted";
  supporting_section_id: string | null;        // bắt buộc non-null khi 'supported'
}

export interface PipelineStep {
  step: "validate" | "safety" | "intent" | "context" | "risk"
      | "retrieval" | "eligibility" | "draft" | "verify";
  ok: boolean; ms: number;
  model?: "claude-haiku-4-5" | "claude-opus-5" | "claude-sonnet-5";
  input_tokens?: number; output_tokens?: number;
  note?: string;
}

export interface TurnResult {
  decision: Decision;
  reason_code: ReasonCode | null;
  answer_vi: string | null;                    // null khi decision ≠ 'answer'
  clarify_question_vi: string | null;          // non-null khi decision = 'clarify'
  citations: Citation[];
  claims: ClaimVerdict[];
  confidence: number;                          // CẤM truyền xuống React (VC-07)
  gate_triggered: string | null;
  steps: PipelineStep[];
}
```

**Ràng buộc kiểu bắt buộc (BB-05 / VC-07):** props của mọi component React dùng
`Omit<TurnResult, "confidence" | "gate_triggered">`. Không có `confidence` trong kiểu
props thì không lọt ra màn hình được, khỏi trông chờ kỷ luật người viết.

---

## 8. Hợp đồng 3 agent

Adapter duy nhất: `lib/adapters/anthropic.ts` (BB-07). Ràng buộc API theo model đã
chốt ở `00-ARCHITECTURE.md` §10.1 — đọc lại trước khi gọi, sai là 400.

### 8.1 — A1 `classifier` — `claude-haiku-4-5`

```ts
export interface ClassifierInput {
  question_vi: string;
  conversation_tail: Array<{ role: "user" | "assistant"; content_vi: string }>; // ≤ 6 lượt
  principal_summary: { owned_property_ids: string[]; property_type: string[] };
}

export interface ClassifierOutput {
  intent: IntentId | "unsupported" | "unresolved";
  is_emergency: boolean;                       // A9 — chặn trước mọi gate khác
  is_legal_or_compensation: boolean;           // A2
  target_subjects: { resident_ids: string[]; property_ids: string[] };
  missing_required_fields: string[];           // theo PRD §5.1, xem §8.1.1
  clarify_question_vi: string | null;
  normalized_query_vi: string;                 // dùng cho retrieval
}

export async function runClassifier(i: ClassifierInput): Promise<ClassifierOutput>;
```

Tham số gọi bắt buộc:

```ts
{
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  thinking: { type: "enabled", budget_tokens: 1024 },   // Haiku 4.5 KHÔNG nhận 'adaptive'
  output_config: { format: zodOutputFormat(ClassifierOutputSchema) },
  // CẤM đặt output_config.effort — Haiku 4.5 báo lỗi
}
```

#### 8.1.1 — Bảng `required_context` theo intent

Giữ **nguyên văn** `docs/PRD_ResidentGPT_MVP.md` §5.1. CẤM sửa danh sách; sửa là
breaking change kéo theo Golden.

| Intent | Trường bắt buộc |
| :-- | :-- |
| `I-01` Thẻ cư dân/ra vào | `card_type`, `request_type`, `property_type`, `unit_type_when_limit_is_relevant` |
| `I-02` Phương tiện/thẻ xe | `parking_card_or_parking_service`, `facility_type`, `monthly_or_casual`, `vehicle_type`, `time_window_when_casual` |
| `I-03` Tiện ích chung | `amenity_type`, `amenity_variant_when_relevant`, `age_or_height_when_safety_relevant` |
| `I-04` Chuyển đồ/thi công | `moving_or_construction`, `property_type`, `building_or_area_when_relevant`, `work_type_when_construction_schedule_is_asked`, `requested_day_or_time_when_schedule_is_asked` |
| `I-05` Nội quy sinh hoạt | `rule_topic`, `apartment_commercial_or_villa_scope`, `general_rule_or_case_specific_decision` |

Trường có hậu tố `_when_*` là **có điều kiện** — chỉ bắt buộc khi câu hỏi/nguồn cần
phân biệt đó. CẤM dùng clarification để moi thêm dữ liệu cá nhân không cần thiết.

### 8.2 — A2 `retriever` — `claude-opus-5`

```ts
export interface RetrieverInput {
  normalized_query_vi: string;
  intent: IntentId;
  eligible_chunks: RetrievedChunk[];           // ĐÃ qua cổng §5. A2 không tự lọc
}

export interface RetrieverOutput {
  draft_vi: string;
  citations: Citation[];                       // ⊆ eligible_chunks
  refused: boolean;                            // true ⇒ evidence không đủ trả lời
  refusal_note_vi: string | null;
}
```

```ts
{
  model: "claude-opus-5",
  max_tokens: 4096,
  thinking: { type: "adaptive" },              // budget_tokens ⇒ 400
  output_config: { format: zodOutputFormat(RetrieverOutputSchema) },
  // CẤM temperature / top_p / top_k ⇒ 400
}
```

**Bất biến A2:** mọi `citations[i].section_id` phải tồn tại trong `eligible_chunks`.
Vi phạm ⇒ ném `PipelineInvariantError` (E1), **không** im lặng lọc bỏ — lọc im lặng
che mất việc model đang bịa nguồn.

### 8.3 — A3 `verifier` — `claude-sonnet-5`

```ts
export interface VerifierInput {
  draft_vi: string;                            // CHỈ bản nháp
  evidence: Array<{ section_id: string; content_vi: string }>;
  // CỐ Ý KHÔNG CÓ question_vi — xem VC-03
}

export interface VerifierOutput {
  claims: ClaimVerdict[];
  faithfulness: number;                        // = supported / total, làm tròn 4 số
}
```

```ts
{
  model: "claude-sonnet-5",
  max_tokens: 4096,
  thinking: { type: "adaptive" },
  output_config: { format: zodOutputFormat(VerifierOutputSchema) },
}
```

Quy tắc tính, bắt buộc tính **ở TypeScript, không tin số model tự báo**:

```ts
const total = out.claims.length;
const supported = out.claims.filter(c => c.verdict === "supported").length;
const faithfulness = total === 0 ? 0 : round4(supported / total);
```

`total === 0` ⇒ `faithfulness = 0` ⇒ escalate. Bản nháp không có mệnh đề nào kiểm
được thì không phải câu trả lời có căn cứ. Đây là trường hợp biên hay bị bỏ sót.

**BB-06:** `faithfulness` ghi vào `answer_turns.s3_faithfulness` và đó là **cột duy
nhất** mà bảng eval `P04` đọc. CẤM chạy A3 lần hai để "chấm lại".

---

## 8.4 — Đăng ký capability (đầu vào cho P05)

Nguồn: `H02_capability_map.md` §b. Bản đồ gốc có **46 capability**. Vòng này **chỉ
lấy nhóm `amenity` phần liên quan đặt chỗ tiện ích**.

```ts
export interface CapabilitySpec {
  capability_id: string;
  kind: "read" | "write";
  precheck_capability_id: string | null;       // BẮT BUỘC non-null khi kind='write' (BB-03)
  reversible: boolean;
  idempotent: boolean;
  required_params: string[];
}
```

| `capability_id` | kind | `precheck_capability_id` | reversible | idempotent |
| :-- | :-- | :-- | :-- | :-- |
| `amenity.list_facilities` | read | `null` | — | ✅ |
| `amenity.get_facility_detail` | read | `null` | — | ✅ |
| `amenity.get_booking_policy` | read | `null` | — | ✅ |
| `amenity.get_availability` | read | `null` | — | ✅ |
| `amenity.check_eligibility` | read | `null` | — | ✅ |
| `amenity.list_my_bookings` | read | `null` | — | ✅ |
| `amenity.get_booking_detail` | read | `null` | — | ✅ |
| `amenity.create_booking` | **write** | `amenity.check_eligibility` | ✅ (`cancel_booking`) | chỉ khi có `idempotency_key` |
| `amenity.cancel_booking` | **write** | `amenity.get_booking_detail` | ❌ | ✅ về trạng thái |

**Vùng cấm capability — 37 capability bị loại, có lý do:**

| Nhóm bị loại | Vì sao |
| :-- | :-- |
| `billing.*` (5) | Tiền thật/hoá đơn — NG-03. Rubric không chấm. `billing.pay_invoice` là lệnh không hoàn tác được nguy hiểm nhất bản đồ |
| `partner.*` (5) | VinWonders/Aquafield — khác pháp nhân, trắng nguồn tuyệt đối (`H02` §d.3, §e) |
| `promo.*` (6) | `submit_consult_lead` gây cuộc gọi sales thật; ngoài phạm vi |
| `identity.switch_active_property` | Idempotent nhưng đổi ngữ cảnh mọi lệnh sau ⇒ đặt nhầm căn mà vẫn "thành công" (`H02` §b.1) |
| `service.*`, `event.*`, `support.*`, `notify.*`, `identity.*` còn lại | Ngoài phạm vi vòng 1.0.0 (VC-11) |
| `amenity.modify_booking` | "Dời +1 giờ" kiểu tương đối không idempotent. Huỷ rồi đặt lại là đủ cho demo |

---

## 9. Bảng phân loại lỗi & hành vi caller

| Lỗi | Ném ở đâu | Retry? | Caller BẮT BUỘC làm gì | Ghi `answer_turns` |
| :-- | :-- | :-- | :-- | :-- |
| `PipelineInvariantError` | `assertCitedOrEscalate`, `assertStepOrder`, kiểm citation A2 | ❌ | Ném lên, HTTP 500, `audit_log` mức `error`. **CẤM nuốt** | ✅ `decision=escalate`, `reason_code=system_error` |
| `UpstreamModelError` | `lib/adapters/anthropic.ts` | ✅ ≤2, backoff 1s→3s | Hết retry → `system_error`, UI hiện nút Thử lại | ✅ |
| `ContractDriftError` | parse structured output thất bại | ✅ đúng 1 lần | **CẤM sửa JSON bằng regex.** Hỏng lần 2 → `system_error` | ✅ |
| `RetrievalError` | `lib/adapters/db.ts` | ❌ | Lỗi cấu hình, retry vô ích → `system_error` | ✅ |
| `OwnershipViolation` | `checkOwnership` | ❌ | Chặn **trước** khi chạm DB → `pii_or_account_specific` | ✅ |
| `AuthzError` | middleware | ❌ | HTTP 403, redirect. CẤM trả nội dung một phần | ❌ |
| `EnumViolation` | Postgres | ❌ | Bug lập trình. Để lỗi nổ, đừng bắt | ❌ |

---

## 10. Vùng cấm của file này

| # | CẤM | Lý do |
| :-- | :-- | :-- |
| C-01 | CẤM thêm cột vào `answer_turns` mà không cập nhật `SPEC-P04` §3 | Dashboard đọc thẳng bảng này; thêm cột lặng lẽ làm số lệch |
| C-02 | CẤM để A2 tự lọc eligibility | Eligibility là luật, phải tất định (VC-04). A2 chỉ nhận chunk **đã sạch** |
| C-03 | CẤM truyền `question_vi` vào A3 | VC-03 |
| C-04 | CẤM dùng `text` thay `reason_code` enum cho cột `reason_code` | Mất BB-09, gõ sai chính tả là mất số liệu |
| C-05 | CẤM bỏ cờ `32` trong `ts_rank_cd` | Mất chặn trên ⇒ công thức confidence vô nghĩa (§4.2) |
| C-06 | CẤM tin `faithfulness` do model tự báo | Tính lại ở TS (§8.3) |
| C-07 | CẤM thêm capability ngoài 9 dòng ở §8.4 | 37 capability còn lại đã bị loại **có lý do**, không phải quên |
| C-08 | CẤM dùng Claude làm embedding | Không có endpoint đó (§4.3) |

---

## 11. Số đo nghiệm thu

| # | Lệnh | Kết quả PASS |
| :-- | :-- | :-- |
| C-M1 | `npm run db:migrate && node scripts/dump_schema.mjs` | In đủ **15** giá trị `reason_code`, **4** `lifecycle_state`; exit 0 |
| C-M2 | `node scripts/check_enum_closed.mjs` | In `rejected: invalid input value for enum reason_code`; exit 0 |
| C-M3 | `npx tsc --noEmit` | 0 lỗi |
| C-M4 | `node scripts/validate_capabilities.mjs` | In `capabilities: 9 · write: 2 · write_without_precheck: 0`; exit 0 |
| C-M5 | `npm run test -- ownership` | 5/5 pass — đúng 5 dòng bảng §2.2 |
| C-M6 | `node scripts/check_rank_flag.mjs` | In `ts_rank_cd normalization flag 32: present`; exit 0 |
| C-M7 | `grep -c "confidence" lib/types.ts` và kiểm props React | `TurnResult` có `confidence`; không component nào nhận nó (VC-07) |

`scripts/validate_capabilities.mjs` đã được chạy thử trên dữ liệu giả — mã nguồn và
output nguyên văn ở [`TESTING-ACCEPTANCE.md`](TESTING-ACCEPTANCE.md) §3.2.
