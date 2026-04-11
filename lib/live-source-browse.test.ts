import test from "node:test";
import assert from "node:assert/strict";
import {
  maxAsuraBrowsePageFromHtml,
  parseAsuraBrowseCardsHtml,
  parseFlameBrowseSeriesByRecency,
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

test("parseFlameBrowseSeriesByRecency orders by last_edit descending", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"series":[
        {"series_id":1,"title":"Old","type":"Manhwa","last_edit":100},
        {"series_id":2,"title":"New","type":"Manhwa","last_edit":900},
        {"series_id":3,"title":"Mid","type":"Manga","last_edit":400}
      ]}}}
    </script>
  `;
  const rows = parseFlameBrowseSeriesByRecency(html);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].seriesSlug, "2");
  assert.equal(rows[0].title, "New");
  assert.equal(rows[1].seriesSlug, "3");
  assert.equal(rows[2].seriesSlug, "1");
});

test("parseFlameBrowseSeriesByRecency drops web-novel-only JSON rows", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"series":[
        {"novel_id":8,"title":"Web Novel Title","type":"Web Novel","last_edit":999,"cover":"thumbnail.webp"}
      ]}}}
    </script>
  `;
  const rows = parseFlameBrowseSeriesByRecency(html);
  assert.equal(rows.length, 0);
});

test("parseFlameBrowseSeriesByRecency drops Flame series whose type is not manhwa/manga/manhua/webtoon", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"series":[
        {"series_id":1,"title":"Keep","type":"Manhwa","last_edit":500},
        {"series_id":2,"title":"Drop Comic","type":"Comic","last_edit":900}
      ]}}}
    </script>
  `;
  const rows = parseFlameBrowseSeriesByRecency(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].seriesSlug, "1");
  assert.equal(rows[0].title, "Keep");
});

test("parseFlameBrowseSeriesByRecency keeps Flame series typed Webtoon", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"series":[
        {"series_id":10,"title":"WT","type":"Webtoon","last_edit":100}
      ]}}}
    </script>
  `;
  const rows = parseFlameBrowseSeriesByRecency(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].seriesSlug, "10");
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
