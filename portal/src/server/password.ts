import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(plain: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(plain, salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** "scrypt$N$r$p$<salt b64>$<hash b64>" */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(plain, salt, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

// Hash used when the user does not exist, so both paths cost one scrypt
const DUMMY = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEYLEN).toString("base64")}`;

export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored ?? DUMMY).split("$");
  const usable = stored != null && parts.length === 6 && parts[0] === "scrypt";
  const [, n, r, p, saltB64, hashB64] = usable ? parts : DUMMY.split("$");
  const expected = Buffer.from(hashB64, "base64");
  const key = await scrypt(plain, Buffer.from(saltB64, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return usable && expected.length === key.length && timingSafeEqual(expected, key);
}
