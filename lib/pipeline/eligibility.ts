// lib/pipeline/eligibility.ts — cổng eligibility, 7 điều kiện tất định
// (01-CONTRACTS.md §5, VC-04). Lấy metadata QUA `getDataStore()`
// (`lib/adapters/db.ts`) — CẤM import thẳng `store-mock.ts` (luật §4
// handoff H04).

import { getDataStore } from "../adapters/db.ts";
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
  now: Date
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
    // E-6 — phạm vi khớp: scope_property ∩ principal.property_type ≠ ∅, hoặc scope_property = {}
    else if (!scopeMatches(doc.scope_property, principal.property_type)) reason = "scope_mismatch";

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
  const conflictGroups = detectConflict(passedFirstPass, sectionConflictGroup);
  const conflictedSectionIds = new Set<string>();
  if (conflictGroups.length > 0) {
    for (const c of passedFirstPass) {
      const g = sectionConflictGroup.get(c.section_id);
      if (g && conflictGroups.includes(g)) conflictedSectionIds.add(c.section_id);
    }
  }

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
