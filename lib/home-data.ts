import type { CatalogHighlight } from "@/lib/featured-series";
import {
  getHomeLatestAsuraHighlights,
} from "@/lib/live-source-browse";
import { prisma } from "@/lib/prisma";
import { SUPPORTED_SOURCE_KEYS } from "@/lib/supported-sources";

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
];

/**
 * Resume row for signed-in users (cover from the user's follow row when set).
 */
export type ContinueReadingCard = {
  id: string;
  seriesSlug: string;
  /** Source `key` (e.g. `asura-scans`) for slug normalization and display helpers. */
  sourceKey: string;
  /** From the user’s follow row when present; otherwise null and the UI derives a label from the slug. */
  seriesTitle: string | null;
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
  recentReads: ContinueReadingCard[];
  /** Live Asura browse (first page order), cover-enriched when possible. */
  latestAsura: CatalogHighlight[];
  currentUserEmail: string | null;
};

// `attachFollowCoversToRecentReads` function removed along with its dependencies
// as it will be moved to the personalized API route.

export async function getHomePageData(): Promise<HomePageData> {
  // Cover URLs are already embedded at browse-parse time and cached per-slug (daily TTL);
  // the separate enrichCatalogHighlightCovers pass was removed to avoid per-request outbound fetches.
  const latestAsura = await getHomeLatestAsuraHighlights();

  try {
    const sources = await prisma.source.findMany({
      where: {
        key: {
          in: [...SUPPORTED_SOURCE_KEYS],
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        baseUrl: true,
        isEnabled: true,
      },
    });

    return {
      sources,
      dbOk: true,
      recentReads: [], // Moved to client-side API
      latestAsura,
      currentUserEmail: null, // Moved to client-side API
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[getHomePageData] database unavailable: ${message}`);
    return {
      sources: OFFLINE_SOURCES,
      dbOk: false,
      recentReads: [],
      latestAsura,
      currentUserEmail: null,
    };
  }
}
