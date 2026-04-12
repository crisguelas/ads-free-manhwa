import { unstable_cache } from "next/cache";
import { flameOverviewPageUrl, parseFlameSeriesSlug } from "@/lib/flame-series-slug";
import { decodeBasicHtmlEntities } from "@/lib/html-entities";
import { resolveAsuraSeriesSlug } from "@/lib/sources/adapters/asura-source-adapter";

const ASURA_BASE_URL = "https://asurascans.com";
const FETCH_TIMEOUT_MS = 12_000;

/**
 * Strips simple HTML tags for synopsis snippets embedded in JSON fields.
 */
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Pulls og:description or meta description from raw HTML.
 */
export function extractSynopsisFromMetaHtml(html: string): string | null {
  const ogOrdered = html.match(
    /property="og:description"\s+content="([^"]*)"/i,
  );
  const ogReversed = html.match(
    /content="([^"]*)"\s+[^>]*property="og:description"/i,
  );
  const raw = ogOrdered?.[1] ?? ogReversed?.[1];
  if (raw) {
    const t = decodeBasicHtmlEntities(raw).trim();
    return t.length > 0 ? t : null;
  }
  const meta = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  if (meta?.[1]) {
    const t = decodeBasicHtmlEntities(meta[1]).trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

type FlameSeriesPayload = {
  synopsis: string | null;
  status: string | null;
};

/**
 * Parses Flame `__NEXT_DATA__` once for synopsis and publication status.
 */
function parseFlameSeriesPayload(html: string): FlameSeriesPayload {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match?.[1]) {
    return {
      synopsis: extractSynopsisFromMetaHtml(html),
      status: null,
    };
  }
  try {
    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: { series?: Record<string, unknown> } };
    };
    const series = data.props?.pageProps?.series;
    if (!series || typeof series !== "object") {
      return {
        synopsis: extractSynopsisFromMetaHtml(html),
        status: null,
      };
    }
    let synopsis: string | null = null;
    for (const key of ["description", "synopsis", "summary", "overview"] as const) {
      const v = series[key];
      if (typeof v === "string" && v.trim().length > 0) {
        synopsis = stripHtmlTags(decodeBasicHtmlEntities(v));
        break;
      }
    }
    if (!synopsis) {
      synopsis = extractSynopsisFromMetaHtml(html);
    }
    const statusRaw =
      series.status ?? series.series_status ?? series.publication_status;
    const status =
      typeof statusRaw === "string" && statusRaw.trim().length > 0
        ? decodeBasicHtmlEntities(statusRaw).trim()
        : null;
    return { synopsis, status };
  } catch {
    return {
      synopsis: extractSynopsisFromMetaHtml(html),
      status: null,
    };
  }
}

/**
 * Reads a synopsis-like field from Flame’s embedded `__NEXT_DATA__` when present.
 */
export function extractFlameSynopsisFromSeriesHtml(html: string): string | null {
  return parseFlameSeriesPayload(html).synopsis;
}

/**
 * Best-effort scan status from Asura series HTML (badges / visible labels).
 */
export function extractAsuraSeriesStatusFromHtml(html: string): string | null {
  const safeHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  
  // High confidence: adjacent to "Status" label
  const m = safeHtml.match(
    /Status(?:<\/?[^>]+>|\s|&nbsp;|:)*(ongoing|completed|complete|hiatus|dropped|finished)\b/i,
  );
  if (m?.[1]) return m[1].trim();

  // Fallback: bounded tightly by tags (typical badge layout)
  const m2 = safeHtml.match(
    />\s*(ongoing|completed|hiatus|dropped|finished)\s*</i,
  );
  if (m2?.[1]) return m2[1].trim();

  return null;
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

export type SeriesPageMeta = {
  synopsis: string | null;
  status: string | null;
};

/**
 * Fetches synopsis + status from the series page HTML once per source/slug (daily cache).
 */
export function getCachedSeriesPageMeta(
  sourceKey: string,
  seriesSlug: string,
): Promise<SeriesPageMeta> {
  return unstable_cache(
    async (): Promise<SeriesPageMeta> => {
      if (sourceKey === "asura-scans") {
        const resolved = await resolveAsuraSeriesSlug(seriesSlug.trim());
        if (!resolved) {
          return { synopsis: null, status: null };
        }
        const html = await fetchHtml(`${ASURA_BASE_URL}/comics/${resolved}`);
        if (!html) {
          return { synopsis: null, status: null };
        }
        return {
          synopsis: extractSynopsisFromMetaHtml(html),
          status: extractAsuraSeriesStatusFromHtml(html),
        };
      }
      if (sourceKey === "flame-scans") {
        const parsed = parseFlameSeriesSlug(seriesSlug.trim());
        if (!parsed) {
          return { synopsis: null, status: null };
        }
        const html = await fetchHtml(flameOverviewPageUrl(parsed));
        if (!html) {
          return { synopsis: null, status: null };
        }
        const { synopsis, status } = parseFlameSeriesPayload(html);
        return { synopsis, status };
      }
      return { synopsis: null, status: null };
    },
    ["series-page-meta", "v2", sourceKey, seriesSlug],
    { revalidate: 86_400 },
  )();
}

/**
 * Loads synopsis text only (shares cache with {@link getCachedSeriesPageMeta}).
 */
export async function getCachedSeriesSynopsis(
  sourceKey: string,
  seriesSlug: string,
): Promise<string | null> {
  const meta = await getCachedSeriesPageMeta(sourceKey, seriesSlug);
  return meta.synopsis;
}
