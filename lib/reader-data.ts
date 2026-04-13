import { CATALOG_HIGHLIGHTS } from "@/lib/featured-series";
import { getSessionUser } from "@/lib/auth/current-user";
import { pickRowWhenSeriesSlugSpansScanSources } from "@/lib/follow-source-disambiguation";
import { displayFollowSeriesTitle } from "@/lib/follow-series-title";
import { decodeBasicHtmlEntities } from "@/lib/html-entities";
import { buildLiveBrowseCatalogForSource } from "@/lib/live-source-browse";
import { prisma } from "@/lib/prisma";
import { getCachedSeriesPageMeta } from "@/lib/series-synopsis";
import {
  recordCacheSyncFallback,
  recordCacheSyncSuccess,
} from "@/lib/sources/adapter-observability";
import { getSourceAdapter } from "@/lib/sources/registry";

const CHAPTER_CACHE_TTL_MS = 1000 * 60 * 30;

/** Caps how many chapters we cache and show per series (sources can have hundreds of entries). */
const MAX_CACHED_CHAPTERS_PER_SERIES = 500;

/**
 * Derives a numeric reading order from title/slug so lists sort with the story’s beginning first.
 */
function parseGenericChapterSortKey(title: string, slug: string): number {
  const fromTitle = title.match(/Chapter\s+([\d.]+)/i);
  if (fromTitle?.[1]) {
    const n = Number(fromTitle[1]);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  const digits = slug.replace(/[^0-9.]/g, "");
  const n2 = Number.parseFloat(digits);
  if (Number.isFinite(n2)) {
    return n2;
  }
  return Number.MAX_SAFE_INTEGER;
}

type LiveChapterRow = {
  slug: string;
  title: string;
  url: string;
  publishedAt: Date | null;
};

/**
 * Sorts chapter rows ascending by inferred chapter number (earliest episode at index 0).
 */
function sortLiveChaptersReadingOrder(chapters: LiveChapterRow[]): LiveChapterRow[] {
  return [...chapters].sort(
    (a, b) =>
      parseGenericChapterSortKey(a.title, a.slug) -
      parseGenericChapterSortKey(b.title, b.slug),
  );
}

/**
 * With chapters ordered oldest → newest, “previous” is the earlier chapter and “next” is the later one.
 */
function adjacentChapterSlugs(
  chapterList: Array<{ slug: string }>,
  chapterSlug: string,
): { previousChapterSlug: string | null; nextChapterSlug: string | null } {
  const currentIndex = chapterList.findIndex((c) => c.slug === chapterSlug);
  if (currentIndex < 0) {
    return { previousChapterSlug: null, nextChapterSlug: null };
  }
  return {
    previousChapterSlug:
      currentIndex > 0 ? (chapterList[currentIndex - 1]?.slug ?? null) : null,
    nextChapterSlug:
      currentIndex < chapterList.length - 1
        ? (chapterList[currentIndex + 1]?.slug ?? null)
        : null,
  };
}

/**
 * Series + source identity for reader routes: from the user’s library follow, or from the home catalog + `Source` row.
 */
type ResolvedSeriesContext = {
  seriesSlug: string;
  seriesTitle: string;
  sourceId: string;
  sourceKey: string;
  sourceName: string;
  sourceBaseUrl: string;
  /** Poster URL from follow row or curated catalog when available. */
  coverImageUrl: string | null;
};

/**
 * Resolves which source and title apply to `seriesSlug` for this user (also used by bookmark API).
 * Prefer an explicit `Follow`; otherwise curated highlights; otherwise any slug present on the live Asura/Flame browse index (same as home/browse tiles).
 */
export async function resolveSeriesContextForUser(
  seriesSlug: string,
  userId: string,
): Promise<ResolvedSeriesContext | null> {
  const followRows = await prisma.follow.findMany({
    where: {
      seriesSlug: { equals: seriesSlug, mode: "insensitive" },
      userId,
    },
    select: {
      seriesSlug: true,
      seriesTitle: true,
      sourceId: true,
      coverImageUrl: true,
      source: {
        select: {
          key: true,
          name: true,
          baseUrl: true,
        },
      },
    },
  });

  if (followRows.length > 0) {
    const follow = pickRowWhenSeriesSlugSpansScanSources(followRows, seriesSlug);
    return {
      seriesSlug: follow.seriesSlug,
      seriesTitle: displayFollowSeriesTitle(follow.seriesTitle),
      sourceId: follow.sourceId,
      sourceKey: follow.source.key,
      sourceName: follow.source.name,
      sourceBaseUrl: follow.source.baseUrl,
      coverImageUrl: follow.coverImageUrl,
    };
  }

  // Next, check our persistent Database Cache. 
  // This handles everything found via Search or older browse activity.
  const cachedHit = await prisma.seriesCache.findFirst({
    where: {
      seriesSlug: { equals: seriesSlug, mode: "insensitive" },
      source: { isEnabled: true },
    },
    include: { source: { select: { id: true, key: true, name: true, baseUrl: true } } },
  });

  if (cachedHit) {
    return {
      seriesSlug: cachedHit.seriesSlug, // Use the canonical slug from DB
      seriesTitle: decodeBasicHtmlEntities(cachedHit.title).trim(),
      sourceId: cachedHit.source.id,
      sourceKey: cachedHit.source.key,
      sourceName: cachedHit.source.name,
      sourceBaseUrl: cachedHit.source.baseUrl,
      coverImageUrl: cachedHit.coverImageUrl,
    };
  }

  // Smart Fallback 1: Prefix matching (handles Asura hashes being added or changed)
  const fuzzyHit = await prisma.seriesCache.findFirst({
    where: {
      seriesSlug: { startsWith: seriesSlug, mode: "insensitive" },
      source: { isEnabled: true },
    },
    include: { source: { select: { id: true, key: true, name: true, baseUrl: true } } },
  });

  if (fuzzyHit) {
    return {
      seriesSlug: fuzzyHit.seriesSlug,
      seriesTitle: decodeBasicHtmlEntities(fuzzyHit.title).trim(),
      sourceId: fuzzyHit.source.id,
      sourceKey: fuzzyHit.source.key,
      sourceName: fuzzyHit.source.name,
      sourceBaseUrl: fuzzyHit.source.baseUrl,
      coverImageUrl: fuzzyHit.coverImageUrl,
    };
  }

  // Last resort: Live Scrape (only for brand new series not yet in our search/cache maps)
  const [asuraList, flameList] = await Promise.all([
    buildLiveBrowseCatalogForSource("asura-scans"),
    buildLiveBrowseCatalogForSource("flame-scans"),
  ]);
  const asuraHit = asuraList.find((h) => h.seriesSlug.toLowerCase().startsWith(seriesSlug.toLowerCase()));
  const flameHit = flameList.find((h) => h.seriesSlug.toLowerCase().startsWith(seriesSlug.toLowerCase()));
  let liveEntry = asuraHit ?? flameHit;
  if (asuraHit && flameHit) {
    liveEntry = /^\d+$/.test(seriesSlug) ? flameHit : asuraHit;
  }

  if (!liveEntry) {
    // Smart Fallback 2: Direct site resolution (final attempt)
    // If we can't find it in our lists, maybe it's just a new hashed slug we haven't seen.
    // We try to ping Asura / Flame once to see if the page exists or redirects.
    try {
      const sourceRow = await prisma.source.findFirst({
        where: { key: "asura-scans", isEnabled: true },
      });
      if (sourceRow) {
        const url = `${sourceRow.baseUrl}/series/${seriesSlug}`;
        const resp = await fetch(url, { method: "HEAD", redirect: "follow" });
        if (resp.ok) {
          const finalUrl = resp.url;
          const match = finalUrl.match(/\/series\/([^/?#]+)/);
          if (match && match[1] && match[1] !== seriesSlug) {
            // It redirected to a new slug! Update DB and return.
            // (We'll let the next request cache full details)
            return {
              seriesSlug: match[1],
              seriesTitle: seriesSlug, // Fallback title
              sourceId: sourceRow.id,
              sourceKey: sourceRow.key,
              sourceName: sourceRow.name,
              sourceBaseUrl: sourceRow.baseUrl,
              coverImageUrl: null,
            };
          }
        }
      }
    } catch {
      /* ignore resolution failures */
    }

    return null;
  }

  const sourceRow = await prisma.source.findFirst({
    where: {
      key: liveEntry.sourceKey,
      isEnabled: true,
    },
    select: {
      id: true,
      key: true,
      name: true,
      baseUrl: true,
    },
  });

  if (!sourceRow) {
    return null;
  }

  return {
    seriesSlug,
    seriesTitle: decodeBasicHtmlEntities(liveEntry.title).trim(),
    sourceId: sourceRow.id,
    sourceKey: sourceRow.key,
    sourceName: sourceRow.name,
    sourceBaseUrl: sourceRow.baseUrl,
    coverImageUrl: liveEntry.coverImageUrl ?? null,
  };
}

/**
 * Represents series-level data for the manhwa detail page.
 */
export type SeriesDetailData = {
  seriesSlug: string;
  seriesTitle: string;
  sourceKey: string;
  sourceName: string;
  adapterName: string | null;
  sourceBaseUrl: string;
  /** Short series description for the detail hero (meta / Flame JSON / cache). */
  synopsis: string | null;
  coverImageUrl: string | null;
  latestChapterSlug: string | null;
  latestChapterTitle: string | null;
  firstChapterSlug: string | null;
  firstChapterTitle: string | null;
  /** Bookmark row id when the first chapter is bookmarked (for toggle UI). */
  bookmarkIdForFirstChapter: string | null;
  liveChapters: Array<{
    slug: string;
    title: string;
    url: string;
    publishedAt: string | null;
  }>;
  bookmarks: Array<{
    id: string;
    chapterSlug: string;
    chapterTitle: string | null;
    pageNumber: number | null;
  }>;
  recentReads: Array<{
    id: string;
    chapterSlug: string;
    chapterTitle: string | null;
    pageNumber: number | null;
  }>;
  /** Publication status for hero overlay (same normalization as the chapter reader). */
  seriesStatus: SeriesReaderStatus;
};

/**
 * Normalized scan status for reader chrome (ongoing vs finished, etc.).
 */
export type SeriesReaderStatus = {
  label: string;
  variant: "ongoing" | "completed" | "hiatus" | "unknown" | "other";
};

/**
 * Maps raw site status strings into short labels for the reader header.
 */
export function formatSeriesStatusForReader(
  raw: string | null | undefined,
): SeriesReaderStatus {
  if (!raw?.trim()) {
    return { label: "Unknown", variant: "unknown" };
  }
  const s = raw.trim().toLowerCase();
  if (/\b(complete|completed|finished|ended)\b/.test(s)) {
    return { label: "Finished", variant: "completed" };
  }
  if (/\b(ongoing|updating|active|serializing)\b/.test(s)) {
    return { label: "Ongoing", variant: "ongoing" };
  }
  if (/\b(hiatus|paused|cancelled|canceled|dropped)\b/.test(s)) {
    return { label: raw.trim(), variant: "hiatus" };
  }
  return { label: raw.trim(), variant: "other" };
}

/**
 * Represents chapter-level data for the reader page.
 */
export type ChapterReaderData = {
  seriesSlug: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterUrl: string | null;
  sourceKey: string;
  sourceName: string;
  pageNumber: number;
  previousChapterSlug: string | null;
  nextChapterSlug: string | null;
  imageUrls: string[];
  seriesStatus: SeriesReaderStatus;
};

/**
 * Options for opening a chapter in the reader (e.g. ignore saved scroll position).
 */
export type ChapterReaderOptions = {
  /** When true, open at page 1 and skip `ReadingHistory` pageNumber for this visit. */
  fromStart?: boolean;
};

/**
 * Loads `SeriesCache.status` or fetches once from the series page meta cache, then normalizes for UI.
 */
async function resolveSeriesStatusForReader(
  sourceId: string,
  sourceKey: string,
  seriesSlug: string,
): Promise<SeriesReaderStatus> {
  const row = await prisma.seriesCache.findUnique({
    where: {
      sourceId_seriesSlug: {
        sourceId,
        seriesSlug,
      },
    },
    select: { status: true },
  });
  let raw = row?.status?.trim() || null;
  if (!raw) {
    const meta = await getCachedSeriesPageMeta(sourceKey, seriesSlug);
    raw = meta.status?.trim() || null;
    const data: { synopsis?: string; status?: string } = {};
    if (meta.synopsis?.trim()) {
      data.synopsis = meta.synopsis.trim();
    }
    if (meta.status?.trim()) {
      data.status = meta.status.trim();
    }
    if (Object.keys(data).length > 0) {
      await prisma.seriesCache
        .updateMany({
          where: { sourceId, seriesSlug },
          data,
        })
        .catch(() => {
          /* series row may not exist yet */
        });
    }
  }
  return formatSeriesStatusForReader(raw);
}

/**
 * Checks whether a cache timestamp is still within the freshness window.
 */
function isCacheFresh(lastSyncedAt: Date): boolean {
  return Date.now() - lastSyncedAt.getTime() <= CHAPTER_CACHE_TTL_MS;
}

/**
 * Writes adapter chapter results into chapter cache using idempotent upserts.
 */
async function syncAdapterChaptersToCache(params: {
  sourceId: string;
  seriesSlug: string;
  seriesTitle: string;
  chapters: Array<{
    slug: string;
    title: string;
    url: string;
    chapterLabel?: string;
  }>;
}): Promise<void> {
  const { sourceId, seriesSlug, seriesTitle, chapters } = params;
  if (chapters.length === 0) {
    return;
  }

  await prisma.seriesCache.upsert({
    where: {
      sourceId_seriesSlug: {
        sourceId,
        seriesSlug,
      },
    },
    update: {
      title: seriesTitle,
      lastSyncedAt: new Date(),
    },
    create: {
      sourceId,
      seriesSlug,
      title: seriesTitle,
      genres: [],
      lastSyncedAt: new Date(),
    },
  });

  await Promise.all(
    chapters.slice(0, MAX_CACHED_CHAPTERS_PER_SERIES).map((chapter) =>
      prisma.chapterCache.upsert({
        where: {
          sourceId_seriesSlug_chapterSlug: {
            sourceId,
            seriesSlug,
            chapterSlug: chapter.slug,
          },
        },
        update: {
          title: chapter.title,
          chapterUrl: chapter.url,
          chapterLabel: chapter.chapterLabel ?? chapter.slug,
          lastSyncedAt: new Date(),
        },
        create: {
          sourceId,
          seriesSlug,
          chapterSlug: chapter.slug,
          title: chapter.title,
          chapterUrl: chapter.url,
          chapterLabel: chapter.chapterLabel ?? chapter.slug,
          lastSyncedAt: new Date(),
        },
      }),
    ),
  );
}

/**
 * Loads detail page data for a given series slug.
 */
export async function getSeriesDetailData(
  seriesSlug: string,
): Promise<SeriesDetailData | null> {
  const user = await getSessionUser();
  if (!user) {
    return null;
  }

  const resolved = await resolveSeriesContextForUser(seriesSlug, user.id);
  if (!resolved) {
    return null;
  }

  const adapter = getSourceAdapter(resolved.sourceKey);

  const userScope = { userId: user.id };

  const [cachedChapters, bookmarks, recentReads, seriesCacheRow] = await Promise.all([
    prisma.chapterCache.findMany({
      where: {
        sourceId: resolved.sourceId,
        seriesSlug,
      },
      take: MAX_CACHED_CHAPTERS_PER_SERIES,
      select: {
        chapterSlug: true,
        title: true,
        chapterUrl: true,
        lastSyncedAt: true,
        publishedAt: true,
      },
    }),
    prisma.bookmark.findMany({
      where: {
        sourceId: resolved.sourceId,
        seriesSlug,
        ...userScope,
      },
      orderBy: { bookmarkedAt: "desc" },
      take: 20,
      select: {
        id: true,
        chapterSlug: true,
        chapterTitle: true,
        pageNumber: true,
      },
    }),
    prisma.readingHistory.findMany({
      where: {
        sourceId: resolved.sourceId,
        seriesSlug,
        ...userScope,
      },
      orderBy: { lastReadAt: "desc" },
      take: 20,
      select: {
        id: true,
        chapterSlug: true,
        chapterTitle: true,
        pageNumber: true,
      },
    }),
    prisma.seriesCache.findUnique({
      where: {
        sourceId_seriesSlug: {
          sourceId: resolved.sourceId,
          seriesSlug,
        },
      },
      select: {
        synopsis: true,
        coverImageUrl: true,
        status: true,
      },
    }),
  ]);

  const shouldRefreshFromAdapter =
    adapter &&
    (cachedChapters.length === 0 ||
      cachedChapters.some((chapter) => !isCacheFresh(chapter.lastSyncedAt)));
  const liveChapterCandidates = shouldRefreshFromAdapter
    ? await adapter.listSeriesChapters(seriesSlug)
    : [];

  if (liveChapterCandidates.length > 0) {
    await syncAdapterChaptersToCache({
      sourceId: resolved.sourceId,
      seriesSlug,
      seriesTitle: resolved.seriesTitle,
      chapters: liveChapterCandidates,
    });
    recordCacheSyncSuccess(resolved.sourceKey, seriesSlug, liveChapterCandidates.length);
  } else if (shouldRefreshFromAdapter && cachedChapters.length > 0) {
    recordCacheSyncFallback(
      resolved.sourceKey,
      seriesSlug,
      "Live chapter refresh returned empty; serving stale cache.",
    );
  }

  const rawLiveChapters: LiveChapterRow[] =
    liveChapterCandidates.length > 0
      ? liveChapterCandidates.slice(0, MAX_CACHED_CHAPTERS_PER_SERIES).map((chapter) => ({
          slug: chapter.slug,
          title: chapter.title,
          url: chapter.url,
          publishedAt: null,
        }))
      : cachedChapters.map((chapter) => ({
          slug: chapter.chapterSlug,
          title: chapter.title,
          url: chapter.chapterUrl,
          publishedAt: chapter.publishedAt,
        }));

  const liveChapters = sortLiveChaptersReadingOrder(rawLiveChapters);
  const newestChapter = liveChapters[liveChapters.length - 1];
  const firstChapter = liveChapters[0];
  const bookmarkOnFirst = firstChapter
    ? bookmarks.find((b) => b.chapterSlug === firstChapter.slug)
    : undefined;

  let synopsis = seriesCacheRow?.synopsis?.trim() || null;
  const cachedStatus = seriesCacheRow?.status?.trim() || null;

  if (!synopsis || !cachedStatus) {
    const meta = await getCachedSeriesPageMeta(resolved.sourceKey, seriesSlug);
    if (!synopsis && meta.synopsis?.trim()) {
      synopsis = meta.synopsis.trim();
    }
    const data: { synopsis?: string; status?: string } = {};
    if (!seriesCacheRow?.synopsis?.trim() && meta.synopsis?.trim()) {
      data.synopsis = meta.synopsis.trim();
    }
    if (!cachedStatus && meta.status?.trim()) {
      data.status = meta.status.trim();
    }
    if (Object.keys(data).length > 0) {
      await prisma.seriesCache
        .updateMany({
          where: { sourceId: resolved.sourceId, seriesSlug },
          data,
        })
        .catch(() => {
          /* row may not exist yet on first visit */
        });
    }
  }

  const coverImageUrl =
    resolved.coverImageUrl ?? seriesCacheRow?.coverImageUrl ?? null;

  const seriesStatus = await resolveSeriesStatusForReader(
    resolved.sourceId,
    resolved.sourceKey,
    seriesSlug,
  );

  return {
    seriesSlug: resolved.seriesSlug,
    seriesTitle: resolved.seriesTitle,
    sourceKey: resolved.sourceKey,
    sourceName: resolved.sourceName,
    adapterName: adapter?.name ?? null,
    sourceBaseUrl: resolved.sourceBaseUrl,
    synopsis,
    coverImageUrl,
    latestChapterSlug: newestChapter?.slug ?? null,
    latestChapterTitle: newestChapter?.title ?? null,
    firstChapterSlug: firstChapter?.slug ?? null,
    firstChapterTitle: firstChapter?.title ?? null,
    bookmarkIdForFirstChapter: bookmarkOnFirst?.id ?? null,
    liveChapters: liveChapters.map((c) => ({
      slug: c.slug,
      title: c.title,
      url: c.url,
      publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
    })),
    bookmarks,
    recentReads,
    seriesStatus,
  };
}

/**
 * Loads reader page data for a series/chapter slug pair.
 */
export async function getChapterReaderData(
  seriesSlug: string,
  chapterSlug: string,
  options?: ChapterReaderOptions,
): Promise<ChapterReaderData | null> {
  const user = await getSessionUser();
  if (!user) {
    return null;
  }

  const skipSavedProgress = options?.fromStart === true;

  const history = skipSavedProgress
    ? null
    : await prisma.readingHistory.findFirst({
        where: {
          seriesSlug,
          chapterSlug,
          userId: user.id,
        },
        orderBy: { lastReadAt: "desc" },
        select: {
          chapterSlug: true,
          chapterTitle: true,
          chapterUrl: true,
          pageNumber: true,
          source: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
      });

  if (!history) {
    const resolved = await resolveSeriesContextForUser(seriesSlug, user.id);
    if (!resolved) {
      return null;
    }

    const adapter = getSourceAdapter(resolved.sourceKey);
    if (!adapter) {
      return null;
    }

    const [chapterDetail, chapterList, cachedChapter] = await Promise.all([
      adapter.getChapterDetail(seriesSlug, chapterSlug),
      adapter.listSeriesChapters(seriesSlug),
      prisma.chapterCache.findFirst({
        where: {
          sourceId: resolved.sourceId,
          seriesSlug,
          chapterSlug,
        },
        select: {
          title: true,
          chapterUrl: true,
        },
      }),
    ]);
    if (!chapterDetail && !cachedChapter) {
      return null;
    }
    const { previousChapterSlug, nextChapterSlug } = adjacentChapterSlugs(
      chapterList,
      chapterSlug,
    );

    const seriesStatus = await resolveSeriesStatusForReader(
      resolved.sourceId,
      resolved.sourceKey,
      seriesSlug,
    );

    return {
      seriesSlug,
      chapterSlug,
      chapterTitle:
        chapterDetail?.title ?? cachedChapter?.title ?? `Chapter ${chapterSlug}`,
      chapterUrl: chapterDetail?.url ?? cachedChapter?.chapterUrl ?? null,
      sourceKey: resolved.sourceKey,
      sourceName: resolved.sourceName,
      pageNumber: 1,
      previousChapterSlug,
      nextChapterSlug,
      imageUrls: chapterDetail?.imageUrls ?? [],
      seriesStatus,
    };
  }

  const adapter = getSourceAdapter(history.source.key);

  const [chapterDetail, chapterList] = await Promise.all([
    adapter?.getChapterDetail(seriesSlug, chapterSlug) ?? Promise.resolve(null),
    adapter?.listSeriesChapters(seriesSlug) ?? Promise.resolve([]),
  ]);

  const { previousChapterSlug, nextChapterSlug } = adjacentChapterSlugs(
    chapterList,
    chapterSlug,
  );

  const seriesStatus = await resolveSeriesStatusForReader(
    history.source.id,
    history.source.key,
    seriesSlug,
  );

  return {
    seriesSlug,
    chapterSlug,
    chapterTitle:
      chapterDetail?.title ?? history.chapterTitle ?? chapterSlug,
    chapterUrl: chapterDetail?.url ?? history.chapterUrl ?? null,
    sourceKey: history.source.key,
    sourceName: history.source.name,
    pageNumber: history.pageNumber ?? 1,
    previousChapterSlug,
    nextChapterSlug,
    imageUrls: chapterDetail?.imageUrls ?? [],
    seriesStatus,
  };
}
