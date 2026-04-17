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
import { SUPPORTED_SOURCE_KEYS } from "@/lib/supported-sources";

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
 * Series + source identity for reader routes: from follow rows, cache, or live browse + `Source` row.
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
 * Resolves which source and title apply to `seriesSlug`.
 * Prefer an explicit `Follow`; otherwise curated highlights; otherwise any slug present on the live browse index.
 */
export async function resolveSeriesContextForUser(
  seriesSlug: string,
): Promise<ResolvedSeriesContext | null> {
  const followRows = await prisma.follow.findMany({
    where: {
      seriesSlug: { equals: seriesSlug, mode: "insensitive" },
      source: {
        key: {
          in: [...SUPPORTED_SOURCE_KEYS],
        },
      },
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
    const follow = pickRowWhenSeriesSlugSpansScanSources(followRows);
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
      source: {
        isEnabled: true,
        key: {
          in: [...SUPPORTED_SOURCE_KEYS],
        },
      },
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
      source: {
        isEnabled: true,
        key: {
          in: [...SUPPORTED_SOURCE_KEYS],
        },
      },
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
  const asuraList = await buildLiveBrowseCatalogForSource("asura-scans");
  const liveEntry = asuraList.find((h) =>
    h.seriesSlug.toLowerCase().startsWith(seriesSlug.toLowerCase()),
  );

  if (!liveEntry) {
    // Smart Fallback 2: Direct site resolution (final attempt)
    // If we can't find it in our lists, maybe it's just a new hashed slug we haven't seen.
    // We try to ping Asura once to see if the page exists or redirects.
    try {
      const sourceRow = await prisma.source.findFirst({
        where: {
          key: "asura-scans",
          isEnabled: true,
        },
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
  /** Short series description for the detail hero (meta/cache). */
  synopsis: string | null;
  coverImageUrl: string | null;
  latestChapterSlug: string | null;
  latestChapterTitle: string | null;
  firstChapterSlug: string | null;
  firstChapterTitle: string | null;
  liveChapters: Array<{
    slug: string;
    title: string;
    url: string;
    publishedAt: string | null;
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
  seriesTitle: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterUrl: string | null;
  sourceKey: string;
  sourceName: string;
  coverImageUrl: string | null;
  pageNumber: number;
  previousChapterSlug: string | null;
  nextChapterSlug: string | null;
  imageUrls: string[];
  seriesStatus: SeriesReaderStatus;
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
  const resolved = await resolveSeriesContextForUser(seriesSlug);
  if (!resolved) {
    return null;
  }

  const adapter = getSourceAdapter(resolved.sourceKey);

  // Fetch DB data and series page meta in parallel — avoids two sequential async round-trips later.
  const [cachedChapters, seriesCacheRow, prefetchedMeta] = await Promise.all([
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
    // Pre-fetch page meta in parallel so synopsis + status are ready without extra round-trips.
    getCachedSeriesPageMeta(resolved.sourceKey, seriesSlug),
  ]);

  const shouldRefreshFromAdapter =
    adapter &&
    (cachedChapters.length === 0 ||
      cachedChapters.some((chapter) => !isCacheFresh(chapter.lastSyncedAt)));
  const liveChapterCandidates = shouldRefreshFromAdapter
    ? await adapter.listSeriesChapters(seriesSlug)
    : [];

  if (liveChapterCandidates.length > 0) {
    // Fire-and-forget: the page already has live data in memory; no need to block rendering
    // while N chapter upserts round-trip to the database.
    void syncAdapterChaptersToCache({
      sourceId: resolved.sourceId,
      seriesSlug,
      seriesTitle: resolved.seriesTitle,
      chapters: liveChapterCandidates,
    }).then(
      () => recordCacheSyncSuccess(resolved.sourceKey, seriesSlug, liveChapterCandidates.length),
      () => { /* swallow write errors — stale cache is acceptable */ },
    );
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

  // Use the pre-fetched meta (already running in parallel above) for synopsis and status.
  let synopsis = seriesCacheRow?.synopsis?.trim() || null;
  const cachedStatus = seriesCacheRow?.status?.trim() || null;

  if (!synopsis && prefetchedMeta.synopsis?.trim()) {
    synopsis = prefetchedMeta.synopsis.trim();
  }

  // Back-fill DB cache with meta values when missing — fire-and-forget.
  const backfillData: { synopsis?: string; status?: string } = {};
  if (!seriesCacheRow?.synopsis?.trim() && prefetchedMeta.synopsis?.trim()) {
    backfillData.synopsis = prefetchedMeta.synopsis.trim();
  }
  if (!cachedStatus && prefetchedMeta.status?.trim()) {
    backfillData.status = prefetchedMeta.status.trim();
  }
  if (Object.keys(backfillData).length > 0) {
    void prisma.seriesCache
      .updateMany({ where: { sourceId: resolved.sourceId, seriesSlug }, data: backfillData })
      .catch(() => { /* row may not exist yet on first visit */ });
  }

  const coverImageUrl =
    resolved.coverImageUrl ?? seriesCacheRow?.coverImageUrl ?? null;

  // Reuse the prefetched meta for status instead of making another async call.
  const rawStatus = cachedStatus || prefetchedMeta.status?.trim() || null;
  const seriesStatus = formatSeriesStatusForReader(rawStatus);

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
    liveChapters: liveChapters.map((c) => ({
      slug: c.slug,
      title: c.title,
      url: c.url,
      publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
    })),
    seriesStatus,
  };
}

/**
 * Loads reader page data for a series/chapter slug pair.
 */
export async function getChapterReaderData(
  seriesSlug: string,
  chapterSlug: string,
): Promise<ChapterReaderData | null> {
  const resolved = await resolveSeriesContextForUser(seriesSlug);
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
    seriesTitle: resolved.seriesTitle,
    chapterSlug,
    chapterTitle:
      chapterDetail?.title ?? cachedChapter?.title ?? `Chapter ${chapterSlug}`,
    chapterUrl: chapterDetail?.url ?? cachedChapter?.chapterUrl ?? null,
    sourceKey: resolved.sourceKey,
    sourceName: resolved.sourceName,
    coverImageUrl: resolved.coverImageUrl,
    pageNumber: 1,
    previousChapterSlug,
    nextChapterSlug,
    imageUrls: chapterDetail?.imageUrls ?? [],
    seriesStatus,
  };
}
