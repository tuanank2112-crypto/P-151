"use server";

import { act, toId } from "@/server/act";
import * as wf from "@/server/workflow";

export async function assignStaffAction(id: number, staffId: number) {
  return act((db, actor) => wf.assignStaff(db, actor, toId(id), toId(staffId)));
}

export async function finishTicketAction(id: number) {
  return act((db, actor) => wf.finishTicket(db, actor, toId(id)));
}

export async function requestMaterialAction(id: number, item: string) {
  return act((db, actor) => wf.requestMaterial(db, actor, toId(id), String(item ?? "")));
}

export async function receiveMaterialAction(materialId: number) {
  return act((db, actor) => wf.receiveMaterial(db, actor, toId(materialId)));
}
