// lib/auth/password.ts — băm mật khẩu bằng scrypt (OPERATIONS.md §4.1).
// CẤM hardcode mật khẩu ở bất kỳ đâu gọi tới các hàm này.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Băm mật khẩu, trả về chuỗi lưu trong `users.password_hash` dạng `salt:hash` (hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/** Kiểm mật khẩu so với chuỗi đã băm. So sánh bằng `timingSafeEqual`. */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuf = Buffer.from(hashHex, "hex");
  if (storedBuf.length !== derived.length) return false;
  return timingSafeEqual(storedBuf, derived);
}
