// evidence/h25-pipeline-steps/pg_roundtrip.ts — H25 W4 (2026-09-23), script TẠM,
// KHÔNG đặt trong scripts/ (đúng luật handoff §2). Đo thật trên Postgres:
// insertAnswerTurn() với pipeline_steps 2 phần tử + s3_faithfulness=0.75, đọc
// lại bằng SQL thô, rồi tự dọn (delete conversations, cascade). Chạy:
//   node --experimental-strip-types "planning/.../evidence/h25-pipeline-steps/pg_roundtrip.ts"
// KHÔNG gọi model thật — không cần transport giả vì không đi qua runTurn(),
// gọi thẳng getDataStore().insertAnswerTurn().

import { loadLocalEnv, requireEnv } from "../../../../scripts/_batch.mjs";
import { makeSql } from "../../../../scripts/_pg.mjs";
import { getDataStore, __resetDataStoreForTesting } from "../../../../lib/adapters/db.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.DATA_BACKEND = "postgres";
__resetDataStoreForTesting();

const sql = makeSql(process.env.DATABASE_URL!);

async function main() {
  const store = await getDataStore();
  const residentUser = await store.findUserByEmail("resident@demo.local");
  if (!residentUser) {
    throw new Error("Seed thiếu resident@demo.local — chạy npm run db:seed:users trước.");
  }
  const conv = await store.createConversation(residentUser.id);
  const userMsg = await store.appendMessage(conv.id, "user", "câu hỏi đo H25 W4.", residentUser.id);

  const { id: turnId } = await store.insertAnswerTurn({
    conversation_id: conv.id,
    user_message_id: userMsg.id,
    assistant_message_id: null,
    question_vi: "câu hỏi đo H25 W4.",
    detected_intent: null,
    lifecycle_state: "answered",
    decision: "answer",
    reason_code: null,
    confidence: 0.9,
    gate_triggered: null,
    citations: [],
    claims: [],
    latency_ms: 1,
    is_golden_run: false,
    golden_case_id: null,
    pipeline_steps: [
      { step: "validate", ok: true, ms: 0 },
      { step: "safety", ok: true, ms: 1 },
    ],
    s1_retrieval_top1: 0.5,
    s2_eligible_ratio: 0.5,
    s3_faithfulness: 0.75,
    s4_conflict: false,
    rejection_histogram: {},
  });

  const rows = (await sql(
    "select jsonb_array_length(pipeline_steps) as len, s3_faithfulness from answer_turns where id = $1",
    [turnId]
  )) as unknown as Array<{ len: number; s3_faithfulness: string }>;

  console.log("turnId:", turnId);
  console.log("jsonb_array_length(pipeline_steps):", rows[0]?.len);
  console.log("s3_faithfulness:", rows[0]?.s3_faithfulness);

  const lenOk = rows.length === 1 && rows[0]!.len === 2;
  const faithOk = rows.length === 1 && rows[0]!.s3_faithfulness === "0.7500";
  console.log("CHECK len==2:", lenOk);
  console.log("CHECK s3_faithfulness==0.7500:", faithOk);

  await sql("delete from conversations where id = $1", [conv.id]);
  const leftover = (await sql("select count(*) as c from answer_turns where id = $1", [turnId])) as unknown as Array<{ c: string }>;
  console.log("CHECK cascade cleanup (answer_turns count==0):", leftover[0]!.c === "0");

  if (!lenOk || !faithOk || leftover[0]!.c !== "0") {
    console.error("FAIL");
    process.exitCode = 1;
    return;
  }
  console.log("PASS");
}

main()
  .catch((err) => {
    console.error("ERROR:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
