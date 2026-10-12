/** Signed session cookie value (SPEC-P02 §2): base64url(JSON payload) "." base64url(HMAC-SHA256). Pure, no framework imports. */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "@/lib/constants";

export type SessionUser = {
  username: string;
  name: string;
  role: Role;
  actorId: string;
  departmentId: string | null;
  tower: string;
  floor: string;
  apartment: string;
};

/** t = backend bearer token, u = who, exp = epoch ms */
export type SessionPayload = { t: string; u: SessionUser; exp: number };

const mac = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

export function verifySession(value: string | undefined | null, secret: string, now = Date.now()): SessionPayload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = Buffer.from(mac(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload?.t !== "string" || typeof payload?.exp !== "number" || !payload.u) return null;
    return payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}
