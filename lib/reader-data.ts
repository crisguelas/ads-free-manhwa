import { prisma } from "@/lib/prisma";
import { getSourceAdapter } from "@/lib/sources/registry";

const CHAPTER_CACHE_TTL_MS = 1000 * 60 * 30;

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
  sourceName: string;
  pageNumber: number;
  previousChapterSlug: string | null;
  nextChapterSlug: string | null;
  imageUrls: string[];
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
    chapters.slice(0, 40).map((chapter) =>
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
  const follow = await prisma.follow.findFirst({
    where: { seriesSlug },
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

  if (!follow) {
    return null;
  }
  const adapter = getSourceAdapter(follow.source.key);

  const [latestChapter, cachedChapters, bookmarks, recentReads] = await Promise.all([
    prisma.chapterCache.findFirst({
      where: {
        sourceId: follow.sourceId,
        seriesSlug,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        chapterSlug: true,
        title: true,
      },
    }),
    prisma.chapterCache.findMany({
      where: {
        sourceId: follow.sourceId,
        seriesSlug,
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        chapterSlug: true,
        title: true,
        chapterUrl: true,
        lastSyncedAt: true,
      },
    }),
    prisma.bookmark.findMany({
      where: {
        sourceId: follow.sourceId,
        seriesSlug,
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
        sourceId: follow.sourceId,
        seriesSlug,
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
      sourceId: follow.sourceId,
      seriesSlug,
      seriesTitle: follow.seriesTitle,
      chapters: liveChapterCandidates,
    });
  }

  const liveChapters =
    liveChapterCandidates.length > 0
      ? liveChapterCandidates.slice(0, 20).map((chapter) => ({
          slug: chapter.slug,
          title: chapter.title,
          url: chapter.url,
        }))
      : cachedChapters.map((chapter) => ({
          slug: chapter.chapterSlug,
          title: chapter.title,
          url: chapter.chapterUrl,
        }));

  return {
    seriesSlug: follow.seriesSlug,
    seriesTitle: follow.seriesTitle,
    sourceKey: follow.source.key,
    sourceName: follow.source.name,
    adapterName: adapter?.name ?? null,
    sourceBaseUrl: follow.source.baseUrl,
    latestChapterSlug: latestChapter?.chapterSlug ?? null,
    latestChapterTitle: latestChapter?.title ?? null,
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
): Promise<ChapterReaderData | null> {
  const history = await prisma.readingHistory.findFirst({
    where: {
      seriesSlug,
      chapterSlug,
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
          name: true,
        },
      },
    },
  });

  if (!history) {
    const follow = await prisma.follow.findFirst({
      where: { seriesSlug },
      select: {
        source: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    if (!follow) {
      return null;
    }

    const adapter = getSourceAdapter(follow.source.key);
    if (!adapter) {
      return null;
    }

    const [chapterDetail, chapterList, cachedChapter] = await Promise.all([
      adapter.getChapterDetail(seriesSlug, chapterSlug),
      adapter.listSeriesChapters(seriesSlug),
      prisma.chapterCache.findFirst({
        where: {
          sourceId: follow.source.id,
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
    const currentIndex = chapterList.findIndex(
      (chapter) => chapter.slug === chapterSlug,
    );
    const previousChapterSlug =
      currentIndex >= 0 && currentIndex < chapterList.length - 1
        ? chapterList[currentIndex + 1]?.slug ?? null
        : null;
    const nextChapterSlug =
      currentIndex > 0 ? chapterList[currentIndex - 1]?.slug ?? null : null;

    return {
      seriesSlug,
      chapterSlug,
      chapterTitle:
        chapterDetail?.title ?? cachedChapter?.title ?? `Chapter ${chapterSlug}`,
      chapterUrl: chapterDetail?.url ?? cachedChapter?.chapterUrl ?? null,
      sourceName: follow.source.name,
      pageNumber: 1,
      previousChapterSlug,
      nextChapterSlug,
      imageUrls: chapterDetail?.imageUrls ?? [],
    };
  }

  const neighbors = await prisma.chapterCache.findMany({
    where: {
      sourceId: history.source.id,
      seriesSlug,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      chapterSlug: true,
    },
    take: 50,
  });

  const currentIndex = neighbors.findIndex(
    (chapter) => chapter.chapterSlug === chapterSlug,
  );

  const previousChapterSlug =
    currentIndex >= 0 && currentIndex < neighbors.length - 1
      ? neighbors[currentIndex + 1]?.chapterSlug ?? null
      : null;
  const nextChapterSlug =
    currentIndex > 0 ? neighbors[currentIndex - 1]?.chapterSlug ?? null : null;

  return {
    seriesSlug,
    chapterSlug,
    chapterTitle: history.chapterTitle ?? chapterSlug,
    chapterUrl: history.chapterUrl,
    sourceName: history.source.name,
    pageNumber: history.pageNumber ?? 1,
    previousChapterSlug,
    nextChapterSlug,
    imageUrls: [],
  };
}
