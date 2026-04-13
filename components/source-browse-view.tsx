import Link from "next/link";
import type { CatalogHighlight } from "@/lib/featured-series";
import type { BrowseSourceKey } from "@/lib/source-browse-data";
import { BROWSE_SOURCE_LABELS } from "@/lib/source-browse-data";
import { BrowsePagination } from "@/components/browse-pagination";
import { RemoteCoverImage } from "@/components/remote-cover-image";

type SourceBrowseViewProps = {
  sourceKey: BrowseSourceKey;
  /** Items for the current page only. */
  pageItems: CatalogHighlight[];
  currentPage: number;
  totalPages: number;
  totalSeries: number;
  pathname: string;
};

/**
 * Paginated grid of series for one scanlation source (`/browse/[sourceKey]`).
 */
export function SourceBrowseView({
  sourceKey,
  pageItems,
  currentPage,
  totalPages,
  totalSeries,
  pathname,
}: SourceBrowseViewProps) {
  const label = BROWSE_SOURCE_LABELS[sourceKey];

  return (
    <div className="min-h-full bg-[var(--browse-canvas)] text-zinc-900">
      <div className="border-b border-zinc-200/90 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <nav className="mb-3 text-xs font-medium text-zinc-500">
            <Link href="/" className="transition hover:text-violet-700">
              Home
            </Link>
            <span className="mx-2 text-zinc-300">/</span>
            <span className="text-zinc-800">Browse</span>
            <span className="mx-2 text-zinc-300">/</span>
            <span className="text-zinc-800">{label}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{label}</h1>
          <p className="mt-2 text-xs text-zinc-500 text-zinc-500">
            {totalSeries} series
            {totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : null}
          </p>
        </div>
      </div>

      <div id="browse" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-8 sm:px-6 sm:py-10">
        {pageItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center shadow-sm">
            <p className="font-medium text-zinc-800">No series listed</p>
            <p className="mt-2 text-sm text-zinc-500">
              Add entries for this source in{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">lib/featured-series.ts</code>
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {pageItems.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/manhwa/${encodeURIComponent(s.seriesSlug)}`}
                  className="group block rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-sm transition hover:border-violet-200 hover:shadow-md"
                >
                  <RemoteCoverImage
                    src={s.coverImageUrl}
                    alt={s.title}
                    variant="poster"
                    className="ring-0 group-hover:opacity-[0.98]"
                  />
                  <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-snug text-zinc-900">{s.title}</p>
                  {s.genres.length > 0 ? (
                    <p className="mt-1 line-clamp-1 text-[10px] text-zinc-500">{s.genres.slice(0, 2).join(" · ")}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <BrowsePagination currentPage={currentPage} totalPages={totalPages} pathname={pathname} />
      </div>
    </div>
  );
}
