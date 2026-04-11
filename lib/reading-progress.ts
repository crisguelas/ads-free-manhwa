import { prisma } from "@/lib/prisma";

/**
 * Max lengths to keep payloads and DB rows bounded.
 */
const MAX_SLUG_LEN = 512;
const MAX_TITLE_LEN = 512;

/**
 * Body shape accepted by `POST /api/reading-progress` (JSON).
 */
export type ReadingProgressPayload = {
  sourceKey: string;
  seriesSlug: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterUrl: string | null;
  pageNumber: number;
};

/**
 * Parses and validates an unknown JSON body into a `ReadingProgressPayload`, or returns an error message.
 */
export function parseReadingProgressBody(
  input: unknown,
): { ok: true; value: ReadingProgressPayload } | { ok: false; message: string } {
  if (input === null || typeof input !== "object") {
    return { ok: false, message: "Body must be a JSON object." };
  }
  const o = input as Record<string, unknown>;

  const sourceKey = typeof o.sourceKey === "string" ? o.sourceKey.trim() : "";
  const seriesSlug = typeof o.seriesSlug === "string" ? o.seriesSlug.trim() : "";
  const chapterSlug = typeof o.chapterSlug === "string" ? o.chapterSlug.trim() : "";
  const chapterTitle =
    typeof o.chapterTitle === "string" ? o.chapterTitle.trim() : "";
  const chapterUrlRaw = o.chapterUrl;
  const pageRaw = o.pageNumber;

  if (!sourceKey || !seriesSlug || !chapterSlug) {
    return { ok: false, message: "sourceKey, seriesSlug, and chapterSlug are required." };
  }
  if (
    sourceKey.length > MAX_SLUG_LEN ||
    seriesSlug.length > MAX_SLUG_LEN ||
    chapterSlug.length > MAX_SLUG_LEN
  ) {
    return { ok: false, message: "Slug fields are too long." };
  }
  if (chapterTitle.length > MAX_TITLE_LEN) {
    return { ok: false, message: "chapterTitle is too long." };
  }

  let chapterUrl: string | null = null;
  if (chapterUrlRaw === null || chapterUrlRaw === undefined || chapterUrlRaw === "") {
    chapterUrl = null;
  } else if (typeof chapterUrlRaw === "string") {
    const u = chapterUrlRaw.trim();
    if (u.length > 0) {
      if (!URL.canParse(u)) {
        return { ok: false, message: "chapterUrl must be a valid absolute URL when provided." };
      }
      chapterUrl = u;
    }
  } else {
    return { ok: false, message: "chapterUrl must be a string or null." };
  }

  const pageNumber =
    typeof pageRaw === "number" && Number.isInteger(pageRaw)
      ? pageRaw
      : typeof pageRaw === "string"
        ? Number.parseInt(pageRaw, 10)
        : NaN;
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    return { ok: false, message: "pageNumber must be a positive integer." };
  }

  return {
    ok: true,
    value: {
      sourceKey,
      seriesSlug,
      chapterSlug,
      chapterTitle: chapterTitle || chapterSlug,
      chapterUrl,
      pageNumber,
    },
  };
}

/**
 * Upserts `ReadingHistory` for the signed-in user and source; used by the progress API route.
 */
export async function upsertReadingProgress(
  payload: ReadingProgressPayload,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const source = await prisma.source.findFirst({
    where: { key: payload.sourceKey, isEnabled: true },
    select: { id: true },
  });

  if (!source) {
    return {
      ok: false,
      message: "Unknown or disabled sourceKey.",
      status: 400,
    };
  }

  await prisma.readingHistory.upsert({
    where: {
      userId_sourceId_seriesSlug_chapterSlug: {
        userId,
        sourceId: source.id,
        seriesSlug: payload.seriesSlug,
        chapterSlug: payload.chapterSlug,
      },
    },
    update: {
      chapterTitle: payload.chapterTitle,
      chapterUrl: payload.chapterUrl,
      pageNumber: payload.pageNumber,
      lastReadAt: new Date(),
    },
    create: {
      userId,
      sourceId: source.id,
      seriesSlug: payload.seriesSlug,
      chapterSlug: payload.chapterSlug,
      chapterTitle: payload.chapterTitle,
      chapterUrl: payload.chapterUrl,
      pageNumber: payload.pageNumber,
    },
  });

  return { ok: true };
}
