import { prisma } from "@/lib/prisma";

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
      source: { select: { name: true, key: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    seriesSlug: r.seriesSlug,
    chapterSlug: r.chapterSlug,
    chapterTitle: r.chapterTitle,
    pageNumber: r.pageNumber,
    bookmarkedAt: r.bookmarkedAt,
    sourceName: r.source.name,
    sourceKey: r.source.key,
  }));
}
