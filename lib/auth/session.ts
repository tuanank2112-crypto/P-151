// lib/auth/session.ts — cookie phiên ký HMAC bằng SESSION_SECRET
// (OPERATIONS.md §4.1, 00-ARCHITECTURE.md §10). Không mở connection, không
// gọi model — không thuộc phạm vi BB-07.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Principal } from "../types";

export const SESSION_COOKIE_NAME = "resident_agent_session";

export interface SessionPayload {
  user_id: string;
  role: Principal["role"];
  resident_id: string | null;
  owned_property_ids: string[];
  property_type: Principal["property_type"];
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET chưa được cấu hình. Xem specs/OPERATIONS.md §3.");
  }
  return secret;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Ký payload phiên, trả về chuỗi `<body>.<chữ ký>` để đặt vào cookie. */
export function createSessionCookie(payload: SessionPayload): string {
  const secret = getSecret();
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(body, secret);
  return `${body}.${signature}`;
}

/**
 * Xác minh giá trị cookie phiên. Trả `null` khi thiếu, sai định dạng, chữ ký
 * không khớp (kể cả lệch một byte), hoặc payload không parse được JSON.
 */
export function verifySessionCookie(
  cookieValue: string | undefined | null
): SessionPayload | null {
  if (!cookieValue) return null;
  const secret = getSecret();
  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex <= 0) return null;
  const body = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  if (!body || !signature) return null;

  const expected = sign(body, secret);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(signatureBuf, expectedBuf)) return null;

  try {
    const json = Buffer.from(body, "base64url").toString("utf8");
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}
