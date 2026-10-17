import "server-only";
import type { WarehouseData } from "@/lib/dto";
import type { SessionUser } from "../session";
import { brief, readCatalog, readMaterialRequests, readStock, readUsage } from "./shared";

/** Items created through `POST /mo/warehouse/items` get codes `SIM-MAT-X-<hex>` (SPEC-P01 §3) */
const isCustom = (code: string) => code.startsWith("SIM-MAT-X-");

export async function warehouseData(user: SessionUser): Promise<WarehouseData> {
  const [stockRows, catalog, usage] = await Promise.all([readStock(), readCatalog(), readUsage()]);
  // plan 24: the open requests come from the backend (`GET /mo/warehouse/requests`), not from the ticket list
  const requests = await readMaterialRequests(catalog.departments);
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
    weeklyUsage: usage.slice(0, 5).map((u) => ({ code: u.item_code, name: u.item_name, unit: u.unit ?? "", qty: u.used_qty, tickets: u.tickets })),
    requests,
    customMaterials: catalog.custom_materials_enabled === true,
  };
}
