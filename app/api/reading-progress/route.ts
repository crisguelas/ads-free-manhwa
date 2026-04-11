import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/current-user";
import {
  parseReadingProgressBody,
  upsertReadingProgress,
} from "@/lib/reading-progress";

/**
 * Accepts JSON progress updates from the chapter reader (debounced scroll + `sendBeacon` on leave).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseReadingProgressBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const result = await upsertReadingProgress(parsed.value, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
