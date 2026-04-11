import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFlameSeriesSlug } from "@/lib/flame-series-slug";
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
 * Verifies manhwa ids, `novel-{id}` web novels, and legacy `series/{id}` slugs.
 */
test("parseFlameSeriesSlug accepts numeric id, novel- prefix, and series/ path", () => {
  assert.deepEqual(FLAME_TEST_UTILS.parseFlameSeriesSlug("2"), {
    numericId: "2",
    contentKind: "series",
  });
  assert.deepEqual(FLAME_TEST_UTILS.parseFlameSeriesSlug("  42  "), {
    numericId: "42",
    contentKind: "series",
  });
  assert.deepEqual(FLAME_TEST_UTILS.parseFlameSeriesSlug("series/99"), {
    numericId: "99",
    contentKind: "series",
  });
  assert.deepEqual(FLAME_TEST_UTILS.parseFlameSeriesSlug("novel-8"), {
    numericId: "8",
    contentKind: "novel",
  });
  assert.equal(FLAME_TEST_UTILS.parseFlameSeriesSlug("not-valid"), null);
});

/**
 * Verifies chapter list extraction dedupes URLs and sorts by chapter number.
 */
test("extractChapterSummaries dedupes and sorts by chapter label", async () => {
  const html = await loadFixture("flame-series-page.fixture.html");
  const parsed = parseFlameSeriesSlug("2");
  assert.ok(parsed);
  const chapters = FLAME_TEST_UTILS.extractChapterSummaries(parsed, html);
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

test("parseFlameSeriesChaptersFromNextData uses pageProps.chapters titles from __NEXT_DATA__", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"chapters":[
        {"token":"b3efed246c5ee10d","title":"Prologue","series_id":2,"chapter":"0.00"},
        {"token":"aaaaaaaaaaaaaaaa","title":"Later chapter","series_id":2,"chapter":"1.00"}
      ]}}}
    </script>
  `;
  const parsed = parseFlameSeriesSlug("2");
  assert.ok(parsed);
  const chapters = FLAME_TEST_UTILS.parseFlameSeriesChaptersFromNextData(html, parsed);
  assert.ok(chapters);
  assert.equal(chapters.length, 2);
  const bySlug = Object.fromEntries(chapters.map((c) => [c.slug, c.title]));
  assert.equal(bySlug["b3efed246c5ee10d"], "Prologue");
  assert.equal(bySlug["aaaaaaaaaaaaaaaa"], "Later chapter");
});

test("buildImageUrlsFromChapterPayload uses novels folder when only novel_id is set", () => {
  const urls = FLAME_TEST_UTILS.buildImageUrlsFromChapterPayload({
    novel_id: 8,
    token: "abcdabcdabcdabcd",
    release_date: 1,
    images: {
      "0": { name: "p.jpg" },
    },
  });
  assert.deepEqual(urls, [
    "https://cdn.flamecomics.xyz/uploads/images/novels/8/abcdabcdabcdabcd/p.jpg?1",
  ]);
});
