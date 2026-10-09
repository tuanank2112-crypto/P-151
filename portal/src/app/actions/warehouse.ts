"use server";

import { fail } from "@/lib/result";
import { act, id, num, str } from "@/server/act";
import { api } from "@/server/backend";

/** Receiving stock restarts tickets waiting for that material (backend side) */
export async function receiveStockAction(code: string, qty: number) {
  const item = id(code);
  const n = num(qty);
  if (!item || !(n > 0)) return fail("INVALID_INPUT", "Số lượng nhập phải lớn hơn 0.");
  return act(async () => {
    await api(`/mo/warehouse/stock/${encodeURIComponent(item)}`, { json: { qty: n } });
    return null;
  });
}

/**
 * Approve a department's material plan (SPEC-P04 §2): warehouse or BQL. The backend answers 409 STOCK_SHORT with the
 * missing quantity when stock is not enough; the ticket then resumes (ON_HOLD -> IN_PROGRESS).
 */
export async function approveMaterialsAction(ticketId: string, note?: string) {
  const tid = id(ticketId);
  if (!tid) return fail("INVALID_INPUT");
  const text = str(note);
  return act(async () => {
    await api(`/mo/tickets/${tid}/materials/approve`, { json: text ? { note: text } : {} });
    return null;
  });
}

/** New catalog item (`POST /mo/warehouse/items`), then the opening stock when qty > 0 */
export async function addStockItemAction(input: { name: string; unit: string; qty: number }) {
  const name = str(input?.name);
  const unit = str(input?.unit);
  const qty = num(input?.qty);
  if (!name || !unit) return fail("INVALID_INPUT", "Vui lòng nhập tên và đơn vị vật tư.");
  return act(async () => {
    const created = await api<{ item_code: string }>("/mo/warehouse/items", { json: { item_name: name, unit } });
    if (qty > 0) await api(`/mo/warehouse/stock/${encodeURIComponent(created.item_code)}`, { json: { qty } });
    return { code: created.item_code };
  });
}
