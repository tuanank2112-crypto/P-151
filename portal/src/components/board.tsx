import type { ReactNode } from "react";
import type { DeptTicket } from "@/lib/dto";

/** Department queue columns (Cleaning/Technical .dc.html cols): stage 3 (routed) · 4 · 5–6 (01-CONTRACTS §3) */
export const COLUMNS: { label: string; match: (t: DeptTicket) => boolean }[] = [
  { label: "Cần nhận", match: (t) => t.stage === 3 },
  { label: "Đang xử lý", match: (t) => t.stage === 4 },
  { label: "Hoàn thành", match: (t) => t.stage >= 5 },
];

export const urgentFirst = (a: DeptTicket, b: DeptTicket) => Number(b.urgent) - Number(a.urgent);

export function Board({ tickets, card }: { tickets: DeptTicket[]; card: (t: DeptTicket) => ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-4">
      {COLUMNS.map((c) => {
        const items = tickets.filter(c.match).sort(urgentFirst);
        return (
          <section key={c.label} className="flex min-w-0 flex-col gap-3" style={{ flex: "1 1 300px" }}>
            <div className="flex items-center justify-between px-1 py-1.5">
              <h2 className="m-0 text-[15px] font-bold">{c.label}</h2>
              <span className="badge">{items.length}</span>
            </div>
            {items.length === 0 && (
              <div className="card rounded-2xl p-6 text-center text-[13px] text-muted" style={{ border: "1px dashed #C5CEDB" }}>
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
