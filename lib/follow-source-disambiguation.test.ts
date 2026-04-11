import assert from "node:assert/strict";
import test from "node:test";
import { pickRowWhenSeriesSlugSpansScanSources } from "@/lib/follow-source-disambiguation";

test("pickRowWhenSeriesSlugSpansScanSources prefers Flame for all-digit slugs when both sources exist", () => {
  const flame = { source: { key: "flame-scans" as const }, n: 1 };
  const asura = { source: { key: "asura-scans" as const }, n: 2 };
  assert.equal(pickRowWhenSeriesSlugSpansScanSources([flame, asura], "89"), flame);
  assert.equal(pickRowWhenSeriesSlugSpansScanSources([asura, flame], "2"), flame);
});

test("pickRowWhenSeriesSlugSpansScanSources prefers Asura for non-numeric slugs when both exist", () => {
  const flame = { source: { key: "flame-scans" as const }, n: 1 };
  const asura = { source: { key: "asura-scans" as const }, n: 2 };
  assert.equal(pickRowWhenSeriesSlugSpansScanSources([flame, asura], "solo-leveling"), asura);
});

test("pickRowWhenSeriesSlugSpansScanSources returns the sole row when only one follow exists", () => {
  const only = { source: { key: "flame-scans" as const } };
  assert.equal(pickRowWhenSeriesSlugSpansScanSources([only], "2"), only);
});
