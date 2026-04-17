import test from "node:test";
import assert from "node:assert/strict";
import {
  extractAsuraSeriesStatusFromHtml,
  extractSynopsisFromMetaHtml,
} from "@/lib/series-synopsis";

test("extractSynopsisFromMetaHtml reads og:description", () => {
  const html = `<meta property="og:description" content="Hello &amp; world" />`;
  assert.equal(extractSynopsisFromMetaHtml(html), "Hello & world");
});

test("extractAsuraSeriesStatusFromHtml finds common labels", () => {
  assert.equal(extractAsuraSeriesStatusFromHtml("foo Ongoing bar"), "Ongoing");
  assert.equal(extractAsuraSeriesStatusFromHtml("status completed"), "completed");
});
