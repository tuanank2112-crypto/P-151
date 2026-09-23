// app/(bql)/dashboard/page.tsx — URL /dashboard. Tỉ lệ tự động giải quyết,
// tách theo intent và lý do escalate (R10, SPEC-P04 §4). Đọc thẳng
// `answer_turns` bằng SQL qua `lib/adapters/metrics-store.ts` — không gọi
// model nào (BB-06).
import {
  getAutoResolutionSummary,
  getGateTriggeredCounts,
  getIntentBreakdown,
  getKnowledgeGaps,
  getLatencySummary,
  getReasonCodeBreakdown,
} from "../../../lib/adapters/metrics-store.ts";
import { reasonMessageVi } from "../../../lib/reason-messages.ts";

export const dynamic = "force-dynamic";

function fmtPct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(2)}%`;
}

export default async function DashboardPage() {
  const [auto, byIntent, byReason, byGate, latency, gaps] = await Promise.all([
    getAutoResolutionSummary(),
    getIntentBreakdown(),
    getReasonCodeBreakdown(),
    getGateTriggeredCounts(),
    getLatencySummary(),
    getKnowledgeGaps(),
  ]);

  if (auto.total_turns === 0) {
    return (
      <main>
        <h1>Dashboard</h1>
        <p className="metrics-empty">
          Chưa có dữ liệu. Hãy đặt vài câu hỏi ở giao diện cư dân.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Dashboard</h1>

      <section className="metrics-cards" aria-label="Tỉ lệ tự động giải quyết">
        <article className="metrics-card">
          <h2>Tỉ lệ tự động giải quyết</h2>
          <p className="metrics-card__big">{fmtPct(auto.auto_resolution_rate_pct)}</p>
          <p className="metrics-card__sub">
            {auto.auto_resolved}/{auto.total_turns} lượt · hành động {auto.actioned} ·
            clarify {auto.clarified} · escalate {auto.escalated}
          </p>
          <p className="metrics-card__note">Tự động = trả lời + hành động.</p>
        </article>
        <article className="metrics-card">
          <h2>Độ trễ</h2>
          <p className="metrics-card__big">
            {latency.avg_ms === null ? "—" : `${latency.avg_ms}ms`}
          </p>
          <p className="metrics-card__sub">
            TB · P95 {latency.p95_ms === null ? "—" : `${latency.p95_ms}ms`}
          </p>
        </article>
      </section>

      <section aria-label="Theo intent">
        <h2>Theo intent</h2>
        <table className="metrics-table">
          <thead>
            <tr>
              <th>intent</th>
              <th>answer</th>
              <th>action</th>
              <th>clarify</th>
              <th>escalate</th>
              <th>tổng</th>
              <th>tỉ lệ</th>
            </tr>
          </thead>
          <tbody>
            {byIntent.map((row) => (
              <tr key={row.intent}>
                <td>{row.intent}</td>
                <td>{row.answered}</td>
                <td>{row.actioned}</td>
                <td>{row.clarified}</td>
                <td>{row.escalated}</td>
                <td>{row.total}</td>
                <td>{fmtPct(row.rate_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Theo lý do escalate">
        <h2>Theo lý do escalate</h2>
        {byReason.length === 0 ? (
          <p className="metrics-empty">Chưa có lượt escalate nào.</p>
        ) : (
          <ul className="metrics-bars">
            {byReason.map((row) => (
              <li key={row.reason_code} className="metrics-bars__row">
                <span className="metrics-bars__label">{reasonMessageVi(row.reason_code)}</span>
                <span
                  className="metrics-bars__bar"
                  style={{ width: `${Math.max(2, row.share_pct ?? 0)}%` }}
                />
                <span className="metrics-bars__value">
                  {row.n} ({fmtPct(row.share_pct)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Cổng theo gate_triggered">
        <h2>Cổng chặn (gate_triggered)</h2>
        {byGate.length === 0 ? (
          <p className="metrics-empty">Chưa lượt nào bị chặn ở một cổng cụ thể.</p>
        ) : (
          <table className="metrics-table">
            <thead>
              <tr>
                <th>gate</th>
                <th>số lượt</th>
              </tr>
            </thead>
            <tbody>
              {byGate.map((row) => (
                <tr key={row.gate}>
                  <td>{row.gate}</td>
                  <td>{row.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-label="Sức khoẻ tri thức">
        <h2>Sức khoẻ tri thức</h2>
        {gaps.length === 0 ? (
          <p className="metrics-empty">Không phát hiện tiện ích nào thiếu nguồn nội quy.</p>
        ) : (
          <ul>
            {gaps.map((g) => (
              <li key={g.facility_ids.join(",")}>
                {g.facility_ids.join(", ")} — {g.reason}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
