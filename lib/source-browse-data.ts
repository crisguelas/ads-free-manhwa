import type { CatalogHighlight } from "@/lib/featured-series";
import type { BrowseSourceKey } from "@/lib/browse-constants";

export {
  BROWSE_SOURCE_KEYS,
  type BrowseSourceKey,
  BROWSE_SOURCE_LABELS,
  isBrowseSourceKey,
} from "@/lib/browse-constants";

/**
 * Full browse list for one source: live site scrape (cached) plus curated-only supplements when scrape fails or omits a title.
 */
export async function getBrowseCatalogForSource(
  sourceKey: BrowseSourceKey,
): Promise<CatalogHighlight[]> {
  const { buildLiveBrowseCatalogForSource } = await import("@/lib/live-source-browse");
  return buildLiveBrowseCatalogForSource(sourceKey);
}
