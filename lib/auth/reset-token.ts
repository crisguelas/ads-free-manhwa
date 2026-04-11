import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Raw token length in bytes (hex string length will be 2× this). */
export const RESET_TOKEN_BYTES = 32;

/**
 * SHA-256 hex digest of the raw token; stored in the database instead of the plaintext token.
 */
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * Generates a new unpredictable reset token (hex string).
 */
export function generateResetTokenRaw(): string {
  return randomBytes(RESET_TOKEN_BYTES).toString("hex");
}

/**
 * Constant-time comparison of a presented token against a stored hash.
 */
export function verifyResetTokenAgainstStoredHash(
  rawToken: string,
  storedHashHex: string,
): boolean {
  const computed = hashResetToken(rawToken);
  if (computed.length !== storedHashHex.length) {
    return false;
  }
  try {
    return timingSafeEqual(
      Buffer.from(computed, "utf8"),
      Buffer.from(storedHashHex, "utf8"),
    );
  } catch {
    return false;
  }
}

/**
 * Accepts only 64-char hex strings (256-bit token in hex).
 */
export function isValidResetTokenFormat(raw: string): boolean {
  return /^[a-f0-9]{64}$/i.test(raw);
}
