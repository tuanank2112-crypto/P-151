// app/(bql)/eval/page.tsx — URL /eval. Bảng eval faithfulness/relevance trên
// Golden (R9, SPEC-P04 §3). Đọc THẲNG `answer_turns` bằng SQL, KHÔNG gọi model
// nào (BB-06 / Đ08 / P04-C1). Số nội bộ bị BB-05 cấm hiển thị KHÔNG xuất hiện
// ở file này — nhãn hiển thị đến từ `./labels.ts` (VC-07).
import {
  getFaithfulnessSummary,
  getGoldenEvalSummary,
  TAU_FAITHFUL,
} from "../../../lib/adapters/metrics-store.ts";
import { faqCheckpointLabelVi, safetyCheckpointLabelVi } from "./labels.ts";

export const dynamic = "force-dynamic";

function fmtPct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(2)}%`;
}

export default async function EvalPage() {
  const [faithfulness, golden] = await Promise.all([
    getFaithfulnessSummary(),
    getGoldenEvalSummary(),
  ]);

  const hasAnyRun = faithfulness.total_answered > 0 || golden.faq_results.some((r) => r.found);

  return (
    <main>
      <h1>Bảng eval</h1>
      <p>
        Bốn con số đọc thẳng từ bảng <code>answer_turns</code> (lượt Golden,{" "}
        <code>is_golden_run = true</code>) và đối chiếu với bộ Golden{" "}
        <code>evals/golden/*.jsonl</code>. Không có lời gọi model nào chạy khi
        mở trang này.
      </p>

      {!hasAnyRun && (
        <p className="metrics-empty">
          Chưa có lượt đo nào. Chạy <code>npm run eval:golden</code> rồi tải
          lại trang này.
        </p>
      )}

      <section className="metrics-cards" aria-label="Bốn thẻ số chính">
        <article className="metrics-card">
          <h2>M1 — Correct &amp; Grounded Answer Rate</h2>
          <p className="metrics-card__big">{fmtPct(golden.m1.rate_pct)}</p>
          <p className="metrics-card__sub">
            {golden.m1.passed}/{golden.m1.total} case · cổng ≥ 34/40
          </p>
        </article>
        <article className="metrics-card">
          <h2>M3 — Correct Safe Behavior Rate</h2>
          <p className="metrics-card__big">{fmtPct(golden.m3.rate_pct)}</p>
          <p className="metrics-card__sub">
            {golden.m3.passed}/{golden.m3.total} case · cổng ≥ 15/16
          </p>
        </article>
        <article className="metrics-card">
          <h2>Faithfulness (trung bình)</h2>
          <p className="metrics-card__big">
            {faithfulness.faithfulness_avg === null
              ? "—"
              : faithfulness.faithfulness_avg.toFixed(4)}
          </p>
          <p className="metrics-card__sub">
            {faithfulness.at_or_above_floor}/{faithfulness.total_answered} đạt sàn{" "}
            {TAU_FAITHFUL} · zero-claim {faithfulness.zero_claim_turns}
          </p>
        </article>
        <article className="metrics-card">
          <h2>Relevance</h2>
          <p className="metrics-card__big">
            {fmtPct(golden.relevance.context_relevance_pct)} /{" "}
            {fmtPct(golden.relevance.answer_relevance_pct)}
          </p>
          <p className="metrics-card__sub">context / answer, mẫu số {golden.m1.total}</p>
        </article>
      </section>

      <section aria-label="Bảng chi tiết case FAQ">
        <h2>Chi tiết case FAQ (answerable)</h2>
        <table className="metrics-table">
          <thead>
            <tr>
              <th>case_id</th>
              <th>Trạng thái</th>
              <th>Checkpoint fail</th>
            </tr>
          </thead>
          <tbody>
            {golden.faq_results.map((r) => (
              <tr key={r.case_id}>
                <td>{r.case_id}</td>
                <td>{r.found ? (r.pass ? "pass" : "fail") : "chưa chạy"}</td>
                <td>{faqCheckpointLabelVi(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Bảng chi tiết case Safety">
        <h2>Chi tiết case Safety</h2>
        <table className="metrics-table">
          <thead>
            <tr>
              <th>case_id</th>
              <th>Trạng thái</th>
              <th>Checkpoint fail</th>
            </tr>
          </thead>
          <tbody>
            {golden.safety_results.map((r) => (
              <tr key={r.case_id}>
                <td>{r.case_id}</td>
                <td>{r.found ? (r.pass ? "pass" : "fail") : "chưa chạy"}</td>
                <td>{safetyCheckpointLabelVi(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="metrics-note">
        Muốn chạy lại: <code>npm run eval:golden</code> ở terminal (script tốn
        hạn mức Gemini — xem <code>evals/golden/rubric.md</code>).
      </p>
    </main>
  );
}
