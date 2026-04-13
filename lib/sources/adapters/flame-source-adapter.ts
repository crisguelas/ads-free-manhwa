import { fetchHtml, fetchHtmlWithOptions } from "@/lib/fetch-utils";
import {
  type ParsedFlameSeriesSlug,
  parseFlameSeriesSlug,
} from "@/lib/flame-series-slug";
import { decodeBasicHtmlEntities } from "@/lib/html-entities";
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

/**
 * Describes JSON shape under `props.pageProps.chapter` in Flame chapter pages.
 */
type FlameNextChapterPayload = {
  series_id?: number;
  novel_id?: number;
  token: string;
  chapter_title?: string;
  title?: string;
  release_date?: number;
  unix_timestamp?: number;
  images?: Record<string, { name: string }>;
  /** Web-novel chapters embed HTML with optional inline images instead of `images`. */
  content?: string;
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
 * One row from `props.pageProps.chapters` on Flame series/novel overview pages (authoritative titles).
 */
type FlameSeriesNextDataChapter = {
  token?: string;
  title?: string;
  chapter?: string;
  series_id?: number;
  novel_id?: number;
};

/**
 * Prefers embedded `__NEXT_DATA__.props.pageProps.chapters` so list rows show real chapter titles instead of `Chapter {hex}` when anchors are empty.
 */
function parseFlameSeriesChaptersFromNextData(
  html: string,
  parsed: ParsedFlameSeriesSlug,
): SourceChapterSummary[] | null {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match?.[1]) {
    return null;
  }
  let data: {
    props?: { pageProps?: { chapters?: FlameSeriesNextDataChapter[] } };
  };
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }
  const chapters = data.props?.pageProps?.chapters;
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return null;
  }
  const out: SourceChapterSummary[] = [];
  for (const c of chapters) {
    const token =
      typeof c.token === "string" ? c.token.trim().toLowerCase() : "";
    if (!/^[a-f0-9]{16}$/.test(token)) {
      continue;
    }
    if (parsed.contentKind === "series") {
      if (c.series_id != null && String(c.series_id) !== parsed.numericId) {
        continue;
      }
    } else if (c.novel_id != null && String(c.novel_id) !== parsed.numericId) {
      continue;
    }
    let title: string;
    const chapStr = typeof c.chapter === "string" ? c.chapter.trim() : "";
    const rawTitle = typeof c.title === "string" ? c.title.trim() : "";

    if (chapStr.length > 0 && rawTitle.length > 0) {
      title = `Chapter ${chapStr} - ${decodeBasicHtmlEntities(rawTitle)}`;
    } else if (rawTitle.length > 0) {
      title = decodeBasicHtmlEntities(rawTitle);
    } else if (chapStr.length > 0) {
      title = `Chapter ${chapStr}`;
    } else {
      title = `Chapter ${token}`;
    }
    out.push({
      slug: token,
      title,
      url: `${FLAME_BASE_URL}/${parsed.contentKind}/${parsed.numericId}/${token}`,
      chapterLabel: title,
    });
  }
  if (out.length === 0) {
    return null;
  }
  return out.sort(
    (a, b) =>
      parseChapterOrderFromTitle(a.title) - parseChapterOrderFromTitle(b.title),
  );
}

/**
 * Extracts chapter rows from a Flame series or novel overview page (anchor + absolute URLs).
 */
function extractChapterSummaries(
  parsed: ParsedFlameSeriesSlug,
  html: string,
): SourceChapterSummary[] {
  const { numericId, contentKind } = parsed;
  const titleByToken = new Map<string, string>();
  const anchorPattern = new RegExp(
    `<a[^>]+href="(?:${escapeRegex(FLAME_BASE_URL)})?/${contentKind}/${numericId}/([a-f0-9]{16})"[^>]*>([^<]*)</a>`,
    "gi",
  );
  for (const match of html.matchAll(anchorPattern)) {
    const token = match[1]?.toLowerCase();
    const label = match[2]?.trim();
    if (token && label && !titleByToken.has(token)) {
      titleByToken.set(token, decodeBasicHtmlEntities(label));
    }
  }

  const seen = new Set<string>();
  const chapters: SourceChapterSummary[] = [];
  const urlPattern = new RegExp(
    `https://flamecomics\\.xyz/${contentKind}/(\\d+)/([a-f0-9]{16})`,
    "gi",
  );

  for (const match of html.matchAll(urlPattern)) {
    const id = match[1];
    const token = match[2]?.toLowerCase();
    if (id !== numericId || !token || seen.has(token)) {
      continue;
    }
    seen.add(token);
    const title = titleByToken.get(token) ?? `Chapter ${token}`;
    chapters.push({
      slug: token,
      title,
      url: `${FLAME_BASE_URL}/${contentKind}/${numericId}/${token}`,
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
  const hostId = chapter.series_id ?? chapter.novel_id;
  if (hostId == null) {
    return [];
  }
  const token = chapter.token;
  const cacheBuster =
    chapter.release_date ?? chapter.unix_timestamp ?? "";
  const suffix = cacheBuster !== "" ? `?${cacheBuster}` : "";
  const folder = chapter.series_id != null ? "series" : "novels";
  const base = `https://${FLAME_CDN_HOST}/uploads/images/${folder}/${hostId}/${token}/`;

  return Object.keys(images)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      const entry = images[key];
      return entry?.name ? `${base}${entry.name}${suffix}` : "";
    })
    .filter(Boolean);
}

/**
 * Collects http(s) image URLs embedded in web-novel chapter HTML content.
 */
function extractHttpImagesFromNovelContent(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/src="(https?:\/\/[^"]+)"/gi)) {
    const u = match[1];
    if (u && !u.startsWith("data:") && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  return urls;
}

/**
 * Collects a limited number of inline `data:image/...` URLs from novel chapter HTML (reader can display them).
 */
function extractDataImageUrlsFromContent(html: string, max = 40): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/src="(data:image[^"]+)"/gi)) {
    const u = match[1];
    if (u && urls.length < max) {
      urls.push(u);
    }
  }
  return urls;
}

/**
 * Fallback: pulls chapter image URLs from `<img src="https://cdn.../uploads/images/series/...">`.
 */
function extractChapterImagesFromImgTags(html: string): string[] {
  const pattern = new RegExp(
    `src="(https://${escapeRegex(FLAME_CDN_HOST)}/uploads/images/(?:series|novels)/\\d+/[a-f0-9]{16}/[^"\\s]+\\.(?:jpg|jpeg|png|webp)[^"]*)"`,
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
 * Reads Open Graph image URL from a Flame HTML page (series overview or chapter).
 */
function extractOgImageFromSeriesHtml(html: string): string | null {
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
 * Fetches the Flame series/novel overview once and returns the newest chapter title and optional OG cover URL.
 * Uses a longer timeout and Referer than the default fetch helper so serverless runs (e.g. Vercel) are less likely to time out before `__NEXT_DATA__` parses.
 */
export async function fetchFlameSeriesOverviewHomeExtras(
  seriesSlug: string,
): Promise<{ latestChapterTitle: string | null; coverImageUrl: string | null }> {
  const parsed = parseFlameSeriesSlug(seriesSlug);
  if (!parsed) {
    return { latestChapterTitle: null, coverImageUrl: null };
  }
  const url = `${FLAME_BASE_URL}/${parsed.contentKind}/${parsed.numericId}`;
  const html = await fetchHtmlWithOptions(url, {
    timeoutMs: 28_000,
    referer: `${FLAME_BASE_URL}/browse`,
  });
  if (!html) {
    return { latestChapterTitle: null, coverImageUrl: null };
  }
  const chapters =
    parseFlameSeriesChaptersFromNextData(html, parsed) ??
    extractChapterSummaries(parsed, html);
  const latestChapterTitle =
    chapters.length > 0
      ? (chapters[chapters.length - 1]?.title?.trim() ?? null)
      : null;
  const coverImageUrl = extractOgImageFromSeriesHtml(html);
  return { latestChapterTitle, coverImageUrl };
}

/**
 * Live adapter for Flame Comics (`https://flamecomics.xyz/`).
 * Manhwa slugs are numeric (`"2"`); web novels use `novel-{id}` because browse JSON may only include `novel_id`.
 * Chapter `slug` is the 16-char hex token in URLs.
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
    const parsed = parseFlameSeriesSlug(seriesSlug);
    if (!parsed) {
      logFlameError({
        code: "invalid-slug",
        message:
          "Flame slug must be a numeric manhwa id or novel-{id} for web novels.",
        seriesSlug,
      });
      return [];
    }

    const url = `${FLAME_BASE_URL}/${parsed.contentKind}/${parsed.numericId}`;
    const html = await fetchHtmlWithOptions(url, {
      timeoutMs: 28_000,
      referer: `${FLAME_BASE_URL}/browse`,
    });
    if (!html) {
      logFlameError({
        code: "network",
        message: "Failed to fetch Flame series page.",
        url,
      });
      return [];
    }

    const chapters =
      parseFlameSeriesChaptersFromNextData(html, parsed) ??
      extractChapterSummaries(parsed, html);
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
    logFlameEvent("chapters_parsed", {
      seriesId: parsed.numericId,
      kind: parsed.contentKind,
      chapterCount: chapters.length,
    });
    return chapters;
  }

  /**
   * Loads chapter images from `__NEXT_DATA__` with `<img>` fallback.
   */
  public async getChapterDetail(
    seriesSlug: string,
    chapterSlug: string,
  ): Promise<SourceChapterDetail | null> {
    const parsed = parseFlameSeriesSlug(seriesSlug);
    if (!parsed) {
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
    const chapterUrl = `${FLAME_BASE_URL}/${parsed.contentKind}/${parsed.numericId}/${token}`;
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
    let imageUrls: string[] = [];

    if (chapterPayload) {
      if (parsed.contentKind === "series") {
        imageUrls = buildImageUrlsFromChapterPayload(chapterPayload);
      } else {
        const content = chapterPayload.content;
        if (typeof content === "string") {
          imageUrls = extractHttpImagesFromNovelContent(content);
          if (imageUrls.length === 0) {
            imageUrls = extractDataImageUrlsFromContent(content);
          }
        }
        if (imageUrls.length === 0) {
          imageUrls = buildImageUrlsFromChapterPayload(chapterPayload);
        }
      }
    }

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
    const title = decodeBasicHtmlEntities(
      rawTitle.replace(/\s*-\s*Flame Comics\s*$/i, "").trim(),
    );

    logFlameEvent("chapter_images_detected", {
      seriesId: parsed.numericId,
      kind: parsed.contentKind,
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
  parseFlameSeriesSlug,
  parseFlameSeriesChaptersFromNextData,
  extractChapterSummaries,
  parseNextData,
  buildImageUrlsFromChapterPayload,
};
