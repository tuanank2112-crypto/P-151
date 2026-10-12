import "server-only";
import type { ResidentData } from "@/lib/dto";
import { PLACE_ORDER } from "@/lib/constants";
import { api } from "../backend";
import type { SessionUser } from "../session";
import { buildResidentTicket } from "./build";
import { brief } from "./shared";
import type { BResidentView } from "./types";

/** Resident screen: only `/resident/*` (I-04). One call, no detail reads. */
export async function residentData(user: SessionUser): Promise<ResidentData> {
  const views = await api<BResidentView[]>("/resident/tickets");
  const now = new Date();
  return {
    user: { ...brief(user), tower: user.tower, floor: user.floor, apartment: user.apartment },
    tickets: views.map((v) => buildResidentTicket(v, now)),
    places: PLACE_ORDER,
  };
}
