-- DropForeignKey
ALTER TABLE "Bookmark" DROP CONSTRAINT IF EXISTS "Bookmark_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "ReadingHistory" DROP CONSTRAINT IF EXISTS "ReadingHistory_sourceId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Bookmark";

-- DropTable
DROP TABLE IF EXISTS "ReadingHistory";
