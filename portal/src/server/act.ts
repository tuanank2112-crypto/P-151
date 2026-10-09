import "server-only";
import { refresh } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { BackendError, BackendUnavailable } from "./backend-error";
import { getSessionUser, type SessionUser } from "./session";

/**
 * Re-reads the session inside every action (never trusts the client), runs `fn`, maps backend errors to an
 * ActionResult and refreshes the router on success. Permissions are the backend's job (I-02).
 */
export async function act<T>(fn: (user: SessionUser) => Promise<T>): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return fail("UNAUTHENTICATED");
  try {
    const data = await fn(user);
    refresh();
    return ok(data);
  } catch (e) {
    if (e instanceof BackendError) return fail(e.code, e.message);
    if (e instanceof BackendUnavailable) return fail("CONFLICT", "Không kết nối được máy chủ");
    throw e;
  }
}

/** Server-action argument guards: the client is not trusted to send the right types */
export const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
export const id = (v: unknown): string => (typeof v === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(v) ? v : "");
export const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number.NaN);
