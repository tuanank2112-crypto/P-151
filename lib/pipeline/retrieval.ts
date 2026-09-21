// lib/pipeline/retrieval.ts — chặng 6 (SPEC-P02 §3). Đi qua `getDataStore()`
// (`lib/adapters/db.ts`) — CẤM import thẳng `store-mock.ts`.

import { getDataStore } from "../adapters/db.ts";
import type { RetrievedChunk } from "../types.ts";

export const TOP_K = 8;

/**
 * Truy hồi lexical (mặc định) — dùng nguyên hợp đồng `01-CONTRACTS.md §4.2`
 * ở backend Postgres; ở backend mock đi qua thuật toán thay thế của
 * `store-mock.ts` (Đ24 — điểm không chuyển được sang Postgres, chỉ định
 * hướng cục bộ).
 */
export async function retrieve(normalizedQueryVi: string, topK: number = TOP_K): Promise<RetrievedChunk[]> {
  const store = await getDataStore();
  return store.searchLexical(normalizedQueryVi, topK);
}
