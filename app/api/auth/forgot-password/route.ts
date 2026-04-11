import { NextResponse } from "next/server";
import { getAppBaseUrlFromRequest } from "@/lib/auth/app-base-url";
import { requestPasswordReset } from "@/lib/auth/password-reset";

const GENERIC_OK_MESSAGE =
  "If an account exists for that email address, we’ve sent instructions to reset your password. The message may take a few minutes to arrive—please check your spam or junk folder if you don’t see it.";

/**
 * Starts a password reset (always responds the same to avoid email enumeration).
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

  if (!emailRaw) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
  }

  const baseUrl = getAppBaseUrlFromRequest(request);
  await requestPasswordReset(emailRaw, baseUrl);

  return NextResponse.json({ ok: true, message: GENERIC_OK_MESSAGE });
}
