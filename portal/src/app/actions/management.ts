"use server";

import { act, toId } from "@/server/act";
import * as wf from "@/server/workflow";

export async function startTicketAction(id: number) {
  return act((db, actor) => wf.startTicket(db, actor, toId(id)));
}

export async function finishBqlTicketAction(id: number) {
  return act((db, actor) => wf.finishTicket(db, actor, toId(id)));
}

export async function reassignTicketAction(id: number, dept: string) {
  return act((db, actor) => wf.reassignTicket(db, actor, toId(id), String(dept)));
}
