/**
 * Curated series entry points for the home browse UI.
 * These are links into your reader (`/manhwa/[slug]`) — not rows loaded from the database.
 * Edit this list for fallbacks and `/browse` merge supplements; the home dashboard uses live per-source latest lists.
 */
export type CatalogHighlight = {
  id: string;
  seriesSlug: string;
  title: string;
  /** Optional cover URL (hotlinked for display only; not stored in DB). */
  coverImageUrl: string | null;
  sourceName: string;
  sourceKey: string;
  genres: string[];
  /** Shown under title on cards (e.g. suggested starting point). */
  subtitle?: string;
  /** Extracted latest chapter for the home page latest updates grid. */
  latestChapter?: {
    title: string;
    slug?: string;
  };
};

/**
 * Static highlights for Asura (`asurascans.com`).
 * Asura slugs are resolved by the live adapter.
 * Static URLs are fallbacks only: `lib/catalog-covers.ts` refreshes Asura covers from site `og:image` metadata (cached). Client `RemoteCoverImage` hides broken hotlinks.
 */
export const CATALOG_HIGHLIGHTS: CatalogHighlight[] = [
  // Asura Scans
  {
    id: "asura-tbate",
    seriesSlug: "the-beginning-after-the-end",
    title: "The Beginning After the End",
    // Asura no longer hosts this series; og:image enrichment returns null. Webtoon CDN cover for browse tiles only.
    coverImageUrl:
      "https://swebtoon-phinf.pstatic.net/20190904_91/15675594449646Uar9_PNG/M_details_720x1230.png?type=crop540_540",
    sourceName: "Asura Scans",
    sourceKey: "asura-scans",
    genres: ["Action", "Fantasy", "Shounen"],
    subtitle: "Fantasy · reincarnation",
  },
  {
    id: "asura-sl",
    seriesSlug: "solo-leveling",
    title: "Solo Leveling",
    coverImageUrl:
      "https://cdn.asurascans.com/asura-images/covers/solo-leveling.c27830.webp",
    sourceName: "Asura Scans",
    sourceKey: "asura-scans",
    genres: ["Action", "Fantasy"],
    subtitle: "Hunter · dungeon",
  },
  {
    id: "asura-orv",
    seriesSlug: "omniscient-readers-viewpoint",
    title: "Omniscient Reader's Viewpoint",
    coverImageUrl:
      "https://cdn.asurascans.com/asura-images/covers/omniscient-readers-viewpoint.c29ced.webp",
    sourceName: "Asura Scans",
    sourceKey: "asura-scans",
    genres: ["Action", "Fantasy", "Drama"],
    subtitle: "Apocalypse · meta",
  },
  {
    id: "asura-mh",
    seriesSlug: "return-of-the-mount-hua-sect",
    title: "Return of the Mount Hua Sect",
    coverImageUrl:
      "https://cdn.asurascans.com/asura-images/covers/return-of-the-mount-hua-sect.34a1e2.webp",
    sourceName: "Asura Scans",
    sourceKey: "asura-scans",
    genres: ["Action", "Martial arts", "Comedy"],
    subtitle: "Murim · regression",
  },
  {
    id: "asura-nm",
    seriesSlug: "nano-machine",
    title: "Nano Machine",
    coverImageUrl:
      "https://cdn.asurascans.com/asura-images/covers/nano-machine.e31bdb.webp",
    sourceName: "Asura Scans",
    sourceKey: "asura-scans",
    genres: ["Action", "Martial arts", "Fantasy"],
    subtitle: "Murim · sci-fi",
  },
];
