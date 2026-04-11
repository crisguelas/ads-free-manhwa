import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FLAME_TEST_UTILS } from "@/lib/sources/adapters/flame-source-adapter";

/**
 * Loads a Flame HTML fixture from disk.
 */
async function loadFixture(name: string): Promise<string> {
  const p = join(
    process.cwd(),
    "lib",
    "sources",
    "adapters",
    "__fixtures__",
    name,
  );
  return readFile(p, "utf8");
}

/**
 * Verifies numeric and `series/{id}` series slug parsing.
 */
test("parseFlameSeriesId accepts numeric id and series/ path", () => {
  assert.equal(FLAME_TEST_UTILS.parseFlameSeriesId("2"), "2");
  assert.equal(FLAME_TEST_UTILS.parseFlameSeriesId("  42  "), "42");
  assert.equal(FLAME_TEST_UTILS.parseFlameSeriesId("series/99"), "99");
  assert.equal(FLAME_TEST_UTILS.parseFlameSeriesId("not-valid"), null);
});

/**
 * Verifies chapter list extraction dedupes URLs and sorts by chapter number.
 */
test("extractChapterSummaries dedupes and sorts by chapter label", async () => {
  const html = await loadFixture("flame-series-page.fixture.html");
  const chapters = FLAME_TEST_UTILS.extractChapterSummaries("2", html);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0]?.slug, "bbbbbbbbbbbbbbbb");
  assert.equal(chapters[1]?.slug, "aaaaaaaaaaaaaaaa");
});

/**
 * Verifies CDN image URL assembly from `__NEXT_DATA__` chapter payload.
 */
test("buildImageUrlsFromChapterPayload orders images by numeric key", () => {
  const urls = FLAME_TEST_UTILS.buildImageUrlsFromChapterPayload({
    series_id: 2,
    token: "abcdabcdabcdabcd",
    release_date: 123,
    images: {
      "1": { name: "b.jpg" },
      "0": { name: "a.jpg" },
    },
  });
  assert.deepEqual(urls, [
    "https://cdn.flamecomics.xyz/uploads/images/series/2/abcdabcdabcdabcd/a.jpg?123",
    "https://cdn.flamecomics.xyz/uploads/images/series/2/abcdabcdabcdabcd/b.jpg?123",
  ]);
});
