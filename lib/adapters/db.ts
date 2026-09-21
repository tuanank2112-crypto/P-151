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
import { buildLexicalQuery } from "../retrieval/query.ts";
import type {
  Citation,
  ClaimVerdict,
  Decision,
  LifecycleState,
  ReasonCode,
  RetrievedChunk,
  UserRole,
} from "../types.ts";

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
 * trường `runTurn` có đủ dữ liệu để điền — mọi cột khác của bảng
 * (`s1_retrieval_top1`, `rejection_histogram`, `pipeline_steps`, …) dùng
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
  /** Ghi một dòng `messages`, trả `id` — dùng làm `user_message_id` /
   *  `assistant_message_id` của `answer_turns`. */
  appendMessage(
    conversationId: string,
    role: "user" | "assistant",
    contentVi: string
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
    }>(text, [params[0], params[1]]);
    return rows.map((r) => ({
      chunk_id: r.id,
      section_id: r.section_id,
      document_id: r.document_id,
      content_vi: r.content_vi,
      score: Number(r.score),
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
    contentVi: string
  ): Promise<{ id: string }> {
    const sql = getSql();
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

  async insertAnswerTurn(input: AnswerTurnInput): Promise<{ id: string }> {
    const sql = getSql();
    const rows = await sql<{ id: string }>(
      `INSERT INTO answer_turns (
         conversation_id, user_message_id, assistant_message_id, question_vi,
         detected_intent, lifecycle_state, decision, reason_code, confidence,
         gate_triggered, citations, claims, latency_ms, is_golden_run
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
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
