import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, saltHex, keyHex] = encoded.split("$");
  if (algorithm !== "scrypt" || n !== "16384" || r !== "8" || p !== "1" ||
      !/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(keyHex)) {
    return false;
  }
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(actual, expected);
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function sessionCookie(token, { secure = process.env.NODE_ENV === "production", maxAge = 30 * 24 * 60 * 60 } = {}) {
  return `kk_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure = process.env.NODE_ENV === "production") {
  return `kk_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function readSessionCookie(header = "") {
  const value = header.split(";").map((part) => part.trim()).find((part) => part.startsWith("kk_session="));
  return value?.slice("kk_session=".length) || null;
}

export function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: Boolean(user.emailVerifiedAt) };
}
