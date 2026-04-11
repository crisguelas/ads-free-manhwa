import { SignJWT, jwtVerify } from "jose";

const MIN_SECRET_LEN = 32;

/**
 * Returns the HS256 key or null when auth is not configured (verification then fails open to null session).
 */
function getSecretKey(): Uint8Array | null {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s || s.length < MIN_SECRET_LEN) {
    return null;
  }
  return new TextEncoder().encode(s);
}

/**
 * Creates a JWT bound to the user for the session cookie (30-day expiry).
 */
export async function signSessionToken(userId: string, email: string): Promise<string> {
  const key = getSecretKey();
  if (!key) {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters; cannot sign sessions.",
    );
  }
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

/**
 * Validates a session JWT and returns subject (user id) and email, or null if invalid/expired.
 */
export async function verifySessionToken(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  const key = getSecretKey();
  if (!key) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, key);
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!sub || !email) {
      return null;
    }
    return { userId: sub, email };
  } catch {
    return null;
  }
}
