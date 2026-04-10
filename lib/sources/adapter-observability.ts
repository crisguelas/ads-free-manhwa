const FAILURE_WINDOW_MS = 1000 * 60 * 10;
const FAILURE_ALERT_THRESHOLD = 3;

/**
 * Represents in-memory source metrics for parser/cache health.
 */
type SourceMetricState = {
  parserFailures: number[];
  parserSuccesses: number;
  cacheSyncSuccesses: number;
  cacheSyncFallbacks: number;
};

/**
 * Stores lightweight per-source metrics for the running server process.
 */
const sourceMetrics = new Map<string, SourceMetricState>();

/**
 * Returns mutable source metric state, creating defaults when missing.
 */
function getState(sourceKey: string): SourceMetricState {
  const existing = sourceMetrics.get(sourceKey);
  if (existing) {
    return existing;
  }

  const next: SourceMetricState = {
    parserFailures: [],
    parserSuccesses: 0,
    cacheSyncSuccesses: 0,
    cacheSyncFallbacks: 0,
  };
  sourceMetrics.set(sourceKey, next);
  return next;
}

/**
 * Increments parser success count for a source.
 */
export function recordParserSuccess(sourceKey: string): void {
  const state = getState(sourceKey);
  state.parserSuccesses += 1;
}

/**
 * Records parser failure and emits threshold alert when repeated failures occur.
 */
export function recordParserFailure(sourceKey: string, reason: string): void {
  const state = getState(sourceKey);
  const now = Date.now();
  state.parserFailures = state.parserFailures.filter(
    (timestamp) => now - timestamp <= FAILURE_WINDOW_MS,
  );
  state.parserFailures.push(now);

  if (state.parserFailures.length >= FAILURE_ALERT_THRESHOLD) {
    console.error("[source-observability] parser-failure-alert", {
      sourceKey,
      reason,
      failureCountInWindow: state.parserFailures.length,
      threshold: FAILURE_ALERT_THRESHOLD,
      windowMs: FAILURE_WINDOW_MS,
    });
  }
}

/**
 * Records a successful adapter-to-cache sync operation.
 */
export function recordCacheSyncSuccess(
  sourceKey: string,
  seriesSlug: string,
  chapterCount: number,
): void {
  const state = getState(sourceKey);
  state.cacheSyncSuccesses += 1;
  console.info("[source-observability] cache-sync-success", {
    sourceKey,
    seriesSlug,
    chapterCount,
    cacheSyncSuccesses: state.cacheSyncSuccesses,
  });
}

/**
 * Records use of stale cache fallback when live adapter data is unavailable.
 */
export function recordCacheSyncFallback(
  sourceKey: string,
  seriesSlug: string,
  reason: string,
): void {
  const state = getState(sourceKey);
  state.cacheSyncFallbacks += 1;
  console.warn("[source-observability] cache-sync-fallback", {
    sourceKey,
    seriesSlug,
    reason,
    cacheSyncFallbacks: state.cacheSyncFallbacks,
  });
}

/**
 * Returns a shallow metrics snapshot primarily for tests and diagnostics.
 */
export function getSourceMetricSnapshot(sourceKey: string): SourceMetricState {
  const state = getState(sourceKey);
  return {
    parserFailures: [...state.parserFailures],
    parserSuccesses: state.parserSuccesses,
    cacheSyncSuccesses: state.cacheSyncSuccesses,
    cacheSyncFallbacks: state.cacheSyncFallbacks,
  };
}
