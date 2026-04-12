import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ASURA_TEST_UTILS } from "@/lib/sources/adapters/asura-source-adapter";
import {
  getSourceMetricSnapshot,
  recordParserFailure,
} from "@/lib/sources/adapter-observability";

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
    ["not-a-chapter", "9", "10.5", "11"],
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

/**
 * Verifies parser failure counters are tracked for alert-threshold monitoring.
 */
test("parser failure metrics increment in observability state", () => {
  const before = getSourceMetricSnapshot("asura-scans");
  recordParserFailure("asura-scans", "synthetic parser failure for regression test");
  const after = getSourceMetricSnapshot("asura-scans");

  assert.equal(after.parserFailures.length, before.parserFailures.length + 1);
});

/**
 * Verifies the RSC pages payload parser extracts image URLs in the server-defined order.
 * This is critical for Asura's hex-hash filenames which cannot be sorted numerically.
 */
test("extractImagesFromRscPagesPayload returns images in correct reading order", async () => {
  const html = await loadFixture("asura-chapter-rsc-pages.fixture.html");
  const imageUrls = ASURA_TEST_UTILS.extractImagesFromRscPagesPayload(html);

  assert.deepEqual(imageUrls, [
    "https://cdn.asurascans.com/asura-images/chapters/test-series/5/aa1111.webp",
    "https://cdn.asurascans.com/asura-images/chapters/test-series/5/bb2222.webp",
    "https://cdn.asurascans.com/asura-images/chapters/test-series/5/cc3333.webp",
  ]);
});

/**
 * Verifies extractChapterImages prefers the RSC payload path over the regex fallback.
 * With hex-hash filenames the regex fallback would sort them alphabetically (wrong order).
 */
test("extractChapterImages uses RSC payload when present, preserving reading order", async () => {
  const html = await loadFixture("asura-chapter-rsc-pages.fixture.html");
  const imageUrls = ASURA_TEST_UTILS.extractChapterImages(html);

  // Order must match the RSC payload sequence, not alphabetical hash sort
  assert.deepEqual(imageUrls, [
    "https://cdn.asurascans.com/asura-images/chapters/test-series/5/aa1111.webp",
    "https://cdn.asurascans.com/asura-images/chapters/test-series/5/bb2222.webp",
    "https://cdn.asurascans.com/asura-images/chapters/test-series/5/cc3333.webp",
  ]);
});

/**
 * Verifies extractImagesFromRscPagesPayload returns null for HTML without the payload.
 */
test("extractImagesFromRscPagesPayload returns null when RSC payload is absent", async () => {
  const html = await loadFixture("asura-chapter-images.fixture.html");
  const result = ASURA_TEST_UTILS.extractImagesFromRscPagesPayload(html);
  assert.equal(result, null);
});
