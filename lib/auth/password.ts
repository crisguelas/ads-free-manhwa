import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

/**
 * Produces a bcrypt hash suitable for storing in `User.passwordHash` (sync for seeds and route handlers).
 */
export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

/**
 * Verifies a password against a stored hash (bcrypt or legacy SHA-256 hex from early seeds).
 */
export function verifyPassword(plain: string, storedHash: string): boolean {
  if (storedHash.startsWith("$2")) {
    return bcrypt.compareSync(plain, storedHash);
  }
  const legacy = createHash("sha256").update(plain).digest("hex");
  return legacy === storedHash.toLowerCase();
}
