import assert from "node:assert/strict";
import test from "node:test";
import { displayFollowSeriesTitle, normalizeFollowSeriesTitleForStorage } from "@/lib/follow-series-title";

test("normalizeFollowSeriesTitleForStorage trims and decodes entities", () => {
  assert.equal(normalizeFollowSeriesTitleForStorage("  A&#x27;s B  "), "A's B");
});

test("displayFollowSeriesTitle decodes legacy stored titles", () => {
  assert.equal(displayFollowSeriesTitle("A Dragonslayer&#x27;s Peerless Regression"), "A Dragonslayer's Peerless Regression");
});
