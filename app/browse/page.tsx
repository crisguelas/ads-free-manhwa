import { BROWSE_PAGE_SIZE } from "@/lib/browse-constants";
import { SourceBrowseView } from "@/components/source-browse-view";
import { getBrowseCatalogForSource } from "@/lib/source-browse-data";

type BrowsePageProps = {
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
 * Root browse route (`/browse`) that serves the Asura catalog directly.
 */
export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const sourceKey = "asura-scans";
  const sp = await searchParams;
  const highlights = await getBrowseCatalogForSource(sourceKey);
  const totalSeries = highlights.length;
  const totalPages = Math.max(1, Math.ceil(totalSeries / BROWSE_PAGE_SIZE) || 1);
  const requested = parsePage(sp.page);
  const currentPage = Math.min(requested, totalPages);
  const start = (currentPage - 1) * BROWSE_PAGE_SIZE;
  const pageItems = highlights.slice(start, start + BROWSE_PAGE_SIZE);

  return (
    <main className="flex flex-1 flex-col">
      <SourceBrowseView
        sourceKey={sourceKey}
        pageItems={pageItems}
        currentPage={currentPage}
        totalPages={totalPages}
        totalSeries={totalSeries}
        pathname="/browse"
      />
    </main>
  );
}
