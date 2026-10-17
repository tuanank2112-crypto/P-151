import type { ReactNode } from "react";
import type { DeptTicket } from "@/lib/dto";

/** Department queue columns (Cleaning/Technical .dc.html cols): stage 3 (routed) · 4 · 5–6 (01-CONTRACTS §3) */
export const COLUMNS: { label: string; dot: string; match: (t: DeptTicket) => boolean }[] = [
  { label: "Cần nhận", dot: "bg-amber-500", match: (t) => t.stage === 3 },
  { label: "Đang xử lý", dot: "bg-blue-600", match: (t) => t.stage === 4 },
  { label: "Hoàn thành", dot: "bg-emerald-600", match: (t) => t.stage >= 5 },
];

export const urgentFirst = (a: DeptTicket, b: DeptTicket) => Number(b.urgent) - Number(a.urgent);

export function Board({ tickets, card }: { tickets: DeptTicket[]; card: (t: DeptTicket) => ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-4">
      {COLUMNS.map((c) => {
        const items = tickets.filter(c.match).sort(urgentFirst);
        return (
          <section
            key={c.label}
            className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200/60 bg-slate-100/50 p-3.5"
            style={{ flex: "1 1 300px" }}
          >
            <div className="flex items-center gap-2 px-1 py-1">
              <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
              <h2 className="m-0 text-[14px] font-bold text-slate-800">{c.label}</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 shadow-xs border border-slate-200/60">
                {items.length}
              </span>
            </div>
            {items.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300/80 bg-white/60 p-6 text-center text-[13px] text-muted">
                Trống
              </div>
            )}
            <div className="scroll-list flex flex-col gap-3">{items.map(card)}</div>
          </section>
        );
      })}
    </div>
  );
}
