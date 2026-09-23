// lib/retrieval/query.ts — dựng câu truy vấn lexical tất định
// (01-CONTRACTS.md §4.2). Cờ chuẩn hoá `32` của `ts_rank_cd` BẮT BUỘC giữ
// nguyên (C-05) — bỏ cờ này thì `score` không chặn trên và công thức
// confidence của P02 vô nghĩa.
//
// G22 (Đ32, đo 2026-09-21) — §4.2 nguyên bản dùng `plainto_tsquery`, hàm này
// nối MỌI từ trong câu hỏi bằng AND. Truy vấn đã chuẩn hoá của A1 dài 8–10 từ
// ("điều kiện trẻ em dưới 12 tuổi sử dụng bể bơi") nên đòi một chunk chứa đủ
// cả 10 từ ⇒ đo trên DB thật: **0 dòng**, trong khi "trẻ em bể bơi" ra 2 dòng.
// Hệ quả là mọi câu hỏi đi qua A1 đều rơi vào `no_eligible_source`: RAG trông
// như "không có tài liệu" trong khi tài liệu vẫn nằm đó. Chuyển sang OR
// (`to_tsquery` với `|`), để `ts_rank_cd` làm đúng việc của nó là XẾP HẠNG
// theo số từ khớp — thay vì để `WHERE` làm việc lọc tất-cả-hoặc-không.

export const DEFAULT_TOP_K = 8;

export interface LexicalQuery {
  /** Câu SQL tham số hoá, $1 = biểu thức tsquery (đã nối `|`), $2 = TOP_K. */
  text: string;
  params: readonly [tsqueryExpr: string, topK: number];
}

/**
 * Chuẩn hoá câu hỏi thành biểu thức `tsquery` dạng OR: `"bể | bơi | trẻ"`.
 *
 * AN TOÀN: mọi ký tự không phải chữ/số bị loại TRƯỚC khi nối, nên không có
 * toán tử `tsquery` (`&`, `|`, `!`, `<->`, ngoặc) nào lọt từ đầu vào người
 * dùng vào — đây là lý do dùng `to_tsquery` được mà không mở đường injection.
 * Dấu thanh GIỮ NGUYÊN: `immutable_unaccent()` ở SQL bỏ dấu cho cả truy vấn
 * lẫn `tsv`, phải đi qua CÙNG một hàm thì `WHERE` mới khớp (G18).
 *
 * Trả chuỗi rỗng khi không còn từ nào — caller BẮT BUỘC coi đó là "tập rỗng"
 * và KHÔNG chạy SQL (`to_tsquery('')` ném lỗi cú pháp).
 */
export function buildTsQueryExpr(queryVi: string): string {
  return queryVi
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(" | ");
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
    "       ts_rank_cd(c.tsv, to_tsquery('simple', public.immutable_unaccent($1)), 32) AS score,",
    // Đ59b — điểm CHỈ trên nội dung, tính tại chỗ (không cần cột/index mới):
    // E-5 và s1 dùng thang đo này, như trước migration 007.
    "       ts_rank_cd(to_tsvector('simple', public.immutable_unaccent(c.content_vi)), to_tsquery('simple', public.immutable_unaccent($1)), 32) AS score_content",
    "FROM chunks c",
    "WHERE c.tsv @@ to_tsquery('simple', public.immutable_unaccent($1))",
    "ORDER BY score DESC",
    "LIMIT $2;",
  ].join("\n");
  return { text, params: [buildTsQueryExpr(queryVi), topK] };
}
