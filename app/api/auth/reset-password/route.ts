import { NextResponse } from "next/server";
import { completePasswordReset } from "@/lib/auth/password-reset";

/**
 * Completes a reset using the token from the email (or console) link.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const token = typeof record.token === "string" ? record.token.trim() : "";
  const password = typeof record.password === "string" ? record.password : "";

  if (!token || !password) {
    return NextResponse.json(
      { error: "Token and new password are required." },
      { status: 400 },
    );
  }

  const result = await completePasswordReset(token, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Password updated. You can sign in now." });
}
