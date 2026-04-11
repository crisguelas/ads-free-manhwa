import { unstable_cache } from "next/cache";
import type { CatalogHighlight } from "@/lib/featured-series";
import { CATALOG_HIGHLIGHTS } from "@/lib/featured-series";
import { flameOverviewPageUrl, parseFlameSeriesSlug } from "@/lib/flame-series-slug";
import { stripAsuraHashSuffix } from "@/lib/live-source-browse";
import { fetchAsuraSeriesCoverUrl } from "@/lib/sources/adapters/asura-source-adapter";

const FETCH_TIMEOUT_MS = 12_000;

/**
 * Pulls `og:image` from raw HTML for series pages (Asura / Flame).
 */
function extractOgImageFromHtml(html: string): string | null {
  const ordered = html.match(/property="og:image"\s+content="([^"]+)"/i);
  if (ordered?.[1]) {
    return ordered[1].trim();
  }
  const reversed = html.match(
    /content="([^"]+)"\s+[^>]*property="og:image"/i,
  );
  if (reversed?.[1]) {
    return reversed[1].trim();
  }
  return null;
}

/**
 * Loads Flame manhwa or novel overview HTML and returns the Open Graph image when present.
 */
async function fetchFlameSeriesCoverFromPage(seriesSlug: string): Promise<string | null> {
  const parsed = parseFlameSeriesSlug(seriesSlug.trim());
  if (!parsed) {
    return null;
  }
  const pageUrl = flameOverviewPageUrl(parsed);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(pageUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const html = await response.text();
    return extractOgImageFromHtml(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Wraps Asura cover lookup in a day-long cache so the home page does not refetch HTML for every slug on each request.
 */
function getCachedAsuraCover(slug: string): Promise<string | null> {
  return unstable_cache(
    async () => fetchAsuraSeriesCoverUrl(slug),
    ["asura-series-cover", "v2", slug],
    { revalidate: 86_400 },
  )();
}

/**
 * Caches Flame `og:image` per app series slug (manhwa id or `novel-{id}`).
 */
function getCachedFlameCover(seriesSlug: string): Promise<string | null> {
  return unstable_cache(
    async () => fetchFlameSeriesCoverFromPage(seriesSlug),
    ["flame-series-cover", "v2", seriesSlug],
    { revalidate: 86_400 },
  )();
}

/**
 * Returns a static `coverImageUrl` from `CATALOG_HIGHLIGHTS` when the series slug matches (Asura hashes normalized).
 */
function staticCatalogCoverFallback(
  sourceKey: string,
  seriesSlug: string,
): string | null {
  const normalized =
    sourceKey === "asura-scans" ? stripAsuraHashSuffix(seriesSlug) : seriesSlug.trim();
  for (const entry of CATALOG_HIGHLIGHTS) {
    if (entry.sourceKey !== sourceKey) {
      continue;
    }
    const entryNorm =
      sourceKey === "asura-scans"
        ? stripAsuraHashSuffix(entry.seriesSlug)
        : entry.seriesSlug.trim();
    if (entryNorm === normalized || entry.seriesSlug === seriesSlug) {
      return entry.coverImageUrl;
    }
  }
  return null;
}

/**
 * Resolves a poster URL for a series using the same pipeline as home catalog tiles: cached live `og:image`, then curated static URLs.
 * Call this when `Follow.coverImageUrl` is unset so “Continue reading” tiles are not blank for history-only series.
 */
export async function resolveSeriesCoverUrl(
  sourceKey: string,
  seriesSlug: string,
): Promise<string | null> {
  if (sourceKey === "asura-scans") {
    try {
      const live = await getCachedAsuraCover(seriesSlug);
      if (live) {
        return live;
      }
    } catch {
      /* use static fallback */
    }
    return staticCatalogCoverFallback(sourceKey, seriesSlug);
  }

  if (sourceKey === "flame-scans") {
    try {
      const live = await getCachedFlameCover(seriesSlug);
      if (live) {
        return live;
      }
    } catch {
      /* use static fallback */
    }
    return staticCatalogCoverFallback(sourceKey, seriesSlug);
  }

  return null;
}

/**
 * Refreshes cover URLs from each site’s series page (`og:image`) so stale CDN filenames do not break tiles.
 * Falls back to `featured-series.ts` values when live fetch fails.
 */
export async function enrichCatalogHighlightCovers(
  highlights: CatalogHighlight[],
): Promise<CatalogHighlight[]> {
  return Promise.all(
    highlights.map(async (entry) => {
      if (entry.sourceKey === "asura-scans") {
        try {
          const live = await getCachedAsuraCover(entry.seriesSlug);
          if (live) {
            return { ...entry, coverImageUrl: live };
          }
        } catch {
          /* keep static fallback */
        }
        return entry;
      }

      if (entry.sourceKey === "flame-scans") {
        try {
          const live = await getCachedFlameCover(entry.seriesSlug);
          if (live) {
            return { ...entry, coverImageUrl: live };
          }
        } catch {
          /* keep static fallback */
        }
        return entry;
      }

      return entry;
    }),
  );
}
