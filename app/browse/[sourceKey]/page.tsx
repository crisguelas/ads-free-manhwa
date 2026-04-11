import { notFound } from "next/navigation";
import { BROWSE_PAGE_SIZE } from "@/lib/browse-constants";
import {
  getBrowseCatalogForSource,
  isBrowseSourceKey,
  type BrowseSourceKey,
} from "@/lib/source-browse-data";
import { SourceBrowseView } from "@/components/source-browse-view";

type BrowseSourcePageProps = {
  params: Promise<{ sourceKey: string }>;
  searchParams: Promise<{ page?: string }>;
};

/**
 * Parses a positive page index from the query string; invalid values default to 1.
 */
function parsePage(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return n;
}

/**
 * Per-source catalog: all curated series for Asura or Flame with server-side pagination.
 */
export default async function BrowseSourcePage({ params, searchParams }: BrowseSourcePageProps) {
  const { sourceKey: rawKey } = await params;
  if (!isBrowseSourceKey(rawKey)) {
    notFound();
  }
  const sourceKey = rawKey as BrowseSourceKey;
  const sp = await searchParams;
  const highlights = await getBrowseCatalogForSource(sourceKey);
  const totalSeries = highlights.length;
  const totalPages = Math.max(1, Math.ceil(totalSeries / BROWSE_PAGE_SIZE) || 1);
  const requested = parsePage(sp.page);
  const currentPage = Math.min(requested, totalPages);
  const start = (currentPage - 1) * BROWSE_PAGE_SIZE;
  const pageItems = highlights.slice(start, start + BROWSE_PAGE_SIZE);
  const pathname = `/browse/${sourceKey}`;

  return (
    <main className="flex flex-1 flex-col">
      <SourceBrowseView
        sourceKey={sourceKey}
        pageItems={pageItems}
        currentPage={currentPage}
        totalPages={totalPages}
        totalSeries={totalSeries}
        pathname={pathname}
      />
    </main>
  );
}
