-- DropForeignKey
ALTER TABLE "Bookmark" DROP CONSTRAINT IF EXISTS "Bookmark_userId_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT IF EXISTS "Follow_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReadingHistory" DROP CONSTRAINT IF EXISTS "ReadingHistory_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Bookmark_userId_sourceId_seriesSlug_chapterSlug_key";

-- DropIndex
DROP INDEX IF EXISTS "Follow_userId_sourceId_seriesSlug_key";

-- DropIndex
DROP INDEX IF EXISTS "ReadingHistory_userId_lastReadAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "ReadingHistory_userId_sourceId_seriesSlug_chapterSlug_key";

-- AlterTable
ALTER TABLE "Bookmark" DROP COLUMN IF EXISTS "userId";

-- AlterTable
ALTER TABLE "Follow" DROP COLUMN IF EXISTS "userId";

-- AlterTable
ALTER TABLE "ReadingHistory" DROP COLUMN IF EXISTS "userId";

-- DropTable
DROP TABLE IF EXISTS "PasswordResetToken";

-- DropTable
DROP TABLE IF EXISTS "User";

-- Deduplicate rows after removing per-user scope
WITH ranked_bookmarks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "sourceId", "seriesSlug", "chapterSlug"
      ORDER BY "lastAccessedAt" DESC, "bookmarkedAt" DESC, id DESC
    ) AS rn
  FROM "Bookmark"
)
DELETE FROM "Bookmark"
WHERE id IN (SELECT id FROM ranked_bookmarks WHERE rn > 1);

WITH ranked_follows AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "sourceId", "seriesSlug"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
    ) AS rn
  FROM "Follow"
)
DELETE FROM "Follow"
WHERE id IN (SELECT id FROM ranked_follows WHERE rn > 1);

WITH ranked_history AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "sourceId", "seriesSlug", "chapterSlug"
      ORDER BY "lastReadAt" DESC, id DESC
    ) AS rn
  FROM "ReadingHistory"
)
DELETE FROM "ReadingHistory"
WHERE id IN (SELECT id FROM ranked_history WHERE rn > 1);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_sourceId_seriesSlug_chapterSlug_key" ON "Bookmark"("sourceId", "seriesSlug", "chapterSlug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Follow_sourceId_seriesSlug_key" ON "Follow"("sourceId", "seriesSlug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReadingHistory_sourceId_seriesSlug_chapterSlug_key" ON "ReadingHistory"("sourceId", "seriesSlug", "chapterSlug");
