import { decodeBasicHtmlEntities } from "@/lib/html-entities";

/**
 * Normalizes `Follow.seriesTitle` before persistence: trim and decode HTML entities so DB rows match human-readable titles.
 */
export function normalizeFollowSeriesTitleForStorage(raw: string): string {
  return decodeBasicHtmlEntities(raw.trim());
}

/**
 * Normalizes a stored follow title for API/UI: decode entities (legacy rows) and trim whitespace.
 */
export function displayFollowSeriesTitle(stored: string): string {
  return decodeBasicHtmlEntities(stored).trim();
}
