import "server-only";
import { redirect } from "next/navigation";
import { BackendError, BackendUnavailable } from "../backend-error";

export type Loaded<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * Page loaders: a dead backend token (401) goes through /api/session/expired, which clears the cookie before /login
 * (otherwise /login would bounce the still-signed cookie back to the dashboard); backend down => a message, not a crash.
 */
export async function safe<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  let expired = false;
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof BackendError && e.status === 401) expired = true;
    else if (e instanceof BackendUnavailable) return { ok: false, message: e.message };
    else if (e instanceof BackendError) return { ok: false, message: e.message };
    else throw e;
  }
  if (expired) redirect("/api/session/expired");
  return { ok: false, message: "" };
}
