// lib/pipeline/index.ts — điểm vào DUY NHẤT của pipeline 3 agent
// (SPEC-P02-Agent-Pipeline.md §1, §2, BB-08). Chín chặng, thứ tự tất định.
//
// BB-11 (H06 W2) — `runTurn` ghi đúng MỘT dòng `answer_turns` mỗi lượt, kể cả
// nhánh escalate và nhánh ném lỗi. Cài bằng `try/finally`: chặng `validate`
// chạy TRƯỚC mọi lần chạm DataStore (câu hỏi rỗng KHÔNG tạo answer_turns —
// SPEC-P02 §9, `EmptyQuestionError`); sau khi qua `validate`, câu hỏi được
// ghi thành một dòng `messages` (vai `user`) NGAY, để có `user_message_id`
// cho FK bắt buộc của `answer_turns`. Từ đó, `finally` LUÔN ghi một dòng
// `answer_turns` dù hàm trả về bình thường hay ném lỗi giữa chừng.
//
// Trên `DATA_BACKEND=mock`, các hàm ghi của `DataStore` là NO-OP có ghi chú
// (Đ24, `lib/adapters/store-mock.ts`) — không ném lỗi, để không phá các test
// hiện có gọi thẳng `runTurn` với backend mock (`tests/pipeline-order.test.ts`,
// `tests/citations.test.ts`). Số liệu ghi được coi là THẬT chỉ khi chạy trên
// Postgres — xem `TESTING-ACCEPTANCE.md`.

import { getDataStore, type DataStore } from "../adapters/db.ts";
import {
  agentModel,
  runClassifier,
  runRetriever,
  runVerifier,
  type ForceUpstreamError,
} from "../adapters/model.ts";
import type {
  Citation,
  ClaimVerdict,
  Decision,
  IntentId,
  LifecycleState,
  PipelineStep,
  Principal,
  ReasonCode,
  RetrievedChunk,
  TurnResult,
} from "../types.ts";
import { decideTurn, round4 } from "../confidence.ts";
import { applyEligibility, type EligibilityResult } from "./eligibility.ts";
import { checkOwnership } from "./ownership.ts";
import { retrieve, TOP_K } from "./retrieval.ts";
import { EmptyQuestionError, PipelineInvariantError } from "./errors.ts";

const STEP_ORDER: PipelineStep["step"][] = [
  "validate",
  "safety",
  "intent",
  "context",
  "risk",
  "retrieval",
  "eligibility",
  "draft",
  "verify",
];

/**
 * Bất biến thứ tự (BB-08): `steps` phải xuất hiện đúng thứ tự tăng dần,
 * không nhảy cóc. Ném `PipelineInvariantError` nếu vi phạm.
 */
export function assertStepOrder(steps: PipelineStep[]): void {
  let lastIdx = -1;
  for (const s of steps) {
    const idx = STEP_ORDER.indexOf(s.step);
    if (idx === -1) throw new PipelineInvariantError(`step lạ: ${s.step}`);
    if (idx <= lastIdx) {
      throw new PipelineInvariantError(
        `steps sai thứ tự: "${s.step}" (idx=${idx}) không đứng sau idx=${lastIdx}`
      );
    }
    lastIdx = idx;
  }
}

/** Bảng required_context theo intent — 01-CONTRACTS.md §8.1.1, dùng để đối
 *  chiếu `missing_required_fields` do A1 trả về (giữ NGUYÊN, không tự suy
 *  thêm ở đây — A1 đã chấm theo đúng bảng này trong prompt). */

/**
 * Chặng 5 — danh mục hard-block (SPEC-P02 §2, `MVP_DATA_SCOPE_LOCK.md` §8).
 * Đây là lưới TẤT ĐỊNH đặt thêm phía sau phán đoán ngữ nghĩa của A1 ở chặng 2,
 * nên nó phải CHÍNH XÁC chứ không cần phủ rộng.
 *
 * G24 (Đ31, đo 2026-09-21) — bản cũ dùng `lower.includes(k)` với `k = "kiện"`.
 * Tiếng Việt viết rời từng âm tiết nên phép so chuỗi con đó bắt luôn "điều
 * kiện", "sự kiện", "linh kiện". Hậu quả đo được: ca Golden FAQ *"Nuôi thú
 * cưng trong căn hộ cần điều kiện gì?"* bị đẩy sang
 * `legal_or_compensation_escalation` ngay ở chặng 5 — không bao giờ tới được
 * retrieval, và đếm thẳng vào cột trượt của `M1`. Cùng họ lỗi với G23.
 */
const RISK_PHRASES_VI = [
  "bồi thường",
  "đền bù",
  "trách nhiệm pháp lý",
  "khởi kiện",
  "kiện tụng",
  "thưa kiện",
  "kiện cáo",
  "tranh chấp",
];

/** Âm tiết đứng MỘT MÌNH thì mới mang nghĩa pháp lý; đi sau các âm tiết dưới
 *  đây là từ ghép khác hẳn nghĩa. Giữ được ca Safety "tôi kiện được không"
 *  mà không bắt oan "điều kiện". */
const LONE_RISK_SYLLABLE = "kiện";
const LONE_RISK_BLOCKED_PREV = ["điều", "sự", "linh", "bưu", "vụ"];
const LONE_RISK_BLOCKED_NEXT = ["hàng", "tướng", "toàn"];

/** Tách câu thành âm tiết, bỏ dấu câu. Giữ nguyên dấu thanh tiếng Việt. */
export function syllables(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Cụm `phrase` xuất hiện như một dãy âm tiết LIỀN NHAU trong `tokens`. */
function hasPhrase(tokens: string[], phrase: string): boolean {
  const want = syllables(phrase);
  if (want.length === 0) return false;
  for (let i = 0; i + want.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < want.length; j++) {
      if (tokens[i + j] !== want[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export function hitsRiskKeyword(text: string): boolean {
  const tokens = syllables(text);
  if (RISK_PHRASES_VI.some((p) => hasPhrase(tokens, p))) return true;

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== LONE_RISK_SYLLABLE) continue;
    const prev = i > 0 ? tokens[i - 1]! : "";
    const next = i + 1 < tokens.length ? tokens[i + 1]! : "";
    if (LONE_RISK_BLOCKED_PREV.includes(prev)) continue;
    if (LONE_RISK_BLOCKED_NEXT.includes(next)) continue;
    return true;
  }
  return false;
}

interface RunTurnArgs {
  conversation_id: string;
  question_vi: string;
  principal: Principal;
  now?: Date;
  /** CHỈ dùng để bơm lỗi khi test, áp dụng ở lời gọi A2 (TESTING §4.4).
   *  `true` giữ lại cho tương thích, nghĩa là "429". */
  forceUpstreamError?: ForceUpstreamError | true;
  /** Đ44 — chỉ nguồn gọi mới biết nó đang chạy Golden, nên chính nó phải
   *  khai. Mặc định `false`/`null` (lượt thật qua `/api/chat`).
   *  `scripts/eval_golden.mjs` truyền `true` + `case_id` (SPEC-P04 §5). */
  is_golden_run?: boolean;
  golden_case_id?: string | null;
}

function escalateResult(
  reason_code: ReasonCode,
  gate: string | null,
  steps: PipelineStep[],
  clarify: string | null = null,
  citations: Citation[] = []
): TurnResult {
  return {
    decision: "escalate",
    reason_code,
    answer_vi: null,
    clarify_question_vi: clarify,
    citations,
    claims: [],
    confidence: 0,
    gate_triggered: gate,
    steps,
  };
}

/** `snippet_vi` ≤ 300 ký tự, cắt theo câu (01-CONTRACTS §7 `Citation`) — Đ42:
 *  cắt cứng ở 299 ký tự rồi nối "…" (tổng đúng 300); CHỈ cắt theo câu khi dấu
 *  chấm/hỏi/than gần nhất nằm SAU một sàn 80 ký tự, ngược lại cắt cứng kèm
 *  "…" — tránh trả về snippet 1–2 ký tự khi văn bản đánh số kiểu "1. …" có
 *  dấu chấm ngay ở đầu (R14 mục 2). */
const SNIPPET_MAX_LEN = 300;
const SNIPPET_SENTENCE_FLOOR = 80;
export function toSnippet(contentVi: string): string {
  const trimmed = contentVi.trim();
  if (trimmed.length <= SNIPPET_MAX_LEN) return trimmed;
  const cut = trimmed.slice(0, SNIPPET_MAX_LEN - 1); // 299 — chừa 1 ký tự cho "…"
  const lastSentenceEnd = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"), cut.lastIndexOf("!"));
  if (lastSentenceEnd >= SNIPPET_SENTENCE_FLOOR) return cut.slice(0, lastSentenceEnd + 1);
  return `${cut}…`;
}

/**
 * Đ38 — lượt `escalate` với `gate = "G1_conflict"` PHẢI trả các section
 * thuộc `conflict_group` đã phát hiện dưới dạng `citations`, để câu tiếng
 * Việt "đây là hai nguồn để anh/chị đối chiếu" (SPEC-P02 §6.4) không hứa
 * suông. CHỈ dùng cho đúng nhánh này — mọi đường escalate khác giữ nguyên
 * `citations: []` (không hứa nguồn nào thì không nợ gì, Đ38).
 *
 * Nguồn dữ liệu: `elig.rejected` đã có sẵn đúng các chunk bị loại vì
 * `reason === "conflict"` (lib/pipeline/eligibility.ts E-5, KHÔNG sửa file
 * đó — chỉ đọc kết quả nó trả về). Tra thêm `document_title_vi`/`heading_vi`
 * qua `DataStore` (đã có sẵn qua tham số `store`, không mở connection mới).
 */
async function buildConflictCitations(
  store: DataStore,
  elig: EligibilityResult
): Promise<Citation[]> {
  const conflictedChunks = elig.rejected
    .filter((r) => r.reason === "conflict")
    .map((r) => r.chunk);
  if (conflictedChunks.length === 0) return [];

  // Một section chỉ xuất hiện MỘT lần trong citations dù retrieval có thể
  // trả nhiều chunk cùng section_id (seed hiện tại là 1 section = 1 chunk,
  // nhưng không dựa vào giả định đó — khử trùng lặp tường minh).
  const bySection = new Map<string, RetrievedChunk>();
  for (const c of conflictedChunks) if (!bySection.has(c.section_id)) bySection.set(c.section_id, c);
  const uniqueChunks = [...bySection.values()];

  const documentIds = [...new Set(uniqueChunks.map((c) => c.document_id))];
  const sectionIds = [...new Set(uniqueChunks.map((c) => c.section_id))];
  const [documents, sections] = await Promise.all([
    store.getDocumentMeta(documentIds),
    store.getSectionMeta(sectionIds),
  ]);

  return uniqueChunks.map((c) => ({
    document_id: c.document_id,
    section_id: c.section_id,
    document_title_vi: documents.get(c.document_id)?.title_vi ?? "",
    heading_vi: sections.get(c.section_id)?.heading_vi ?? "",
    snippet_vi: toSnippet(c.content_vi),
  }));
}

/** `answer_turns.lifecycle_state` theo `decision` (01-CONTRACTS §2.1). */
function lifecycleForDecision(decision: Decision): LifecycleState {
  if (decision === "answer") return "answered";
  if (decision === "clarify") return "clarification_required";
  return "escalated";
}

export async function runTurn(args: RunTurnArgs): Promise<TurnResult> {
  const now = args.now ?? new Date();
  const steps: PipelineStep[] = [];
  const questionVi = args.question_vi;
  const principal = args.principal;
  const forceA2Error: ForceUpstreamError | undefined =
    args.forceUpstreamError === true ? "429" : args.forceUpstreamError;

  // ── Chặng 1 — validate ──────────────────────────────────────────────
  const trimmed = questionVi.trim();
  if (trimmed.length === 0 || questionVi.length > 2000) {
    throw new EmptyQuestionError(
      trimmed.length === 0 ? "câu hỏi rỗng" : `câu hỏi quá dài (${questionVi.length} > 2000)`
    );
  }
  steps.push({ step: "validate", ok: true, ms: 0 });

  // Từ đây, mọi lượt hợp lệ PHẢI ghi đúng một answer_turns (BB-11), kể cả khi
  // ném lỗi bên dưới — xem khối try/finally quanh chặng 2–9.
  const store = await getDataStore();
  // Đ37/R13 — truyền `principal.user_id` để tự tạo hàng `conversations` khi
  // `conversation_id` là uuid dẫn xuất tất định từ script đo, chưa từng có
  // `createConversation()` gọi trước (`eval_golden.mjs`/`probe_defects.mjs`/
  // `trace_sample.mjs`). Với đường `/api/chat` (đã tạo hội thoại trước), đây
  // là một upsert `ON CONFLICT DO NOTHING`, không đổi hành vi.
  const userMessage = await store.appendMessage(
    args.conversation_id,
    "user",
    trimmed,
    principal.user_id
  );
  const turnStart = Date.now();
  let outcome: TurnResult | undefined;
  let detectedIntent: IntentId | null = null;

  /** Ghi nhớ kết quả cuối cùng để `finally` đọc được, rồi trả nguyên nó. */
  function finish(result: TurnResult): TurnResult {
    outcome = result;
    return result;
  }

  try {
    return await runPipelineBody();
  } finally {
    const finalResult: TurnResult =
      outcome ?? {
        decision: "escalate",
        reason_code: "system_error",
        answer_vi: null,
        clarify_question_vi: null,
        citations: [],
        claims: [],
        confidence: 0,
        gate_triggered: null,
        steps,
      };
    let assistantMessageId: string | null = null;
    if (finalResult.decision === "answer" && finalResult.answer_vi) {
      const assistantMsg = await store.appendMessage(
        args.conversation_id,
        "assistant",
        finalResult.answer_vi
      );
      assistantMessageId = assistantMsg.id;
    } else if (finalResult.decision === "clarify" && finalResult.clarify_question_vi) {
      const assistantMsg = await store.appendMessage(
        args.conversation_id,
        "assistant",
        finalResult.clarify_question_vi
      );
      assistantMessageId = assistantMsg.id;
    }
    await store.insertAnswerTurn({
      conversation_id: args.conversation_id,
      user_message_id: userMessage.id,
      assistant_message_id: assistantMessageId,
      question_vi: questionVi,
      detected_intent: detectedIntent,
      lifecycle_state: outcome ? lifecycleForDecision(finalResult.decision) : "failed",
      decision: finalResult.decision,
      reason_code: finalResult.reason_code,
      confidence: finalResult.confidence,
      gate_triggered: finalResult.gate_triggered,
      citations: finalResult.citations,
      claims: finalResult.claims,
      latency_ms: Date.now() - turnStart,
      is_golden_run: args.is_golden_run ?? false,
      golden_case_id: args.golden_case_id ?? null,
    });
  }

  // ── Chín chặng còn lại, đóng gói trong hàm nội bộ để try/finally ở trên
  //    bọc được TOÀN BỘ đường thoát (return sớm lẫn throw) — BB-11.
  async function runPipelineBody(): Promise<TurnResult> {
  // ── Chặng 2+3 — safety & intent (cùng một lời gọi A1) ────────────────
  const classifierStart = Date.now();
  const { output: a1, input_tokens: a1In, output_tokens: a1Out } = await runClassifier({
    question_vi: questionVi,
    conversation_tail: [],
    principal_summary: {
      owned_property_ids: principal.owned_property_ids,
      property_type: principal.property_type,
    },
  });
  const classifierMs = Date.now() - classifierStart;

  steps.push({
    step: "safety",
    ok: true,
    ms: classifierMs,
    model: agentModel("A1"),
    input_tokens: a1In,
    output_tokens: a1Out,
  });

  // Ưu tiên TUYỆT ĐỐI: khẩn cấp trước mọi thứ khác, kể cả ownership.
  if (a1.is_emergency) {
    return finish(escalateResult("emergency_or_life_safety", null, steps));
  }

  const ownership = checkOwnership(a1.target_subjects, principal);
  if (!ownership.ok) {
    return finish(escalateResult("pii_or_account_specific", null, steps));
  }

  if (a1.is_legal_or_compensation) {
    return finish(escalateResult("legal_or_compensation_escalation", null, steps));
  }

  steps.push({
    step: "intent",
    ok: true,
    ms: 0,
    model: agentModel("A1"),
    note: "cùng lời gọi chặng 2",
  });

  if (a1.intent === "unsupported") {
    return finish(escalateResult("unsupported_intent", null, steps));
  }
  if (a1.intent === "unresolved") {
    return finish(escalateResult("intent_unresolved", null, steps));
  }
  const intent = a1.intent as IntentId;
  detectedIntent = intent;

  // ── Chặng 4 — context (missing_required_fields do A1 chấm) ───────────
  if (a1.missing_required_fields.length > 0) {
    steps.push({ step: "context", ok: false, ms: 0, note: a1.missing_required_fields.join(",") });
    return finish({
      decision: "clarify",
      reason_code: null,
      answer_vi: null,
      clarify_question_vi: a1.clarify_question_vi,
      citations: [],
      claims: [],
      confidence: 0,
      gate_triggered: null,
      steps,
    });
  }
  steps.push({ step: "context", ok: true, ms: 0 });

  // ── Chặng 5 — risk (danh mục hard-block bổ sung) ─────────────────────
  if (hitsRiskKeyword(a1.normalized_query_vi) || hitsRiskKeyword(questionVi)) {
    steps.push({ step: "risk", ok: false, ms: 0 });
    return finish(escalateResult("legal_or_compensation_escalation", null, steps));
  }
  steps.push({ step: "risk", ok: true, ms: 0 });

  // ── Chặng 6 — retrieval ───────────────────────────────────────────────
  const retrievalStart = Date.now();
  const retrieved: RetrievedChunk[] = await retrieve(a1.normalized_query_vi, TOP_K);
  steps.push({ step: "retrieval", ok: true, ms: Date.now() - retrievalStart });

  const s1 = retrieved[0]?.score ?? 0;
  const retrievedCount = retrieved.length;

  // ── Chặng 7 — eligibility ─────────────────────────────────────────────
  const eligStart = Date.now();
  const elig: EligibilityResult = await applyEligibility(retrieved, principal, now);
  steps.push({ step: "eligibility", ok: true, ms: Date.now() - eligStart });

  const conflictDetected = elig.conflict_groups.length > 0;
  const eligibleCount = elig.eligible.length;

  if (conflictDetected || eligibleCount === 0) {
    const dec = decideTurn({
      retrieval_top1: s1,
      eligible_count: eligibleCount,
      retrieved_count: retrievedCount,
      faithfulness: 0,
      conflict_detected: conflictDetected,
      rejection_histogram: elig.rejection_histogram,
      top_rejected_reason: elig.top_rejected_reason,
    });
    // Đ38 — CHỈ gate G1_conflict mới kèm citations; G2_zero_eligible (không
    // mâu thuẫn, chỉ đơn giản là không có nguồn nào) giữ nguyên citations=[].
    const conflictCitations = conflictDetected ? await buildConflictCitations(store, elig) : [];
    return finish(
      escalateResult(dec.reason_code as ReasonCode, dec.gate, steps, null, conflictCitations)
    );
  }

  // ── Chặng 8 — draft (A2) ──────────────────────────────────────────────
  const draftStart = Date.now();
  const { output: a2, input_tokens: a2In, output_tokens: a2Out } = await runRetriever(
    {
      normalized_query_vi: a1.normalized_query_vi,
      intent,
      eligible_chunks: elig.eligible.map((c) => ({
        chunk_id: c.chunk_id,
        section_id: c.section_id,
        document_id: c.document_id,
        content_vi: c.content_vi,
        score: c.score,
      })),
    },
    { forceUpstreamError: forceA2Error }
  );
  steps.push({
    step: "draft",
    ok: true,
    ms: Date.now() - draftStart,
    model: agentModel("A2"),
    input_tokens: a2In,
    output_tokens: a2Out,
  });

  // Bất biến A2 (P02-C6): mọi citations[i].section_id phải ⊆ eligible_chunks.
  // CẤM lọc im lặng — ném PipelineInvariantError.
  const allowedSectionIds = new Set(elig.eligible.map((c) => c.section_id));
  for (const cit of a2.citations) {
    if (!allowedSectionIds.has(cit.section_id)) {
      throw new PipelineInvariantError(`A2 trích section_id lạ: ${cit.section_id}`);
    }
  }

  if (a2.refused) {
    const dec = decideTurn({
      retrieval_top1: s1,
      eligible_count: eligibleCount,
      retrieved_count: retrievedCount,
      faithfulness: 0,
      conflict_detected: false,
      retriever_refused: true,
      rejection_histogram: elig.rejection_histogram,
      top_rejected_reason: elig.top_rejected_reason,
    });
    return finish(escalateResult(dec.reason_code as ReasonCode, dec.gate, steps));
  }

  // ── Chặng 9 — verify (A3) ─────────────────────────────────────────────
  const verifyStart = Date.now();
  const { output: a3, input_tokens: a3In, output_tokens: a3Out } = await runVerifier({
    draft_vi: a2.draft_vi,
    evidence: elig.eligible.map((c) => ({ section_id: c.section_id, content_vi: c.content_vi })),
  });
  steps.push({
    step: "verify",
    ok: true,
    ms: Date.now() - verifyStart,
    model: agentModel("A3"),
    input_tokens: a3In,
    output_tokens: a3Out,
  });

  // Faithfulness tính LẠI ở TypeScript, không tin số model tự báo (§8.3, BB-06).
  const total = a3.claims.length;
  const supported = a3.claims.filter((c) => c.verdict === "supported").length;
  const faithfulness = total === 0 ? 0 : round4(supported / total);

  const dec = decideTurn({
    retrieval_top1: s1,
    eligible_count: eligibleCount,
    retrieved_count: retrievedCount,
    faithfulness,
    conflict_detected: false,
    rejection_histogram: elig.rejection_histogram,
    top_rejected_reason: elig.top_rejected_reason,
  });

  assertStepOrder(steps);

  if (dec.decision !== "answer") {
    return finish(escalateResult(dec.reason_code as ReasonCode, dec.gate, steps));
  }

  const citations: Citation[] = a2.citations;
  const claims: ClaimVerdict[] = a3.claims;

  // BB-04 (E1): decision='answer' PHẢI có >= 1 citation. CẤM trả lời không căn cứ.
  if (citations.length === 0) {
    throw new PipelineInvariantError("decision=answer nhưng citations=[] (BB-04)");
  }

  return finish({
    decision: "answer",
    reason_code: null,
    answer_vi: a2.draft_vi,
    clarify_question_vi: null,
    citations,
    claims,
    confidence: dec.confidence,
    gate_triggered: null,
    steps,
  });
  }
}

export { getDataStore };
