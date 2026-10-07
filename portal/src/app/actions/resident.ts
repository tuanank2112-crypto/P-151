"use server";

import { act, toId } from "@/server/act";
import * as wf from "@/server/workflow";

export async function submitTicketAction(fd: FormData) {
  return act(async (db, actor) => {
    const files = fd.getAll("photos").filter((f): f is File => typeof f === "object" && "arrayBuffer" in f);
    const urgent = fd.get("urgent");
    return wf.submitTicket(db, actor, {
      description: String(fd.get("description") ?? ""),
      place: String(fd.get("place") ?? ""),
      placeDetail: String(fd.get("placeDetail") ?? ""),
      urgent: urgent === "true" ? true : urgent === "false" ? false : null,
      photos: await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }))),
    });
  });
}

export async function cancelTicketAction(id: number) {
  return act((db, actor) => wf.cancelTicket(db, actor, toId(id)));
}

export async function addExtraAction(id: number, text: string) {
  return act((db, actor) => wf.addExtra(db, actor, toId(id), String(text ?? "")));
}

export async function acceptTicketAction(id: number) {
  return act((db, actor) => wf.acceptTicket(db, actor, toId(id)));
}

export async function rejectTicketAction(id: number) {
  return act((db, actor) => wf.rejectTicket(db, actor, toId(id)));
}

export async function rateTicketAction(id: number, input: { stars: number; tags: string[]; comment: string }) {
  return act((db, actor) =>
    wf.rateTicket(db, actor, toId(id), {
      stars: Number(input?.stars),
      tags: Array.isArray(input?.tags) ? input.tags.map(String) : [],
      comment: String(input?.comment ?? ""),
    }),
  );
}
