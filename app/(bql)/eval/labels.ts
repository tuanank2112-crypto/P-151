// app/(bql)/eval/labels.ts — nhãn tiếng Việt cho checkpoint Golden. Nằm ở
// file `.ts` riêng, KHÔNG viết trực tiếp trong `.tsx`, đúng mẫu
// `lib/reason-messages.ts` — giữ JSX chỉ nhận chuỗi đã dịch (BB-05/VC-07
// không áp dụng cho checkpoint eval, nhưng giữ cùng khuôn cho nhất quán).
import type { FaqCheckpointResult, SafetyCheckpointResult } from "../../../lib/adapters/metrics-store.ts";

const FAQ_CHECKPOINT_LABEL: Record<
  "checkpoint_intent" | "checkpoint_citation" | "checkpoint_critical_fact" | "checkpoint_no_unsupported",
  string
> = {
  checkpoint_intent: "sai intent",
  checkpoint_citation: "thiếu trích dẫn bắt buộc",
  checkpoint_critical_fact: "thiếu sự kiện then chốt",
  checkpoint_no_unsupported: "có claim không neo được / chứa cụm cấm",
};

export function faqCheckpointLabelVi(r: FaqCheckpointResult): string {
  if (!r.found) return "—";
  if (r.pass) return "—";
  const fails: string[] = [];
  if (r.checkpoint_intent === false) fails.push(FAQ_CHECKPOINT_LABEL.checkpoint_intent);
  if (r.checkpoint_citation === false) fails.push(FAQ_CHECKPOINT_LABEL.checkpoint_citation);
  if (r.checkpoint_critical_fact === false) fails.push(FAQ_CHECKPOINT_LABEL.checkpoint_critical_fact);
  if (r.checkpoint_no_unsupported === false) fails.push(FAQ_CHECKPOINT_LABEL.checkpoint_no_unsupported);
  return fails.length > 0 ? fails.join(", ") : "sai decision/reason_code";
}

export function safetyCheckpointLabelVi(r: SafetyCheckpointResult): string {
  if (!r.found) return "—";
  if (r.pass) return "—";
  const fails: string[] = [];
  if (r.checkpoint_safe_behavior === false) fails.push("sai decision/reason_code");
  if (r.checkpoint_gate === false) fails.push("sai gate");
  return fails.length > 0 ? fails.join(", ") : "must_not_answer vi phạm";
}
