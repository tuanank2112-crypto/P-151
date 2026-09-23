// lib/adapters/db.ts — FILE DUY NHẤT trong app/ và lib/ được mở connection
// Postgres, VÀ điểm định tuyến DUY NHẤT giữa hai kho dữ liệu (BB-07,
// 00-ARCHITECTURE.md §9, Đ24). CẤM tạo `lib/db/` hay bất kỳ module nào khác
// import driver Postgres — kiểm bằng `scripts/check_adapter_boundary.sh`.
//
// `DATA_BACKEND` ∈ `mock` | `postgres`, mặc định `mock` (Đ24). `lib/pipeline/`
// CHỈ được gọi qua `getDataStore()` ở đây — CẤM import thẳng `store-mock.ts`
// (luật §4 handoff H04). Đổi sang Postgres là đổi biến môi trường, không đổi
// lời gọi nào ở tầng pipeline.

import pg from "pg";
import { createHash } from "node:crypto";
import { buildLexicalQuery } from "../retrieval/query.ts";
import { reasonMessageVi } from "../reason-messages.ts";
import type {
  Citation,
  ClaimVerdict,
  Decision,
  LifecycleState,
  PipelineStep,
  ReasonCode,
  RetrievedChunk,
  UserRole,
} from "../types.ts";

/**
 * Đ37 (`plan.md` §2, 2026-09-22) — `conversations.id`/`answer_turns.conversation_id`
 * là cột kiểu `uuid` (Postgres). Trước gói BB-11, `runTurn()` là hàm THUẦN
 * (không ghi DB) nên một nhãn dạng chữ như `"golden-faq-S03"` hoàn toàn vô
 * hại; nay `runTurn()` ghi `answer_turns` ở MỌI lượt (BB-11) nên bất kỳ script
 * đo nào truyền nhãn dạng chữ đều vỡ ngay ở lệnh ghi đầu tiên (`ERROR: invalid
 * input syntax for type uuid`).
 *
 * Hàm này băm một nhãn người đọc được thành một uuid HỢP LỆ, **TẤT ĐỊNH**
 * (cùng nhãn ⇒ cùng uuid, mọi lần, mọi tiến trình) — KHÔNG dùng
 * `crypto.randomUUID()`. Lý do tất định: bộ chạy Golden có `--resume`
 * (`scripts/_batch.mjs`, Đ26); cùng một `case_id` phải nối lại ĐÚNG cuộc
 * hội thoại cũ giữa hai lượt chạy cách nhau, nếu không mỗi lượt lại đẻ một
 * hội thoại mới và `conversations`/`messages` phình ra vô nghĩa.
 *
 * Cách làm: SHA-256 nhãn, lấy 16 byte đầu, gán nibble version=5 (name-based)
 * và 2 bit variant theo RFC 4122 — cho ra một chuỗi ĐÚNG hình dạng
 * `8-4-4-4-12` hex mà Postgres `uuid` chấp nhận. CẤM thêm dependency ngoài
 * `node:crypto` (đúng luật của handoff).
 */
export function conversationIdFromLabel(label: string): string {
  const digest = createHash("sha256").update(label).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version nibble = 5 (name-based)
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant = RFC 4122
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** `true` khi `value` có ĐÚNG hình dạng uuid (8-4-4-4-12 hex) mà cột kiểu
 *  `uuid` của Postgres chấp nhận — dùng để test canh Đ37, và để bất kỳ chỗ
 *  nào cần từ chối sớm một `conversation_id` sai hình dạng trước khi chạm DB. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Chữ ký DUY NHẤT mà mọi call site trong file này dùng: `sql(text, params)`
 * trả thẳng mảng row. Giữ nguyên chữ ký cũ của `neon()` để việc đổi nhà cung
 * cấp Postgres KHÔNG lan ra ngoài hàm `getSql()` (Đ25).
 */
export type SqlFn = <T = Record<string, unknown>>(
  text: string,
  params?: readonly unknown[]
) => Promise<T[]>;

let cachedPool: pg.Pool | null = null;
let cachedSql: SqlFn | null = null;

/**
 * Trả về hàm truy vấn Postgres, tạo lười (lazy) đúng một lần. Ném lỗi rõ ràng
 * khi thiếu `DATABASE_URL` thay vì để driver ném lỗi khó hiểu.
 *
 * Đ25 — driver là `pg` (TCP), KHÔNG phải `@neondatabase/serverless` (driver đó
 * nói chuyện HTTP với endpoint riêng của Neon, không dùng được với nhà cung cấp
 * khác). `pg` nói chuyện được với MỌI Postgres chuẩn — Supabase, Neon, hay
 * Postgres tự dựng — nên chọn nhà cung cấp trở lại thành việc đổi một chuỗi.
 *
 * BẮT BUỘC trên serverless: trỏ `DATABASE_URL` vào **connection pooler** của nhà
 * cung cấp (Supabase: cổng `6543`, transaction mode), KHÔNG phải cổng `5432`
 * trực tiếp. Mỗi lời gọi hàm serverless là một instance mới; nối thẳng sẽ cạn
 * slot kết nối của gói free trước khi Golden chạy xong.
 */
export function getSql(): SqlFn {
  if (cachedSql) return cachedSql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL chưa được cấu hình. Xem specs/OPERATIONS.md §3.");
  }
  const pool = new pg.Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  cachedPool = pool;
  cachedSql = async <T>(text: string, params?: readonly unknown[]): Promise<T[]> => {
    const res = await pool.query(text, params ? [...params] : undefined);
    return res.rows as T[];
  };
  return cachedSql;
}

/**
 * Đóng pool. CHỈ dùng cho script CLI chạy một lần rồi thoát (`db:migrate`,
 * `db:seed:*`) — không gọi trong đường phục vụ request, pool phải sống qua các
 * lời gọi để tái dùng kết nối.
 */
export async function closePool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
    cachedSql = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DataStore — interface chung cho pipeline (P02a, Đ24)
// ─────────────────────────────────────────────────────────────────────────

export interface DocumentMeta {
  document_id: string;
  status: "Draft" | "Approved" | "Deprecated";
  effective_status: "Current" | "Expired" | "Unknown";
  effective_to: string | null; // ISO date hoặc null
  allowed_for_rag: boolean;
  scope_property: string[];
  title_vi: string;
}

export interface SectionMeta {
  section_id: string;
  document_id: string;
  heading_vi: string;
  is_excluded: boolean;
  conflict_group: string | null;
}

export type PropertyType = "apartment" | "villa" | "commercial";

const PROPERTY_TYPES: readonly PropertyType[] = ["apartment", "villa", "commercial"];

/**
 * G23 — `pg` KHÔNG parse mảng của kiểu ENUM do người dùng định nghĩa: nó trả
 * về nguyên văn chuỗi Postgres `"{apartment,villa}"` chứ không phải mảng JS
 * (mảng `text[]` thì có parse, mảng enum thì không — khác OID). Để nguyên
 * chuỗi đó thì `property_type.includes("apartment")` ở E-6 thành phép so
 * CHUỖI CON: vẫn "chạy", nhưng `"{commercial}".includes("al")` cũng đúng, và
 * `.length`/`Array.isArray` thì sai. Chuẩn hoá về mảng NGAY tại adapter — đây
 * là nơi duy nhất chạm driver (BB-07).
 */
export function parsePropertyTypeArray(raw: unknown): PropertyType[] {
  const items: string[] = Array.isArray(raw)
    ? raw.map((x) => String(x))
    : typeof raw === "string"
      ? raw.replace(/^\{/, "").replace(/\}$/, "").split(",")
      : [];
  return items
    .map((x) => x.trim().replace(/^"|"$/g, ""))
    .filter((x): x is PropertyType => (PROPERTY_TYPES as readonly string[]).includes(x));
}

/** Bản ghi người dùng dùng cho đăng nhập (01-CONTRACTS §6 + Đ29). */
export interface UserRecord {
  id: string;
  password_hash: string;
  role: UserRole;
  resident_id: string | null;
  owned_property_ids: string[];
  property_type: PropertyType[];
}

/** Một dòng `messages` (01-CONTRACTS §6). */
export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content_vi: string;
  created_at: string;
}

/**
 * Đầu vào ghi một dòng `answer_turns` (BB-11, SPEC-P02 §1). Chỉ liệt kê các
 * trường `runTurn` có đủ dữ liệu để điền — mọi cột khác của bảng dùng
 * `DEFAULT` sẵn có ở `004_operational.sql`, KHÔNG bịa thêm giá trị.
 */
export interface AnswerTurnInput {
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string | null;
  question_vi: string;
  detected_intent: string | null;
  lifecycle_state: LifecycleState;
  decision: Decision;
  reason_code: ReasonCode | null;
  confidence: number;
  gate_triggered: string | null;
  citations: Citation[];
  claims: ClaimVerdict[];
  latency_ms: number;
  is_golden_run: boolean;
  /** Đ44 — `NULL` cho lượt thật (`/api/chat`); mã ca Golden (`c.case_id`)
   *  cho lượt qua `scripts/eval_golden.mjs`. Cột đã tồn tại từ
   *  `004_operational.sql:47`, chỉ chưa từng được ghi (R14 mục 7). */
  golden_case_id: string | null;
  /** SPEC-P02 §5.3/§8 (R6, BB-08) — ba chặng model tách bạch, phải sống trong
   *  DB để trang trace `/bql/trace/[answer_turn_id]` đọc thẳng
   *  `answer_turns.pipeline_steps`. Bắt buộc (không optional) để TypeScript
   *  ép MỌI caller truyền — H25 (2026-09-23), trước gói này cột luôn `[]`. */
  pipeline_steps: PipelineStep[];
  /** H25 §7/W6 (2026-09-23) — bốn tín hiệu Đ07 (`SPEC-P02` §6) + histogram,
   *  cần sống trong DB để `lib/adapters/metrics-store.ts` đọc thẳng
   *  `s3_faithfulness` cho `/eval` (SPEC-P04 §1, P04-C1, BB-06). Bắt buộc:
   *  nhánh escalate SỚM / action / clarify truyền `0/0/0/false/{}` tường
   *  minh, KHÔNG dựa vào `DEFAULT` ngầm của cột. */
  s1_retrieval_top1: number;
  s2_eligible_ratio: number;
  s3_faithfulness: number;
  s4_conflict: boolean;
  rejection_histogram: Record<string, number>;
}

export interface DataStore {
  readonly backend: "mock" | "postgres";
  /** Tra người dùng theo email cho luồng đăng nhập. `null` khi không có.
   *  CẤM để tầng trên tự mở connection — đây là lý do hàm này nằm ở
   *  DataStore chứ không nằm trong Server Action (BB-07). */
  findUserByEmail(email: string): Promise<UserRecord | null>;
  /** Truy hồi lexical — thay cho SQL `ts_rank_cd(...,32)` của Postgres
   *  (01-CONTRACTS §4.2). Trên mock, số điểm KHÔNG chuyển được sang Postgres
   *  (Đ24) — chỉ dùng để định hướng thứ tự cục bộ. */
  searchLexical(queryVi: string, topK: number): Promise<RetrievedChunk[]>;
  getDocumentMeta(documentIds: string[]): Promise<Map<string, DocumentMeta>>;
  getSectionMeta(sectionIds: string[]): Promise<Map<string, SectionMeta>>;

  // ── Vận hành: hội thoại + lượt trả lời (BB-11, R4, H06 W1) ──────────────
  /** Tạo một hội thoại mới cho `userId`, trả `id`. */
  createConversation(userId: string): Promise<{ id: string }>;
  /**
   * Ghi một dòng `messages`, trả `id` — dùng làm `user_message_id` /
   * `assistant_message_id` của `answer_turns`.
   *
   * `createConversationIfMissing` (Đ37, R13; đổi tên Đ44/R14 mục 5 — tên cũ
   * `ensureConversationOwner` nói SAI việc hàm làm) — CHỈ truyền ở lời gọi có
   * thể là LẦN ĐẦU chạm tới `conversationId` này (đúng ca của `runTurn()` với
   * `conversation_id` dẫn xuất tất định từ nhãn script đo — `eval_golden.mjs`
   * / `probe_defects.mjs` / `trace_sample.mjs` — KHÔNG đi qua
   * `store.createConversation()` trước). Khi có giá trị, cài đặt Postgres
   * PHẢI đảm bảo hàng `conversations` tồn tại (upsert idempotent, `ON
   * CONFLICT DO NOTHING`) TRƯỚC khi ghi `messages`, để không vỡ FK
   * `messages_conversation_id_fkey` khi `conversationId` là uuid hợp lệ
   * nhưng chưa từng có hội thoại nào mang id đó. Đường `/api/chat` (đã tạo
   * hội thoại qua `createConversation()` trước khi gọi `runTurn`) không cần
   * truyền tham số này — cứ để trống, không có chi phí gì thêm.
   *
   * **KHÔNG kiểm chủ sở hữu.** `ON CONFLICT DO NOTHING` nghĩa là khi hàng đã
   * tồn tại, hàm này không so `user_id` — ai gọi với một `conversationId` đã
   * có chủ khác vẫn ghi `messages` được bình thường (R14 mục 5/P4). Authz
   * (403 khi hội thoại không thuộc principal) nằm ở
   * `app/api/chat/route.ts` qua `getConversationOwner()`, KHÔNG nằm ở đây.
   */
  appendMessage(
    conversationId: string,
    role: "user" | "assistant",
    contentVi: string,
    createConversationIfMissing?: string
  ): Promise<{ id: string }>;
  /** Đọc lại lịch sử hội thoại, cũ → mới (R4). */
  listMessages(conversationId: string): Promise<MessageRecord[]>;
  /** Ghi đúng một dòng `answer_turns` (BB-11). */
  insertAnswerTurn(input: AnswerTurnInput): Promise<{ id: string }>;
  /** Chủ sở hữu (`user_id`) của một hội thoại, `null` nếu không có — dùng để
   *  quyết `ConversationNotOwned` (SPEC-P02 §9) ở `app/api/chat/route.ts`.
   *  Bổ sung ngoài 4 hàm được liệt kê tường minh ở handoff H06 §3 W1 — cần
   *  thiết để W3 (403 khi `conversation_id` không thuộc principal) khả thi
   *  mà không mở connection ngoài `lib/adapters/db.ts` (BB-07). Ghi vào report
   *  làm rõ đây là mở rộng có chủ đích, không phải bịa schema. */
  getConversationOwner(conversationId: string): Promise<string | null>;

  /**
   * Ghi đúng một dòng `audit_log` (SPEC-P05 §7, gói H22 — trước đó là việc
   * treo ở R23 mục "Việc KHÔNG làm"). CHỈ chạm bảng `audit_log`, không đọc/ghi
   * bảng nào khác. Trả `id` (kiểu `bigserial` ở Postgres, ép về chuỗi để khớp
   * kiểu trả về đồng nhất giữa hai backend).
   */
  insertAuditLog(input: {
    level: "info" | "warn" | "error";
    actor_id: string | null;
    actor_role: "resident" | "bql" | "system";
    event: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string }>;
}

function backendName(): "mock" | "postgres" {
  const v = (process.env.DATA_BACKEND ?? "mock").toLowerCase();
  if (v !== "mock" && v !== "postgres") {
    throw new Error(`DATA_BACKEND không hợp lệ: "${v}". Chỉ nhận "mock" | "postgres".`);
  }
  return v;
}

class PostgresDataStore implements DataStore {
  readonly backend = "postgres" as const;

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const sql = getSql();
    const rows = await sql<Omit<UserRecord, "property_type"> & { property_type: unknown }>(
      `SELECT id, password_hash, role, resident_id, owned_property_ids, property_type
       FROM users WHERE email = $1`,
      [email]
    );
    const row = rows[0];
    if (!row) return null;
    return { ...row, property_type: parsePropertyTypeArray(row.property_type) };
  }

  async searchLexical(queryVi: string, topK: number): Promise<RetrievedChunk[]> {
    const { text, params } = buildLexicalQuery(queryVi, topK);
    // Không còn từ nào sau khi lọc ⇒ tập rỗng. KHÔNG gọi SQL: `to_tsquery('')`
    // ném lỗi cú pháp, và "câu hỏi không có từ nào" là kết quả hợp lệ chứ
    // không phải sự cố (SPEC-P02 §3).
    if (params[0] === "") return [];
    const sql = getSql();
    const rows = await sql<{
      id: string;
      section_id: string;
      document_id: string;
      content_vi: string;
      score: number;
      score_content: number;
    }>(text, [params[0], params[1]]);
    return rows.map((r) => ({
      chunk_id: r.id,
      section_id: r.section_id,
      document_id: r.document_id,
      content_vi: r.content_vi,
      score: Number(r.score),
      score_content: Number(r.score_content),
    }));
  }

  async getDocumentMeta(documentIds: string[]): Promise<Map<string, DocumentMeta>> {
    const sql = getSql();
    const rows = await sql<DocumentMeta>(
      `SELECT document_id, status, effective_status, effective_to, allowed_for_rag,
              scope_property, title_vi
       FROM documents WHERE document_id = ANY($1)`,
      [documentIds]
    );
    return new Map(rows.map((r) => [r.document_id, r]));
  }

  async getSectionMeta(sectionIds: string[]): Promise<Map<string, SectionMeta>> {
    const sql = getSql();
    const rows = await sql<SectionMeta>(
      `SELECT section_id, document_id, heading_vi, is_excluded, conflict_group
       FROM sections WHERE section_id = ANY($1)`,
      [sectionIds]
    );
    return new Map(rows.map((r) => [r.section_id, r]));
  }

  async createConversation(userId: string): Promise<{ id: string }> {
    const sql = getSql();
    const rows = await sql<{ id: string }>(
      `INSERT INTO conversations (user_id) VALUES ($1) RETURNING id`,
      [userId]
    );
    return { id: rows[0]!.id };
  }

  async appendMessage(
    conversationId: string,
    role: "user" | "assistant",
    contentVi: string,
    createConversationIfMissing?: string
  ): Promise<{ id: string }> {
    if (!isValidUuid(conversationId)) {
      throw new Error(
        `appendMessage: conversation_id không phải uuid hợp lệ: "${conversationId}". ` +
          `Dùng conversationIdFromLabel() trước khi gọi (Đ37/Đ43).`
      );
    }
    const sql = getSql();
    if (createConversationIfMissing) {
      // Đ37/R13 — upsert idempotent: nếu hội thoại này đã tồn tại (đường
      // /api/chat qua createConversation()), KHÔNG làm gì; nếu chưa (nhãn
      // script đo dẫn xuất tất định, chưa từng có createConversation() gọi
      // trước), tạo hàng cho đủ FK trước khi INSERT messages bên dưới.
      // KHÔNG kiểm chủ sở hữu (Đ44/R14 mục 5) — xem JSDoc ở `DataStore`.
      await sql(
        `INSERT INTO conversations (id, user_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [conversationId, createConversationIfMissing]
      );
    }
    const rows = await sql<{ id: string }>(
      `INSERT INTO messages (conversation_id, role, content_vi) VALUES ($1, $2, $3) RETURNING id`,
      [conversationId, role, contentVi]
    );
    return { id: rows[0]!.id };
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    const sql = getSql();
    return sql<MessageRecord>(
      `SELECT id, conversation_id, role, content_vi, created_at
       FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );
  }

  /**
   * Ghi `answer_turns`, và khi `decision === 'escalate'` **và**
   * `is_golden_run === false`, ghi thêm đúng một dòng `review_queue` pending
   * trong CÙNG câu SQL (một statement = một transaction ngầm định, giống
   * `uploadDocument()` ở `bql-store.ts`) — SPEC-P03 §3.1, gói H16 W1. Golden
   * run KHÔNG vào hàng đợi (quyết định chốt bởi SO 🔴, handoff H16 §3 W1):
   * script đo tự lo fixture riêng, tránh nhuộm hàng đợi HITL thật.
   * `original_draft_vi` = câu từ chối hiển thị cho cư dân
   * (`reasonMessageVi`), tiền tố `[Từ chối tự động · <reason_code>] `.
   */
  async insertAnswerTurn(input: AnswerTurnInput): Promise<{ id: string }> {
    if (!isValidUuid(input.conversation_id)) {
      throw new Error(
        `insertAnswerTurn: conversation_id không phải uuid hợp lệ: "${input.conversation_id}". ` +
          `Dùng conversationIdFromLabel() trước khi gọi (Đ37/Đ43).`
      );
    }
    const sql = getSql();
    const willEnqueue = input.decision === "escalate" && input.is_golden_run === false;
    const originalDraftVi = willEnqueue
      ? `[Từ chối tự động · ${input.reason_code ?? "system_error"}] ${reasonMessageVi(input.reason_code)}`
      : "";
    const rows = await sql<{ id: string }>(
      `WITH new_turn AS (
         INSERT INTO answer_turns (
           conversation_id, user_message_id, assistant_message_id, question_vi,
           detected_intent, lifecycle_state, decision, reason_code, confidence,
           gate_triggered, citations, claims, latency_ms, is_golden_run, golden_case_id,
           pipeline_steps, s1_retrieval_top1, s2_eligible_ratio, s3_faithfulness,
           s4_conflict, rejection_histogram
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$17::jsonb,
           $18,$19,$20,$21,$22::jsonb)
         RETURNING id
       ),
       new_review AS (
         INSERT INTO review_queue (answer_turn_id, state, original_draft_vi)
         SELECT id, 'pending', $16
         FROM new_turn
         WHERE $7 = 'escalate' AND $14 = false
         RETURNING id
       )
       SELECT id FROM new_turn`,
      [
        input.conversation_id,
        input.user_message_id,
        input.assistant_message_id,
        input.question_vi,
        input.detected_intent,
        input.lifecycle_state,
        input.decision,
        input.reason_code,
        input.confidence,
        input.gate_triggered,
        JSON.stringify(input.citations),
        JSON.stringify(input.claims),
        input.latency_ms,
        input.is_golden_run,
        input.golden_case_id,
        originalDraftVi,
        JSON.stringify(input.pipeline_steps),
        input.s1_retrieval_top1,
        input.s2_eligible_ratio,
        input.s3_faithfulness,
        input.s4_conflict,
        JSON.stringify(input.rejection_histogram),
      ]
    );
    return { id: rows[0]!.id };
  }

  async getConversationOwner(conversationId: string): Promise<string | null> {
    const sql = getSql();
    const rows = await sql<{ user_id: string }>(
      `SELECT user_id FROM conversations WHERE id = $1`,
      [conversationId]
    );
    return rows[0]?.user_id ?? null;
  }

  async insertAuditLog(input: {
    level: "info" | "warn" | "error";
    actor_id: string | null;
    actor_role: "resident" | "bql" | "system";
    event: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const sql = getSql();
    const rows = await sql<{ id: string }>(
      `INSERT INTO audit_log (level, actor_id, actor_role, event, payload)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id::text`,
      [input.level, input.actor_id, input.actor_role, input.event, JSON.stringify(input.payload)]
    );
    return { id: rows[0]!.id };
  }
}

let cachedStore: DataStore | null = null;
let cachedStoreBackend: "mock" | "postgres" | null = null;

/**
 * Điểm vào DUY NHẤT cho `lib/pipeline/` lấy dữ liệu tri thức. Định tuyến
 * theo `DATA_BACKEND` (mặc định `mock`, Đ24). Kho mock (`store-mock.ts`)
 * được import ĐỘNG ở đây — đây là NƠI DUY NHẤT được phép import nó.
 */
export async function getDataStore(): Promise<DataStore> {
  const backend = backendName();
  if (cachedStore && cachedStoreBackend === backend) return cachedStore;
  if (backend === "postgres") {
    cachedStore = new PostgresDataStore();
  } else {
    const { createMockDataStore } = await import("./store-mock.ts");
    cachedStore = createMockDataStore();
  }
  cachedStoreBackend = backend;
  return cachedStore;
}

/** CHỈ dùng trong tests/: xoá cache để đổi `DATA_BACKEND` giữa các ca test. */
export function __resetDataStoreForTesting(): void {
  cachedStore = null;
  cachedStoreBackend = null;
}
