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

export async function approveInspectionAction(id: number) {
  return act((db, actor) => wf.approveInspection(db, actor, toId(id)));
}

export async function rejectInspectionAction(id: number, reason?: string) {
  return act((db, actor) => wf.rejectInspection(db, actor, toId(id), reason));
}

export async function bqlDecideWrongDeptAction(id: number, choice: "TO_BPTN" | "KEEP") {
  return act((db, actor) => wf.bqlDecideWrongDept(db, actor, toId(id), choice));
}
