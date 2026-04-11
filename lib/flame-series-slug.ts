/**
 * Flame hosts manhwa under `/series/{id}` and web novels under `/novel/{id}` with separate numeric id spaces.
 * App slugs: plain digits = manhwa; `novel-{id}` = web novel (browse JSON may only set `novel_id`).
 */
export type FlameContentKind = "series" | "novel";

export type ParsedFlameSeriesSlug = {
  /** Numeric id as used in Flame URLs (without `novel-` prefix). */
  numericId: string;
  contentKind: FlameContentKind;
};

/**
 * Parses stored `seriesSlug` values for Flame routes: `42` and `series/42` → manhwa; `novel-8` → web novel id 8.
 */
export function parseFlameSeriesSlug(seriesSlug: string): ParsedFlameSeriesSlug | null {
  const t = seriesSlug.trim();
  const novel = t.match(/^novel-(\d+)$/i);
  if (novel?.[1]) {
    return { numericId: novel[1], contentKind: "novel" };
  }
  if (/^\d+$/.test(t)) {
    return { numericId: t, contentKind: "series" };
  }
  const legacy = t.match(/^series\/(\d+)$/i);
  if (legacy?.[1]) {
    return { numericId: legacy[1], contentKind: "series" };
  }
  return null;
}

/**
 * Public series or novel overview URL on flamecomics.xyz (no chapter token).
 */
export function flameOverviewPageUrl(parsed: ParsedFlameSeriesSlug): string {
  return `https://flamecomics.xyz/${parsed.contentKind}/${parsed.numericId}`;
}

/**
 * True for app slugs that refer to Flame **web novels** (`novel-{id}`), not manhwa (`/series/{id}`). These are hidden from home/browse/continue-reading so links target the comic (`/manhwa/2`) instead of a parallel novel entry.
 */
export function isFlameWebNovelSeriesSlug(seriesSlug: string): boolean {
  return /^novel-\d+$/i.test(seriesSlug.trim());
}
