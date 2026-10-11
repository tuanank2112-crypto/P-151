import "server-only";
import type { WarehouseData } from "@/lib/dto";
import type { SessionUser } from "../session";
import { buildWarehouseRequest, stockMap } from "./build";
import { brief, listTickets, readCases, readCatalog, readStock } from "./shared";

/** Items created through `POST /mo/warehouse/items` get codes `SIM-MAT-X-<hex>` (SPEC-P01 §3) */
const isCustom = (code: string) => code.startsWith("SIM-MAT-X-");

export async function warehouseData(user: SessionUser): Promise<WarehouseData> {
  const [list, stockRows, catalog] = await Promise.all([listTickets(), readStock(), readCatalog()]);
  const now = new Date();
  const stock = stockMap(stockRows);
  const waiting = list.filter((s) => s.status === "ON_HOLD" && s.reason_code === "WAITING_MATERIAL");
  const cases = await readCases(waiting.map((s) => s.ticket_id));
  return {
    user: brief(user),
    inventory: stockRows.map((r) => ({
      code: r.item_code,
      name: r.item_name,
      unit: r.unit ?? "",
      stock: r.qty,
      min: r.min_qty ?? null,
      custom: isCustom(r.item_code),
    })),
    requests: cases
      .map((c) => buildWarehouseRequest(c, stock, catalog.departments, now))
      .filter((r): r is NonNullable<typeof r> => r !== null),
    customMaterials: catalog.custom_materials_enabled === true,
  };
}
