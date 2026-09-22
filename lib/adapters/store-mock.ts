// lib/adapters/store-mock.ts — kho mock đọc THẲNG `knowledge/` (Đ24, H04 §2).
// CHỈ được import bởi `lib/adapters/db.ts` (điểm định tuyến DUY NHẤT) — CẤM
// bất kỳ file nào trong `lib/pipeline/` import file này trực tiếp (luật §4
// handoff H04: phá đúng cái khiến việc đổi sang Neon rẻ).
//
// CHỈ ĐỌC `knowledge/` — không sửa, không ghi lại (CẤM chạm knowledge/**).
//
// Đ24 — vùng cấm số liệu: điểm lexical ở đây (`score_lexical`) KHÔNG chuyển
// được sang Postgres (mock không có `ts_rank_cd(...,32)`). Chỉ dùng để định
// hướng cục bộ, KHÔNG dùng để tick Exit Gate G11, KHÔNG dùng để chỉnh ngưỡng
// confidence.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RetrievedChunk } from "../types.ts";
import { hashPassword } from "../auth/password.ts";
import { isValidUuid } from "./db.ts";
import type {
  AnswerTurnInput,
  DataStore,
  DocumentMeta,
  MessageRecord,
  SectionMeta,
  UserRecord,
} from "./db.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const KNOWLEDGE_DIR = path.join(REPO_ROOT, "knowledge");

interface ManifestDoc {
  document_id: string;
  title_vi: string;
  status: "Draft" | "Approved" | "Deprecated";
  effective_status: "Current" | "Expired" | "Unknown";
  effective_to: string | null;
  allowed_for_rag: boolean;
  scope_property: string[];
}

interface RawSection {
  section_id: string;
  heading_vi: string;
  body_vi: string;
  is_excluded: boolean;
  conflict_group: string | null;
}

interface MockChunk {
  chunk_id: string; // = section_id (một section = một chunk, seed_knowledge.mjs)
  section_id: string;
  document_id: string;
  content_vi: string;
  tokens: Set<string>;
  termFreq: Map<string, number>;
}

interface KnowledgeIndex {
  documents: Map<string, DocumentMeta>;
  sections: Map<string, SectionMeta>;
  chunks: MockChunk[];
  idf: Map<string, number>;
}

let cachedIndex: KnowledgeIndex | null = null;

/** Bỏ dấu tiếng Việt — tương đương `unaccent()` của Postgres cho mục đích
 *  so khớp thô. KHÔNG phải bộ unaccent đầy đủ, đủ dùng cho demo. */
function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, (m) => (m === "Đ" ? "D" : "d"));
}

/** Tách từ theo khoảng trắng/dấu câu — tương đương `to_tsvector('simple', …)`
 *  ở mức thô (không stemming, giữ nguyên từng "từ" cách nhau khoảng trắng). */
function tokenize(text: string): string[] {
  const folded = stripDiacritics(text.toLowerCase());
  return folded
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function loadManifest(): { revision: string; documents: ManifestDoc[] } {
  const raw = readFileSync(path.join(KNOWLEDGE_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw);
}

function loadSections(documentId: string): RawSection[] {
  const raw = readFileSync(path.join(KNOWLEDGE_DIR, "sections", `${documentId}.json`), "utf8");
  return JSON.parse(raw);
}

function buildIndex(): KnowledgeIndex {
  const manifest = loadManifest();
  const documents = new Map<string, DocumentMeta>();
  const sections = new Map<string, SectionMeta>();
  const chunks: MockChunk[] = [];
  const df = new Map<string, number>(); // document frequency theo CHUNK

  for (const d of manifest.documents) {
    documents.set(d.document_id, {
      document_id: d.document_id,
      status: d.status,
      effective_status: d.effective_status,
      effective_to: d.effective_to,
      allowed_for_rag: d.allowed_for_rag,
      scope_property: d.scope_property,
      title_vi: d.title_vi,
    });
    const secs = loadSections(d.document_id);
    for (const s of secs) {
      sections.set(s.section_id, {
        section_id: s.section_id,
        document_id: d.document_id,
        heading_vi: s.heading_vi,
        is_excluded: s.is_excluded,
        conflict_group: s.conflict_group ?? null,
      });
      // Một section = một chunk (khớp `scripts/seed_knowledge.mjs`).
      const contentVi = s.body_vi;
      const tokens = tokenize(contentVi);
      const termFreq = new Map<string, number>();
      for (const t of tokens) termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
      for (const t of termFreq.keys()) df.set(t, (df.get(t) ?? 0) + 1);
      chunks.push({
        chunk_id: s.section_id,
        section_id: s.section_id,
        document_id: d.document_id,
        content_vi: contentVi,
        tokens: new Set(tokens),
        termFreq,
      });
    }
  }

  const N = chunks.length;
  const idf = new Map<string, number>();
  for (const [term, docFreq] of df.entries()) {
    idf.set(term, Math.log((N + 1) / (docFreq + 0.5)));
  }

  return { documents, sections, chunks, idf };
}

function getIndex(): KnowledgeIndex {
  if (!cachedIndex) cachedIndex = buildIndex();
  return cachedIndex;
}

/** CHỈ dùng trong tests/: buộc đọc lại `knowledge/` (ví dụ sau khi test tự
 *  tạo fixture riêng bằng biến môi trường trỏ thư mục khác — hiện chưa cần,
 *  giữ để mở đường kiểm thử sau này). */
export function __invalidateMockIndexForTesting(): void {
  cachedIndex = null;
}

/**
 * Điểm khớp lexical mô phỏng, KHÔNG PHẢI `ts_rank_cd` (Đ24 — không chuyển
 * được sang Postgres). Thiết kế: "AND mềm" có trọng số idf — đòi hỏi phần
 * lớn khối lượng từ khoá (theo idf) của câu hỏi phải xuất hiện trong chunk,
 * để tránh khớp tràn lan như OR thuần, nhưng không đòi khớp CỨNG 100% như
 * AND thuần (khác biệt cách tách từ giữa câu hỏi thô và nội dung tài liệu).
 * Điểm ép về (0,1) bằng công thức dạng "rank/(rank+1)", cùng tinh thần với
 * cờ chuẩn hoá 32 của Postgres (01-CONTRACTS §4.2) dù không phải cùng công thức.
 */
const COVERAGE_THRESHOLD = Number(process.env.MOCK_COVERAGE_THRESHOLD ?? 0.45);

function scoreChunk(queryTerms: string[], idf: Map<string, number>, chunk: MockChunk): number | null {
  if (queryTerms.length === 0) return null;
  const uniqueQueryTerms = [...new Set(queryTerms)];
  let matchedWeight = 0;
  let totalWeight = 0;
  let rawRank = 0;
  for (const t of uniqueQueryTerms) {
    const w = idf.get(t) ?? Math.log((getIndex().chunks.length + 1) / 0.5); // termkhông có trong corpus -> idf cao (hiếm tuyệt đối)
    totalWeight += w;
    const tf = chunk.termFreq.get(t) ?? 0;
    if (tf > 0) {
      matchedWeight += w;
      rawRank += tf * w;
    }
  }
  // Khi câu hỏi có từ 3 từ phân biệt trở lên, đòi hỏi chunk phải khớp ít nhất
  // một từ thuộc nhóm IDF cao nhất (top 35%) của câu hỏi, chống rò tiện ích khác.
  if (uniqueQueryTerms.length >= 3) {
    const sortedByIdf = [...uniqueQueryTerms].sort(
      (a, b) =>
        (idf.get(b) ?? Math.log((getIndex().chunks.length + 1) / 0.5)) -
        (idf.get(a) ?? Math.log((getIndex().chunks.length + 1) / 0.5))
    );
    const topKeywords = sortedByIdf.slice(0, Math.ceil(uniqueQueryTerms.length * 0.35));
    const hasTopKeyword = topKeywords.some((t) => (chunk.termFreq.get(t) ?? 0) > 0);
    if (!hasTopKeyword) return null;
  }

  const coverage = totalWeight === 0 ? 0 : matchedWeight / totalWeight;
  if (coverage < COVERAGE_THRESHOLD) return null;
  return rawRank / (rawRank + 1); // ∈ (0,1)
}

/**
 * Hai tài khoản demo cho backend mock (NG-09 — đúng hai, không hơn).
 *
 * MẬT KHẨU ĐỌC TỪ BIẾN MÔI TRƯỜNG, y hệt `scripts/seed_users.mjs` dùng cho
 * Postgres — CẤM hardcode (OPERATIONS §4.1). Một nguồn chân lý cho thông tin
 * đăng nhập, để tài khoản local và tài khoản trên DB thật không trôi khỏi
 * nhau. Thiếu biến ⇒ không có tài khoản nào, đăng nhập trượt tử tế thay vì
 * mở một cửa hậu không mật khẩu.
 */
const DEMO_USERS: Array<Omit<UserRecord, "password_hash"> & { email: string; password_env: string }> = [
  {
    email: "resident@demo.local",
    password_env: "SEED_RESIDENT_PASSWORD",
    id: "00000000-0000-4000-8000-000000000001",
    role: "resident",
    resident_id: "R-0001",
    owned_property_ids: ["S1.120817"],
    property_type: ["apartment"],
  },
  {
    email: "bql@demo.local",
    password_env: "SEED_BQL_PASSWORD",
    id: "00000000-0000-4000-8000-000000000002",
    role: "bql",
    resident_id: null,
    owned_property_ids: [],
    property_type: ["apartment", "villa", "commercial"],
  },
];

/** Băm scrypt tốn ~100ms nên nhớ lại theo email; không cache mật khẩu thô. */
const hashCache = new Map<string, string>();

/**
 * H06 W1 — kho mock KHÔNG có bảng vận hành thật (Đ24: `conversations` /
 * `messages` / `answer_turns` chỉ tồn tại ở Postgres). CẤM giả vờ ghi được
 * bằng cách chấm điểm số dòng lên số liệu nghiệm thu — Đ24 đã cấm tick G11
 * hay bất kỳ số nào bằng dữ liệu mock.
 *
 * Chọn **no-op có ghi chú**, KHÔNG ném lỗi: nhiều test hiện có
 * (`tests/pipeline-order.test.ts`, `tests/citations.test.ts`) gọi `runTurn`
 * thẳng với `DATA_BACKEND=mock` (mặc định) và không hề tạo hội thoại thật —
 * ném lỗi ở đây sẽ làm vỡ toàn bộ các test đó dù chúng không liên quan gì
 * tới BB-11. Id trả về là ngẫu nhiên, chỉ sống trong bộ nhớ tiến trình hiện
 * tại — KHÔNG bền qua restart, KHÔNG phải bằng chứng nghiệm thu BB-11
 * (chỉ Postgres thật mới được dùng cho việc đó, xem `TESTING-ACCEPTANCE.md`).
 */
const mockConversationOwners = new Map<string, string>();

class MockDataStore implements DataStore {
  readonly backend = "mock" as const;

  async createConversation(userId: string): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    mockConversationOwners.set(id, userId);
    return { id };
  }

  async appendMessage(
    conversationId: string,
    _role: "user" | "assistant",
    _contentVi: string
  ): Promise<{ id: string }> {
    // Đ43/R14 mục 4 — kho mock phải khó tính ĐÚNG BẰNG Postgres ở ràng buộc
    // kiểu dữ liệu `conversation_id: uuid`; đây là cơ chế đã sinh ra G26 khi
    // mock dễ tính hơn (xanh ở mock, vỡ ở Postgres).
    if (!isValidUuid(conversationId)) {
      throw new Error(
        `appendMessage: conversation_id không phải uuid hợp lệ: "${conversationId}". ` +
          `Dùng conversationIdFromLabel() trước khi gọi (Đ37/Đ43).`
      );
    }
    return { id: crypto.randomUUID() };
  }

  async listMessages(_conversationId: string): Promise<MessageRecord[]> {
    return [];
  }

  async insertAnswerTurn(input: AnswerTurnInput): Promise<{ id: string }> {
    if (!isValidUuid(input.conversation_id)) {
      throw new Error(
        `insertAnswerTurn: conversation_id không phải uuid hợp lệ: "${input.conversation_id}". ` +
          `Dùng conversationIdFromLabel() trước khi gọi (Đ37/Đ43).`
      );
    }
    return { id: crypto.randomUUID() };
  }

  async getConversationOwner(conversationId: string): Promise<string | null> {
    return mockConversationOwners.get(conversationId) ?? null;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const found = DEMO_USERS.find((u) => u.email === email.trim().toLowerCase());
    if (!found) return null;
    const plain = process.env[found.password_env];
    if (!plain) return null;

    let password_hash = hashCache.get(found.email);
    if (!password_hash) {
      password_hash = await hashPassword(plain);
      hashCache.set(found.email, password_hash);
    }
    const { email: _e, password_env: _p, ...rest } = found;
    return { ...rest, password_hash };
  }

  async searchLexical(queryVi: string, topK: number): Promise<RetrievedChunk[]> {
    const { chunks, idf } = getIndex();
    const queryTerms = tokenize(queryVi);
    const scored: RetrievedChunk[] = [];
    for (const chunk of chunks) {
      const score = scoreChunk(queryTerms, idf, chunk);
      if (score === null) continue;
      scored.push({
        chunk_id: chunk.chunk_id,
        section_id: chunk.section_id,
        document_id: chunk.document_id,
        content_vi: chunk.content_vi,
        score,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async getDocumentMeta(documentIds: string[]): Promise<Map<string, DocumentMeta>> {
    const { documents } = getIndex();
    const out = new Map<string, DocumentMeta>();
    for (const id of documentIds) {
      const d = documents.get(id);
      if (d) out.set(id, d);
    }
    return out;
  }

  async getSectionMeta(sectionIds: string[]): Promise<Map<string, SectionMeta>> {
    const { sections } = getIndex();
    const out = new Map<string, SectionMeta>();
    for (const id of sectionIds) {
      const s = sections.get(id);
      if (s) out.set(id, s);
    }
    return out;
  }
}

export function createMockDataStore(): DataStore {
  return new MockDataStore();
}
