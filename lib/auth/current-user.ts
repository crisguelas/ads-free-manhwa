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
 */
export async function getSessionUser(): Promise<SessionUser | null> {
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
}
