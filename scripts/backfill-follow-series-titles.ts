/**
 * Manual run of the same follow-title backfill used automatically in production startup (`instrumentation.ts`).
 * Useful for local DBs or when `SKIP_FOLLOW_TITLE_BACKFILL` is set on the host.
 *
 * Usage: `npm run backfill:follow-titles` (requires `DATABASE_URL`).
 */
import "dotenv/config";
import { runFollowSeriesTitleBackfill } from "../lib/run-follow-series-title-backfill";
import { prisma } from "../lib/prisma";

async function main(): Promise<void> {
  const result = await runFollowSeriesTitleBackfill();
  console.log(
    `[backfill-follow-series-titles] scanned ${result.scanned} follow(s), updated ${result.updated}` +
      (result.skippedDueToLock ? " (skipped: another session held lock)" : "") +
      ".",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
