// lib/pipeline/index.ts — điểm vào DUY NHẤT của pipeline 3 agent
// (SPEC-P02-Agent-Pipeline.md §1, §2, BB-08). Chín chặng, thứ tự tất định.
//
// GIỚI HẠN GÓI P02a (mock, H04): KHÔNG có bảng `answer_turns`/`conversations`
// trong kho mock (Đ24 chỉ định nghĩa tri thức + Golden, không định nghĩa
// bảng vận hành cho mock). BB-11 ("ghi đúng một dòng answer_turns, kể cả khi
// lỗi") vì vậy CHƯA thi công ở gói này — cần `DATABASE_URL` thật. `runTurn`
// trả về `TurnResult` thuần, không side-effect ghi DB. Ghi rõ trong báo cáo.

import { getDataStore } from "../adapters/db.ts";
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
  IntentId,
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
}

function escalateResult(
  reason_code: ReasonCode,
  gate: string | null,
  steps: PipelineStep[],
  clarify: string | null = null
): TurnResult {
  return {
    decision: "escalate",
    reason_code,
    answer_vi: null,
    clarify_question_vi: clarify,
    citations: [],
    claims: [],
    confidence: 0,
    gate_triggered: gate,
    steps,
  };
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
    return escalateResult("emergency_or_life_safety", null, steps);
  }

  const ownership = checkOwnership(a1.target_subjects, principal);
  if (!ownership.ok) {
    return escalateResult("pii_or_account_specific", null, steps);
  }

  if (a1.is_legal_or_compensation) {
    return escalateResult("legal_or_compensation_escalation", null, steps);
  }

  steps.push({
    step: "intent",
    ok: true,
    ms: 0,
    model: agentModel("A1"),
    note: "cùng lời gọi chặng 2",
  });

  if (a1.intent === "unsupported") {
    return escalateResult("unsupported_intent", null, steps);
  }
  if (a1.intent === "unresolved") {
    return escalateResult("intent_unresolved", null, steps);
  }
  const intent = a1.intent as IntentId;

  // ── Chặng 4 — context (missing_required_fields do A1 chấm) ───────────
  if (a1.missing_required_fields.length > 0) {
    steps.push({ step: "context", ok: false, ms: 0, note: a1.missing_required_fields.join(",") });
    return {
      decision: "clarify",
      reason_code: null,
      answer_vi: null,
      clarify_question_vi: a1.clarify_question_vi,
      citations: [],
      claims: [],
      confidence: 0,
      gate_triggered: null,
      steps,
    };
  }
  steps.push({ step: "context", ok: true, ms: 0 });

  // ── Chặng 5 — risk (danh mục hard-block bổ sung) ─────────────────────
  if (hitsRiskKeyword(a1.normalized_query_vi) || hitsRiskKeyword(questionVi)) {
    steps.push({ step: "risk", ok: false, ms: 0 });
    return escalateResult("legal_or_compensation_escalation", null, steps);
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
    return escalateResult(dec.reason_code as ReasonCode, dec.gate, steps);
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
    return escalateResult(dec.reason_code as ReasonCode, dec.gate, steps);
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
    return escalateResult(dec.reason_code as ReasonCode, dec.gate, steps);
  }

  const citations: Citation[] = a2.citations;
  const claims: ClaimVerdict[] = a3.claims;

  // BB-04 (E1): decision='answer' PHẢI có >= 1 citation. CẤM trả lời không căn cứ.
  if (citations.length === 0) {
    throw new PipelineInvariantError("decision=answer nhưng citations=[] (BB-04)");
  }

  return {
    decision: "answer",
    reason_code: null,
    answer_vi: a2.draft_vi,
    clarify_question_vi: null,
    citations,
    claims,
    confidence: dec.confidence,
    gate_triggered: null,
    steps,
  };
}

export { getDataStore };
