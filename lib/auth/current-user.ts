import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { verifySessionToken } from "@/lib/auth/session-token";

/**
 * Minimal user identity restored from the session cookie (no password fields).
 */
export type SessionUser = {
  id: string;
  email: string;
};

/**
 * Reads and verifies the session cookie; returns null when logged out or misconfigured.
 * Wrapped in React `cache()` so the JWT is verified at most once per SSR request
 * (root layout and page components both call this without duplicate work).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  const payload = await verifySessionToken(raw);
  if (!payload) {
    return null;
  }
  return { id: payload.userId, email: payload.email };
});
