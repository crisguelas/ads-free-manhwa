import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signSessionToken } from "@/lib/auth/session-token";
import {
  SESSION_COOKIE,
  buildSessionCookieOptions,
} from "@/lib/auth/session-cookie";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

/**
 * Validates credentials and sets the HttpOnly session cookie.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const emailRaw = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const password = typeof record.password === "string" ? record.password : "";

  if (!emailRaw || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: emailRaw },
    select: { id: true, passwordHash: true },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  let token: string;
  try {
    token = await signSessionToken(user.id, emailRaw);
  } catch {
    return NextResponse.json(
      { error: "Server is not configured for sessions (AUTH_SECRET)." },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE,
    token,
    buildSessionCookieOptions(SESSION_MAX_AGE_SEC),
  );
  return res;
}
