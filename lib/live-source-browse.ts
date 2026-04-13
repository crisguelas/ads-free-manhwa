import { unstable_cache } from "next/cache";
import { extractAsuraComicFormatFromSeriesHtml } from "@/lib/asura-comic-format";
import type { CatalogHighlight } from "@/lib/featured-series";
import { CATALOG_HIGHLIGHTS } from "@/lib/featured-series";
import type { BrowseSourceKey } from "@/lib/browse-constants";
import { isFlameWebNovelSeriesSlug } from "@/lib/flame-series-slug";
import { decodeBasicHtmlEntities } from "@/lib/html-entities";
import { isAllowedScanlationFormatLabel } from "@/lib/scanlation-format-filter";
import { getSourceAdapter } from "@/lib/sources/registry";

import { fetchHtml, fetchHtmlWithOptions } from "@/lib/fetch-utils";
import { fetchFlameSeriesOverviewHomeExtras } from "@/lib/sources/adapters/flame-source-adapter";
const ASURA_BASE_URL = "https://asurascans.com";
const FLAME_BROWSE_URL = "https://flamecomics.xyz/browse";
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
  /** Latest chapter label parsed from the browse card (if available); avoids per-series adapter calls. */
  latestChapterLabel?: string;
  /** Optional format/type label parsed from card payload (used to avoid extra per-row requests on home latest). */
  formatLabel?: string;
};

/**
 * Strips Asura’s trailing hash segment so curated slugs match live slugs.
 */
export function stripAsuraHashSuffix(slug: string): string {
  return slug.replace(/-[a-z0-9]{8,}$/i, "");
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
    // Extract latest chapter label from the card markup (e.g. "Chapter 123") without making per-series adapter calls.
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
 * This avoids one `/comics/{slug}` fetch per tile for the home latest strip.
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
  const BATCH_SIZE = 6;
  let page = 1;
  let keepGoing = true;

  while (page <= ASURA_BROWSE_MAX_PAGES && keepGoing) {
    const promises = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const current = page + i;
      if (current > ASURA_BROWSE_MAX_PAGES) break;
      const url =
        current === 1
          ? `${ASURA_BASE_URL}/browse`
          : `${ASURA_BASE_URL}/browse?page=${current}`;
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
          newlyAdded++;
        }
      }

      // Early exit: if we just parsed a full page but all series were already seen,
      // the site is likely returning duplicate fallback pages beyond its true last page.
      if (newlyAdded === 0 && rows.length > 0) {
        keepGoing = false;
        break;
      }
    }
    page += BATCH_SIZE;
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
  const chapterBySeriesSlug = parseFlameLatestChapterLabelsBySeriesSlug(html);
  return sorted.flatMap((s) => {
    const row = flameJsonSeriesToRow(s);
    if (row) {
      row.latestChapterLabel = chapterBySeriesSlug.get(row.seriesSlug);
    }
    return row ? [row] : [];
  });
}

/**
 * Parses Flame browse card links and extracts chapter labels keyed by series slug.
 * Expected pattern: `/series/{id}/{token}` or `/novel/{id}/{token}` with visible "Chapter ..." text.
 */
function parseFlameLatestChapterLabelsBySeriesSlug(
  html: string,
): Map<string, string> {
  const out = new Map<string, string>();
  const linkPattern =
    /href="\/(series|novel)\/(\d+)\/[a-f0-9]{16}"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const kind = match[1];
    const id = match[2];
    const rawText = decodeBasicHtmlEntities(
      (match[3] ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    );
    const chapterMatch = rawText.match(/Chapter\s+[\d.]+(?:\s*-\s*[^|]+)?/i);
    if (!chapterMatch?.[0]) {
      continue;
    }
    const seriesSlug = kind === "novel" ? `novel-${id}` : id;
    if (!out.has(seriesSlug)) {
      out.set(seriesSlug, chapterMatch[0].trim());
    }
  }
  return out;
}

/**
 * Fetches Flame browse HTML and extracts the embedded series list.
 * Unlike Asura, Flame’s `/browse` SSR includes the **full** `pageProps.series` array in `__NEXT_DATA__`
 * (extra `?page=` URLs repeat the same payload); we do not paginate network requests for Flame.
 */
async function fetchFlameBrowseHtml(): Promise<string> {
  const attemptUrls = [
    FLAME_BROWSE_URL,
    `${FLAME_BROWSE_URL}/`,
    `${FLAME_BROWSE_URL}?page=1`,
    `${FLAME_BROWSE_URL}?_=${Date.now()}`,
  ];
  for (const url of attemptUrls) {
    const html = await fetchHtmlWithOptions(url, {
      timeoutMs: 22_000,
      referer: "https://flamecomics.xyz/",
    });
    if (!html) {
      continue;
    }
    if (html.includes("__NEXT_DATA__")) {
      return html;
    }
  }
  return "";
}

/**
 * Loads Flame browse rows from the best available browse HTML response.
 */
async function fetchFlameBrowseRows(): Promise<LiveBrowseRow[]> {
  const html = await fetchFlameBrowseHtml();
  if (!html) {
    return [];
  }
  const rows = parseFlameBrowseSeriesHtml(html);
  if (rows.length > 0) {
    return rows;
  }
  return [];
}

/**
 * Backfills Flame latest chapter labels for home cards by asking the adapter only when the browse payload has no chapter text.
 * This runs on the home latest cache window (30m), not per request.
 */
async function enrichFlameRowsWithLatestChapterLabels(
  rows: LiveBrowseRow[],
): Promise<LiveBrowseRow[]> {
  const adapter = getSourceAdapter("flame-scans");
  if (!adapter) {
    return rows;
  }
  const out = [...rows];
  /** Fewer parallel series-page fetches so Flame upstream is less likely to throttle or time out on Vercel. */
  const CONCURRENCY = 4;
  for (let i = 0; i < out.length; i += CONCURRENCY) {
    const chunk = out.slice(i, i + CONCURRENCY);
    const resolved = await Promise.all(
      chunk.map(async (row) => {
        if (row.latestChapterLabel?.trim()) {
          return row;
        }
        const extras = await fetchFlameSeriesOverviewHomeExtras(row.seriesSlug);
        let merged: LiveBrowseRow = {
          ...row,
          coverImageUrl: extras.coverImageUrl || row.coverImageUrl,
          latestChapterLabel: extras.latestChapterTitle ?? row.latestChapterLabel,
        };
        if (!merged.latestChapterLabel?.trim()) {
          const chapters = await adapter.listSeriesChapters(row.seriesSlug);
          if (chapters.length > 0) {
            const latest = chapters[chapters.length - 1];
            merged = {
              ...merged,
              latestChapterLabel: latest?.title?.trim() || merged.latestChapterLabel,
            };
          }
        }
        return merged;
      }),
    );
    for (let j = 0; j < resolved.length; j += 1) {
      out[i + j] = resolved[j];
    }
  }
  return out;
}

/**
 * Backfills Asura latest chapter labels for home cards using the live adapter when card HTML lacks chapter text.
 * This runs on the home latest cache window (30m), not per request.
 */
async function enrichAsuraRowsWithLatestChapterLabels(
  rows: LiveBrowseRow[],
): Promise<LiveBrowseRow[]> {
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
        return {
          ...row,
          latestChapterLabel: latest?.title?.trim() || row.latestChapterLabel,
        };
      }),
    );
    for (let j = 0; j < resolved.length; j += 1) {
      out[i + j] = resolved[j];
    }
  }
  return out;
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
    latestChapter: row.latestChapterLabel
      ? { title: row.latestChapterLabel }
      : undefined,
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
      // Chapter labels and coarse format labels are extracted from card HTML at parse time.
      // This avoids per-series adapter calls and per-row `/comics/{slug}` lookups on home requests.
      return enriched.map(liveRowToHighlight);
    },
    ["home-latest-asura", "v5"],
    { revalidate: HOME_LATEST_REVALIDATE_SEC },
  )();
}

/**
 * Loads Flame series ordered by `last_edit` for the home dashboard.
 */
export function getHomeLatestFlameHighlights(): Promise<CatalogHighlight[]> {
  return unstable_cache(
    async () => {
      const html = await fetchFlameBrowseHtml();
      if (!html) {
        return fallbackFlameLatestHighlights();
      }
      let rows = parseFlameBrowseSeriesByRecency(html)
        .filter((row) => !isFlameWebNovelSeriesSlug(row.seriesSlug))
        .slice(0, HOME_LATEST_PER_SOURCE);
      if (rows.length === 0) {
        return fallbackFlameLatestHighlights();
      }
      rows = await enrichFlameRowsWithLatestChapterLabels(rows);
      return rows.map(liveRowToHighlight);
    },
    ["home-latest-flame", "v8"],
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
    async () => {
      const rows = await fetchFlameBrowseRows();
      if (rows.length === 0) {
        // Throw so stale cache remains usable during transient upstream failures.
        throw new Error("Flame browse scrape returned zero rows.");
      }
      return rows;
    },
    ["live-flame-browse-series", "v8"],
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
  let flameRows: LiveBrowseRow[] = [];
  try {
    const live = await getCachedFlameLiveRows();
    flameRows = live.filter((row) => !isFlameWebNovelSeriesSlug(row.seriesSlug));
  } catch {
    // If cache revalidation failed, retry direct fetch once before using curated fallback.
    const retryRows = await fetchFlameBrowseRows();
    flameRows = retryRows.filter((row) => !isFlameWebNovelSeriesSlug(row.seriesSlug));
  }
  if (flameRows.length === 0) {
    const retryRows = await fetchFlameBrowseRows();
    flameRows = retryRows.filter((row) => !isFlameWebNovelSeriesSlug(row.seriesSlug));
  }
  if (flameRows.length === 0) {
    return CATALOG_HIGHLIGHTS.filter((h) => h.sourceKey === "flame-scans");
  }
  return mergeFlameWithCurated(flameRows, CATALOG_HIGHLIGHTS);
}
