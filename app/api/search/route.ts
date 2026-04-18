import { NextResponse } from "next/server";
import { isBrowseSourceKey } from "@/lib/browse-constants";
import { buildLiveBrowseCatalogForSource, stripAsuraHashSuffix } from "@/lib/live-source-browse";
import { prisma } from "@/lib/prisma";
import { CATALOG_HIGHLIGHTS } from "@/lib/featured-series";
import { isSupportedSourceKey, SUPPORTED_SOURCE_KEYS } from "@/lib/supported-sources";

/**
 * One row returned to the header search client.
 */
interface SearchResult {
  title: string;
  slug: string;
  coverImageUrl: string | null;
  sourceName: string;
  sourceKey: string;
}

/**
 * Merge key so static `solo-leveling` and live `solo-leveling-75e30c62` count as one Asura hit.
 */
function searchResultMergeKey(sourceKey: string, seriesSlug: string): string {
  if (sourceKey === "asura-scans") {
    return `${sourceKey}:${stripAsuraHashSuffix(seriesSlug)}`;
  }
  return `${sourceKey}:${seriesSlug}`;
}

/**
 * When two rows share a merge key, keep the richer row: real cover beats placeholder, then prefer the longer live slug for routing.
 */
function shouldPreferSearchResult(candidate: SearchResult, incumbent: SearchResult): boolean {
  const cCover = Boolean(candidate.coverImageUrl);
  const iCover = Boolean(incumbent.coverImageUrl);
  if (cCover && !iCover) {
    return true;
  }
  if (!cCover && iCover) {
    return false;
  }
  return candidate.slug.length > incumbent.slug.length;
}

/**
 * Inserts or replaces a merged search hit using Asura hash-aware deduplication.
 */
function upsertMergedSearchResult(merged: Map<string, SearchResult>, row: SearchResult): void {
  const key = searchResultMergeKey(row.sourceKey, row.slug);
  const incumbent = merged.get(key);
  if (!incumbent || shouldPreferSearchResult(row, incumbent)) {
    merged.set(key, row);
  }
}

/**
 * Returns merged DB cache, static highlights, and live browse catalog matches for the header search (title or slug substring).
 * Final rows are limited to `SUPPORTED_SOURCE_KEYS` so disabled sources never surface from legacy DB data.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase();

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    // 1. Search in SeriesCache (Database)
    const dbResults = await prisma.seriesCache.findMany({
      where: {
        source: {
          key: {
            in: [...SUPPORTED_SOURCE_KEYS],
          },
        },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { seriesSlug: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 10,
      include: {
        source: true,
      },
    });

    // 2. Search in Static Highlights (Catalog)
    const staticResults = CATALOG_HIGHLIGHTS.filter(
      (h) =>
        h.title.toLowerCase().includes(query) ||
        h.seriesSlug.toLowerCase().includes(query),
    ).slice(0, 5);

    const merged = new Map<string, SearchResult>();

    // Add DB hits (cover URLs from SeriesCache are already populated by browse/detail scrapes)
    for (const res of dbResults) {
      upsertMergedSearchResult(merged, {
        title: res.title,
        slug: res.seriesSlug,
        coverImageUrl: res.coverImageUrl,
        sourceName: res.source.name,
        sourceKey: res.source.key,
      });
    }

    for (const h of staticResults) {
      upsertMergedSearchResult(merged, {
        title: h.title,
        slug: h.seriesSlug,
        coverImageUrl: h.coverImageUrl,
        sourceName: h.sourceName,
        sourceKey: h.sourceKey,
      });
    }

    // Live browse catalog (same `unstable_cache` as `/browse` and home “latest”) so series visible there are searchable even when `SeriesCache` is empty.
    for (const sourceKey of SUPPORTED_SOURCE_KEYS) {
      if (!isBrowseSourceKey(sourceKey)) {
        continue;
      }
      const liveCatalog = await buildLiveBrowseCatalogForSource(sourceKey);
      for (const h of liveCatalog) {
        const titleMatch = h.title.toLowerCase().includes(query);
        const slugMatch = h.seriesSlug.toLowerCase().includes(query);
        if (!titleMatch && !slugMatch) {
          continue;
        }
        upsertMergedSearchResult(merged, {
          title: h.title,
          slug: h.seriesSlug,
          coverImageUrl: h.coverImageUrl,
          sourceName: h.sourceName,
          sourceKey: h.sourceKey,
        });
      }
    }

    // Return merged results directly — DB and static entries already carry cover URLs;
    // live og:image resolution was removed to eliminate 10+ outbound HTTP requests per search.
    // Drop any legacy source keys (e.g. removed scan sites) if rows still exist in older databases.
    const results = Array.from(merged.values())
      .filter((r) => isSupportedSourceKey(r.sourceKey))
      .slice(0, 10);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
