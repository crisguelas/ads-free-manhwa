import { prisma } from "@/lib/prisma";
import { CATALOG_HIGHLIGHTS } from "@/lib/featured-series";
import { displayFollowSeriesTitle } from "@/lib/follow-series-title";
import { resolveSeriesContextForUser } from "@/lib/reader-data";

/**
 * One bookmark row for the bookmarks list UI (chapter deep-link + metadata).
 */
export type BookmarkListEntry = {
  id: string;
  seriesSlug: string;
  chapterSlug: string;
  chapterTitle: string | null;
  pageNumber: number | null;
  bookmarkedAt: Date;
  sourceName: string;
  sourceKey: string;
  seriesTitle: string;
  coverImageUrl: string | null;
};

/**
 * Fetches a user’s bookmarks newest-first for the `/bookmarks` page.
 */
export async function getBookmarksForUser(userId: string): Promise<BookmarkListEntry[]> {
  const rows = await prisma.bookmark.findMany({
    where: { userId },
    orderBy: { bookmarkedAt: "desc" },
    select: {
      id: true,
      seriesSlug: true,
      chapterSlug: true,
      chapterTitle: true,
      pageNumber: true,
      bookmarkedAt: true,
      sourceId: true,
      source: { select: { name: true, key: true } },
    },
  });

  if (rows.length === 0) {
    return [];
  }

  // Pre-fetch Follows and SeriesCache for metadata resolution
  const seriesSlugs = Array.from(new Set(rows.map((r) => r.seriesSlug)));
  
  const [follows, caches] = await Promise.all([
    prisma.follow.findMany({
      where: { userId, seriesSlug: { in: seriesSlugs } },
      select: { seriesSlug: true, sourceId: true, seriesTitle: true, coverImageUrl: true }
    }),
    prisma.seriesCache.findMany({
      where: { seriesSlug: { in: seriesSlugs } },
      select: { seriesSlug: true, sourceId: true, title: true, coverImageUrl: true }
    })
  ]);

  // Build synchronous part
  const entries = rows.map((r) => {
    let seriesTitle = r.seriesSlug;
    let coverImageUrl: string | null = null;

    const follow = follows.find((f) => f.seriesSlug === r.seriesSlug && f.sourceId === r.sourceId);
    const cache = caches.find((c) => c.seriesSlug === r.seriesSlug && c.sourceId === r.sourceId);
    const highlight = CATALOG_HIGHLIGHTS.find((h) => h.seriesSlug === r.seriesSlug);

    if (follow) {
      seriesTitle = displayFollowSeriesTitle(follow.seriesTitle);
      coverImageUrl = follow.coverImageUrl;
    } else if (cache) {
      seriesTitle = displayFollowSeriesTitle(cache.title);
      coverImageUrl = cache.coverImageUrl;
    } else if (highlight) {
      seriesTitle = highlight.title;
      coverImageUrl = highlight.coverImageUrl;
    }

    return {
      id: r.id,
      seriesSlug: r.seriesSlug,
      chapterSlug: r.chapterSlug,
      chapterTitle: r.chapterTitle,
      pageNumber: r.pageNumber,
      bookmarkedAt: r.bookmarkedAt,
      sourceName: r.source.name,
      sourceKey: r.source.key,
      seriesTitle,
      coverImageUrl,
      _needsResolution: !coverImageUrl,
    };
  });

  // Resolve any entries that are missing their cover image via reader-data's live context resolution
  await Promise.all(
    entries
      .filter((e) => e._needsResolution)
      .map(async (e) => {
        const resolved = await resolveSeriesContextForUser(e.seriesSlug, userId);
        if (resolved) {
          if (resolved.coverImageUrl) {
            e.coverImageUrl = resolved.coverImageUrl;
          }
          if (resolved.seriesTitle && resolved.seriesTitle !== e.seriesSlug) {
            e.seriesTitle = resolved.seriesTitle;
          }
        }
      })
  );

  return entries.map(({ _needsResolution, ...clean }) => clean);
}
