import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedScanlationFormatLabel } from "@/lib/scanlation-format-filter";

test("isAllowedScanlationFormatLabel accepts manhwa, manga, manhua, webtoon (case-insensitive)", () => {
  assert.equal(isAllowedScanlationFormatLabel("Manhwa"), true);
  assert.equal(isAllowedScanlationFormatLabel("manga"), true);
  assert.equal(isAllowedScanlationFormatLabel(" Manhua "), true);
  assert.equal(isAllowedScanlationFormatLabel("Webtoon"), true);
});

test("isAllowedScanlationFormatLabel rejects other labels", () => {
  assert.equal(isAllowedScanlationFormatLabel("Comic"), false);
  assert.equal(isAllowedScanlationFormatLabel("Web Novel"), false);
  assert.equal(isAllowedScanlationFormatLabel("Novel"), false);
});
