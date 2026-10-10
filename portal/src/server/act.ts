import "server-only";
import type { Db } from "@/db/client";
import { fail, type ActionResult } from "@/lib/result";
import type { Actor } from "./workflow";

/** Re-reads the session inside every action (never trusts the client), runs the workflow, refreshes the router on success */
export async function act<T>(_fn: (db: Db, actor: Actor) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  void _fn;
  return fail("CONFLICT", "Luồng portal cũ đã ngừng. Vui lòng tải lại giao diện dùng backend Python.");
}

export const toId = (v: unknown): number => (typeof v === "number" ? v : Number.NaN);
