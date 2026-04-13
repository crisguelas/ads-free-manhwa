import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/current-user";
import { isFlameWebNovelSeriesSlug } from "@/lib/flame-series-slug";
import {
  firstFollowMapValue,
  followRowLookupKeys,
  normalizeContinueReadingSeriesKey,
} from "@/lib/continue-reading-display";
import { displayFollowSeriesTitle } from "@/lib/follow-series-title";
import { resolveSeriesCoverUrl } from "@/lib/catalog-covers";
import type { ContinueReadingCard } from "@/lib/home-data";

/** Raw history rows to scan when deduping by series (ordered newest-first). */
const CONTINUE_READING_HISTORY_FETCH = 320;
/** Max distinct series on the home resume list. */
const CONTINUE_READING_MAX_SERIES = 48;

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

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ authenticated: false });
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

    return NextResponse.json({
      authenticated: true,
      currentUserEmail: user.email,
      recentReads,
    });
  } catch (error) {
    console.error("Personal home data API Error:", error);
    return NextResponse.json({ error: "Failed to load personal data" }, { status: 500 });
  }
}
