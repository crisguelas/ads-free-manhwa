/**
 * Fetches remote HTML with a default timeout and modern user-agent.
 * Returns an empty string on network failure or timeout to allow graceful degradation.
 */
export async function fetchHtml(url: string, timeoutMs: number = 12_000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      cache: "no-store", // Ensure fresh data unless the caller uses unstable_cache
    });
    
    if (!response.ok) {
      return "";
    }
    
    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`[fetchHtml] Timeout fetching ${url}`);
    } else {
      console.warn(`[fetchHtml] Failed to fetch ${url}:`, error);
    }
    return "";
  } finally {
    clearTimeout(timeout);
  }
}
