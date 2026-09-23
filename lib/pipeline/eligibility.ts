// lib/pipeline/eligibility.ts — cổng eligibility, 7 điều kiện tất định
// (01-CONTRACTS.md §5, VC-04). Lấy metadata QUA `getDataStore()`
// (`lib/adapters/db.ts`) — CẤM import thẳng `store-mock.ts` (luật §4
// handoff H04).

import { getDataStore, type PropertyType } from "../adapters/db.ts";
import type { Principal, RetrievedChunk } from "../types.ts";

export type RejectionReason =
  | "not_approved"
  | "expired_or_unknown"
  | "not_allowed_for_rag"
  | "section_excluded"
  | "conflict"
  | "scope_mismatch";

export interface EligibilityResult {
  eligible: RetrievedChunk[];
  rejected: Array<{ chunk: RetrievedChunk; reason: RejectionReason }>;
  rejection_histogram: Record<RejectionReason, number>;
  conflict_groups: string[]; // rỗng ⇒ không mâu thuẫn
  /**
   * Lý do loại của chunk XẾP HẠNG 1 trong tập truy hồi, `null` nếu chunk đó
   * hợp lệ hoặc tập rỗng. Đây là proxy đo được cho câu "nguồn khớp nhất với
   * câu hỏi này có dùng được không" — Đ28 dùng nó để tách
   * `source_expired_or_unknown` khỏi `no_eligible_source` ở cổng G3, thứ mà
   * `rejection_histogram` một mình KHÔNG làm được (histogram đếm cả những
   * chunk hết hiệu lực xếp hạng thấp, không liên quan tới câu hỏi).
   */
  top_rejected_reason: RejectionReason | null;
}

const EMPTY_HISTOGRAM: Record<RejectionReason, number> = {
  not_approved: 0,
  expired_or_unknown: 0,
  not_allowed_for_rag: 0,
  section_excluded: 0,
  conflict: 0,
  scope_mismatch: 0,
};

/**
 * Đ56 mục 1 (01-CONTRACTS §5, dòng E-6) — từ điển TẤT ĐỊNH loại bất động sản
 * mà câu hỏi NÊU THẲNG. Khoá đã bỏ dấu + chữ thường; so khớp theo ranh giới
 * từ trên câu đã bỏ dấu. CẤM thay bằng LLM (VC-04). Chỉ đúng các cụm §5 liệt
 * kê — muốn thêm cụm thì sửa hợp đồng trước.
 */
export const PROPERTY_MENTIONS: ReadonlyArray<readonly [string, PropertyType]> = [
  ["biet thu", "villa"],
  ["thuong mai", "commercial"],
  ["shophouse", "commercial"],
  ["ki-ot", "commercial"],
  ["kiot", "commercial"],
  ["can ho", "apartment"],
  ["chung cu", "apartment"],
];

/** Bỏ dấu thanh + `đ`→`d`, chữ thường (NFD thuần, không thư viện). */
function foldVi(text: string): string {
  return text.normalize("NFD").replace(/\p{M}+/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

// Cụm trong từ điển chỉ gồm chữ thường a-z, dấu cách, `-` (không ký tự đặc
// biệt regex) ⇒ ghép thẳng; ranh giới từ = không phải chữ/số Unicode.
const MENTION_PATTERNS: ReadonlyArray<readonly [RegExp, PropertyType]> = PROPERTY_MENTIONS.map(
  ([phrase, type]) => [new RegExp(`(?:^|[^\\p{L}\\p{N}])${phrase}(?=$|[^\\p{L}\\p{N}])`, "u"), type] as const
);

/**
 * Đ56 mục 1 — các loại BĐS câu hỏi nêu thẳng, theo thứ tự xuất hiện trong
 * `PROPERTY_MENTIONS`, không trùng. Rỗng ⇒ caller dùng `principal.property_type`.
 */
export function mentionedPropertyTypes(queryVi: string): PropertyType[] {
  const folded = foldVi(queryVi);
  const out: PropertyType[] = [];
  for (const [re, type] of MENTION_PATTERNS) {
    if (!out.includes(type) && re.test(folded)) out.push(type);
  }
  return out;
}

function scopeMatches(scopeProperty: string[], propertyType: string[]): boolean {
  if (scopeProperty.length === 0) return true; // scope rỗng = áp dụng mọi loại
  return scopeProperty.some((s) => propertyType.includes(s));
}

/**
 * Phát hiện mâu thuẫn — SQL/logic tất định, KHÔNG LLM (VC-04, SPEC-P02 §4.2).
 * Nhận diện các `conflict_group` có >= 2 section KHÁC NHAU cùng lọt vào tập
 * đã cho (dùng cho cả "trước khi loại theo mâu thuẫn" — trên tập retrieved
 * đã qua các điều kiện E-1..E-4/E-6/E-7 — và để trả `conflict_groups`).
 */
export function detectConflict(
  chunks: RetrievedChunk[],
  sectionConflictGroup: Map<string, string | null>
): string[] {
  const byGroup = new Map<string, Set<string>>();
  for (const c of chunks) {
    const g = sectionConflictGroup.get(c.section_id) ?? null;
    if (!g) continue;
    if (!byGroup.has(g)) byGroup.set(g, new Set());
    byGroup.get(g)!.add(c.section_id);
  }
  return [...byGroup.entries()].filter(([, ids]) => ids.size >= 2).map(([g]) => g);
}

/**
 * Cổng eligibility — đánh giá E-1..E-7 THEO ĐÚNG THỨ TỰ, dừng ở điều kiện
 * fail ĐẦU TIÊN cho mỗi chunk (SPEC-P02 §4.1 — "chọn lý do nghiêm trọng nhất"
 * sẽ làm khuyết tật #4 ra sai mã). E-7 (ownership) được gọi TRƯỚC ở chặng 2
 * (an toàn) nên ở đây coi như đã qua cho các chunk còn lại của MỘT lượt hỏi
 * hợp lệ — tham số `principal`/`now` giữ lại để khớp đúng chữ ký hợp đồng
 * (01-CONTRACTS §5) và để tính lại E-6 (phạm vi) theo đúng vai.
 */
export async function applyEligibility(
  retrieved: RetrievedChunk[],
  principal: Principal,
  now: Date,
  queryVi?: string
): Promise<EligibilityResult> {
  if (retrieved.length === 0) {
    return {
      eligible: [],
      rejected: [],
      rejection_histogram: { ...EMPTY_HISTOGRAM },
      conflict_groups: [],
      top_rejected_reason: null,
    };
  }

  const store = await getDataStore();
  const documentIds = [...new Set(retrieved.map((c) => c.document_id))];
  const sectionIds = [...new Set(retrieved.map((c) => c.section_id))];
  const [documents, sections] = await Promise.all([
    store.getDocumentMeta(documentIds),
    store.getSectionMeta(sectionIds),
  ]);

  const histogram: Record<RejectionReason, number> = { ...EMPTY_HISTOGRAM };
  const rejected: EligibilityResult["rejected"] = [];
  const passedFirstPass: RetrievedChunk[] = [];

  const nowDateStr = now.toISOString().slice(0, 10);
  // Đ56 mục 1 (§5 E-6): câu hỏi nêu thẳng loại BĐS ⇒ lọc theo loại đó; không
  // nêu ⇒ theo `principal.property_type` như cũ.
  const mentioned = queryVi ? mentionedPropertyTypes(queryVi) : [];
  const effectiveTypes: string[] = mentioned.length > 0 ? mentioned : principal.property_type;

  for (const chunk of retrieved) {
    const doc = documents.get(chunk.document_id);
    const sec = sections.get(chunk.section_id);
    let reason: RejectionReason | null = null;

    // E-1
    if (!doc || doc.status !== "Approved") reason = "not_approved";
    // E-2
    else if (
      doc.effective_status !== "Current" ||
      (doc.effective_to !== null && doc.effective_to < nowDateStr)
    )
      reason = "expired_or_unknown";
    // E-3
    else if (!doc.allowed_for_rag) reason = "not_allowed_for_rag";
    // E-4
    else if (!sec || sec.is_excluded) reason = "section_excluded";
    // E-6 — phạm vi khớp: scope_property ∩ loại_hiệu_lực ≠ ∅, hoặc scope_property = {} (Đ56)
    else if (!scopeMatches(doc.scope_property, effectiveTypes)) reason = "scope_mismatch";

    if (reason) {
      histogram[reason]++;
      rejected.push({ chunk, reason });
      continue;
    }
    passedFirstPass.push(chunk);
  }

  // E-5 — mâu thuẫn: đánh giá SAU cùng, trên tập đã qua E-1..E-4/E-6, vì chỉ
  // chunk còn hợp lệ ở các điều kiện khác mới đáng tính là "cùng lọt vào tập
  // eligible" (SPEC-P02 §4.2).
  const sectionConflictGroup = new Map<string, string | null>();
  for (const [id, meta] of sections) sectionConflictGroup.set(id, meta.conflict_group);
  const detectedGroups = detectConflict(passedFirstPass, sectionConflictGroup);
  const conflictedSectionIds = new Set<string>();
  if (detectedGroups.length > 0) {
    for (const c of passedFirstPass) {
      const g = sectionConflictGroup.get(c.section_id);
      if (g && detectedGroups.includes(g)) conflictedSectionIds.add(c.section_id);
    }
  }
  // Đ56 mục 2 (§5 E-5): vẫn LOẠI mọi thành viên nhóm mâu thuẫn (ở trên), nhưng
  // chỉ BÁO nhóm chứa section của chunk hạng cao nhất trong `passedFirstPass`
  // (giữ thứ tự `retrieved`) — nguồn khớp nhất bị tranh chấp ⇒ G1. Nhóm chỉ
  // "đi ngang" ⇒ không báo, pipeline đi tiếp với `eligible` còn lại.
  // Đ56b (SO, 2026-09-23 — rủi ro R31): "hạng cao nhất" tính theo ĐIỂM, không
  // theo vị trí. SQL chỉ `ORDER BY score DESC` không khoá phụ ⇒ các chunk đồng
  // điểm có thể đổi chỗ sau seed/reindex; S03 có 4 chunk đồng điểm ở đầu. Nhóm
  // mâu thuẫn nào có thành viên ĐỒNG ĐIỂM với điểm cao nhất ⇒ vẫn báo (nghiêng
  // về an toàn: nghi ngờ thì báo mâu thuẫn, không trả lời).
  // Đ59b — so trên `score_content` (điểm CHỈ nội dung, thang đo trước
  // migration 007): trọng số tiêu đề chỉ để xếp hạng, KHÔNG được quyết định
  // nguồn nào "khớp nhất" cho luật mâu thuẫn (đo 2026-09-23: mọi mức trọng số
  // tiêu đề đều đẩy BBQ-BOOK-02 lên trên cặp mâu thuẫn của S03 ⇒ mất G1).
  const contentScore = (c: RetrievedChunk): number => c.score_content ?? c.score;
  const topScore = passedFirstPass.length > 0 ? Math.max(...passedFirstPass.map(contentScore)) : null;
  const topGroups = new Set<string>();
  if (topScore !== null) {
    for (const c of passedFirstPass) {
      if (contentScore(c) < topScore) continue;
      const g = sectionConflictGroup.get(c.section_id) ?? null;
      if (g) topGroups.add(g);
    }
  }
  const conflictGroups = detectedGroups.filter((g) => topGroups.has(g));

  const eligible: RetrievedChunk[] = [];
  for (const chunk of passedFirstPass) {
    if (conflictedSectionIds.has(chunk.section_id)) {
      histogram.conflict++;
      rejected.push({ chunk, reason: "conflict" });
      continue;
    }
    eligible.push(chunk);
  }

  // Chunk xếp hạng 1 (tập `retrieved` đã sắp giảm dần theo score — hợp đồng
  // của `searchLexical`, 01-CONTRACTS §4.2). Tra trong `rejected` SAU khi đã
  // tính cả E-5, để không bỏ sót chunk bị loại vì mâu thuẫn.
  const rejectedByChunkId = new Map(rejected.map((x) => [x.chunk.chunk_id, x.reason]));
  const top_rejected_reason = rejectedByChunkId.get(retrieved[0]!.chunk_id) ?? null;

  return {
    eligible,
    rejected,
    rejection_histogram: histogram,
    conflict_groups: conflictGroups,
    top_rejected_reason,
  };
}
