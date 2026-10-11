"use server";

import { readinessMessages } from "@/lib/backend-map";
import { fail } from "@/lib/result";
import { act, id, num, str } from "@/server/act";
import { api } from "@/server/backend";
import { BackendError } from "@/server/backend-error";
import type { BCase } from "@/server/data/types";
import { filesOf, photoForm } from "@/server/uploads";

const path = (tid: string, tail: string) => `/mo/tickets/${tid}/${tail}`;
const post = async (url: string, json?: unknown) => {
  await api(url, json === undefined ? { method: "POST" } : { json });
  return null;
};

export async function acceptAction(ticketId: string) {
  const tid = id(ticketId);
  if (!tid) return fail("INVALID_INPUT");
  return act(() => post(path(tid, "accept")));
}

/** ROUTED, wrong department: back to reception */
export async function returnAction(ticketId: string, note: string) {
  const tid = id(ticketId);
  const reason = str(note);
  if (!tid || !reason) return fail("INVALID_INPUT", "Vui lòng nhập lý do.");
  return act(() => post(path(tid, "return"), { note: reason }));
}

/** IN_PROGRESS, wrong department (T16): BQL decides */
export async function reportWrongDeptAction(ticketId: string, note: string) {
  const tid = id(ticketId);
  const reason = str(note);
  if (!tid || !reason) return fail("INVALID_INPUT", "Vui lòng nhập lý do.");
  return act(() => post(path(tid, "wrong-department"), { note: reason }));
}

type UsedInput = { itemCode: string; qty: number };

/**
 * Photos, checklist, materials, note, then `complete` (01 §7). FormData fields: `note`, `photos` (files),
 * `checklist` (repeated template_item_id), `used` (repeated JSON {itemCode, qty}: what the department actually used).
 * `complete` that leaves the ticket IN_PROGRESS is reported as INVALID_INPUT with the translated failing items.
 */
export async function finishTicketAction(ticketId: string, fd: FormData) {
  const tid = id(ticketId);
  if (!tid || !(fd instanceof FormData)) return fail("INVALID_INPUT");
  return act(async () => {
    const files = filesOf(fd, "photos");
    const form = files.length ? photoForm(files) : null;
    const checklist = fd.getAll("checklist").map(str).filter(Boolean);
    const used: UsedInput[] = [];
    for (const raw of fd.getAll("used")) {
      try {
        const u = JSON.parse(String(raw)) as UsedInput;
        if (id(u.itemCode) && Number.isInteger(num(u.qty)) && num(u.qty) > 0) used.push(u);
        else throw new Error();
      } catch {
        throw new BackendError(422, "INVALID_INPUT", "Dữ liệu vật tư đã dùng không hợp lệ.");
      }
    }
    if (form) await api(path(tid, "photos"), { form });
    for (const item of checklist) {
      await api(`${path(tid, "checklist")}/${encodeURIComponent(item)}`, { json: { status: "COMPLETED" } });
    }
    // one atomic call: issued = used, stock moves by the difference; an empty list is allowed for cleaning only
    await api(path(tid, "material-usage"), { json: { lines: used.map((u) => ({ item_code: u.itemCode, used_qty: u.qty })) } });
    const note = str(fd.get("note"));
    if (note) {
      await api(path(tid, "evidence"), { json: { requirement_id: null, evidence_type: "RESULT_NOTE", content_or_metadata: note } });
    }
    const done = await api<BCase>(path(tid, "complete"), { method: "POST" });
    if (done.ticket.status === "IN_PROGRESS") {
      const failing = done.draft?.readiness_evaluation?.failing_items ?? [];
      const why = failing.length ? readinessMessages(failing, done.checklist_items, done.material_lines).join("; ") : "Chưa đủ điều kiện hoàn thành";
      throw new BackendError(422, "INVALID_INPUT", `Chưa thể hoàn thành: ${why}.`, { failing_items: failing });
    }
    return null;
  });
}
