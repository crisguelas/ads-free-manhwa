import { createHash } from "node:crypto";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

/**
 * Provides stable source seed data for scraper adapters.
 */
const SOURCE_SEEDS = [
  { key: "asura-scans", name: "Asura Scans", baseUrl: "https://asuracomic.net" },
  { key: "reaper-scans", name: "Reaper Scans", baseUrl: "https://reaperscans.com" },
  { key: "flame-scans", name: "Flame Scans", baseUrl: "https://flamecomics.com" },
] as const;

/**
 * Creates a deterministic placeholder password hash for local seed users.
 */
function buildDevPasswordHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Seeds base source rows and development test records for UI/testing.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run seed data.");
  }

  const adapter = new PrismaPg({ connectionString });
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

    const devUser = await prisma.user.upsert({
      where: { email: "dev@manhwa.local" },
      update: {
        displayName: "Dev Reader",
      },
      create: {
        email: "dev@manhwa.local",
        displayName: "Dev Reader",
        passwordHash: buildDevPasswordHash("dev-password-change-me"),
      },
    });

    const asuraSource = await prisma.source.findUniqueOrThrow({
      where: { key: "asura-scans" },
    });

    await prisma.follow.upsert({
      where: {
        userId_sourceId_seriesSlug: {
          userId: devUser.id,
          sourceId: asuraSource.id,
          seriesSlug: "the-beginning-after-the-end",
        },
      },
      update: {
        seriesTitle: "The Beginning After the End",
        coverImageUrl: "https://example.com/covers/tbate.jpg",
      },
      create: {
        userId: devUser.id,
        sourceId: asuraSource.id,
        seriesSlug: "the-beginning-after-the-end",
        seriesTitle: "The Beginning After the End",
        coverImageUrl: "https://example.com/covers/tbate.jpg",
      },
    });

    await prisma.bookmark.upsert({
      where: {
        userId_sourceId_seriesSlug_chapterSlug: {
          userId: devUser.id,
          sourceId: asuraSource.id,
          seriesSlug: "the-beginning-after-the-end",
          chapterSlug: "chapter-200",
        },
      },
      update: {
        chapterTitle: "Chapter 200",
        pageNumber: 5,
        chapterUrl: "https://example.com/series/tbate/chapter-200",
      },
      create: {
        userId: devUser.id,
        sourceId: asuraSource.id,
        seriesSlug: "the-beginning-after-the-end",
        chapterSlug: "chapter-200",
        chapterTitle: "Chapter 200",
        pageNumber: 5,
        chapterUrl: "https://example.com/series/tbate/chapter-200",
      },
    });

    await prisma.readingHistory.upsert({
      where: {
        userId_sourceId_seriesSlug_chapterSlug: {
          userId: devUser.id,
          sourceId: asuraSource.id,
          seriesSlug: "the-beginning-after-the-end",
          chapterSlug: "chapter-200",
        },
      },
      update: {
        chapterTitle: "Chapter 200",
        pageNumber: 5,
        chapterUrl: "https://example.com/series/tbate/chapter-200",
      },
      create: {
        userId: devUser.id,
        sourceId: asuraSource.id,
        seriesSlug: "the-beginning-after-the-end",
        chapterSlug: "chapter-200",
        chapterTitle: "Chapter 200",
        pageNumber: 5,
        chapterUrl: "https://example.com/series/tbate/chapter-200",
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main();
