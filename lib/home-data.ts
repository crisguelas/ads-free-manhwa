import { prisma } from "@/lib/prisma";

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
  follows: Array<{
    id: string;
    seriesSlug: string;
    seriesTitle: string;
    sourceName: string;
  }>;
  recentReads: Array<{
    id: string;
    seriesSlug: string;
    chapterSlug: string;
    chapterTitle: string | null;
    sourceName: string;
  }>;
};

/**
 * Loads home page data from Prisma for initial UI rendering.
 */
export async function getHomePageData(): Promise<HomePageData> {
  const [sources, follows, recentReads] = await Promise.all([
    prisma.source.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        baseUrl: true,
        isEnabled: true,
      },
    }),
    prisma.follow.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        seriesSlug: true,
        seriesTitle: true,
        source: { select: { name: true } },
      },
    }),
    prisma.readingHistory.findMany({
      orderBy: { lastReadAt: "desc" },
      take: 10,
      select: {
        id: true,
        seriesSlug: true,
        chapterSlug: true,
        chapterTitle: true,
        source: { select: { name: true } },
      },
    }),
  ]);

  return {
    sources,
    follows: follows.map((entry) => ({
      id: entry.id,
      seriesSlug: entry.seriesSlug,
      seriesTitle: entry.seriesTitle,
      sourceName: entry.source.name,
    })),
    recentReads: recentReads.map((entry) => ({
      id: entry.id,
      seriesSlug: entry.seriesSlug,
      chapterSlug: entry.chapterSlug,
      chapterTitle: entry.chapterTitle,
      sourceName: entry.source.name,
    })),
  };
}
