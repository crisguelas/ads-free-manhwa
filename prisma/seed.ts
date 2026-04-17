import "dotenv/config";
import { normalizeFollowSeriesTitleForStorage } from "../lib/follow-series-title";
import { createPostgresAdapter } from "../lib/prisma-adapter";
import { PrismaClient } from "../lib/generated/prisma/client";

/**
 * Provides stable source seed data for scraper adapters.
 */
const SOURCE_SEEDS = [
  { key: "asura-scans", name: "Asura Scans", baseUrl: "https://asuracomic.net" },
] as const;

/**
 * Seeds base source rows and development test records for UI/testing.
 */
async function main(): Promise<void> {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("DATABASE_URL is required to run seed data.");
  }

  const adapter = createPostgresAdapter(rawUrl);
  const prisma = new PrismaClient({ adapter });

  try {
    for (const source of SOURCE_SEEDS) {
      await prisma.source.upsert({
        where: { key: source.key },
        update: {
          name: source.name,
          baseUrl: source.baseUrl,
          isEnabled: true,
        },
        create: {
          key: source.key,
          name: source.name,
          baseUrl: source.baseUrl,
          isEnabled: true,
        },
      });
    }

    /**
     * Drops legacy sources no longer supported by the app.
     */
    await prisma.source.deleteMany({
      where: { key: "reaper-scans" },
    });

    const asuraSource = await prisma.source.findUniqueOrThrow({
      where: { key: "asura-scans" },
    });

    await prisma.follow.upsert({
      where: {
        sourceId_seriesSlug: {
          sourceId: asuraSource.id,
          seriesSlug: "the-beginning-after-the-end",
        },
      },
      update: {
        seriesTitle: normalizeFollowSeriesTitleForStorage("The Beginning After the End"),
        coverImageUrl: "https://example.com/covers/tbate.jpg",
      },
      create: {
        sourceId: asuraSource.id,
        seriesSlug: "the-beginning-after-the-end",
        seriesTitle: normalizeFollowSeriesTitleForStorage("The Beginning After the End"),
        coverImageUrl: "https://example.com/covers/tbate.jpg",
      },
    });

  } finally {
    await prisma.$disconnect();
  }
}

void main();
