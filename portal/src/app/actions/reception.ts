"use server";

import { act, toId } from "@/server/act";
import * as wf from "@/server/workflow";

export async function routeTicketAction(id: number, dept: string) {
  return act((db, actor) => wf.routeTicket(db, actor, toId(id), String(dept)));
}

export async function setUrgentAction(id: number, urgent: boolean) {
  return act((db, actor) => wf.setUrgent(db, actor, toId(id), urgent === true));
}

export async function askMoreInfoAction(id: number) {
  return act((db, actor) => wf.askMoreInfo(db, actor, toId(id)));
}

export async function mergeTicketAction(sourceId: number, targetId: number) {
  return act((db, actor) => wf.mergeTicket(db, actor, toId(sourceId), toId(targetId)));
}

export async function dismissDuplicateAction(id: number, otherId: number) {
  return act((db, actor) => wf.dismissDuplicate(db, actor, toId(id), toId(otherId)));
}
