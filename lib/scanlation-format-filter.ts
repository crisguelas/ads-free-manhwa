/**
 * Shared allowlist for “comic strip” formats surfaced in browse/home catalog scrapes.
 * Excludes text novels, generic “comic”, and other unsupported labels unless added here.
 */
const SCANLATION_FORMAT_ALLOWLIST = new Set([
  "manhwa",
  "manga",
  "manhua",
  "webtoon",
]);

/**
 * Returns true when `raw` is exactly one of manhwa / manga / manhua / webtoon (ASCII, case-insensitive, trimmed).
 */
export function isAllowedScanlationFormatLabel(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return SCANLATION_FORMAT_ALLOWLIST.has(t);
}
