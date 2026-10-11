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
