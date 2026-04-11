import { CATALOG_HIGHLIGHTS } from "@/lib/featured-series";
import { getSessionUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
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

type LiveChapterRow = { slug: string; title: string; url: string };

/**
 * Sorts chapter rows ascending by inferred chapter number (earliest episode at the top).
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
};

/**
 * Resolves which source and title apply to `seriesSlug` for this user.
 * Prefer an explicit `Follow`; otherwise allow any title linked from `CATALOG_HIGHLIGHTS` so browse tiles open without a follow row.
 */
async function resolveSeriesContextForUser(
  seriesSlug: string,
  userId: string,
): Promise<ResolvedSeriesContext | null> {
  const follow = await prisma.follow.findFirst({
    where: {
      seriesSlug,
      userId,
    },
    select: {
      seriesSlug: true,
      seriesTitle: true,
      sourceId: true,
      source: {
        select: {
          key: true,
          name: true,
          baseUrl: true,
        },
      },
    },
  });

  if (follow) {
    return {
      seriesSlug: follow.seriesSlug,
      seriesTitle: follow.seriesTitle,
      sourceId: follow.sourceId,
      sourceKey: follow.source.key,
      sourceName: follow.source.name,
      sourceBaseUrl: follow.source.baseUrl,
    };
  }

  const catalogEntry = CATALOG_HIGHLIGHTS.find((h) => h.seriesSlug === seriesSlug);
  if (!catalogEntry) {
    return null;
  }

  const sourceRow = await prisma.source.findFirst({
    where: {
      key: catalogEntry.sourceKey,
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
    seriesTitle: catalogEntry.title,
    sourceId: sourceRow.id,
    sourceKey: sourceRow.key,
    sourceName: sourceRow.name,
    sourceBaseUrl: sourceRow.baseUrl,
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
  latestChapterSlug: string | null;
  latestChapterTitle: string | null;
  liveChapters: Array<{
    slug: string;
    title: string;
    url: string;
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
};

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
};

/**
 * Options for opening a chapter in the reader (e.g. ignore saved scroll position).
 */
export type ChapterReaderOptions = {
  /** When true, open at page 1 and skip `ReadingHistory` pageNumber for this visit. */
  fromStart?: boolean;
};

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

  const [cachedChapters, bookmarks, recentReads] = await Promise.all([
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
        }))
      : cachedChapters.map((chapter) => ({
          slug: chapter.chapterSlug,
          title: chapter.title,
          url: chapter.chapterUrl,
        }));

  const liveChapters = sortLiveChaptersReadingOrder(rawLiveChapters);
  const newestChapter = liveChapters[liveChapters.length - 1];

  return {
    seriesSlug: resolved.seriesSlug,
    seriesTitle: resolved.seriesTitle,
    sourceKey: resolved.sourceKey,
    sourceName: resolved.sourceName,
    adapterName: adapter?.name ?? null,
    sourceBaseUrl: resolved.sourceBaseUrl,
    latestChapterSlug: newestChapter?.slug ?? null,
    latestChapterTitle: newestChapter?.title ?? null,
    liveChapters,
    bookmarks,
    recentReads,
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
  };
}
