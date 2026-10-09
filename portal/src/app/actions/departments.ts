"use server";

import { act, toId } from "@/server/act";
import * as wf from "@/server/workflow";

export async function assignStaffAction(id: number, staffId: number) {
  return act((db, actor) => wf.assignStaff(db, actor, toId(id), toId(staffId)));
}

export async function finishTicketAction(id: number, fd?: FormData) {
  return act(async (db, actor) => {
    let evidence: { note?: string; photo?: { name: string; mime: string; data: Uint8Array } } | undefined;
    if (fd) {
      const note = String(fd.get("note") ?? "").trim();
      const photo = fd.get("photo");
      if (photo && typeof photo === "object" && "arrayBuffer" in photo && (photo as File).size > 0) {
        const f = photo as File;
        evidence = {
          note,
          photo: {
            name: f.name,
            mime: f.type || "image/jpeg",
            data: new Uint8Array(await f.arrayBuffer()),
          },
        };
      } else if (note) {
        evidence = { note };
      }
    }
    return wf.finishTicket(db, actor, toId(id), evidence);
  });
}

export async function reportWrongDeptAction(id: number, reason: string) {
  return act((db, actor) => wf.reportWrongDept(db, actor, toId(id), String(reason ?? "")));
}

export async function requestMaterialAction(id: number, item: string) {
  return act((db, actor) => wf.requestMaterial(db, actor, toId(id), String(item ?? "")));
}

export async function receiveMaterialAction(materialId: number) {
  return act((db, actor) => wf.receiveMaterial(db, actor, toId(materialId)));
}

