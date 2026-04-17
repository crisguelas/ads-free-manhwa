import assert from "node:assert/strict";
import test from "node:test";
import {
  displaySeriesTitleForContinueCard,
  normalizeContinueReadingSeriesKey,
  resolveContinueReadingCarouselLabels,
  shortChapterLineForContinueCard,
  splitSeriesAndChapterFromPageTitle,
} from "@/lib/continue-reading-display";

test("normalizeContinueReadingSeriesKey strips Asura hash slug suffix", () => {
  assert.equal(
    normalizeContinueReadingSeriesKey("asura-scans", "the-world-after-the-end-75e30c62"),
    "the-world-after-the-end",
  );
  assert.equal(normalizeContinueReadingSeriesKey("other-source", "2"), "2");
});

test("displaySeriesTitleForContinueCard strips trailing hash token from stored titles", () => {
  assert.equal(
    displaySeriesTitleForContinueCard("The World After The End 75e30c62", "asura-scans", "x"),
    "The World After The End",
  );
});

test("displaySeriesTitleForContinueCard derives clean title from hashed Asura slug when follow title missing", () => {
  assert.equal(
    displaySeriesTitleForContinueCard(null, "asura-scans", "the-world-after-the-end-75e30c62"),
    "The World After The End",
  );
});

test("shortChapterLineForContinueCard removes repeated series prefix from chapter title", () => {
  const line = shortChapterLineForContinueCard(
    "The World After The End",
    "The World After The End Chapter 155",
    "chapter-155",
  );
  assert.equal(line, "Chapter 155");
});

test("splitSeriesAndChapterFromPageTitle parses standard page titles", () => {
  assert.deepEqual(splitSeriesAndChapterFromPageTitle("Solo Leveling Chapter 164 - Read Online | Asura"), {
    seriesPart: "Solo Leveling",
    chapterPart: "Chapter 164",
  });
});

test("resolveContinueReadingCarouselLabels fixes short follow title vs full page title", () => {
  const out = resolveContinueReadingCarouselLabels({
    seriesTitle: "Solo",
    sourceKey: "asura-scans",
    seriesSlug: "solo-leveling",
    chapterTitle: "Solo Leveling Chapter 164 - Read Online",
    chapterSlug: "ch164",
  });
  assert.equal(out.seriesLine, "Solo Leveling");
  assert.equal(out.chapterLine, "Chapter 164");
});
