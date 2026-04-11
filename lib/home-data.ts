import { enrichCatalogHighlightCovers } from "@/lib/catalog-covers";
import { CATALOG_HIGHLIGHTS, type CatalogHighlight } from "@/lib/featured-series";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

/**
 * Static source rows used when the database is unreachable so the browse UI still renders.
 */
const OFFLINE_SOURCES: HomePageData["sources"] = [
  {
    id: "offline-asura-scans",
    key: "asura-scans",
    name: "Asura Scans",
    baseUrl: "https://asuracomic.net",
    isEnabled: true,
  },
  {
    id: "offline-flame-scans",
    key: "flame-scans",
    name: "Flame Comics",
    baseUrl: "https://flamecomics.xyz/",
    isEnabled: true,
  },
];

/**
 * Resume row for signed-in users (cover from the user's follow row when set).
 */
export type ContinueReadingCard = {
  id: string;
  seriesSlug: string;
  chapterSlug: string;
  chapterTitle: string | null;
  sourceName: string;
  coverImageUrl: string | null;
};

/**
 * Represents grouped data required by the home page.
 */
export type HomePageData = {
  sources: Array<{
    id: string;
    key: string;
    name: string;
    baseUrl: string;
    isEnabled: boolean;
  }>;
  /** False when Prisma failed (network/TLS/etc.); signed-in lists may be empty despite a valid session. */
  dbOk: boolean;
  follows: Array<{
    id: string;
    seriesSlug: string;
    seriesTitle: string;
    sourceName: string;
    coverImageUrl: string | null;
  }>;
  recentReads: ContinueReadingCard[];
  /**
   * Static curated links for the browse grid (no DB catalog table).
   */
  catalogHighlights: CatalogHighlight[];
  currentUserEmail: string | null;
};

/**
 * Maps recent reads to cover art using the same user's follow rows only (no SeriesCache).
 */
async function attachFollowCoversToRecentReads(
  userId: string,
  reads: Array<{
    id: string;
    seriesSlug: string;
    chapterSlug: string;
    chapterTitle: string | null;
    source: { name: string; id: string };
  }>,
): Promise<ContinueReadingCard[]> {
  if (reads.length === 0) {
    return [];
  }

  const followRows = await prisma.follow.findMany({
    where: { userId },
    select: {
      sourceId: true,
      seriesSlug: true,
      coverImageUrl: true,
    },
  });

  const coverMap = new Map(
    followRows.map((f) => [`${f.sourceId}:${f.seriesSlug}`, f.coverImageUrl] as const),
  );

  return reads.map((r) => ({
    id: r.id,
    seriesSlug: r.seriesSlug,
    chapterSlug: r.chapterSlug,
    chapterTitle: r.chapterTitle,
    sourceName: r.source.name,
    coverImageUrl: coverMap.get(`${r.source.id}:${r.seriesSlug}`) ?? null,
  }));
}

/**
 * Loads home page data from Prisma for initial UI rendering.
 * On connection failures, returns curated catalog + static sources so the page does not throw.
 */
export async function getHomePageData(): Promise<HomePageData> {
  const user = await getSessionUser();
  let catalogHighlights: CatalogHighlight[] = CATALOG_HIGHLIGHTS;
  try {
    catalogHighlights = await enrichCatalogHighlightCovers(CATALOG_HIGHLIGHTS);
  } catch {
    catalogHighlights = CATALOG_HIGHLIGHTS;
  }

  try {
    const sources = await prisma.source.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        baseUrl: true,
        isEnabled: true,
      },
    });

    if (!user) {
      return {
        sources,
        dbOk: true,
        follows: [],
        recentReads: [],
        catalogHighlights,
        currentUserEmail: null,
      };
    }

    const [followRows, recentReadRows] = await Promise.all([
      prisma.follow.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          seriesSlug: true,
          seriesTitle: true,
          coverImageUrl: true,
          source: { select: { name: true } },
        },
      }),
      prisma.readingHistory.findMany({
        where: { userId: user.id },
        orderBy: { lastReadAt: "desc" },
        take: 12,
        select: {
          id: true,
          seriesSlug: true,
          chapterSlug: true,
          chapterTitle: true,
          source: { select: { name: true, id: true } },
        },
      }),
    ]);

    const recentReads = await attachFollowCoversToRecentReads(user.id, recentReadRows);

    return {
      sources,
      dbOk: true,
      follows: followRows.map((entry) => ({
        id: entry.id,
        seriesSlug: entry.seriesSlug,
        seriesTitle: entry.seriesTitle,
        sourceName: entry.source.name,
        coverImageUrl: entry.coverImageUrl,
      })),
      recentReads,
      catalogHighlights,
      currentUserEmail: user.email,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[getHomePageData] database unavailable: ${message}`);
    return {
      sources: OFFLINE_SOURCES,
      dbOk: false,
      follows: [],
      recentReads: [],
      catalogHighlights,
      currentUserEmail: user?.email ?? null,
    };
  }
}
