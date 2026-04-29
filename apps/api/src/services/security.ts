import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_PREFIX = "scrypt";
const PASSWORD_KEY_LENGTH = 32;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `${PASSWORD_PREFIX}$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, encodedHash] = storedHash.split("$");
  if (prefix !== PASSWORD_PREFIX || !salt || !encodedHash) {
    return false;
  }

  const expected = Buffer.from(encodedHash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
