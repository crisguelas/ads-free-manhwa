import { prisma } from "@/lib/prisma";
import { resolveSeriesContextForUser } from "@/lib/reader-data";

type JsonBookmarkCreate = {
  seriesSlug?: unknown;
  chapterSlug?: unknown;
  chapterTitle?: unknown;
};

/**
 * Validates bookmark create payload from the API route.
 */
export function parseBookmarkCreateBody(
  json: unknown,
): { ok: true; seriesSlug: string; chapterSlug: string; chapterTitle: string | null } | { ok: false; message: string } {
  if (!json || typeof json !== "object") {
    return { ok: false, message: "Expected JSON object." };
  }
  const o = json as JsonBookmarkCreate;
  const seriesSlug = typeof o.seriesSlug === "string" ? o.seriesSlug.trim() : "";
  const chapterSlug = typeof o.chapterSlug === "string" ? o.chapterSlug.trim() : "";
  if (!seriesSlug || !chapterSlug) {
    return { ok: false, message: "seriesSlug and chapterSlug are required." };
  }
  const chapterTitle =
    typeof o.chapterTitle === "string" && o.chapterTitle.trim().length > 0
      ? o.chapterTitle.trim()
      : null;
  return { ok: true, seriesSlug, chapterSlug, chapterTitle };
}

/**
 * Creates or updates a chapter bookmark for the signed-in user after resolving source ownership.
 */
export async function upsertBookmarkForUser(
  userId: string,
  params: { seriesSlug: string; chapterSlug: string; chapterTitle: string | null },
): Promise<
  { ok: true; bookmarkId: string } | { ok: false; message: string; status: number }
> {
  const resolved = await resolveSeriesContextForUser(params.seriesSlug, userId);
  if (!resolved) {
    return { ok: false, message: "Series not found for this account.", status: 404 };
  }

  const row = await prisma.bookmark.upsert({
    where: {
      userId_sourceId_seriesSlug_chapterSlug: {
        userId,
        sourceId: resolved.sourceId,
        seriesSlug: resolved.seriesSlug,
        chapterSlug: params.chapterSlug,
      },
    },
    update: {
      chapterTitle: params.chapterTitle,
      lastAccessedAt: new Date(),
    },
    create: {
      userId,
      sourceId: resolved.sourceId,
      seriesSlug: resolved.seriesSlug,
      chapterSlug: params.chapterSlug,
      chapterTitle: params.chapterTitle,
      chapterUrl: null,
      pageNumber: 1,
    },
    select: { id: true },
  });

  return { ok: true, bookmarkId: row.id };
}

/**
 * Deletes a bookmark by id when it belongs to the user.
 */
export async function deleteBookmarkByIdForUser(
  userId: string,
  bookmarkId: string,
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const row = await prisma.bookmark.findFirst({
    where: { id: bookmarkId, userId },
    select: { id: true },
  });
  if (!row) {
    return { ok: false, message: "Bookmark not found.", status: 404 };
  }
  await prisma.bookmark.delete({ where: { id: bookmarkId } });
  return { ok: true };
}
