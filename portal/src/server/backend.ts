import "server-only";
import { clearSessionCookie, getToken } from "./session";
import { BackendError, BackendUnavailable, errorFrom } from "./backend-error";

export { BackendError, BackendUnavailable, errorFrom };

const TIMEOUT_MS = 15_000;

export type ApiInit = {
  method?: "GET" | "POST";
  json?: unknown;
  form?: FormData;
  /** undefined = the session token; null = no Authorization header (login) */
  token?: string | null;
  query?: Record<string, string | undefined>;
};

function urlFor(path: string, query?: Record<string, string | undefined>): string {
  const base = process.env.BACKEND_URL;
  if (!base) throw new BackendUnavailable("BACKEND_URL chưa cấu hình");
  const url = new URL(`${base.replace(/\/+$/, "")}/api/v1${path}`);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, v);
  return url.toString();
}

async function send(path: string, init: ApiInit): Promise<Response> {
  const token = init.token === undefined ? await getToken() : init.token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  try {
    return await fetch(urlFor(path, init.query), {
      method: init.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof BackendUnavailable) throw e;
    throw new BackendUnavailable();
  }
}

/** JSON call to the backend. Never logs the token or the request body (resident text). */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await send(path, init);
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  if (res.status >= 500) throw new BackendUnavailable(`Máy chủ trả lỗi ${res.status}`);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const err = errorFrom(res.status, body);
  if (res.status === 401 && init.token !== null) await clearSessionCookie();
  throw err;
}

/** Raw response (photos). The caller handles the status. */
export async function apiRaw(path: string, token: string): Promise<Response> {
  return send(path, { token });
}
