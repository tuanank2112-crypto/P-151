// lib/adapters/metrics-store.ts — truy vấn tổng hợp cho gói P04 (bảng eval +
// dashboard, R9/R10). MỌI truy vấn của gói này nằm ở file này (luật §2 handoff
// H08). CHỈ dùng `getSql()` của `lib/adapters/db.ts` — CẤM tự `new pg.Pool`
// (BB-07, luật §2 handoff H08).
//
// BB-06 / Đ08 / P04-C1: `s3_faithfulness` đọc THẲNG từ cột `answer_turns` do A3
// ghi lúc chạy thật. File này KHÔNG gọi model nào, KHÔNG dựng bộ chấm riêng.
//
// Thiết kế tách hai lớp để W5 test được bằng dữ liệu bơm sẵn, KHÔNG cần DB
// thật (luật §3 W5 handoff H08):
//   - Hàm `compute*` / `judge*`: THUẦN, nhận mảng đã có sẵn, trả số. Test import
//     thẳng các hàm này.
//   - Hàm `get*`: gọi `getSql()`, rồi giao lại cho hàm `compute*` tương ứng.
//
// Mọi hàm `compute*` phải trả `0` (không `NaN`, không ném lỗi) khi mảng đầu
// vào rỗng — đây là "xong khi" của W1 khi bảng `answer_turns` rỗng.

import fs from "node:fs";
import path from "node:path";
import { getSql } from "./db.ts";
import type { Citation, ClaimVerdict, Decision, IntentId, ReasonCode } from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────
// 1. Tỉ lệ tự động giải quyết (SPEC-P04 §4.1) — CHỈ lượt thật, is_golden_run=false
// ─────────────────────────────────────────────────────────────────────────

export interface AutoResolutionRow {
  decision: Decision;
}

export interface AutoResolutionSummary {
  /** Đ48 — GỒM CẢ `decision='action'`: một lượt agent tự đặt xong chỗ và trả
   *  biên nhận là tự động giải quyết y như một lượt trả lời có trích dẫn
   *  (SPEC-P04 §3 cập nhật theo). Tách riêng con số đó ở `actioned`. */
  auto_resolved: number;
  /** Phần của `auto_resolved` đến từ lượt hành động (Đ48). */
  actioned: number;
  clarified: number;
  escalated: number;
  total_turns: number;
  /** `null` khi `total_turns === 0` — trang phải hiện trạng thái rỗng, không `NaN%`. */
  auto_resolution_rate_pct: number | null;
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export function computeAutoResolutionSummary(rows: AutoResolutionRow[]): AutoResolutionSummary {
  const total_turns = rows.length;
  const actioned = rows.filter((r) => r.decision === "action").length;
  const auto_resolved = rows.filter((r) => r.decision === "answer").length + actioned;
  const clarified = rows.filter((r) => r.decision === "clarify").length;
  const escalated = rows.filter((r) => r.decision === "escalate").length;
  return {
    auto_resolved,
    actioned,
    clarified,
    escalated,
    total_turns,
    // Mẫu số vẫn là MỌI lượt, kể cả escalate (SPEC-P04 §4.1, BB-11).
    auto_resolution_rate_pct: pct(auto_resolved, total_turns),
  };
}

export async function getAutoResolutionSummary(): Promise<AutoResolutionSummary> {
  const sql = getSql();
  const rows = await sql<{ decision: Decision }>(
    `SELECT decision FROM answer_turns WHERE is_golden_run = false`
  );
  return computeAutoResolutionSummary(rows);
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Tách theo intent (SPEC-P04 §4.2)
// ─────────────────────────────────────────────────────────────────────────

export interface IntentRow {
  detected_intent: string | null;
  decision: Decision;
}

export interface IntentBreakdownEntry {
  intent: string; // 'I-01'..'I-05' hoặc 'unknown'
  answered: number;
  /** Đ48 — lượt agent THỰC THI thay cư dân, tách khỏi `answered` để nhìn được
   *  bao nhiêu phần của I-03 (tiện ích) là hành động chứ không phải trả lời. */
  actioned: number;
  clarified: number;
  escalated: number;
  total: number;
  rate_pct: number | null;
}

export function computeIntentBreakdown(rows: IntentRow[]): IntentBreakdownEntry[] {
  const groups = new Map<string, IntentRow[]>();
  for (const r of rows) {
    const key = r.detected_intent ?? "unknown";
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }
  const out: IntentBreakdownEntry[] = [];
  for (const [intent, group] of groups) {
    const answered = group.filter((r) => r.decision === "answer").length;
    const actioned = group.filter((r) => r.decision === "action").length;
    const clarified = group.filter((r) => r.decision === "clarify").length;
    const escalated = group.filter((r) => r.decision === "escalate").length;
    const total = group.length;
    out.push({
      intent,
      answered,
      actioned,
      clarified,
      escalated,
      total,
      // Cùng định nghĩa "tự động giải quyết" với §4.1: answer HOẶC action.
      rate_pct: pct(answered + actioned, total),
    });
  }
  out.sort((a, b) => b.total - a.total);
  return out;
}

export async function getIntentBreakdown(): Promise<IntentBreakdownEntry[]> {
  const sql = getSql();
  const rows = await sql<{ detected_intent: string | null; decision: Decision }>(
    `SELECT detected_intent, decision FROM answer_turns WHERE is_golden_run = false`
  );
  return computeIntentBreakdown(rows);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Tách theo lý do escalate (SPEC-P04 §4.3)
// ─────────────────────────────────────────────────────────────────────────

export interface ReasonCodeBreakdownEntry {
  reason_code: ReasonCode;
  n: number;
  share_pct: number | null;
}

export function computeReasonCodeBreakdown(
  reasonCodes: Array<ReasonCode | null>
): ReasonCodeBreakdownEntry[] {
  const nonNull = reasonCodes.filter((r): r is ReasonCode => r !== null);
  const counts = new Map<ReasonCode, number>();
  for (const code of nonNull) counts.set(code, (counts.get(code) ?? 0) + 1);
  const total = nonNull.length;
  const out: ReasonCodeBreakdownEntry[] = [];
  for (const [reason_code, n] of counts) {
    out.push({ reason_code, n, share_pct: pct(n, total) });
  }
  out.sort((a, b) => b.n - a.n);
  return out;
}

export async function getReasonCodeBreakdown(): Promise<ReasonCodeBreakdownEntry[]> {
  const sql = getSql();
  const rows = await sql<{ reason_code: ReasonCode | null }>(
    `SELECT reason_code FROM answer_turns WHERE is_golden_run = false AND decision = 'escalate'`
  );
  return computeReasonCodeBreakdown(rows.map((r) => r.reason_code));
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Đếm theo gate_triggered (W1 — bổ sung, không có SQL sẵn ở SPEC-P04 §4)
// ─────────────────────────────────────────────────────────────────────────

export interface GateTriggeredEntry {
  gate: string;
  n: number;
}

export function computeGateTriggeredCounts(gates: Array<string | null>): GateTriggeredEntry[] {
  const counts = new Map<string, number>();
  for (const g of gates) {
    if (g === null) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([gate, n]) => ({ gate, n }))
    .sort((a, b) => b.n - a.n);
}

export async function getGateTriggeredCounts(): Promise<GateTriggeredEntry[]> {
  const sql = getSql();
  const rows = await sql<{ gate_triggered: string | null }>(
    `SELECT gate_triggered FROM answer_turns WHERE is_golden_run = false`
  );
  return computeGateTriggeredCounts(rows.map((r) => r.gate_triggered));
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Độ trễ (SPEC-P04 §4.4)
// ─────────────────────────────────────────────────────────────────────────

export interface LatencySummary {
  avg_ms: number | null;
  p95_ms: number | null;
}

export function computeLatencySummary(latencies_ms: number[]): LatencySummary {
  if (latencies_ms.length === 0) return { avg_ms: null, p95_ms: null };
  const sorted = [...latencies_ms].sort((a, b) => a - b);
  const avg = sorted.reduce((s, x) => s + x, 0) / sorted.length;
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return { avg_ms: Math.round(avg), p95_ms: Math.round(sorted[Math.max(0, idx)]) };
}

export async function getLatencySummary(): Promise<LatencySummary> {
  const sql = getSql();
  const rows = await sql<{ latency_ms: number }>(
    `SELECT latency_ms FROM answer_turns WHERE is_golden_run = false`
  );
  return computeLatencySummary(rows.map((r) => Number(r.latency_ms)));
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Faithfulness trên Golden (SPEC-P04 §3.1) — BB-06: đọc thẳng cột A3 ghi
// ─────────────────────────────────────────────────────────────────────────

export interface FaithfulnessRow {
  s3_faithfulness: number;
  claims: ClaimVerdict[] | null;
}

export interface FaithfulnessSummary {
  faithfulness_avg: number | null;
  at_or_above_floor: number;
  total_answered: number;
  zero_claim_turns: number;
}

/** `TAU_FAITHFUL` — sàn faithfulness, SAO Y `SPEC-P02` §6.2 (P04-C5: cấm chỉnh để đẹp số). */
export const TAU_FAITHFUL = 0.8;

export function computeFaithfulnessSummary(rows: FaithfulnessRow[]): FaithfulnessSummary {
  const total_answered = rows.length;
  if (total_answered === 0) {
    return { faithfulness_avg: null, at_or_above_floor: 0, total_answered: 0, zero_claim_turns: 0 };
  }
  const sum = rows.reduce((s, r) => s + Number(r.s3_faithfulness), 0);
  const at_or_above_floor = rows.filter((r) => Number(r.s3_faithfulness) >= TAU_FAITHFUL).length;
  const zero_claim_turns = rows.filter((r) => (r.claims?.length ?? 0) === 0).length;
  return {
    faithfulness_avg: Math.round((sum / total_answered) * 10000) / 10000,
    at_or_above_floor,
    total_answered,
    zero_claim_turns,
  };
}

export async function getFaithfulnessSummary(): Promise<FaithfulnessSummary> {
  const sql = getSql();
  const rows = await sql<{ s3_faithfulness: number; claims: ClaimVerdict[] | null }>(
    `SELECT s3_faithfulness, claims FROM answer_turns
     WHERE is_golden_run = true AND decision = 'answer'`
  );
  return computeFaithfulnessSummary(rows);
}

// ─────────────────────────────────────────────────────────────────────────
// 7. M1 / M3 / Relevance trên Golden.
//
// Đ36 (`plan.md` §2, 2026-09-22): cách chấm (7 checkpoint, SAO Y `SPEC-P00`
// §6.5) SỐNG Ở MỘT NƠI DUY NHẤT — `lib/eval/score.ts`. File này KHÔNG còn tự
// tính verdict; chỉ còn tầng truy vấn DB + gọi hàm chấm dùng chung. Xem
// `scripts/eval_golden.mjs` — bên kia import CÙNG module này.
//
// Nguồn số M1/M3/Relevance vẫn KHÁC văn tự `SPEC-P04` §3.2 (bảng
// `golden_results` không tồn tại trong DB, việc tạo nó ngoài phạm vi gói P04
// — xem `evals/golden/rubric.md` §7 để biết lý do và đường lật). Ở ĐÂY chỉ
// đổi CÁCH CHẤM cho khớp `eval_golden.mjs` (Đ36); câu hỏi mở về nguồn
// `golden_results` GIỮ NGUYÊN, chưa được giải quyết ở gói này.
// ─────────────────────────────────────────────────────────────────────────

import {
  judgeFaqCase,
  judgeSafetyCase,
  type FaqCheckpointResult,
  type GoldenFaqCase,
  type GoldenSafetyCase,
  type GoldenTurnRow,
  type SafetyCheckpointResult,
} from "../eval/score.ts";

export type { FaqCheckpointResult, GoldenFaqCase, GoldenSafetyCase, GoldenTurnRow, SafetyCheckpointResult };
export { judgeFaqCase, judgeSafetyCase, viNormalize } from "../eval/score.ts";

export interface GoldenEvalSummary {
  m1: { passed: number; total: number; rate_pct: number | null };
  m3: { passed: number; total: number; rate_pct: number | null };
  relevance: { context_relevance_pct: number | null; answer_relevance_pct: number | null };
  faq_results: FaqCheckpointResult[];
  safety_results: SafetyCheckpointResult[];
}

export function computeGoldenEvalSummary(
  faqCases: GoldenFaqCase[],
  safetyCases: GoldenSafetyCase[],
  turnsByCaseId: Map<string, GoldenTurnRow>
): GoldenEvalSummary {
  const faq_results = faqCases.map((c) => judgeFaqCase(c, turnsByCaseId.get(c.case_id)));
  const safety_results = safetyCases.map((c) => judgeSafetyCase(c, turnsByCaseId.get(c.case_id)));

  const answerable = faq_results.filter((_, i) => faqCases[i].kind === "answerable");
  const m1Passed = answerable.filter((r) => r.pass).length;
  const m1Total = answerable.length;

  const m3Passed = safety_results.filter((r) => r.pass).length;
  const m3Total = safety_results.length;

  const citationTrue = answerable.filter((r) => r.checkpoint_citation === true).length;
  const factTrue = answerable.filter((r) => r.checkpoint_critical_fact === true).length;

  return {
    m1: { passed: m1Passed, total: m1Total, rate_pct: pct(m1Passed, m1Total) },
    m3: { passed: m3Passed, total: m3Total, rate_pct: pct(m3Passed, m3Total) },
    relevance: {
      context_relevance_pct: pct(citationTrue, m1Total),
      answer_relevance_pct: pct(factTrue, m1Total),
    },
    faq_results,
    safety_results,
  };
}

function readJsonlSafe<T>(absPath: string): T[] {
  if (!fs.existsSync(absPath)) return [];
  return fs
    .readFileSync(absPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

/** Đọc `evals/golden/*.jsonl` — CHỈ ĐỌC (luật §2 handoff H08). */
export function loadGoldenCases(): { faq: GoldenFaqCase[]; safety: GoldenSafetyCase[] } {
  const dir = path.join(process.cwd(), "evals", "golden");
  const faq = readJsonlSafe<GoldenFaqCase>(path.join(dir, "golden_faq.jsonl"));
  const safety = readJsonlSafe<GoldenSafetyCase>(path.join(dir, "golden_safety.jsonl"));
  return { faq, safety };
}

export async function getGoldenEvalSummary(): Promise<GoldenEvalSummary> {
  const { faq, safety } = loadGoldenCases();
  const sql = getSql();
  const rows = await sql<{
    golden_case_id: string;
    decision: Decision;
    reason_code: ReasonCode | null;
    gate_triggered: string | null;
    detected_intent: string | null;
    citations: Citation[] | null;
    claims: ClaimVerdict[] | null;
    answer_vi: string | null;
  }>(
    `SELECT DISTINCT ON (a.golden_case_id)
       a.golden_case_id, a.decision, a.reason_code, a.gate_triggered,
       a.detected_intent, a.citations, a.claims, m.content_vi AS answer_vi
     FROM answer_turns a
     LEFT JOIN messages m ON m.id = a.assistant_message_id
     WHERE a.is_golden_run = true AND a.golden_case_id IS NOT NULL
     ORDER BY a.golden_case_id, a.created_at DESC`
  );
  const turnsByCaseId = new Map<string, GoldenTurnRow>(
    rows.map((r) => [
      r.golden_case_id,
      {
        decision: r.decision,
        reason_code: r.reason_code,
        gate_triggered: r.gate_triggered,
        detected_intent: r.detected_intent,
        citations: r.citations ?? [],
        claims: r.claims ?? [],
        answer_vi: r.answer_vi,
      },
    ])
  );
  return computeGoldenEvalSummary(faq, safety, turnsByCaseId);
}

// ─────────────────────────────────────────────────────────────────────────
// 8. Sức khoẻ tri thức (SPEC-P04 §4.4) — tiện ích chưa có nguồn nội quy tin cậy
// ─────────────────────────────────────────────────────────────────────────

export interface KnowledgeGapEntry {
  facility_ids: string[];
  reason: string;
}

export async function getKnowledgeGaps(): Promise<KnowledgeGapEntry[]> {
  const sql = getSql();
  // Tiện ích xuất hiện trong sections nhưng KHÔNG có section nào đủ eligible
  // (E-1..E-4 của 01-CONTRACTS §5) — dấu hiệu "chưa có nguồn nội quy tin cậy".
  const rows = await sql<{ facility_id: string }>(
    `SELECT DISTINCT unnest(s.facility_ids) AS facility_id
     FROM sections s
     JOIN documents d ON d.document_id = s.document_id
     WHERE s.facility_ids <> '{}'
       AND NOT EXISTS (
         SELECT 1 FROM sections s2
         JOIN documents d2 ON d2.document_id = s2.document_id
         WHERE s2.facility_ids && s.facility_ids
           AND d2.status = 'Approved' AND d2.effective_status = 'Current'
           AND d2.allowed_for_rag = true AND s2.is_excluded = false
       )`
  );
  if (rows.length === 0) return [];
  return [{ facility_ids: rows.map((r) => r.facility_id), reason: "Không có nguồn nội quy đủ tin cậy (BB-01)" }];
}
