import assert from "node:assert/strict";
import test from "node:test";
import { pickRowWhenSeriesSlugSpansScanSources } from "@/lib/follow-source-disambiguation";

test("pickRowWhenSeriesSlugSpansScanSources returns first row when multiple rows exist", () => {
  const first = { source: { key: "asura-scans" as const }, n: 1 };
  const second = { source: { key: "legacy-source" as const }, n: 2 };
  assert.equal(pickRowWhenSeriesSlugSpansScanSources([first, second]), first);
});

test("pickRowWhenSeriesSlugSpansScanSources returns the sole row when only one follow exists", () => {
  const only = { source: { key: "asura-scans" as const } };
  assert.equal(pickRowWhenSeriesSlugSpansScanSources([only]), only);
});
