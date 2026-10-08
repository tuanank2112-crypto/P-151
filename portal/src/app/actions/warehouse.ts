"use server";

import { act, toId } from "@/server/act";
import * as wf from "@/server/workflow";

export async function receiveStockAction(code: string, qty: number, note?: string) {
  return act((db, actor) => wf.receiveStock(db, actor, String(code ?? ""), Number(qty), note));
}

export async function addStockItemAction(item: {
  code: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minStock?: number;
  location?: string;
}) {
  return act((db, actor) => wf.addStockItem(db, actor, item));
}

export async function approveMaterialAction(materialId: number) {
  return act((db, actor) => wf.approveMaterial(db, actor, toId(materialId)));
}
