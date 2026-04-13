import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATALOG_HIGHLIGHTS } from "@/lib/featured-series";

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
        title: {
          contains: query,
          mode: "insensitive",
        },
      },
      take: 10,
      include: {
        source: true,
      },
    });

    // 2. Search in Static Highlights (Catalog)
    const staticResults = CATALOG_HIGHLIGHTS.filter((h) =>
      h.title.toLowerCase().includes(query)
    ).slice(0, 5);

    // 3. Merge and Deduplicate
    interface SearchResult {
      title: string;
      slug: string;
      coverImageUrl: string | null;
      sourceName: string;
      sourceKey: string;
    }

    const merged = new Map<string, SearchResult>();

    // Add DB hits (cover URLs from SeriesCache are already populated by browse/detail scrapes)
    for (const res of dbResults) {
      const key = `${res.source.key}:${res.seriesSlug}`;
      merged.set(key, {
        title: res.title,
        slug: res.seriesSlug,
        coverImageUrl: res.coverImageUrl,
        sourceName: res.source.name,
        sourceKey: res.source.key,
      });
    }

    // Add static hits if not already present
    for (const h of staticResults) {
      const key = `${h.sourceKey}:${h.seriesSlug}`;
      if (!merged.has(key)) {
        merged.set(key, {
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
    const results = Array.from(merged.values()).slice(0, 10);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
