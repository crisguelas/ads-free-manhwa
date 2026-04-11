import test from "node:test";
import assert from "node:assert/strict";
import {
  generateResetTokenRaw,
  hashResetToken,
  isValidResetTokenFormat,
  verifyResetTokenAgainstStoredHash,
} from "@/lib/auth/reset-token";

/**
 * Ensures generated tokens match the expected hex length and validate.
 */
test("generateResetTokenRaw produces a 64-char hex string", () => {
  const t = generateResetTokenRaw();
  assert.equal(t.length, 64);
  assert.ok(isValidResetTokenFormat(t));
});

/**
 * Ensures hashing is stable for the same input.
 */
test("hashResetToken is deterministic", () => {
  const a = hashResetToken("abc");
  const b = hashResetToken("abc");
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

/**
 * Ensures verification accepts the correct raw token for a stored hash.
 */
test("verifyResetTokenAgainstStoredHash succeeds for matching token", () => {
  const raw = generateResetTokenRaw();
  const hash = hashResetToken(raw);
  assert.ok(verifyResetTokenAgainstStoredHash(raw, hash));
  assert.ok(!verifyResetTokenAgainstStoredHash(raw + "x", hash));
});

/**
 * Rejects malformed token strings before hitting the database.
 */
test("isValidResetTokenFormat rejects bad input", () => {
  assert.equal(isValidResetTokenFormat(""), false);
  assert.equal(isValidResetTokenFormat("g".repeat(64)), false);
  assert.equal(isValidResetTokenFormat("a".repeat(63)), false);
});
