import {
  enrichCatalogHighlightCovers,
  resolveSeriesCoverUrl,
} from "@/lib/catalog-covers";
import { isFlameWebNovelSeriesSlug } from "@/lib/flame-series-slug";
import type { CatalogHighlight } from "@/lib/featured-series";
import { getSessionUser } from "@/lib/auth/current-user";
import {
  firstFollowMapValue,
  followRowLookupKeys,
  normalizeContinueReadingSeriesKey,
} from "@/lib/continue-reading-display";
import { displayFollowSeriesTitle } from "@/lib/follow-series-title";
import {
  getHomeLatestAsuraHighlights,
  getHomeLatestFlameHighlights,
} from "@/lib/live-source-browse";
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
  /** Live Flame browse ordered by `last_edit`, cover-enriched when possible. */
  latestFlame: CatalogHighlight[];
  currentUserEmail: string | null;
};

/**
 * Maps recent reads to cover art: prefer the user’s `Follow.coverImageUrl`, then the same live + static resolution as catalog tiles (`resolveSeriesCoverUrl`).
 */
async function attachFollowCoversToRecentReads(
  userId: string,
  reads: Array<{
    id: string;
    seriesSlug: string;
    chapterSlug: string;
    chapterTitle: string | null;
    source: { name: string; id: string; key: string };
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
      seriesTitle: true,
    },
  });

  const key = (sourceId: string, seriesSlug: string) => `${sourceId}:${seriesSlug}`;

  const coverMap = new Map(
    followRows.map((f) => [key(f.sourceId, f.seriesSlug), f.coverImageUrl] as const),
  );

  const titleMap = new Map(
    followRows.map((f) => [key(f.sourceId, f.seriesSlug), displayFollowSeriesTitle(f.seriesTitle)] as const),
  );

  const base = reads.map((r) => {
    const keys = followRowLookupKeys(r.source.id, r.source.key, r.seriesSlug);
    return {
      id: r.id,
      seriesSlug: r.seriesSlug,
      sourceKey: r.source.key,
      seriesTitle: firstFollowMapValue(keys, titleMap),
      chapterSlug: r.chapterSlug,
      chapterTitle: r.chapterTitle,
      sourceName: r.source.name,
      coverImageUrl: firstFollowMapValue(keys, coverMap),
    };
  });

  return Promise.all(
    base.map(async (card) => {
      if (card.coverImageUrl) {
        return card;
      }
      const resolved = await resolveSeriesCoverUrl(card.sourceKey, card.seriesSlug);
      return { ...card, coverImageUrl: resolved };
    }),
  );
}

/** Raw history rows to scan when deduping by series (ordered newest-first). */
const CONTINUE_READING_HISTORY_FETCH = 320;
/** Max distinct series on the home resume list. */
const CONTINUE_READING_MAX_SERIES = 48;

/**
 * Loads home page data from Prisma for initial UI rendering.
 * On connection failures, returns curated catalog + static sources so the page does not throw.
 */
export async function getHomePageData(): Promise<HomePageData> {
  const user = await getSessionUser();

  const [rawAsura, rawFlame] = await Promise.all([
    getHomeLatestAsuraHighlights(),
    getHomeLatestFlameHighlights(),
  ]);
  let latestAsura = rawAsura;
  let latestFlame = rawFlame;
  try {
    [latestAsura, latestFlame] = await Promise.all([
      enrichCatalogHighlightCovers(rawAsura),
      enrichCatalogHighlightCovers(rawFlame),
    ]);
  } catch {
    /* keep live scrape covers */
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
        recentReads: [],
        latestAsura,
        latestFlame,
        currentUserEmail: null,
      };
    }

    const historyRows = await prisma.readingHistory.findMany({
      where: { userId: user.id },
      orderBy: { lastReadAt: "desc" },
      take: CONTINUE_READING_HISTORY_FETCH,
      select: {
        id: true,
        seriesSlug: true,
        chapterSlug: true,
        chapterTitle: true,
        source: { select: { name: true, id: true, key: true } },
      },
    });

    const seenSeries = new Set<string>();
    const recentReadRows: typeof historyRows = [];
    for (const row of historyRows) {
      if (recentReadRows.length >= CONTINUE_READING_MAX_SERIES) {
        break;
      }
      if (row.source.key === "flame-scans" && isFlameWebNovelSeriesSlug(row.seriesSlug)) {
        continue;
      }
      const norm = normalizeContinueReadingSeriesKey(row.source.key, row.seriesSlug);
      const dedupeKey = `${row.source.id}:${norm}`;
      if (seenSeries.has(dedupeKey)) {
        continue;
      }
      seenSeries.add(dedupeKey);
      recentReadRows.push(row);
    }

    const recentReads = await attachFollowCoversToRecentReads(user.id, recentReadRows);

    return {
      sources,
      dbOk: true,
      recentReads,
      latestAsura,
      latestFlame,
      currentUserEmail: user.email,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[getHomePageData] database unavailable: ${message}`);
    return {
      sources: OFFLINE_SOURCES,
      dbOk: false,
      recentReads: [],
      latestAsura,
      latestFlame,
      currentUserEmail: user?.email ?? null,
    };
  }
}
