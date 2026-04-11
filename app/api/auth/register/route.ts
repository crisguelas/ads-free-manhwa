import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signSessionToken } from "@/lib/auth/session-token";
import {
  SESSION_COOKIE,
  buildSessionCookieOptions,
} from "@/lib/auth/session-cookie";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;
const MIN_PASSWORD_LEN = 8;
const MAX_DISPLAY_NAME = 80;

/**
 * Creates a new user with a bcrypt password and establishes a session.
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
  const displayNameRaw =
    typeof record.displayName === "string" ? record.displayName.trim() : "";

  if (!emailRaw || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` },
      { status: 400 },
    );
  }

  const displayName =
    displayNameRaw.length > MAX_DISPLAY_NAME
      ? displayNameRaw.slice(0, MAX_DISPLAY_NAME)
      : displayNameRaw || null;

  try {
    const user = await prisma.user.create({
      data: {
        email: emailRaw,
        passwordHash: hashPassword(password),
        displayName,
      },
      select: { id: true },
    });

    let token: string;
    try {
      token = await signSessionToken(user.id, emailRaw);
    } catch {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
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
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    throw e;
  }
}
