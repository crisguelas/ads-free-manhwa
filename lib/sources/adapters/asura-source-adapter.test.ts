import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ASURA_TEST_UTILS } from "@/lib/sources/adapters/asura-source-adapter";

/**
 * Loads a fixture file used by parser regression tests.
 */
async function loadFixture(fileName: string): Promise<string> {
  const fixturePath = join(
    process.cwd(),
    "lib",
    "sources",
    "adapters",
    "__fixtures__",
    fileName,
  );
  return readFile(fixturePath, "utf8");
}

/**
 * Verifies chapter extraction keeps unique items and descending order.
 */
test("extractChapterSummaries parses unique chapter slugs with fallback links", async () => {
  const html = await loadFixture("asura-chapter-list.fixture.html");
  const chapters = ASURA_TEST_UTILS.extractChapterSummaries(
    "the-great-mage-returns-abcdef12",
    html,
  );

  assert.equal(chapters.length, 4);
  assert.deepEqual(
    chapters.map((chapter) => chapter.slug),
    ["11", "10.5", "9", "not-a-chapter"],
  );
});

/**
 * Verifies image extraction supports mixed patterns and removes known non-page assets.
 */
test("extractChapterImages parses mixed image patterns and filters avatar/logo assets", async () => {
  const html = await loadFixture("asura-chapter-images.fixture.html");
  const imageUrls = ASURA_TEST_UTILS.extractChapterImages(html);

  assert.deepEqual(imageUrls, [
    "https://cdn.asura.example.com/chapters/100/001.jpg",
    "https://cdn.asura.example.com/chapters/100/002.webp",
    "https://cdn.asura.example.com/chapters/100/003.png",
  ]);
});

/**
 * Verifies auth-guard marker detection remains case-insensitive and broad enough.
 */
test("detectAuthGuard flags premium/login prompts", () => {
  assert.equal(
    ASURA_TEST_UTILS.detectAuthGuard("<div>Log in to continue this Premium Chapter</div>"),
    true,
  );
  assert.equal(
    ASURA_TEST_UTILS.detectAuthGuard("<div>Normal chapter content</div>"),
    false,
  );
});
