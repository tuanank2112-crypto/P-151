import "server-only";
import type { UserBrief } from "@/lib/dto";
import { fmtDateTime, initials } from "@/lib/format";
import { toStockAlert, type BStockAlert, type StockAlertDto } from "@/lib/stock-alerts";
import { api, BackendError } from "../backend";
import type { SessionUser } from "../session";
import type { BCase, BCatalog, BStockRow, BSummary } from "./types";

export const brief = (u: SessionUser): UserBrief => ({ name: u.name, avatar: initials(u.name) });

/** Max detail calls per page load and max parallel calls (01 §4) */
export const MAX_DETAIL_CALLS = 30;
const CONCURRENCY = 6;

export async function mapLimit<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return out;
}

export const listTickets = () => api<BSummary[]>("/mo/tickets");
export const readCase = (id: string) => api<BCase>(`/mo/tickets/${encodeURIComponent(id)}`);
export const readStock = () => api<BStockRow[]>("/mo/warehouse/stock");
/** Materials used in the last 7 days, most used first (the warehouse cannot open finished tickets, so the backend sums them) */
export const readUsage = () => api<{ item_code: string; item_name: string; unit: string | null; used_qty: number; tickets: number }[]>("/mo/warehouse/usage");
export const readCatalog = () => api<BCatalog>("/mo/catalog");
/** Plan 20: a failing alert feed (flag off, old backend) never breaks the Technical page */
export async function readStockAlerts(): Promise<StockAlertDto[]> {
  try {
    const rows = await api<BStockAlert[]>("/mo/stock-alerts?unread=true");
    return rows.map((r) => toStockAlert(r, (iso) => fmtDateTime(new Date(iso))));
  } catch {
    return [];
  }
}

/** Detail of at most MAX_DETAIL_CALLS tickets, in list order, 6 at a time. A ticket that vanished meanwhile (404) is skipped; any other error propagates. */
export async function readCases(ids: string[], limit = MAX_DETAIL_CALLS): Promise<BCase[]> {
  const got = await mapLimit(ids.slice(0, limit), async (id) => {
    try {
      return await readCase(id);
    } catch (e) {
      if (e instanceof BackendError && e.status === 404) return null;
      throw e;
    }
  });
  return got.filter((c): c is BCase => c !== null);
}

export const FINISHED = new Set(["CLOSED", "CANCELLED", "MERGED"]);
