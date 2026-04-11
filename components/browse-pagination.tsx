import Link from "next/link";

type BrowsePaginationProps = {
  /** 1-based current page (already clamped to valid range). */
  currentPage: number;
  totalPages: number;
  /** Route path without query, e.g. `/browse/asura-scans`. */
  pathname: string;
};

/**
 * Server-rendered numeric pager for source browse grids (query param `page`).
 */
export function BrowsePagination({ currentPage, totalPages, pathname }: BrowsePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const hrefFor = (p: number) => (p <= 1 ? pathname : `${pathname}?page=${p}`);

  return (
    <nav
      className="mt-10 flex flex-wrap items-center justify-center gap-1.5"
      aria-label="Catalog pages"
    >
      {currentPage > 1 ? (
        <Link
          href={hrefFor(currentPage - 1)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:text-violet-800"
        >
          Prev
        </Link>
      ) : (
        <span className="rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-zinc-300">
          Prev
        </span>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={hrefFor(n)}
          className={`min-w-[2.25rem] rounded-lg px-2.5 py-2 text-center text-sm font-semibold transition ${
            n === currentPage
              ? "bg-violet-600 text-white shadow-sm"
              : "border border-zinc-200 bg-white text-zinc-600 hover:border-violet-200 hover:text-violet-800"
          }`}
        >
          {n}
        </Link>
      ))}
      {currentPage < totalPages ? (
        <Link
          href={hrefFor(currentPage + 1)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-violet-200 hover:text-violet-800"
        >
          Next
        </Link>
      ) : (
        <span className="rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-zinc-300">
          Next
        </span>
      )}
    </nav>
  );
}
