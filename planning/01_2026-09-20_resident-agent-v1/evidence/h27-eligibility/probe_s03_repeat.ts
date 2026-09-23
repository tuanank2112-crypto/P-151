// probe tạm H27 — S03 lặp 30 lần trên Postgres: thứ tự hạng 1 giữa các chunk
// ĐỒNG ĐIỂM có ổn định không (ORDER BY score DESC không có khoá phụ).
import { loadLocalEnv } from "../../../../scripts/_batch.mjs";
import { getDataStore, closePool } from "../../../../lib/adapters/db.ts";
import { applyEligibility } from "../../../../lib/pipeline/eligibility.ts";
import { TOP_K } from "../../../../lib/pipeline/retrieval.ts";
import type { Principal } from "../../../../lib/types.ts";
loadLocalEnv();
process.env.DATA_BACKEND = "postgres";
const P: Principal = { user_id: "probe", role: "resident", resident_id: "R-0001", owned_property_ids: ["S1.120817"], property_type: ["apartment"] };
const q = "Vườn BBQ cho tối đa bao nhiêu người một lượt?";
const store = await getDataStore();
const tally = new Map<string, number>();
for (let i = 0; i < 30; i++) {
  const r = await store.searchLexical(q, TOP_K);
  const e = await applyEligibility(r, P, new Date(), q);
  const key = `top1=${r[0]?.section_id} order=${r.slice(0, 4).map((c) => c.section_id).join(",")} groups=${JSON.stringify(e.conflict_groups)}`;
  tally.set(key, (tally.get(key) ?? 0) + 1);
}
for (const [k, n] of tally) console.log(`${n}/30  ${k}`);
await closePool();
process.exit(0);
