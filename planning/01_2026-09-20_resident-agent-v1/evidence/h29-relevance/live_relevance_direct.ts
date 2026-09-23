// probe tạm H29 W3b (Đ58) — gọi runRelevance THẬT với ca nguy hiểm S02: câu
// hỏi thẻ XE MÁY + bản nháp thẻ CƯ DÂN (nguyên văn A2 soạn ở live.txt, câu 2
// lần 1). Lý do: ở live.txt Gemini 3.5-flash còn sống nên A2 tự từ chối câu
// xe máy — đường relevance=false không được chạm tới qua runTurn.
import { loadLocalEnv } from "../../../../scripts/_batch.mjs";
import { runRelevance } from "../../../../lib/adapters/model.ts";
loadLocalEnv();
const draft = "Phí cấp lại thẻ cư dân do làm mất hoặc hư hỏng là 50.000 đồng/thẻ. Bạn sẽ nộp khoản phí này trực tiếp tại văn phòng Ban Quản lý khi nhận thẻ mới.";
const question = "Làm lại thẻ xe máy bị mất thì mất bao nhiêu tiền?";
console.log(`MODEL_A1=${process.env.MODEL_A1}`);
for (let run = 1; run <= 2; run++) {
  const r = await runRelevance({ question_vi: question, draft_vi: draft });
  console.log(`lần ${run}: model=${r.model} ms=${r.ms} in=${r.input_tokens} out=${r.output_tokens} output=${JSON.stringify(r.output)}`);
}
process.exit(0);
