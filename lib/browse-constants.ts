/**
 * How many series appear on each `/browse/[sourceKey]` page (Asura and Flame use the same cap).
 * Chosen so a 4-column grid shows five full rows per page at `sm` and wider breakpoints.
 */
export const BROWSE_PAGE_SIZE = 20;

/**
 * Source keys that have dedicated `/browse/[sourceKey]` catalog pages.
 */
export const BROWSE_SOURCE_KEYS = ["asura-scans", "flame-scans"] as const;

/**
 * Union of allowed dynamic segment values under `/browse/`.
 */
export type BrowseSourceKey = (typeof BROWSE_SOURCE_KEYS)[number];

/**
 * Human labels for browse page titles and navigation.
 */
export const BROWSE_SOURCE_LABELS: Record<BrowseSourceKey, string> = {
  "asura-scans": "Asura Scans",
  "flame-scans": "Flame Comics",
};

/**
 * Returns true when `value` is a valid `/browse/[sourceKey]` segment.
 */
export function isBrowseSourceKey(value: string): value is BrowseSourceKey {
  return (BROWSE_SOURCE_KEYS as readonly string[]).includes(value);
}
