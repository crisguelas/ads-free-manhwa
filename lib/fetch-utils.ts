/**
 * Optional tuning for HTML fetches (longer timeouts for heavy pages, Referer for CDN anti-hotlink rules).
 */
export type FetchHtmlOptions = {
  timeoutMs?: number;
  referer?: string;
  retries?: number;
};

/**
 * Fetches remote HTML with a default timeout and modern user-agent.
 * Returns an empty string on network failure or timeout to allow graceful degradation.
 */
export async function fetchHtml(url: string, timeoutMs: number = 12_000): Promise<string> {
  return fetchHtmlWithOptions(url, { timeoutMs });
}

/**
 * Same as `fetchHtml` but allows Referer and custom timeout (used for Flame overview pages and browse).
 */
export async function fetchHtmlWithOptions(
  url: string,
  options?: FetchHtmlOptions,
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 12_000;
  const referer = options?.referer;
  const retries = Math.max(0, options?.retries ?? 0);
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
        "cache-control": "no-cache",
      };
      if (referer) {
        headers.referer = referer;
      }

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        cache: "no-store", // Ensure fresh data unless the caller uses unstable_cache
      });

      if (!response.ok) {
        if (attempt >= maxAttempts) {
          return "";
        }
        continue;
      }

      return await response.text();
    } catch (error) {
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
