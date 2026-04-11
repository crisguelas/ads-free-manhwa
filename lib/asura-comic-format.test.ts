import test from "node:test";
import assert from "node:assert/strict";
import { extractAsuraComicFormatFromSeriesHtml } from "@/lib/asura-comic-format";

test("extractAsuraComicFormatFromSeriesHtml reads hero format pill after purple dot", () => {
  const html = `
    <div><span class="w-2.5 h-2.5 rounded-full bg-[#913FE2]"></span>
    <span class="text-base font-bold text-[#913FE2] uppercase"> manhwa </span></div>`;
  assert.equal(extractAsuraComicFormatFromSeriesHtml(html), "manhwa");
});

test("extractAsuraComicFormatFromSeriesHtml falls back to first uppercase format keyword", () => {
  const html = `<span class="text-xs font-bold uppercase"> comic </span>`;
  assert.equal(extractAsuraComicFormatFromSeriesHtml(html), "comic");
});
