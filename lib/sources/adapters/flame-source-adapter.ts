import type {
  SourceAdapter,
  SourceChapterDetail,
  SourceChapterSummary,
} from "@/lib/sources/types";
import {
  recordParserFailure,
  recordParserSuccess,
} from "@/lib/sources/adapter-observability";

/**
 * Base URL for Flame Comics (scanlation site).
 */
const FLAME_BASE_URL = "https://flamecomics.xyz";

/**
 * CDN base used for chapter page assets referenced in `__NEXT_DATA__` and `<img>` tags.
 */
const FLAME_CDN_HOST = "cdn.flamecomics.xyz";

const REQUEST_TIMEOUT_MS = 10000;

/**
 * Describes JSON shape under `props.pageProps.chapter` in Flame chapter pages.
 */
type FlameNextChapterPayload = {
  series_id: number;
  token: string;
  chapter_title?: string;
  title?: string;
  release_date?: number;
  unix_timestamp?: number;
  images?: Record<string, { name: string }>;
};

/**
 * Describes parsed `__NEXT_DATA__` root used for chapter image extraction.
 */
type FlameNextData = {
  props?: {
    pageProps?: {
      chapter?: FlameNextChapterPayload;
    };
  };
};

/**
 * Fetches HTML with timeout; returns empty string on failure.
 */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
 * Parses Flame `seriesSlug`: must be the numeric series id (e.g. `"2"` for ORV).
 */
function parseFlameSeriesId(seriesSlug: string): string | null {
  const trimmed = seriesSlug.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  const seriesPath = trimmed.match(/^series\/(\d+)$/i);
  if (seriesPath?.[1]) {
    return seriesPath[1];
  }
  return null;
}

/**
 * Parses a numeric chapter order from Flame link text (e.g. "Chapter 306 - Part 8").
 */
function parseChapterOrderFromTitle(title: string): number {
  const match = title.match(/Chapter\s+([\d.]+)/i);
  if (match?.[1]) {
    const n = Number(match[1]);
    return Number.isFinite(n) ? n : -1;
  }
  return -1;
}

/**
 * Extracts chapter rows from series page HTML (full chapter URLs and anchor titles).
 */
function extractChapterSummaries(
  seriesId: string,
  html: string,
): SourceChapterSummary[] {
  const titleByToken = new Map<string, string>();
  const anchorPattern = new RegExp(
    `<a[^>]+href="(?:${escapeRegex(FLAME_BASE_URL)})?/series/${seriesId}/([a-f0-9]{16})"[^>]*>([^<]*)</a>`,
    "gi",
  );
  for (const match of html.matchAll(anchorPattern)) {
    const token = match[1]?.toLowerCase();
    const label = match[2]?.trim();
    if (token && label && !titleByToken.has(token)) {
      titleByToken.set(token, label);
    }
  }

  const seen = new Set<string>();
  const chapters: SourceChapterSummary[] = [];
  const urlPattern =
    /https:\/\/flamecomics\.xyz\/series\/(\d+)\/([a-f0-9]{16})/gi;

  for (const match of html.matchAll(urlPattern)) {
    const id = match[1];
    const token = match[2]?.toLowerCase();
    if (id !== seriesId || !token || seen.has(token)) {
      continue;
    }
    seen.add(token);
    const title = titleByToken.get(token) ?? `Chapter ${token}`;
    chapters.push({
      slug: token,
      title,
      url: `${FLAME_BASE_URL}/series/${seriesId}/${token}`,
      chapterLabel: title,
    });
  }

  return chapters.sort(
    (a, b) =>
      parseChapterOrderFromTitle(a.title) - parseChapterOrderFromTitle(b.title),
  );
}

/**
 * Escapes regex special characters in a string.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parses `__NEXT_DATA__` JSON from chapter HTML when present.
 */
function parseNextData(html: string): FlameNextData | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match?.[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]) as FlameNextData;
  } catch {
    return null;
  }
}

/**
 * Builds ordered image URLs from Flame chapter JSON (CDN path pattern).
 */
function buildImageUrlsFromChapterPayload(
  chapter: FlameNextChapterPayload,
): string[] {
  const images = chapter.images;
  if (!images || typeof images !== "object") {
    return [];
  }
  const seriesId = chapter.series_id;
  const token = chapter.token;
  const cacheBuster =
    chapter.release_date ?? chapter.unix_timestamp ?? "";
  const suffix = cacheBuster !== "" ? `?${cacheBuster}` : "";
  const base = `https://${FLAME_CDN_HOST}/uploads/images/series/${seriesId}/${token}/`;

  return Object.keys(images)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      const entry = images[key];
      return entry?.name ? `${base}${entry.name}${suffix}` : "";
    })
    .filter(Boolean);
}

/**
 * Fallback: pulls chapter image URLs from `<img src="https://cdn.../uploads/images/series/...">`.
 */
function extractChapterImagesFromImgTags(html: string): string[] {
  const pattern = new RegExp(
    `src="(https://${escapeRegex(FLAME_CDN_HOST)}/uploads/images/series/\\d+/[a-f0-9]{16}/[^"\\s]+\\.(?:jpg|jpeg|png|webp)[^"]*)"`,
    "gi",
  );
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    const url = match[1];
    if (!url || url.includes("/assets/read/") || seen.has(url)) {
      continue;
    }
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/**
 * Detects login-only or blocked chapter views from HTML text.
 */
function detectAuthGuard(html: string): boolean {
  const markers = ["log in to continue", "login to continue", "please log in"];
  const lower = html.toLowerCase();
  return markers.some((m) => lower.includes(m));
}

/**
 * Emits structured info logs for diagnostics.
 */
function logFlameEvent(event: string, payload: Record<string, unknown>): void {
  console.info(`[flame-adapter] ${event}`, payload);
}

/**
 * Emits structured warning logs for failures.
 */
function logFlameError(payload: Record<string, unknown>): void {
  console.warn("[flame-adapter] error", payload);
}

/**
 * Live adapter for Flame Comics (`https://flamecomics.xyz/`).
 * Expects `seriesSlug` to be the numeric series id (e.g. `"2"`). Chapter `slug` is the 16-char hex token in URLs.
 */
export class FlameSourceAdapter implements SourceAdapter {
  /**
   * Adapter registry key matching `Source.key`.
   */
  public readonly key = "flame-scans";

  /**
   * Display name for UI and logs.
   */
  public readonly name = "Flame Comics Adapter";

  /**
   * Lists chapters by scraping the series page.
   */
  public async listSeriesChapters(
    seriesSlug: string,
  ): Promise<SourceChapterSummary[]> {
    const seriesId = parseFlameSeriesId(seriesSlug);
    if (!seriesId) {
      logFlameError({
        code: "invalid-slug",
        message: "Flame series slug must be the numeric series id (e.g. 2).",
        seriesSlug,
      });
      return [];
    }

    const url = `${FLAME_BASE_URL}/series/${seriesId}`;
    const html = await fetchHtml(url);
    if (!html) {
      logFlameError({
        code: "network",
        message: "Failed to fetch Flame series page.",
        url,
      });
      return [];
    }

    const chapters = extractChapterSummaries(seriesId, html);
    if (chapters.length === 0) {
      recordParserFailure("flame-scans", "No chapter links parsed from series page.");
      logFlameError({
        code: "parse-failed",
        message: "No chapter links found.",
        url,
      });
      return [];
    }

    recordParserSuccess("flame-scans");
    logFlameEvent("chapters_parsed", { seriesId, chapterCount: chapters.length });
    return chapters;
  }

  /**
   * Loads chapter images from `__NEXT_DATA__` with `<img>` fallback.
   */
  public async getChapterDetail(
    seriesSlug: string,
    chapterSlug: string,
  ): Promise<SourceChapterDetail | null> {
    const seriesId = parseFlameSeriesId(seriesSlug);
    if (!seriesId) {
      return null;
    }

    if (!/^[a-f0-9]{16}$/i.test(chapterSlug.trim())) {
      logFlameError({
        code: "invalid-token",
        message: "Flame chapter slug must be the 16-character hex token.",
        chapterSlug,
      });
      return null;
    }

    const token = chapterSlug.trim().toLowerCase();
    const chapterUrl = `${FLAME_BASE_URL}/series/${seriesId}/${token}`;
    const html = await fetchHtml(chapterUrl);
    if (!html) {
      logFlameError({ code: "network", message: "Empty chapter HTML.", chapterUrl });
      return null;
    }

    if (detectAuthGuard(html)) {
      logFlameError({ code: "auth-required", chapterUrl });
      return null;
    }

    const nextData = parseNextData(html);
    const chapterPayload = nextData?.props?.pageProps?.chapter;
    let imageUrls = chapterPayload
      ? buildImageUrlsFromChapterPayload(chapterPayload)
      : [];

    if (imageUrls.length === 0) {
      imageUrls = extractChapterImagesFromImgTags(html);
    }

    if (imageUrls.length === 0) {
      recordParserFailure("flame-scans", "Chapter images empty after JSON and img fallback.");
      logFlameError({ code: "parse-failed", chapterUrl });
      return null;
    }

    recordParserSuccess("flame-scans");

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const rawTitle = titleMatch?.[1]?.trim() ?? `Chapter ${token}`;
    const title = rawTitle.replace(/\s*-\s*Flame Comics\s*$/i, "").trim();

    logFlameEvent("chapter_images_detected", {
      seriesId,
      token,
      imageCount: imageUrls.length,
    });

    return {
      slug: token,
      title,
      url: chapterUrl,
      imageUrls,
    };
  }
}

/**
 * Test-only helpers (parsers) for regression tests.
 */
export const FLAME_TEST_UTILS = {
  parseFlameSeriesId,
  extractChapterSummaries,
  parseNextData,
  buildImageUrlsFromChapterPayload,
};
