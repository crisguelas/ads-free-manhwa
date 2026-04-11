/**
 * HttpOnly cookie name for the signed session JWT.
 */
export const SESSION_COOKIE = "manhwa_session";

/**
 * Standard options for setting the session cookie on the response.
 */
export function buildSessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
