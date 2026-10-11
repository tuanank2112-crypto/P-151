import "server-only";
import type { DeptData } from "@/lib/dto";
import type { SessionUser } from "../session";
import { buildDeptTicket, deptTicketFromSummary, stockMap } from "./build";
import { FINISHED, brief, listTickets, readCases, readCatalog, readStock } from "./shared";

/** Cleaning and technical screens. The backend already scopes `/mo/tickets` to the caller's department. */
export async function deptData(user: SessionUser): Promise<DeptData> {
  const [list, stockRows, catalog] = await Promise.all([listTickets(), readStock(), readCatalog()]);
  const now = new Date();
  const stock = stockMap(stockRows);
  const cases = await readCases(list.filter((s) => !FINISHED.has(s.status)).map((s) => s.ticket_id));
  const byId = new Map(cases.map((c) => [c.ticket.ticket_id, c]));
  const tickets = list.map((s) => {
    const c = byId.get(s.ticket_id);
    return c ? buildDeptTicket(c, catalog.status_labels, stock, now, s) : deptTicketFromSummary(s, now);
  });
  return {
    user: brief(user),
    tickets,
    catalog: stockRows.map((r) => ({ itemCode: r.item_code, itemName: r.item_name, unit: r.unit ?? "", stock: r.qty })),
    customMaterials: catalog.custom_materials_enabled === true,
  };
}
