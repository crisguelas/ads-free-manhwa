import test from "node:test";
import assert from "node:assert/strict";
import { parseReadingProgressBody } from "@/lib/reading-progress";

/**
 * Ensures valid JSON bodies map to a normalized payload.
 */
test("parseReadingProgressBody accepts a well-formed body", () => {
  const result = parseReadingProgressBody({
    sourceKey: "asura-scans",
    seriesSlug: "solo-leveling",
    chapterSlug: "chapter-200",
    chapterTitle: "Chapter 1",
    chapterUrl: "https://asurascans.com/comics/solo-leveling/chapter-200",
    pageNumber: 3,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.pageNumber, 3);
    assert.equal(result.value.chapterTitle, "Chapter 1");
  }
});

/**
 * Ensures required string fields are enforced.
 */
test("parseReadingProgressBody rejects missing slugs", () => {
  const result = parseReadingProgressBody({
    sourceKey: "",
    seriesSlug: "2",
    chapterSlug: "x",
    chapterTitle: "",
    chapterUrl: null,
    pageNumber: 1,
  });
  assert.equal(result.ok, false);
});

/**
 * Ensures page index must be a positive integer.
 */
test("parseReadingProgressBody rejects invalid pageNumber", () => {
  const result = parseReadingProgressBody({
    sourceKey: "asura-scans",
    seriesSlug: "a",
    chapterSlug: "b",
    chapterTitle: "t",
    chapterUrl: null,
    pageNumber: 0,
  });
  assert.equal(result.ok, false);
});

/**
 * Ensures chapterUrl is either absent, null, or parseable as an absolute URL.
 */
test("parseReadingProgressBody rejects bad chapterUrl", () => {
  const result = parseReadingProgressBody({
    sourceKey: "asura-scans",
    seriesSlug: "a",
    chapterSlug: "b",
    chapterTitle: "t",
    chapterUrl: "not-a-url",
    pageNumber: 1,
  });
  assert.equal(result.ok, false);
});
