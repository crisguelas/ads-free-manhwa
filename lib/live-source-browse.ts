import { unstable_cache } from "next/cache";
import { extractAsuraComicFormatFromSeriesHtml } from "@/lib/asura-comic-format";
import type { BrowseSourceKey } from "@/lib/browse-constants";
import type { CatalogHighlight } from "@/lib/featured-series";
import { CATALOG_HIGHLIGHTS } from "@/lib/featured-series";
import { fetchHtml } from "@/lib/fetch-utils";
import { decodeBasicHtmlEntities } from "@/lib/html-entities";
import { isAllowedScanlationFormatLabel } from "@/lib/scanlation-format-filter";
import { getSourceAdapter } from "@/lib/sources/registry";

const ASURA_BASE_URL = "https://asurascans.com";
const ASURA_BROWSE_MAX_PAGES = 120;
const ASURA_FORMAT_FETCH_CONCURRENCY = 12;
const HOME_LATEST_PER_SOURCE = 12;
const HOME_LATEST_REVALIDATE_SEC = 1800;

/**
 * One series row scraped from Asura's public browse HTML.
 */
export type LiveBrowseRow = {
  seriesSlug: string;
  title: string;
  coverImageUrl: string | null;
  sourceKey: BrowseSourceKey;
  latestChapterLabel?: string;
  formatLabel?: string;
};

/**
 * Strips Asura's trailing hash segment so curated slugs match live slugs.
 */
export function stripAsuraHashSuffix(slug: string): string {
  return slug.replace(/-[a-z0-9]{8,}$/i, "");
}

/**
 * Reads the highest page number linked from an Asura browse HTML payload.
 */
export function maxAsuraBrowsePageFromHtml(html: string): number {
  let max = 1;
  for (const match of html.matchAll(/href="\/browse\?page=(\d+)"/g)) {
    const n = parseInt(match[1] ?? "1", 10);
    if (Number.isFinite(n) && n > max) {
      max = n;
    }
  }
  return Math.min(max, ASURA_BROWSE_MAX_PAGES);
}

/**
 * Parses series cards from one Asura `/browse` HTML page.
 */
export function parseAsuraBrowseCardsHtml(html: string): LiveBrowseRow[] {
  const chunks = html.split("series-card group");
  const rows: LiveBrowseRow[] = [];
  for (let i = 1; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const hrefMatch = chunk.match(/href="\/(comics|series)\/([^"]+)"/);
    if (!hrefMatch?.[2]) {
      continue;
    }
    const slug = hrefMatch[2];
    const orderedImg = chunk.match(/<img[^>]+src="(https?:\/\/[^"]+)"[^>]*alt="([^"]*)"/i);
    const reversedImg = chunk.match(/<img[^>]+alt="([^"]*)"[^>]+src="(https?:\/\/[^"]+)"/i);
    let cover: string | null = null;
    let title = slug;
    if (orderedImg) {
      cover = orderedImg[1];
      title = decodeBasicHtmlEntities(orderedImg[2] || slug);
    } else if (reversedImg) {
      cover = reversedImg[2];
      title = decodeBasicHtmlEntities(reversedImg[1] || slug);
    }
    const chapterMatch = chunk.match(/Chapter\s+[\d.]+/i);
    const cardFormatLabel = parseAsuraFormatLabelFromCardChunk(chunk);
    rows.push({
      seriesSlug: slug,
      title: title.trim() || slug,
      coverImageUrl: cover,
      sourceKey: "asura-scans",
      latestChapterLabel: chapterMatch?.[0] ?? undefined,
      formatLabel: cardFormatLabel ?? undefined,
    });
  }
  return rows;
}

/**
 * Reads a coarse format/type label from one Asura browse card when present.
 */
function parseAsuraFormatLabelFromCardChunk(chunk: string): string | null {
  const candidates = ["manhwa", "manga", "manhua", "webtoon", "comic", "novel"];
  const lowered = chunk.toLowerCase();
  for (const c of candidates) {
    if (new RegExp(`\\b${c}\\b`, "i").test(lowered)) {
      return c;
    }
  }
  return null;
}

/**
 * Keeps Asura browse rows with supported format labels.
 */
async function filterAsuraLiveBrowseRowsToAllowedFormats(
  rows: LiveBrowseRow[],
): Promise<LiveBrowseRow[]> {
  const out: LiveBrowseRow[] = [];
  for (let i = 0; i < rows.length; i += ASURA_FORMAT_FETCH_CONCURRENCY) {
    const chunk = rows.slice(i, i + ASURA_FORMAT_FETCH_CONCURRENCY);
    const batch = await Promise.all(
      chunk.map(async (row) => {
        const html = await fetchHtml(`${ASURA_BASE_URL}/comics/${row.seriesSlug}`);
        if (!html) {
          return row;
        }
        const label = extractAsuraComicFormatFromSeriesHtml(html);
        if (!label) {
          return row;
        }
        return isAllowedScanlationFormatLabel(label) ? row : null;
      }),
    );
    for (const r of batch) {
      if (r) {
        out.push(r);
      }
    }
  }
  return out;
}

/**
 * Loads every Asura browse page and dedupes by full comic slug.
 */
async function fetchAllAsuraBrowseRows(): Promise<LiveBrowseRow[]> {
  const bySlug = new Map<string, LiveBrowseRow>();
  const BATCH_SIZE = 6;
  let page = 1;
  let keepGoing = true;

  while (page <= ASURA_BROWSE_MAX_PAGES && keepGoing) {
    const promises = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const current = page + i;
      if (current > ASURA_BROWSE_MAX_PAGES) break;
      const url = current === 1 ? `${ASURA_BASE_URL}/browse` : `${ASURA_BASE_URL}/browse?page=${current}`;
      promises.push(fetchHtml(url));
    }

    const results = await Promise.all(promises);
    for (const html of results) {
      if (!html) {
        keepGoing = false;
        break;
      }
      const rows = parseAsuraBrowseCardsHtml(html);
      if (rows.length === 0) {
        keepGoing = false;
        break;
      }
      let newlyAdded = 0;
      for (const row of rows) {
        if (!bySlug.has(row.seriesSlug)) {
          bySlug.set(row.seriesSlug, row);
          newlyAdded += 1;
        }
      }
      if (newlyAdded === 0 && rows.length > 0) {
        keepGoing = false;
        break;
      }
    }
    page += BATCH_SIZE;
  }

  return filterAsuraLiveBrowseRowsToAllowedFormats([...bySlug.values()]);
}

/**
 * Converts a live scrape row into the shared catalog highlight shape.
 */
function liveRowToHighlight(row: LiveBrowseRow): CatalogHighlight {
  return {
    id: `live-${row.sourceKey}-${row.seriesSlug}`,
    seriesSlug: row.seriesSlug,
    title: row.title,
    coverImageUrl: row.coverImageUrl,
    sourceName: "Asura Scans",
    sourceKey: row.sourceKey,
    genres: [],
    latestChapter: row.latestChapterLabel ? { title: row.latestChapterLabel } : undefined,
  };
}

/**
 * Curated fallback when Asura scrape is unreachable.
 */
function fallbackAsuraLatestHighlights(): CatalogHighlight[] {
  return CATALOG_HIGHLIGHTS.filter((h) => h.sourceKey === "asura-scans").slice(0, HOME_LATEST_PER_SOURCE);
}

/**
 * Backfills Asura latest chapter labels for home cards when card HTML lacks chapter text.
 */
async function enrichAsuraRowsWithLatestChapterLabels(rows: LiveBrowseRow[]): Promise<LiveBrowseRow[]> {
  const adapter = getSourceAdapter("asura-scans");
  if (!adapter) {
    return rows;
  }
  const out = [...rows];
  const CONCURRENCY = 6;
  for (let i = 0; i < out.length; i += CONCURRENCY) {
    const chunk = out.slice(i, i + CONCURRENCY);
    const resolved = await Promise.all(
      chunk.map(async (row) => {
        if (row.latestChapterLabel?.trim()) {
          return row;
        }
        const chapters = await adapter.listSeriesChapters(row.seriesSlug);
        if (chapters.length === 0) {
          return row;
        }
        const latest = chapters[chapters.length - 1];
        return { ...row, latestChapterLabel: latest?.title?.trim() || row.latestChapterLabel };
      }),
    );
    for (let j = 0; j < resolved.length; j += 1) {
      out[i + j] = resolved[j];
    }
  }
  return out;
}

/**
 * Loads Asura series in browse-page order for the home dashboard.
 */
export function getHomeLatestAsuraHighlights(): Promise<CatalogHighlight[]> {
  return unstable_cache(
    async () => {
      const html = await fetchHtml(`${ASURA_BASE_URL}/browse`);
      if (!html) {
        return fallbackAsuraLatestHighlights();
      }
      const rows = parseAsuraBrowseCardsHtml(html)
        .filter((row) => {
          if (!row.formatLabel) {
            return true;
          }
          return isAllowedScanlationFormatLabel(row.formatLabel);
        })
        .slice(0, HOME_LATEST_PER_SOURCE);
      if (rows.length === 0) {
        return fallbackAsuraLatestHighlights();
      }
      const enriched = await enrichAsuraRowsWithLatestChapterLabels(rows);
      return enriched.map(liveRowToHighlight);
    },
    ["home-latest-asura", "v6"],
    { revalidate: HOME_LATEST_REVALIDATE_SEC },
  )();
}

/**
 * Merges live Asura rows with curated entries missing from live lists.
 */
function mergeAsuraWithCurated(
  live: LiveBrowseRow[],
  curated: CatalogHighlight[],
): CatalogHighlight[] {
  const map = new Map<string, CatalogHighlight>();
  for (const row of live) {
    map.set(row.seriesSlug, liveRowToHighlight(row));
  }
  const bases = new Set([...map.keys()].map((slug) => stripAsuraHashSuffix(slug)));
  for (const c of curated) {
    if (c.sourceKey !== "asura-scans") {
      continue;
    }
    const base = stripAsuraHashSuffix(c.seriesSlug);
    if (map.has(c.seriesSlug) || bases.has(base)) {
      continue;
    }
    map.set(c.seriesSlug, c);
    bases.add(base);
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Cached Asura browse scrape to avoid host hammering across paginated requests.
 */
function getCachedAsuraLiveRows(): Promise<LiveBrowseRow[]> {
  return unstable_cache(async () => fetchAllAsuraBrowseRows(), ["live-asura-browse-series", "v5"], {
    revalidate: 3600,
  })();
}

/**
 * Builds the full browse catalog for one source key.
 */
export async function buildLiveBrowseCatalogForSource(
  sourceKey: BrowseSourceKey,
): Promise<CatalogHighlight[]> {
  if (sourceKey !== "asura-scans") {
    return [];
  }
  const live = await getCachedAsuraLiveRows();
  if (live.length === 0) {
    return CATALOG_HIGHLIGHTS.filter((h) => h.sourceKey === "asura-scans");
  }
  return mergeAsuraWithCurated(live, CATALOG_HIGHLIGHTS);
}
