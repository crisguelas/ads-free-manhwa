import { displayFollowSeriesTitle } from "@/lib/follow-series-title";
import { prisma } from "@/lib/prisma";

export type FollowSeriesTitleBackfillResult = {
  scanned: number;
  updated: number;
  /** True when another session held the advisory lock (this run skipped work). */
  skippedDueToLock: boolean;
};

/**
 * Scans all `Follow` rows and updates `seriesTitle` when HTML entities differ from decoded text.
 * Uses a transaction-scoped advisory try-lock (fixed key `872341001`) so concurrent app instances do not run the same migration twice.
 */
export async function runFollowSeriesTitleBackfill(): Promise<FollowSeriesTitleBackfillResult> {
  return prisma.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(872341001) AS acquired
    `;
    const acquired = lockRows[0]?.acquired === true;
    if (!acquired) {
      return { scanned: 0, updated: 0, skippedDueToLock: true };
    }

    /** Narrow to rows that might still hold entities so cold starts avoid a full-table read once data is clean. */
    const rows = await tx.follow.findMany({
      where: {
        OR: [
          { seriesTitle: { contains: "&#" } },
          { seriesTitle: { contains: "&amp;" } },
          { seriesTitle: { contains: "&quot;" } },
          { seriesTitle: { contains: "&apos;" } },
          { seriesTitle: { contains: "&lt;" } },
          { seriesTitle: { contains: "&gt;" } },
          { seriesTitle: { contains: "&nbsp;" } },
        ],
      },
      select: { id: true, seriesTitle: true },
    });

    let updated = 0;
    for (const row of rows) {
      const next = displayFollowSeriesTitle(row.seriesTitle);
      if (next !== row.seriesTitle) {
        await tx.follow.update({
          where: { id: row.id },
          data: { seriesTitle: next },
        });
        updated += 1;
      }
    }

    return { scanned: rows.length, updated, skippedDueToLock: false };
  });
}
