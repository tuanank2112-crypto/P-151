// Script tạm H30 (sau migrate): với 8 câu W4, so điểm cũ (tsv chỉ content, tính lại
// tại chỗ) và điểm mới (chunks.tsv) — tách theo chunk CÓ/KHÔNG khớp từ tiêu đề.
// Kiểm bất biến Đ59: chunk không khớp tiêu đề ⇒ điểm không đổi.
import { makeSql } from "../../../../scripts/_pg.mjs";
import { buildTsQueryExpr } from "../../../../lib/retrieval/query.ts";
const QS = [
  "Khung giờ nào được phép chuyển đồ ra vào Tòa nhà?",
  "Thi công sửa chữa căn hộ được làm trong khung giờ nào?",
  "Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?",
  "Cấp lại thẻ cư dân bị mất tốn bao nhiêu tiền?",
  "Tốc độ tối đa khi lái xe trong hầm là bao nhiêu?",
  "Vườn Nướng BBQ mỗi hộ được đặt tối đa mấy lượt một tuần?",
  "Hàng rào mặt tiền biệt thự được cao tối đa bao nhiêu?",
  "Sân pickleball mở cửa mấy giờ?",
];
const sql = makeSql(process.env.DATABASE_URL);
try {
  console.log("question | chunks_matched | heading_hit | no_heading_hit | max_abs_diff_no_heading | top1_old_formula_section | top1_old_formula_score");
  for (const q of QS) {
    const rows = await sql(
      `WITH q AS (SELECT to_tsquery('simple', public.immutable_unaccent($1)) AS tq)
       SELECT c.section_id,
              ts_rank_cd(c.tsv, q.tq, 32) AS s_new,
              ts_rank_cd(to_tsvector('simple', public.immutable_unaccent(c.content_vi)), q.tq, 32) AS s_old,
              to_tsvector('simple', public.immutable_unaccent(c.heading_vi)) @@ q.tq AS hh,
              to_tsvector('simple', public.immutable_unaccent(c.content_vi)) @@ q.tq AS ch
       FROM chunks c, q WHERE c.tsv @@ q.tq`,
      [buildTsQueryExpr(q)]
    );
    const noH = rows.filter((r) => !r.hh);
    const maxDiff = noH.reduce((m, r) => Math.max(m, Math.abs(Number(r.s_new) - Number(r.s_old))), 0);
    const oldTop = rows.filter((r) => r.ch).sort((a, b) => b.s_old - a.s_old)[0];
    console.log([q, rows.length, rows.length - noH.length, noH.length, maxDiff.toExponential(3),
      oldTop?.section_id ?? "-", oldTop ? Number(oldTop.s_old).toFixed(6) : "-"].join(" | "));
  }
} finally { await sql.end(); }
