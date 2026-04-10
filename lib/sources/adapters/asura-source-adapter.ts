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
 * Defines Asura website constants used by adapter requests.
 */
const ASURA_BASE_URL = "https://asurascans.com";
const SLUG_CACHE_TTL_MS = 1000 * 60 * 30;
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Defines normalized error categories for adapter operations.
 */
type AsuraErrorCode =
  | "network"
  | "timeout"
  | "not-found"
  | "auth-required"
  | "parse-failed";

/**
 * Represents a classified adapter error with context for logging.
 */
type AsuraAdapterError = {
  code: AsuraErrorCode;
  message: string;
  url?: string;
};

/**
 * Stores slug resolution results to reduce homepage scan frequency.
 */
const slugResolutionCache = new Map<
  string,
  { resolvedSlug: string | null; expiresAt: number }
>();

/**
 * Normalizes text into a slug-friendly format for matching.
 */
function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Fetches page HTML and returns empty string on request failure.
 */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
 * Resolves a raw input slug to Asura's current slug format with hash suffix.
 */
async function resolveAsuraSeriesSlug(inputSlug: string): Promise<string | null> {
  const normalizedInput = normalizeSlug(inputSlug);
  const cached = slugResolutionCache.get(normalizedInput);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.resolvedSlug;
  }
  const directHtml = await fetchHtml(`${ASURA_BASE_URL}/comics/${inputSlug}`);

  if (directHtml.length > 0) {
    slugResolutionCache.set(normalizedInput, {
      resolvedSlug: inputSlug,
      expiresAt: now + SLUG_CACHE_TTL_MS,
    });
    return inputSlug;
  }

  const homepageHtml = await fetchHtml(ASURA_BASE_URL);
  if (!homepageHtml) {
    return null;
  }

  const comicMatches = [
    ...homepageHtml.matchAll(/\/comics\/([a-z0-9-]+(?:-[a-z0-9]{8,})?)/gi),
  ];

  const uniqueCandidates = Array.from(
    new Set(comicMatches.map((match) => match[1])),
  );

  const bestMatch = uniqueCandidates.find((candidate) => {
    const normalizedCandidate = normalizeSlug(
      candidate.replace(/-[a-z0-9]{8,}$/i, ""),
    );
    return normalizedCandidate === normalizedInput;
  });

  const resolvedSlug = bestMatch ?? null;
  slugResolutionCache.set(normalizedInput, {
    resolvedSlug,
    expiresAt: now + SLUG_CACHE_TTL_MS,
  });
  return resolvedSlug;
}

/**
 * Parses chapter slug into a sortable number.
 */
function parseChapterNumber(chapterSlug: string): number {
  const parsed = Number(chapterSlug.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : -1;
}

/**
 * Extracts unique chapter entries from a comic page HTML payload using fallback selectors.
 */
function extractChapterSummaries(
  seriesSlug: string,
  html: string,
): SourceChapterSummary[] {
  const chapterRegexes = [
    new RegExp(
      `/comics/${escapeRegex(seriesSlug)}/chapter/([a-z0-9-_.]+)`,
      "gi",
    ),
    new RegExp(`/chapter/([a-z0-9-_.]+)`, "gi"),
  ];
  const seen = new Set<string>();
  const chapters: SourceChapterSummary[] = [];

  for (const chapterRegex of chapterRegexes) {
    for (const match of html.matchAll(chapterRegex)) {
      const chapterId = match[1]?.trim();
      if (!chapterId || seen.has(chapterId)) {
        continue;
      }

      seen.add(chapterId);
      chapters.push({
        slug: chapterId,
        title: `Chapter ${chapterId}`,
        url: `${ASURA_BASE_URL}/comics/${seriesSlug}/chapter/${chapterId}`,
        chapterLabel: chapterId,
      });
    }
  }

  return chapters.sort(
    (left, right) =>
      parseChapterNumber(right.chapterLabel ?? right.slug) -
      parseChapterNumber(left.chapterLabel ?? left.slug),
  );
}

/**
 * Detects auth or premium guard pages based on known text markers.
 */
function detectAuthGuard(html: string): boolean {
  const markers = [
    "log in to continue",
    "login to continue",
    "premium chapter",
    "subscribe to unlock",
  ];
  const normalized = html.toLowerCase();
  return markers.some((marker) => normalized.includes(marker));
}

/**
 * Extracts unique image URLs from multiple HTML patterns used in chapter pages.
 */
function extractChapterImages(html: string): string[] {
  const patterns = [
    /(https?:\/\/[^"'\\\s>]+?\.(?:jpg|jpeg|png|webp))(?:["'\\\s>])/gi,
    /(?:src|data-src|content)\s*=\s*["'](https?:\/\/[^"']+?\.(?:jpg|jpeg|png|webp))["']/gi,
    /https?:\\\/\\\/[^"']+?\.(?:jpg|jpeg|png|webp)/gi,
  ];
  const urls = new Set<string>();

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const value = (match[1] ?? match[0]).replaceAll("\\/", "/");
      if (!value.includes("avatar") && !value.includes("logo")) {
        urls.add(value);
      }
    }
  }

  return Array.from(urls);
}

/**
 * Emits lightweight structured logs for adapter diagnostics.
 */
function logAsuraEvent(event: string, payload: Record<string, unknown>): void {
  // Keep logs concise to avoid noisy server output while preserving useful context.
  console.info(`[asura-adapter] ${event}`, payload);
}

/**
 * Emits normalized error logs for adapter failures.
 */
function logAsuraError(error: AsuraAdapterError): void {
  console.warn("[asura-adapter] error", error);
  if (error.code === "parse-failed") {
    recordParserFailure("asura-scans", error.message);
  }
}

/**
 * Implements live chapter discovery for Asura Scans.
 */
export class AsuraSourceAdapter implements SourceAdapter {
  /**
   * Stores the adapter lookup key.
   */
  public readonly key = "asura-scans";

  /**
   * Stores adapter display name.
   */
  public readonly name = "Asura Scans Adapter";

  /**
   * Returns chapter summaries for a given series slug.
   */
  public async listSeriesChapters(
    seriesSlug: string,
  ): Promise<SourceChapterSummary[]> {
    const resolvedSlug = await resolveAsuraSeriesSlug(seriesSlug);
    if (!resolvedSlug) {
      logAsuraError({
        code: "not-found",
        message: "Series slug could not be resolved.",
        url: `${ASURA_BASE_URL}/comics/${seriesSlug}`,
      });
      return [];
    }

    const html = await fetchHtml(`${ASURA_BASE_URL}/comics/${resolvedSlug}`);
    if (!html) {
      logAsuraError({
        code: "network",
        message: "Failed to fetch series chapter list HTML.",
        url: `${ASURA_BASE_URL}/comics/${resolvedSlug}`,
      });
      return [];
    }

    const chapters = extractChapterSummaries(resolvedSlug, html);
    if (chapters.length === 0) {
      logAsuraError({
        code: "parse-failed",
        message: "No chapter links were parsed from series page.",
        url: `${ASURA_BASE_URL}/comics/${resolvedSlug}`,
      });
      return [];
    }

    logAsuraEvent("chapters_parsed", {
      seriesSlug,
      resolvedSlug,
      chapterCount: chapters.length,
    });
    recordParserSuccess("asura-scans");
    return chapters;
  }

  /**
   * Returns chapter detail metadata and discovered image URLs when available.
   */
  public async getChapterDetail(
    seriesSlug: string,
    chapterSlug: string,
  ): Promise<SourceChapterDetail | null> {
    const resolvedSlug = await resolveAsuraSeriesSlug(seriesSlug);
    if (!resolvedSlug) {
      logAsuraError({
        code: "not-found",
        message: "Series slug could not be resolved for chapter lookup.",
        url: `${ASURA_BASE_URL}/comics/${seriesSlug}/chapter/${chapterSlug}`,
      });
      return null;
    }

    const chapterUrl = `${ASURA_BASE_URL}/comics/${resolvedSlug}/chapter/${chapterSlug}`;
    const html = await fetchHtml(chapterUrl);
    if (!html) {
      logAsuraError({
        code: "network",
        message: "Failed to fetch chapter HTML.",
        url: chapterUrl,
      });
      return null;
    }
    if (detectAuthGuard(html)) {
      logAsuraError({
        code: "auth-required",
        message: "Chapter appears to require login or premium access.",
        url: chapterUrl,
      });
      return null;
    }

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const rawTitle = titleMatch?.[1]?.trim() ?? `Chapter ${chapterSlug}`;
    const title = rawTitle.replace(/\s*-\s*(Read Online|Premium)\s*\|.*$/i, "");
    const imageUrls = extractChapterImages(html);
    if (imageUrls.length === 0) {
      recordParserFailure("asura-scans", "Chapter image list parsed empty.");
    } else {
      recordParserSuccess("asura-scans");
    }
    logAsuraEvent("chapter_images_detected", {
      seriesSlug,
      chapterSlug,
      imageCount: imageUrls.length,
      chapterUrl,
    });

    return {
      slug: chapterSlug,
      title,
      url: chapterUrl,
      imageUrls,
    };
  }
}

/**
 * Exposes internal parser helpers for regression tests without broad public API changes.
 */
export const ASURA_TEST_UTILS = {
  extractChapterSummaries,
  extractChapterImages,
  detectAuthGuard,
  parseChapterNumber,
};
