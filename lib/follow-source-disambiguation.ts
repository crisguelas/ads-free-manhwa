/**
 * Minimal row shape for selecting one source row when duplicates exist.
 */
export type SourceKeyedRow = { source: { key: string } };

/**
 * Returns a stable row when duplicate source rows exist for the same `seriesSlug`.
 * Current source support is single-source, so the first row is sufficient.
 */
export function pickRowWhenSeriesSlugSpansScanSources<T extends SourceKeyedRow>(
  rows: T[],
): T {
  if (rows.length === 0) {
    throw new Error("pickRowWhenSeriesSlugSpansScanSources: expected at least one row");
  }
  return rows[0];
}
