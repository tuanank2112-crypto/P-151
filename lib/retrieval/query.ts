// lib/retrieval/query.ts — dựng câu truy vấn lexical tất định
// (01-CONTRACTS.md §4.2). Cờ chuẩn hoá `32` của `ts_rank_cd` BẮT BUỘC giữ
// nguyên (C-05) — bỏ cờ này thì `score` không chặn trên và công thức
// confidence của P02 vô nghĩa.

export const DEFAULT_TOP_K = 8;

export interface LexicalQuery {
  /** Câu SQL tham số hoá, $1 = query tiếng Việt, $2 = TOP_K. */
  text: string;
  params: readonly [queryVi: string, topK: number];
}

/**
 * Dựng câu truy vấn lexical chuẩn theo 01-CONTRACTS.md §4.2. KHÔNG tự chạy
 * câu này — caller truyền `text`/`params` vào `getSql()`
 * (`lib/adapters/db.ts`, BB-07).
 */
export function buildLexicalQuery(
  queryVi: string,
  topK: number = DEFAULT_TOP_K
): LexicalQuery {
  const text = [
    "SELECT c.id, c.section_id, c.document_id, c.content_vi,",
    "       ts_rank_cd(c.tsv, plainto_tsquery('simple', unaccent($1)), 32) AS score",
    "FROM chunks c",
    "WHERE c.tsv @@ plainto_tsquery('simple', unaccent($1))",
    "ORDER BY score DESC",
    "LIMIT $2;",
  ].join("\n");
  return { text, params: [queryVi, topK] };
}

