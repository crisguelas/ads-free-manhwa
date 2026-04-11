/**
 * Minimal row shape for picking between Asura vs Flame when both exist for the same `seriesSlug`.
 */
export type SourceKeyedRow = { source: { key: string } };

/**
 * When a user has a `Follow` for the same `seriesSlug` on both Asura and Flame (allowed by `@@unique([userId, sourceId, seriesSlug])`), choose the row that matches public browse resolution: all-digit slugs are Flame numeric ids; word slugs map to Asura.
 */
export function pickRowWhenSeriesSlugSpansScanSources<T extends SourceKeyedRow>(
  rows: T[],
  seriesSlug: string,
): T {
  if (rows.length === 0) {
    throw new Error("pickRowWhenSeriesSlugSpansScanSources: expected at least one row");
  }
  if (rows.length === 1) {
    return rows[0] as T;
  }
  const flame = rows.find((r) => r.source.key === "flame-scans");
  const asura = rows.find((r) => r.source.key === "asura-scans");
  if (flame && asura) {
    return (/^\d+$/.test(seriesSlug.trim()) ? flame : asura) as T;
  }
  return rows[0] as T;
}
