/**
 * Optional tuning for HTML fetches (longer timeouts for heavy pages, Referer for CDN anti-hotlink rules).
 */
export type FetchHtmlOptions = {
  timeoutMs?: number;
  referer?: string;
  retries?: number;
  origin?: string;
  extraHeaders?: Record<string, string>;
  onAttempt?: (result: FetchHtmlAttemptResult) => void;
};

/**
 * Structured metadata for each fetch attempt so callers can emit source-specific diagnostics.
 */
type FetchHtmlAttemptResult = {
  url: string;
  attempt: number;
  maxAttempts: number;
  ok: boolean;
  status: number | null;
  errorName: string | null;
};

/**
 * Fetches remote HTML with a default timeout and modern user-agent.
 * Returns an empty string on network failure or timeout to allow graceful degradation.
 */
export async function fetchHtml(url: string, timeoutMs: number = 12_000): Promise<string> {
  return fetchHtmlWithOptions(url, { timeoutMs });
}

/**
 * Same as `fetchHtml` but allows Referer and custom timeout for source-specific fetches.
 */
export async function fetchHtmlWithOptions(
  url: string,
  options?: FetchHtmlOptions,
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 12_000;
  const referer = options?.referer;
  const origin = options?.origin;
  const retries = Math.max(0, options?.retries ?? 0);
  const extraHeaders = options?.extraHeaders ?? {};
  const onAttempt = options?.onAttempt;
  const maxAttempts = retries + 1;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "sec-ch-ua":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        pragma: "no-cache",
        "cache-control": "no-cache",
      };
      if (referer) {
        headers.referer = referer;
      }
      if (origin) {
        headers.origin = origin;
      }
      for (const [key, value] of Object.entries(extraHeaders)) {
        if (value) {
          headers[key.toLowerCase()] = value;
        }
      }

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        cache: "no-store", // Ensure fresh data unless the caller uses unstable_cache
      });
      onAttempt?.({
        url,
        attempt,
        maxAttempts,
        ok: response.ok,
        status: response.status,
        errorName: null,
      });

      if (!response.ok) {
        if (attempt >= maxAttempts) {
          return "";
        }
        continue;
      }

      return await response.text();
    } catch (error) {
      onAttempt?.({
        url,
        attempt,
        maxAttempts,
        ok: false,
        status: null,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      if (attempt >= maxAttempts) {
        if (error instanceof Error && error.name === "AbortError") {
          console.warn(`[fetchHtml] Timeout fetching ${url}`);
        } else {
          console.warn(`[fetchHtml] Failed to fetch ${url}:`, error);
        }
        return "";
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return "";
}
