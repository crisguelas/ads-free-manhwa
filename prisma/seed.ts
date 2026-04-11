import "dotenv/config";
import { hashPassword } from "../lib/auth/password";
import { createPostgresAdapter } from "../lib/prisma-adapter";
import { PrismaClient } from "../lib/generated/prisma/client";

/**
 * Provides stable source seed data for scraper adapters.
 */
const SOURCE_SEEDS = [
  { key: "asura-scans", name: "Asura Scans", baseUrl: "https://asuracomic.net" },
  { key: "flame-scans", name: "Flame Comics", baseUrl: "https://flamecomics.xyz/" },
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
     * Drops legacy sources no longer supported (Reaper removed; app targets Asura + Flame only).
     */
    await prisma.source.deleteMany({
      where: { key: "reaper-scans" },
    });

    const devPassword = "dev-password-change-me";
    const devUser = await prisma.user.upsert({
      where: { email: "dev@manhwa.local" },
      update: {
        displayName: "Dev Reader",
        passwordHash: hashPassword(devPassword),
      },
      create: {
        email: "dev@manhwa.local",
        displayName: "Dev Reader",
        passwordHash: hashPassword(devPassword),
      },
    });

    const asuraSource = await prisma.source.findUniqueOrThrow({
      where: { key: "asura-scans" },
    });

    const flameSource = await prisma.source.findUniqueOrThrow({
      where: { key: "flame-scans" },
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

    /**
     * Flame adapter uses numeric series id as `seriesSlug` (e.g. `2` = Omniscient Reader's Viewpoint).
     */
    await prisma.follow.upsert({
      where: {
        userId_sourceId_seriesSlug: {
          userId: devUser.id,
          sourceId: flameSource.id,
          seriesSlug: "2",
        },
      },
      update: {
        seriesTitle: "Omniscient Reader's Viewpoint",
        coverImageUrl: "https://cdn.flamecomics.xyz/uploads/images/series/2/thumbnail.png",
      },
      create: {
        userId: devUser.id,
        sourceId: flameSource.id,
        seriesSlug: "2",
        seriesTitle: "Omniscient Reader's Viewpoint",
        coverImageUrl: "https://cdn.flamecomics.xyz/uploads/images/series/2/thumbnail.png",
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
