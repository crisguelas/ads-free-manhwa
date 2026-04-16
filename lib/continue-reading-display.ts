import { decodeBasicHtmlEntities } from "@/lib/html-entities";

/**
 * Normalizes Asura slugs by removing the trailing hash suffix segment used on some comic URLs.
 */
function stripAsuraHashSuffix(slug: string): string {
  return slug.replace(/-[a-z0-9]{8,}$/i, "");
}

/**
 * Escapes a string for safe use inside a `RegExp` constructor when stripping redundant chapter prefixes.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds stable dedupe keys: Asura comic slugs with a trailing hash segment collapse to the same series as the unhashed slug.
 */
export function normalizeContinueReadingSeriesKey(sourceKey: string, seriesSlug: string): string {
  if (sourceKey === "asura-scans") {
    return stripAsuraHashSuffix(seriesSlug);
  }
  return seriesSlug;
}

/**
 * Ordered lookup keys for a follow row (`sourceId:seriesSlug`) so history rows with hashed Asura slugs still match follows saved under the shorter slug (or vice versa).
 */
export function followRowLookupKeys(
  sourceId: string,
  sourceKey: string,
  seriesSlug: string,
): string[] {
  const full = `${sourceId}:${seriesSlug}`;
  if (sourceKey !== "asura-scans") {
    return [full];
  }
  const stripped = stripAsuraHashSuffix(seriesSlug);
  if (stripped === seriesSlug) {
    return [full];
  }
  return [full, `${sourceId}:${stripped}`];
}

/**
 * Picks the first non-empty map value across candidate keys (cover URL, title, etc.).
 */
export function firstFollowMapValue<T>(
  keys: string[],
  map: Map<string, T | null | undefined>,
): T | null {
  for (const k of keys) {
    const v = map.get(k);
    if (v != null && v !== "") {
      return v as T;
    }
  }
  return null;
}

/**
 * Human-readable series line for continue-reading cards: strips accidental hash suffixes from stored titles and falls back to a cleaned slug (no Asura hash segment).
 */
export function displaySeriesTitleForContinueCard(
  seriesTitleFromFollow: string | null,
  sourceKey: string,
  seriesSlug: string,
): string {
  let t = seriesTitleFromFollow?.trim() ?? "";
  if (t) {
    t = t.replace(/\s+[a-f0-9]{8,}$/i, "").trim();
  }
  if (t) {
    return t;
  }
  const base = sourceKey === "asura-scans" ? stripAsuraHashSuffix(seriesSlug) : seriesSlug;
  if (/^\d+$/.test(base)) {
    return `Series ${base}`;
  }
  return base
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Chapter subtitle when the source repeats the series name (e.g. “The World After The End Chapter 155” under the same series heading).
 */
export function shortChapterLineForContinueCard(
  seriesTitleLine: string,
  chapterTitle: string | null,
  chapterSlug: string,
): string {
  const raw = chapterTitle?.trim() ? decodeBasicHtmlEntities(chapterTitle).trim() : "";
  if (raw) {
    const prefix = new RegExp(`^${escapeRegex(seriesTitleLine)}\\s*([\\-–—:|]+\\s*)?`, "i");
    const stripped = raw.replace(prefix, "").trim();
    if (stripped.length > 0) {
      return stripped;
    }
    return raw;
  }
  return chapterSlug.replace(/-/g, " ");
}

/**
 * Normalizes `<title>` / history strings before splitting “Series … Chapter n”.
 */
function cleanChapterPageTitleForSplit(chapterTitle: string | null): string | null {
  if (!chapterTitle?.trim()) {
    return null;
  }
  let s = decodeBasicHtmlEntities(chapterTitle).trim();
  s = s.replace(/\s*-\s*(Read Online|Premium)\s*\|.*$/i, "").trim();
  s = s.replace(/\s*-\s*(Read Online|Premium)\s*$/i, "").trim();
  s = s.replace(/\s*-\s*Flame Comics\s*$/i, "").trim();
  return s;
}

/**
 * True when `longer` starts with `shorter` as a whole-word prefix (e.g. “Solo” vs “Solo Leveling”), not “solo” vs “solomon”.
 */
function isWholeWordPrefix(shorter: string, longer: string): boolean {
  const a = shorter.trim().toLowerCase();
  const b = longer.trim().toLowerCase();
  if (a.length === 0 || b.length < a.length) {
    return false;
  }
  if (!b.startsWith(a)) {
    return false;
  }
  if (b.length === a.length) {
    return true;
  }
  return b[a.length] === " ";
}

/**
 * Splits page titles like “Solo Leveling Chapter 164” or “The World After The End Chapter 155” into series vs chapter tail.
 */
export function splitSeriesAndChapterFromPageTitle(chapterTitle: string | null): {
  seriesPart: string | null;
  chapterPart: string | null;
} {
  const s = cleanChapterPageTitleForSplit(chapterTitle);
  if (!s) {
    return { seriesPart: null, chapterPart: null };
  }
  const m = s.match(/^(.+?)\s+(chapter\s+[\d.]+(?:\.\d+)?)\s*$/i);
  if (!m?.[1] || !m?.[2]) {
    return { seriesPart: null, chapterPart: null };
  }
  const seriesPart = m[1].trim();
  const chapterPart = m[2].trim();
  if (seriesPart.length < 2) {
    return { seriesPart: null, chapterPart: null };
  }
  return { seriesPart, chapterPart };
}

/**
 * Picks consistent series + chapter lines for carousel tiles using `<title>` shape when present (fixes Flame “Series 89” + title in wrong row, and short follow titles like “Solo” vs “Solo Leveling Chapter …”).
 */
export function resolveContinueReadingCarouselLabels(input: {
  seriesTitle: string | null;
  sourceKey: string;
  seriesSlug: string;
  chapterTitle: string | null;
  chapterSlug: string;
}): { seriesLine: string; chapterLine: string } {
  const slugDerived = displaySeriesTitleForContinueCard(
    input.seriesTitle,
    input.sourceKey,
    input.seriesSlug,
  );
  const parsed = splitSeriesAndChapterFromPageTitle(input.chapterTitle);

  const chapterLine =
    parsed.chapterPart ??
    shortChapterLineForContinueCard(slugDerived, input.chapterTitle, input.chapterSlug);

  if (parsed.seriesPart && parsed.chapterPart) {
    const slugNorm = slugDerived.trim().toLowerCase();
    if (/^series \d+$/i.test(slugNorm)) {
      return { seriesLine: parsed.seriesPart, chapterLine };
    }
    const parsedSeries = parsed.seriesPart.trim();
    if (slugNorm === parsedSeries.toLowerCase()) {
      return { seriesLine: slugDerived, chapterLine };
    }
    if (isWholeWordPrefix(slugDerived, parsedSeries)) {
      return { seriesLine: parsedSeries, chapterLine };
    }
  }

  return { seriesLine: slugDerived, chapterLine };
}
