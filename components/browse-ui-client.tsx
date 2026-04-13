"use client";

import Link from "next/link";
import { useState } from "react";
import type { CatalogHighlight } from "@/lib/featured-series";
import { RemoteCoverImage } from "@/components/remote-cover-image";

const DEFAULT_LATEST_PER_PAGE = 8;

type LatestUpdateBlockProps = { series: CatalogHighlight };

/**
 * One catalog row: thumb, title, and links into the series detail (scan-site “latest” pattern) with a soft card hover.
 */
function LatestUpdateBlock({ series }: LatestUpdateBlockProps) {
  const base = `/manhwa/${encodeURIComponent(series.seriesSlug)}`;
  const line2 = series.subtitle ?? `Latest from ${series.sourceName}`;
  const line3 = series.latestChapter
    ? series.latestChapter.title
    : series.genres.length > 0
      ? series.genres.slice(0, 4).join(" · ")
      : "Chapters & reader";

  return (
    <div className="group/row flex gap-3.5 rounded-xl border border-transparent p-2 transition duration-200 hover:border-zinc-200/80 hover:bg-zinc-50/90 md:gap-4">
      <Link
        href={base}
        className="relative h-[5.75rem] w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100 shadow-sm ring-1 ring-zinc-200/70 transition duration-200 group-hover/row:ring-violet-200/60 sm:h-[6.25rem] sm:w-[4.5rem]"
      >
        <RemoteCoverImage src={series.coverImageUrl} alt="" variant="thumb" className="h-full w-full object-cover" />
      </Link>
      <div className="min-w-0 flex-1 py-0.5">
        <Link
          href={base}
          className="line-clamp-2 text-sm font-bold leading-snug text-zinc-900 transition group-hover/row:text-violet-800"
        >
          {series.title}
        </Link>
        <p className="mt-1.5 line-clamp-1 text-xs text-zinc-500">{line2}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">{line3}</p>
        <Link
          href={base}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 transition hover:text-violet-800"
        >
          Open series
          <span aria-hidden className="transition group-hover/row:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}

type BrowsePromoRibbonProps = {
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
};

/**
 * Slim dismissible promo strip under the header (session-only; resets on full page load).
 */
export function BrowsePromoRibbon({ message, ctaLabel, ctaHref }: BrowsePromoRibbonProps) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return null;
  }
  return (
    <div className="border-b border-violet-200/80 bg-gradient-to-r from-violet-100/90 via-violet-50 to-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <p className="text-xs font-medium text-violet-950 sm:text-sm">{message}</p>
        <div className="flex shrink-0 items-center gap-2">
          {ctaLabel && ctaHref ? (
            <Link
              href={ctaHref}
              className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              {ctaLabel}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-1 text-violet-700 transition hover:bg-violet-200/50"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

type PagedLatestUpdatesProps = {
  items: CatalogHighlight[];
  /** Items per page in the two-column grid (default 8). */
  perPage?: number;
};

/**
 * Two-column latest list with simple numeric pagination (mimics scan-site density).
 */
export function PagedLatestUpdates({ items, perPage = DEFAULT_LATEST_PER_PAGE }: PagedLatestUpdatesProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * perPage;
  const slice = items.slice(start, start + perPage);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center text-sm text-zinc-500">
        Nothing in this filter yet.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-2 sm:gap-3 md:grid-cols-2 md:gap-x-6 md:gap-y-1">
        {slice.map((series) => (
          <LatestUpdateBlock
            key={`${series.sourceKey}-${series.seriesSlug}`}
            series={series}
          />
        ))}
      </div>
      {totalPages > 1 ? (
        <nav
          className="mt-8 flex flex-wrap items-center justify-center gap-1.5"
          aria-label="Latest updates pages"
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`min-w-[2.25rem] rounded-lg px-2.5 py-1.5 text-sm font-semibold transition duration-200 ${
                n === currentPage
                  ? "bg-violet-600 text-white shadow-sm shadow-violet-600/20"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:border-violet-200 hover:text-violet-800"
              }`}
            >
              {n}
            </button>
          ))}
        </nav>
      ) : null}
    </>
  );
}

type SourceLatestUpdatesSectionProps = {
  /** Short label above the title (e.g. source name). */
  eyebrow: string;
  title: string;
  description: string;
  items: CatalogHighlight[];
  viewAllHref: string;
  viewAllLabel: string;
  /** Left border + heading tint (Tailwind classes). */
  accentClass: string;
};

/**
 * Framed “latest updates” block for one scan source on the home page (live list + link to full browse).
 */
export function SourceLatestUpdatesSection({
  eyebrow,
  title,
  description,
  items,
  viewAllHref,
  viewAllLabel,
  accentClass,
}: SourceLatestUpdatesSectionProps) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-900/[0.04] ring-1 ring-zinc-900/[0.02] ${accentClass}`}
    >
      <div className="border-b border-zinc-100 bg-gradient-to-r from-white via-zinc-50/40 to-white px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{eyebrow}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">{title}</h2>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-600">{description}</p>
            ) : null}
          </div>
          <Link
            href={viewAllHref}
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition duration-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
          >
            {viewAllLabel}
          </Link>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <PagedLatestUpdates items={items} />
      </div>
    </section>
  );
}
