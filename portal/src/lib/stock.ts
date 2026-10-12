export type StockLevel = "unknown" | "out" | "low" | "ok";

/** 01-CONTRACTS §5: unknown stock is never "out"; without a threshold there is no "low" */
export function stockLevel(qty: number | null, min: number | null): StockLevel {
  if (qty === null) return "unknown";
  if (qty <= 0) return "out";
  if (min !== null && qty <= min) return "low";
  return "ok";
}

export const STOCK_BADGE: Record<StockLevel, { label: string; cls: string }> = {
  unknown: { label: "Chưa kiểm kê", cls: "bg-slate-100 text-slate-600" },
  out: { label: "Hết hàng", cls: "bg-rose-100 text-rose-700" },
  low: { label: "Sắp hết", cls: "bg-amber-100 text-amber-800" },
  ok: { label: "An toàn", cls: "bg-emerald-100 text-emerald-700" },
};

/** Plan 19 (D11): the card of the warehouse KPI row follows the worst item: red = at least one out of stock, amber = only "low", green = none to restock */
export type RestockTone = "ok" | "low" | "out";
export function restockTone(levels: StockLevel[]): RestockTone {
  if (levels.includes("out")) return "out";
  return levels.includes("low") ? "low" : "ok";
}

const LEVEL_RANK: Record<StockLevel, number> = { out: 0, low: 1, unknown: 2, ok: 3 };

/** Out of stock first, then low, then not counted yet, then fine; inside a level the emptiest first (stable) */
export function byUrgency<T extends { stock: number | null; min: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ra = LEVEL_RANK[stockLevel(a.stock, a.min)] - LEVEL_RANK[stockLevel(b.stock, b.min)];
    return ra || (a.stock ?? Infinity) - (b.stock ?? Infinity);
  });
}
