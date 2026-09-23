// probe tạm H27 W3 — Postgres thật, KHÔNG gọi model. searchLexical + applyEligibility
// trên câu hỏi GỐC (A1 không chạy ⇒ không có normalized_query_vi).
import { loadLocalEnv } from "../../../../scripts/_batch.mjs";
import { getDataStore, closePool } from "../../../../lib/adapters/db.ts";
import { applyEligibility } from "../../../../lib/pipeline/eligibility.ts";
import { TOP_K } from "../../../../lib/pipeline/retrieval.ts";
import type { Principal } from "../../../../lib/types.ts";

loadLocalEnv();
process.env.DATA_BACKEND = "postgres";
const P: Principal = { user_id: "probe", role: "resident", resident_id: "R-0001", owned_property_ids: ["S1.120817"], property_type: ["apartment"] };
const CASES = [
  ["F-I05-04", "Khu Thương mại dịch vụ hoạt động đến mấy giờ?", "COM-HOURS-02", "[]"],
  ["F-I05-05", "Hàng rào mặt tiền biệt thự được cao tối đa bao nhiêu?", "VIL-FENCE-02", "[]"],
  ["F-I03-02", "Vườn Nướng BBQ mỗi hộ được đặt tối đa mấy lượt một tuần?", "BBQ-BOOK-02", "[]"],
  ["S03", "Vườn BBQ cho tối đa bao nhiêu người một lượt?", null, '["CG-BBQ-CAPACITY"]'],
] as const;
const store = await getDataStore();
let allOk = true;
for (const [id, q, want, wantGroups] of CASES) {
  const retrieved = await store.searchLexical(q, TOP_K);
  const elig = await applyEligibility(retrieved, P, new Date(), q);
  const rej = new Map(elig.rejected.map((x) => [x.chunk.chunk_id, x.reason]));
  console.log(`\n## ${id} | ${q}`);
  retrieved.forEach((c, i) => console.log(`  #${i + 1} ${c.section_id} (${c.document_id}) score=${c.score.toFixed(4)} -> ${rej.get(c.chunk_id) ?? "eligible"}`));
  const groups = JSON.stringify(elig.conflict_groups);
  const inElig = want ? elig.eligible.some((c) => c.section_id === want) : true;
  const ok = inElig && groups === wantGroups;
  allOk &&= ok;
  console.log(`  conflict_groups=${groups} (kỳ vọng ${wantGroups}) · ${want ?? "-"} trong eligible=${inElig} · top_rejected_reason=${elig.top_rejected_reason} · ${ok ? "OK" : "FAIL"}`);
}
console.log(`\nTỔNG: ${allOk ? "4/4 OK" : "CÓ CA FAIL"}`);
await closePool();
process.exit(allOk ? 0 : 1);
