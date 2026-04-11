import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/current-user";
import {
  deleteBookmarkByIdForUser,
  parseBookmarkCreateBody,
  upsertBookmarkForUser,
} from "@/lib/bookmark-api";

/**
 * Creates or touches a chapter bookmark (series page “save first chapter” action).
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

  const parsed = parseBookmarkCreateBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const result = await upsertBookmarkForUser(user.id, parsed);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true, bookmarkId: result.bookmarkId });
}

/**
 * Deletes a bookmark by id (query `id=`).
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Missing id query parameter." }, { status: 400 });
  }

  const result = await deleteBookmarkByIdForUser(user.id, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
