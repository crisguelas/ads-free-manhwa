/**
 * One-time maintenance: delete legacy `ReadingHistory` rows for Flame web-novel slugs (`novel-{id}`).
 * The UI no longer surfaces those URLs; rows left in the DB are ignored but can be removed for a clean dataset.
 *
 * Usage: `npm run cleanup:flame-novel-reading-history` (requires `DATABASE_URL`).
 */
import "dotenv/config";
import { runDeleteFlameNovelReadingHistory } from "../lib/run-delete-flame-novel-reading-history";
import { prisma } from "../lib/prisma";

async function main(): Promise<void> {
  const { deleted } = await runDeleteFlameNovelReadingHistory();
  console.log(`[delete-flame-novel-reading-history] deleted ${deleted} row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
