import { prisma } from "@/lib/prisma";

export type DeleteFlameNovelReadingHistoryResult = {
  /** Number of rows removed (0 if the Flame source row is missing or nothing matched). */
  deleted: number;
};

/**
 * Removes `ReadingHistory` rows for Flame web-novel slugs (`novel-{id}`), which the app no longer links to.
 * Scoped to `Source.key === "flame-scans"` so other sources are untouched. Safe to run repeatedly (no-op when clean).
 */
export async function runDeleteFlameNovelReadingHistory(): Promise<DeleteFlameNovelReadingHistoryResult> {
  const deleted = await prisma.$executeRaw<number>`
    DELETE FROM "ReadingHistory" AS rh
    USING "Source" AS s
    WHERE rh."sourceId" = s.id
      AND s.key = 'flame-scans'
      AND rh."seriesSlug" ~ '^novel-[0-9]+$'
  `;
  return { deleted };
}
