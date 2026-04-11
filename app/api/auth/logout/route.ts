import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

/**
 * Clears the session cookie (sign out).
 */
export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
