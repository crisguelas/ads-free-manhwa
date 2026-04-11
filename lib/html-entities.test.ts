import assert from "node:assert/strict";
import test from "node:test";
import { decodeBasicHtmlEntities } from "@/lib/html-entities";

test("decodeBasicHtmlEntities decodes hex apostrophe and ampersand", () => {
  assert.equal(
    decodeBasicHtmlEntities("A Dragonslayer&#x27;s Peerless Regression"),
    "A Dragonslayer's Peerless Regression",
  );
  assert.equal(decodeBasicHtmlEntities("Tom &amp; Jerry"), "Tom & Jerry");
});

test("decodeBasicHtmlEntities decodes decimal code points", () => {
  assert.equal(decodeBasicHtmlEntities("&#65;BC"), "ABC");
});
