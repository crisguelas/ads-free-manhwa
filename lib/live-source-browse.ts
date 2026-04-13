import { unstable_cache } from "next/cache";
import { extractAsuraComicFormatFromSeriesHtml } from "@/lib/asura-comic-format";
import type { CatalogHighlight } from "@/lib/featured-series";
import { CATALOG_HIGHLIGHTS } from "@/lib/featured-series";
import type { BrowseSourceKey } from "@/lib/browse-constants";
import { isFlameWebNovelSeriesSlug } from "@/lib/flame-series-slug";
import { decodeBasicHtmlEntities } from "@/lib/html-entities";
import { isAllowedScanlationFormatLabel } from "@/lib/scanlation-format-filter";
import { getSourceAdapter } from "@/lib/sources/registry";

const ASURA_BASE_URL = "https://asurascans.com";
const FLAME_BROWSE_URL = "https://flamecomics.xyz/browse";
const FETCH_TIMEOUT_MS = 12_000;
/**
 * Safety cap for Asura `/browse?page=` walks. The site paginates beyond the few page links visible on page 1,
 * so we keep requesting until a page returns zero cards (see `fetchAllAsuraBrowseRows`).
 */
const ASURA_BROWSE_MAX_PAGES = 120;

/** Parallel cap when resolving Asura `/comics/{slug}` format pills (one fetch per catalog title per cache rebuild). */
const ASURA_FORMAT_FETCH_CONCURRENCY = 12;

/**
 * How many series appear in each home “latest updates” column (Asura vs Flame).
 * Cached separately from the full browse scrape so the dashboard can revalidate a bit more often.
 */
const HOME_LATEST_PER_SOURCE = 12;

/** Revalidate home latest panels a little sooner than the hourly full browse merge. */
const HOME_LATEST_REVALIDATE_SEC = 1800;

/**
 * One series row scraped from a source’s public browse HTML (before merging with curated overrides).
 */
export type LiveBrowseRow = {
  seriesSlug: string;
  title: string;
  coverImageUrl: string | null;
  sourceKey: BrowseSourceKey;
};

/**
 * Strips Asura’s trailing hash segment so curated slugs match live slugs.
 */
export function stripAsuraHashSuffix(slug: string): string {
  return slug.replace(/-[a-z0-9]{8,}$/i, "");
}

/**
 * Fetches remote HTML with timeout; returns empty string on failure.
 */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return "";
    }
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reads the highest page number linked from an Asura browse HTML payload.
 * The visible nav is often a short window (e.g. pages 1–5), so this must not be used as the total page count;
 * `fetchAllAsuraBrowseRows` walks pages until empty instead.
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
 * Parses series cards from one Asura `/browse` HTML page (cover + title from card markup).
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
    const orderedImg = chunk.match(
      /<img[^>]+src="(https?:\/\/[^"]+)"[^>]*alt="([^"]*)"/i,
    );
    const reversedImg = chunk.match(
      /<img[^>]+alt="([^"]*)"[^>]+src="(https?:\/\/[^"]+)"/i,
    );
    let cover: string | null = null;
    let title = slug;
    if (orderedImg) {
      cover = orderedImg[1];
      title = decodeBasicHtmlEntities(orderedImg[2] || slug);
    } else if (reversedImg) {
      cover = reversedImg[2];
      title = decodeBasicHtmlEntities(reversedImg[1] || slug);
    }
    rows.push({
      seriesSlug: slug,
      title: title.trim() || slug,
      coverImageUrl: cover,
      sourceKey: "asura-scans",
    });
  }
  return rows;
}

/**
 * Keeps Asura browse rows whose `/comics/{slug}` page advertises manhwa, manga, manhua, or webtoon.
 * Drops other labels (comic, novel, …). If a fetch fails or no label is found, the row is kept so transient HTML changes do not empty the catalog.
 */
async function filterAsuraLiveBrowseRowsToAllowedFormats(
  rows: LiveBrowseRow[],
): Promise<LiveBrowseRow[]> {
  const out: LiveBrowseRow[] = [];
  for (let i = 0; i < rows.length; i += ASURA_FORMAT_FETCH_CONCURRENCY) {
    const chunk = rows.slice(i, i + ASURA_FORMAT_FETCH_CONCURRENCY);
    const batch = await Promise.all(
      chunk.map(async (row) => {
        const html = await fetchHtml(
          `${ASURA_BASE_URL}/comics/${row.seriesSlug}`,
        );
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
 * Fetches `/browse`, then `/browse?page=2`, … until a page parses zero series cards or the safety cap is hit.
 * (The first-page HTML only links to a small window of next pages, so we cannot infer the last page from nav links.)
 */
async function fetchAllAsuraBrowseRows(): Promise<LiveBrowseRow[]> {
  const bySlug = new Map<string, LiveBrowseRow>();
  const ingest = (list: LiveBrowseRow[]) => {
    for (const row of list) {
      if (!bySlug.has(row.seriesSlug)) {
        bySlug.set(row.seriesSlug, row);
      }
    }
  };

  let page = 1;
  while (page <= ASURA_BROWSE_MAX_PAGES) {
    const url =
      page === 1
        ? `${ASURA_BASE_URL}/browse`
        : `${ASURA_BASE_URL}/browse?page=${page}`;
    const html = await fetchHtml(url);
    if (!html) {
      break;
    }
    const rows = parseAsuraBrowseCardsHtml(html);
    if (rows.length === 0) {
      break;
    }
    ingest(rows);
    page += 1;
  }

  return filterAsuraLiveBrowseRowsToAllowedFormats([...bySlug.values()]);
}

type FlameBrowseSeriesJson = {
  /** Manhwa / comic row (numeric id for `/series/{id}`). */
  series_id?: number;
  /** Web-novel row when `series_id` is absent (`/novel/{id}`). */
  novel_id?: number;
  /** Flame “Type” from browse JSON (Manhwa, Manga, Manhua, Comic, Web Novel, …). */
  type?: string;
  title: string;
  cover?: string;
  last_edit?: number;
};

/**
 * Parses Flame browse `__NEXT_DATA__` series array (SSR includes full list).
 */
export function parseFlameBrowseSeriesHtml(html: string): LiveBrowseRow[] {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match?.[1]) {
    return [];
  }
  let data: { props?: { pageProps?: { series?: FlameBrowseSeriesJson[] } } };
  try {
    data = JSON.parse(match[1]) as {
      props?: { pageProps?: { series?: FlameBrowseSeriesJson[] } };
    };
  } catch {
    return [];
  }
  const series = data.props?.pageProps?.series;
  if (!Array.isArray(series)) {
    return [];
  }
  return series.flatMap((s) => {
    const row = flameJsonSeriesToRow(s);
    return row ? [row] : [];
  });
}

/**
 * Maps one Flame browse JSON entry to a live row (cover URL includes cache-busting when `last_edit` exists).
 * Drops web-novel rows and non–manhwa/manga/manhua/webtoon `type` values so the catalog matches comic-strip content only.
 */
function flameJsonSeriesToRow(s: FlameBrowseSeriesJson): LiveBrowseRow | null {
  const hasSeries =
    s.series_id != null && Number.isFinite(Number(s.series_id));
  const hasNovel =
    s.novel_id != null && Number.isFinite(Number(s.novel_id));

  if (hasNovel) {
    return null;
  }

  let seriesSlug: string;
  /** CDN path under `uploads/images/` (manhwa uses `series/`, novels use `novels/`). */
  let imageFolder: string;

  if (hasSeries) {
    if (
      s.type != null &&
      s.type.trim().length > 0 &&
      !isAllowedScanlationFormatLabel(s.type)
    ) {
      return null;
    }
    seriesSlug = String(s.series_id);
    imageFolder = `series/${seriesSlug}`;
  } else {
    return null;
  }

  const file =
    typeof s.cover === "string" && s.cover.length > 0 ? s.cover : "thumbnail.png";
  const query = s.last_edit != null ? `?${s.last_edit}` : "";
  return {
    seriesSlug,
    title: decodeBasicHtmlEntities(s.title),
    coverImageUrl: `https://cdn.flamecomics.xyz/uploads/images/${imageFolder}/${file}${query}`,
    sourceKey: "flame-scans",
  };
}

/**
 * Parses Flame browse HTML and orders series by `last_edit` descending so the home page reflects recent site activity.
 */
export function parseFlameBrowseSeriesByRecency(html: string): LiveBrowseRow[] {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match?.[1]) {
    return [];
  }
  let data: { props?: { pageProps?: { series?: FlameBrowseSeriesJson[] } } };
  try {
    data = JSON.parse(match[1]) as {
      props?: { pageProps?: { series?: FlameBrowseSeriesJson[] } };
    };
  } catch {
    return [];
  }
  const series = data.props?.pageProps?.series;
  if (!Array.isArray(series)) {
    return [];
  }
  const sorted = [...series].sort(
    (a, b) => (b.last_edit ?? 0) - (a.last_edit ?? 0),
  );
  return sorted.flatMap((s) => {
    const row = flameJsonSeriesToRow(s);
    return row ? [row] : [];
  });
}

/**
 * Fetches Flame browse HTML and extracts the embedded series list.
 * Unlike Asura, Flame’s `/browse` SSR includes the **full** `pageProps.series` array in `__NEXT_DATA__`
 * (extra `?page=` URLs repeat the same payload); we do not paginate network requests for Flame.
 */
async function fetchFlameBrowseRows(): Promise<LiveBrowseRow[]> {
  const html = await fetchHtml(FLAME_BROWSE_URL);
  if (!html) {
    return [];
  }
  return parseFlameBrowseSeriesHtml(html);
}

/**
 * Converts a live scrape row into the shared catalog highlight shape for grids and pagination.
 */
function liveRowToHighlight(row: LiveBrowseRow): CatalogHighlight {
  return {
    id: `live-${row.sourceKey}-${row.seriesSlug}`,
    seriesSlug: row.seriesSlug,
    title: row.title,
    coverImageUrl: row.coverImageUrl,
    sourceName: row.sourceKey === "asura-scans" ? "Asura Scans" : "Flame Comics",
    sourceKey: row.sourceKey,
    genres: [],
  };
}

/**
 * Curated fallback when Asura’s first browse page is empty or unreachable.
 */
function fallbackAsuraLatestHighlights(): CatalogHighlight[] {
  return CATALOG_HIGHLIGHTS.filter((h) => h.sourceKey === "asura-scans").slice(
    0,
    HOME_LATEST_PER_SOURCE,
  );
}

/**
 * Curated fallback when Flame browse JSON is missing or unreachable.
 */
function fallbackFlameLatestHighlights(): CatalogHighlight[] {
  return CATALOG_HIGHLIGHTS.filter((h) => h.sourceKey === "flame-scans").slice(
    0,
    HOME_LATEST_PER_SOURCE,
  );
}

/**
 * Loads Asura series in browse-page order (first page only) for the home dashboard; revalidates on a shorter TTL than the full crawl.
 */
export function getHomeLatestAsuraHighlights(): Promise<CatalogHighlight[]> {
  return unstable_cache(
    async () => {
      const html = await fetchHtml(`${ASURA_BASE_URL}/browse`);
      if (!html) {
        return fallbackAsuraLatestHighlights();
      }
      const rows = parseAsuraBrowseCardsHtml(html).slice(0, HOME_LATEST_PER_SOURCE);
      const filtered = await filterAsuraLiveBrowseRowsToAllowedFormats(rows);
      if (filtered.length === 0) {
        return fallbackAsuraLatestHighlights();
      }
      
      const highlights = filtered.map(liveRowToHighlight);
      const adapter = getSourceAdapter("asura-scans");
      if (adapter) {
        await Promise.all(
          highlights.map(async (h) => {
            try {
              const chapters = await adapter.listSeriesChapters(h.seriesSlug);
              if (chapters.length > 0) {
                const latest = chapters[chapters.length - 1];
                h.latestChapter = {
                  title: latest.chapterLabel || latest.title,
                  slug: latest.slug,
                };
              }
            } catch {
              // Ignore timeouts or parsing failures silently for home card loading
            }
          })
        );
      }
      return highlights;
    },
    ["home-latest-asura", "v3"],
    { revalidate: HOME_LATEST_REVALIDATE_SEC },
  )();
}

/**
 * Loads Flame series ordered by `last_edit` for the home dashboard.
 */
export function getHomeLatestFlameHighlights(): Promise<CatalogHighlight[]> {
  return unstable_cache(
    async () => {
      const html = await fetchHtml(FLAME_BROWSE_URL);
      if (!html) {
        return fallbackFlameLatestHighlights();
      }
      const rows = parseFlameBrowseSeriesByRecency(html)
        .filter((row) => !isFlameWebNovelSeriesSlug(row.seriesSlug))
        .slice(0, HOME_LATEST_PER_SOURCE);
      if (rows.length === 0) {
        return fallbackFlameLatestHighlights();
      }
      
      const highlights = rows.map(liveRowToHighlight);
      const adapter = getSourceAdapter("flame-scans");
      if (adapter) {
        await Promise.all(
          highlights.map(async (h) => {
            try {
              const chapters = await adapter.listSeriesChapters(h.seriesSlug);
              if (chapters.length > 0) {
                const latest = chapters[chapters.length - 1];
                h.latestChapter = {
                  title: latest.chapterLabel || latest.title,
                  slug: latest.slug,
                };
              }
            } catch {
              // Ignore timeouts or parsing failures silently for home card loading
            }
          })
        );
      }
      return highlights;
    },
    ["home-latest-flame", "v5"],
    { revalidate: HOME_LATEST_REVALIDATE_SEC },
  )();
}

/**
 * Merges live Asura rows with curated entries that are missing from the site list (e.g. delisted slug).
 */
function mergeAsuraWithCurated(
  live: LiveBrowseRow[],
  curated: CatalogHighlight[],
): CatalogHighlight[] {
  const map = new Map<string, CatalogHighlight>();
  for (const row of live) {
    map.set(row.seriesSlug, liveRowToHighlight(row));
  }
  const bases = new Set(
    [...map.keys()].map((slug) => stripAsuraHashSuffix(slug)),
  );
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
 * Merges live Flame rows with curated-only series ids not present in the browse payload.
 */
function mergeFlameWithCurated(
  live: LiveBrowseRow[],
  curated: CatalogHighlight[],
): CatalogHighlight[] {
  const map = new Map<string, CatalogHighlight>();
  for (const row of live) {
    map.set(row.seriesSlug, liveRowToHighlight(row));
  }
  for (const c of curated) {
    if (c.sourceKey === "flame-scans" && !map.has(c.seriesSlug)) {
      map.set(c.seriesSlug, c);
    }
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Cached Asura browse scrape (hourly) to avoid hammering the host on every paginated request.
 */
function getCachedAsuraLiveRows(): Promise<LiveBrowseRow[]> {
  return unstable_cache(
    async () => fetchAllAsuraBrowseRows(),
    ["live-asura-browse-series", "v4"],
    { revalidate: 3600 },
  )();
}

/**
 * Cached Flame browse scrape (hourly).
 */
function getCachedFlameLiveRows(): Promise<LiveBrowseRow[]> {
  return unstable_cache(
    async () => fetchFlameBrowseRows(),
    ["live-flame-browse-series", "v5"],
    { revalidate: 3600 },
  )();
}

/**
 * Builds the full browse catalog for one source: live site list plus curated-only supplements.
 */
export async function buildLiveBrowseCatalogForSource(
  sourceKey: BrowseSourceKey,
): Promise<CatalogHighlight[]> {
  if (sourceKey === "asura-scans") {
    const live = await getCachedAsuraLiveRows();
    if (live.length === 0) {
      return CATALOG_HIGHLIGHTS.filter((h) => h.sourceKey === "asura-scans");
    }
    return mergeAsuraWithCurated(live, CATALOG_HIGHLIGHTS);
  }
  const live = await getCachedFlameLiveRows();
  const flameRows = live.filter((row) => !isFlameWebNovelSeriesSlug(row.seriesSlug));
  if (flameRows.length === 0) {
    return CATALOG_HIGHLIGHTS.filter((h) => h.sourceKey === "flame-scans");
  }
  return mergeFlameWithCurated(flameRows, CATALOG_HIGHLIGHTS);
}
