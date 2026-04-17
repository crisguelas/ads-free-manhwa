import { unstable_cache } from "next/cache";
import { decodeBasicHtmlEntities } from "@/lib/html-entities";
import { resolveAsuraSeriesSlug } from "@/lib/sources/adapters/asura-source-adapter";
import { fetchHtml } from "@/lib/fetch-utils";

const ASURA_BASE_URL = "https://asurascans.com";

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
