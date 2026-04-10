-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "seriesSlug" TEXT NOT NULL,
    "seriesTitle" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "seriesSlug" TEXT NOT NULL,
    "chapterSlug" TEXT NOT NULL,
    "chapterTitle" TEXT,
    "pageNumber" INTEGER,
    "chapterUrl" TEXT,
    "bookmarkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "seriesSlug" TEXT NOT NULL,
    "chapterSlug" TEXT NOT NULL,
    "chapterTitle" TEXT,
    "chapterUrl" TEXT,
    "pageNumber" INTEGER,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeriesCache" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "seriesSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "synopsis" TEXT,
    "coverImageUrl" TEXT,
    "status" TEXT,
    "genres" TEXT[],
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeriesCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterCache" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "seriesSlug" TEXT NOT NULL,
    "chapterSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "chapterUrl" TEXT NOT NULL,
    "chapterLabel" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE INDEX "Follow_sourceId_seriesSlug_idx" ON "Follow"("sourceId", "seriesSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_userId_sourceId_seriesSlug_key" ON "Follow"("userId", "sourceId", "seriesSlug");

-- CreateIndex
CREATE INDEX "Bookmark_sourceId_seriesSlug_chapterSlug_idx" ON "Bookmark"("sourceId", "seriesSlug", "chapterSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_sourceId_seriesSlug_chapterSlug_key" ON "Bookmark"("userId", "sourceId", "seriesSlug", "chapterSlug");

-- CreateIndex
CREATE INDEX "ReadingHistory_userId_lastReadAt_idx" ON "ReadingHistory"("userId", "lastReadAt");

-- CreateIndex
CREATE INDEX "ReadingHistory_sourceId_seriesSlug_chapterSlug_idx" ON "ReadingHistory"("sourceId", "seriesSlug", "chapterSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingHistory_userId_sourceId_seriesSlug_chapterSlug_key" ON "ReadingHistory"("userId", "sourceId", "seriesSlug", "chapterSlug");

-- CreateIndex
CREATE INDEX "SeriesCache_title_idx" ON "SeriesCache"("title");

-- CreateIndex
CREATE UNIQUE INDEX "SeriesCache_sourceId_seriesSlug_key" ON "SeriesCache"("sourceId", "seriesSlug");

-- CreateIndex
CREATE INDEX "ChapterCache_sourceId_seriesSlug_idx" ON "ChapterCache"("sourceId", "seriesSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterCache_sourceId_seriesSlug_chapterSlug_key" ON "ChapterCache"("sourceId", "seriesSlug", "chapterSlug");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingHistory" ADD CONSTRAINT "ReadingHistory_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingHistory" ADD CONSTRAINT "ReadingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesCache" ADD CONSTRAINT "SeriesCache_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterCache" ADD CONSTRAINT "ChapterCache_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterCache" ADD CONSTRAINT "ChapterCache_sourceId_seriesSlug_fkey" FOREIGN KEY ("sourceId", "seriesSlug") REFERENCES "SeriesCache"("sourceId", "seriesSlug") ON DELETE CASCADE ON UPDATE CASCADE;
