import test from "node:test";
import assert from "node:assert/strict";
import {
  maxAsuraBrowsePageFromHtml,
  parseAsuraBrowseCardsHtml,
  stripAsuraHashSuffix,
} from "@/lib/live-source-browse";

test("stripAsuraHashSuffix removes trailing hash segment", () => {
  assert.equal(stripAsuraHashSuffix("solo-leveling-75e30c62"), "solo-leveling");
});

test("stripAsuraHashSuffix leaves slug without hash unchanged", () => {
  assert.equal(stripAsuraHashSuffix("nano-machine"), "nano-machine");
});

test("maxAsuraBrowsePageFromHtml returns 1 when no pagination links", () => {
  assert.equal(maxAsuraBrowsePageFromHtml("<html></html>"), 1);
});

test("maxAsuraBrowsePageFromHtml finds highest linked page in HTML (nav may show only a short window)", () => {
  const html = `<a href="/browse?page=2">2</a><a href="/browse?page=5">5</a>`;
  assert.equal(maxAsuraBrowsePageFromHtml(html), 5);
});

test("parseAsuraBrowseCardsHtml extracts slug title and cover", () => {
  const html = `
    <div class="series-card group bg-[#1f1a2e]">
      <a href="/comics/test-series-abc12345" class="block">
        <img src="https://cdn.asurascans.com/cover.webp" alt="Test &amp; Title" class="w-full">
      </a>
    </div>
  `;
  const rows = parseAsuraBrowseCardsHtml(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].seriesSlug, "test-series-abc12345");
  assert.equal(rows[0].title, "Test & Title");
  assert.equal(rows[0].coverImageUrl, "https://cdn.asurascans.com/cover.webp");
  assert.equal(rows[0].sourceKey, "asura-scans");
});
