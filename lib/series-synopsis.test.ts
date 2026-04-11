import test from "node:test";
import assert from "node:assert/strict";
import {
  extractAsuraSeriesStatusFromHtml,
  extractFlameSynopsisFromSeriesHtml,
  extractSynopsisFromMetaHtml,
} from "@/lib/series-synopsis";

test("extractSynopsisFromMetaHtml reads og:description", () => {
  const html = `<meta property="og:description" content="Hello &amp; world" />`;
  assert.equal(extractSynopsisFromMetaHtml(html), "Hello & world");
});

test("extractFlameSynopsisFromSeriesHtml reads description from __NEXT_DATA__", () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"series":{"description":"<p>Plot here</p>"}}}}</script>`;
  assert.equal(extractFlameSynopsisFromSeriesHtml(html), "Plot here");
});

test("extractAsuraSeriesStatusFromHtml finds common labels", () => {
  assert.equal(extractAsuraSeriesStatusFromHtml("foo Ongoing bar"), "Ongoing");
  assert.equal(extractAsuraSeriesStatusFromHtml("status completed"), "completed");
});
