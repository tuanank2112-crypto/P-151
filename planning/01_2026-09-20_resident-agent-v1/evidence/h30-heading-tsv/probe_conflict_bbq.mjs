// Script tạm H30 (sau migrate): hạng của cặp DEF-03 (BBQ-CAP-01, BLD-AMEN-07) theo
// điểm cũ (content-only, tính lại tại chỗ) và điểm mới (chunks.tsv).
import { makeSql } from "../../../../scripts/_pg.mjs";
import { buildTsQueryExpr } from "../../../../lib/retrieval/query.ts";
const qs = process.argv.slice(2);
const sql = makeSql(process.env.DATABASE_URL);
try {
  for (const q of qs) {
    const rows = await sql(
      `WITH q AS (SELECT to_tsquery('simple', public.immutable_unaccent($1)) AS tq)
       SELECT c.section_id, ts_rank_cd(c.tsv, q.tq, 32) AS s_new,
              ts_rank_cd(to_tsvector('simple', public.immutable_unaccent(c.content_vi)), q.tq, 32) AS s_old
       FROM chunks c, q WHERE c.tsv @@ q.tq`, [buildTsQueryExpr(q)]);
    const byNew = [...rows].sort((a, b) => b.s_new - a.s_new).map((r) => r.section_id);
    const byOld = [...rows].sort((a, b) => b.s_old - a.s_old).map((r) => r.section_id);
    console.log(`Q: ${q}`);
    console.log(`  old top8: ${byOld.slice(0, 8).join(",")}`);
    console.log(`  new top8: ${byNew.slice(0, 8).join(",")}`);
    for (const id of ["BBQ-CAP-01", "BLD-AMEN-07"]) console.log(`  ${id}: old rank ${byOld.indexOf(id) + 1} · new rank ${byNew.indexOf(id) + 1}`);
  }
} finally { await sql.end(); }
