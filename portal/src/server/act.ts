import "server-only";
import { refresh } from "next/cache";
import { db } from "@/db";
import type { Db } from "@/db/client";
import { fail, type ActionResult } from "@/lib/result";
import type { Actor } from "./workflow";
import { getSessionUser } from "./session";

/** Re-reads the session inside every action (never trusts the client), runs the workflow, refreshes the router on success */
export async function act<T>(fn: (db: Db, actor: Actor) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return fail("UNAUTHENTICATED");
  const result = await fn(db, user);
  if (result.ok) refresh();
  return result;
}

export const toId = (v: unknown): number => (typeof v === "number" ? v : Number.NaN);
