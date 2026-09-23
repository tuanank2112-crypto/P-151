// Script tạm H30: chạy nội dung 007 trong BEGIN … ROLLBACK (không ghi gì).
// Dùng 2 lần: trước migrate (thử) và sau migrate (chứng minh idempotent: chạy lại
// nội dung file trên DB đã có 007 không lỗi).
import { pg } from "../../../../scripts/_pg.mjs";
import { readFile } from "node:fs/promises";
const content = await readFile(new URL("../../../../db/migrations/007_chunk_heading_tsv.sql", import.meta.url), "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(content);
  const r = await client.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE heading_vi='')::int AS e FROM chunks");
  console.log(`dryrun_007 ok inside txn: chunks=${r.rows[0].n} heading_empty=${r.rows[0].e}`);
  await client.query("ROLLBACK");
  console.log("ROLLBACK done");
} catch (e) {
  await client.query("ROLLBACK");
  console.error(`DRYRUN_ERROR: ${e.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
