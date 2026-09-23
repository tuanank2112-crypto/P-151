// probe tạm H29 W3 (Đ58) — chạy runTurn THẬT trên Postgres, 4 câu × 2 lần.
// MODEL_A2 truyền từ shell (gemini-3.5-flash) — shell thắng .env.local.
// Tự dọn đúng các hội thoại mình tạo (ON DELETE CASCADE).
import { loadLocalEnv } from "../../../../scripts/_batch.mjs";
import { getDataStore, getSql, closePool } from "../../../../lib/adapters/db.ts";
import { runTurn } from "../../../../lib/pipeline/index.ts";
import { deleteConversations } from "../../../../tests/_pg-cleanup.ts";
import type { Principal } from "../../../../lib/types.ts";
loadLocalEnv();
process.env.DATA_BACKEND = "postgres";
const P: Principal = {
  user_id: "86e44c36-0914-4630-ac0e-4b9995d4c7e6",
  role: "resident",
  resident_id: "R-0001",
  owned_property_ids: ["S1.120817"],
  property_type: ["apartment"],
};
const QS: Array<[string, string]> = [
  ["Làm lại thẻ xe máy bị mất thì mất bao nhiêu tiền?", "escalate/no_eligible_source"],
  ["Cấp lại thẻ cư dân bị mất tốn bao nhiêu tiền?", "answer"],
  ["Tốc độ tối đa khi lái xe trong hầm là bao nhiêu?", "answer"],
  ["Trước khi thi công sửa chữa căn hộ cần làm thủ tục gì?", "answer"],
];
console.log(`MODEL_A1=${process.env.MODEL_A1} | MODEL_A2=${process.env.MODEL_A2} | MODEL_A3=${process.env.MODEL_A3}`);
const store = await getDataStore();
const created: string[] = [];
try {
  for (const [q, expect] of QS) {
    for (let run = 1; run <= 2; run++) {
      const conv = await store.createConversation(P.user_id);
      created.push(conv.id);
      const t0 = Date.now();
      try {
        const r = await runTurn({ conversation_id: conv.id, question_vi: q, principal: P });
        console.log(`\n### "${q}" · lần ${run} · kỳ vọng ${expect} · ${Date.now() - t0}ms`);
        console.log(`decision=${r.decision} reason=${r.reason_code} gate=${r.gate_triggered}`);
        console.log(`steps=${r.steps.map((s) => `${s.step}${s.model ? `[${s.model}]` : ""}${s.ok ? "" : "!"}`).join(" → ")}`);
        const rel = r.steps.find((s) => s.step === "relevance");
        console.log(`relevance=${rel ? `ok=${rel.ok} model=${rel.model} ms=${rel.ms} in=${rel.input_tokens} out=${rel.output_tokens} note=${rel.note ?? "-"}` : "(không gọi)"}`);
        const turn = (await getSql()("select s3_faithfulness from answer_turns where conversation_id = $1", [conv.id])) as Array<{ s3_faithfulness: number }>;
        console.log(`s3_faithfulness(db)=${turn[0]?.s3_faithfulness}`);
        console.log(`answer_vi=${(r.answer_vi ?? "").replace(/\s+/g, " ").slice(0, 220)}`);
      } catch (e) {
        console.log(`\n### "${q}" · lần ${run} · LỖI ${(e as Error).name}: ${(e as Error).message.slice(0, 300)}`);
      }
    }
  }
} finally {
  await deleteConversations(getSql() as never, created);
  const left = (await getSql()("select count(*)::int as n from conversations where id = any($1)", [created])) as Array<{ n: number }>;
  console.log(`\ncleanup: tạo ${created.length} hội thoại, còn lại sau dọn = ${left[0]?.n}`);
  await closePool();
}
process.exit(0);
