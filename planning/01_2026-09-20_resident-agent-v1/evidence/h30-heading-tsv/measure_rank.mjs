// evidence/h30-heading-tsv/measure_rank.mjs — script tạm W4 (H30). KHÔNG gọi model.
// Dùng ĐÚNG câu SQL của lib/retrieval/query.ts (buildLexicalQuery), chỉ nâng LIMIT
// để thấy hạng thật của section kỳ vọng ngoài top 8.
// Chạy: node --env-file=.env.local <file> <nhãn>
import { makeSql } from "../../../../scripts/_pg.mjs";
import { buildLexicalQuery, DEFAULT_TOP_K } from "../../../../lib/retrieval/query.ts";

const CASES = [
  ["F-I04-02", "Khung giờ nào được phép chuyển đồ ra vào Tòa nhà?", "MOVE-TIME-03", true],
  ["F-I04-04", "Thi công sửa chữa căn hộ được làm trong khung giờ nào?", "CONS-TIME-03", true],
  ["F-I03-01", "Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?", "POOL-SAFE-03", false],
  ["F-I01-04", "Cấp lại thẻ cư dân bị mất tốn bao nhiêu tiền?", "CARD-FEE-05", false],
  ["F-I02-05", "Tốc độ tối đa khi lái xe trong hầm là bao nhiêu?", "PARK-SPEED-03", false],
  ["F-I03-02", "Vườn Nướng BBQ mỗi hộ được đặt tối đa mấy lượt một tuần?", "BBQ-BOOK-02", false],
  ["F-I05-05", "Hàng rào mặt tiền biệt thự được cao tối đa bao nhiêu?", "VIL-FENCE-02", false],
  ["F-ESC-01", "Sân pickleball mở cửa mấy giờ?", null, false],
];

const label = process.argv[2] ?? "run";
const sql = makeSql(process.env.DATABASE_URL);
try {
  const [{ n }] = await sql("SELECT count(*)::int AS n FROM chunks");
  const cols = await sql(
    "SELECT column_name, generation_expression FROM information_schema.columns WHERE table_name='chunks' AND column_name IN ('tsv','heading_vi') ORDER BY column_name"
  );
  const mig = await sql("SELECT version FROM schema_migrations ORDER BY version");
  console.log(`# ${label} · ${new Date().toISOString()} · TOP_K=${DEFAULT_TOP_K}`);
  console.log(`chunks_count=${n}`);
  console.log(`schema_migrations=${mig.map((r) => r.version).join(",")}`);
  for (const c of cols) console.log(`column ${c.column_name}: ${c.generation_expression ?? "(plain)"}`);
  if (cols.some((c) => c.column_name === "heading_vi")) {
    const [{ e }] = await sql("SELECT count(*)::int AS e FROM chunks WHERE heading_vi = ''");
    console.log(`chunks_heading_empty=${e}`);
  }
  console.log("case_id | expected | rank | score_expected | in_top8 | top1_section | top1_score | top3");
  for (const [id, q, exp] of CASES) {
    const { text, params } = buildLexicalQuery(q, 1000);
    const rows = await sql(text, [params[0], params[1]]);
    const idx = exp ? rows.findIndex((r) => r.section_id === exp) : -1;
    const rank = exp ? (idx >= 0 ? idx + 1 : "none") : "-";
    const sc = idx >= 0 ? Number(rows[idx].score).toFixed(6) : "-";
    const top1 = rows[0];
    console.log(
      [id, exp ?? "-", rank, sc, exp ? (idx >= 0 && idx < DEFAULT_TOP_K ? "yes" : "no") : "-",
       top1?.section_id ?? "-", top1 ? Number(top1.score).toFixed(6) : "-",
       rows.slice(0, 3).map((r) => r.section_id).join(",")].join(" | ")
    );
  }
} finally {
  await sql.end();
}
