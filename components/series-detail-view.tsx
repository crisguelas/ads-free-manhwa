"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { SeriesDetailData, SeriesReaderStatus } from "@/lib/reader-data";
import { resolveContinueReadingCarouselLabels } from "@/lib/continue-reading-display";
import { RemoteCoverImage } from "@/components/remote-cover-image";

type SeriesDetailViewProps = {
  data: SeriesDetailData;
};

const SYNOPSIS_COLLAPSE_CHARS = 360;

/**
 * Light-theme pill colors for the status strip under the poster (mirrors scan-site “ongoing / dropped” badges).
 */
function seriesDetailStatusStripClass(
  variant: SeriesReaderStatus["variant"],
): string {
  switch (variant) {
    case "ongoing":
      return "bg-emerald-600 text-white shadow-sm";
    case "completed":
      return "bg-zinc-800 text-zinc-50 shadow-sm";
    case "hiatus":
      return "bg-amber-600 text-amber-50 shadow-sm";
    case "unknown":
      return "bg-zinc-600/95 text-zinc-100 shadow-sm";
    default:
      return "bg-violet-600 text-white shadow-sm";
  }
}

/**
 * Human-readable relative time for chapter rows when `publishedAt` exists.
 */
function formatListDate(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 45) {
    return "just now";
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 36) {
    return `${hr}h ago`;
  }
  const days = Math.floor(hr / 24);
  if (days < 21) {
    return `${days}d ago`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Client shell for the series page: synopsis, bookmark / first / latest actions, searchable chapter list.
 */
export function SeriesDetailView({ data }: SeriesDetailViewProps) {
  const [expandedSynopsis, setExpandedSynopsis] = useState(false);
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [bookmarkId, setBookmarkId] = useState<string | null>(data.bookmarkIdForFirstChapter);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  const synopsis = data.synopsis?.trim() || null;
  const synopsisLong = synopsis && synopsis.length > SYNOPSIS_COLLAPSE_CHARS;
  const synopsisShown =
    !synopsisLong || expandedSynopsis ? synopsis : `${synopsis.slice(0, SYNOPSIS_COLLAPSE_CHARS).trim()}…`;

  const filteredChapters = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = data.liveChapters.filter((c) => {
      if (!q) {
        return true;
      }
      return (
        c.title.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
      );
    });
    return newestFirst ? [...base].reverse() : base;
  }, [data.liveChapters, query, newestFirst]);

  const firstHref =
    data.firstChapterSlug != null
      ? `/manhwa/${encodeURIComponent(data.seriesSlug)}/chapter/${encodeURIComponent(data.firstChapterSlug)}`
      : null;
  const latestHref =
    data.latestChapterSlug != null
      ? `/manhwa/${encodeURIComponent(data.seriesSlug)}/chapter/${encodeURIComponent(data.latestChapterSlug)}`
      : null;

  const toggleBookmark = useCallback(async () => {
    if (!data.firstChapterSlug || bookmarkBusy) {
      return;
    }
    setBookmarkBusy(true);
    try {
      if (bookmarkId) {
        const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(bookmarkId)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setBookmarkId(null);
        }
      } else {
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seriesSlug: data.seriesSlug,
            chapterSlug: data.firstChapterSlug,
            chapterTitle: data.firstChapterTitle,
          }),
        });
        const json = (await res.json()) as { bookmarkId?: string };
        if (res.ok && json.bookmarkId) {
          setBookmarkId(json.bookmarkId);
        }
      }
    } finally {
      setBookmarkBusy(false);
    }
  }, [bookmarkBusy, bookmarkId, data.firstChapterSlug, data.firstChapterTitle, data.seriesSlug]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition duration-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
      >
        ← Home
      </Link>

      <header className="flex flex-col gap-6 border-b border-zinc-200/90 pb-8 sm:flex-row sm:items-start sm:gap-8">
        <div className="flex shrink-0 flex-col gap-3">
          <div className="relative mx-auto w-[8.5rem] overflow-hidden rounded-lg shadow-lg shadow-zinc-900/10 ring-1 ring-zinc-200/80 sm:mx-0 sm:w-36">
            <RemoteCoverImage
              src={data.coverImageUrl}
              alt={data.seriesTitle}
              variant="poster"
              className="shadow-none ring-0"
            />
          </div>
          <div className="flex justify-center sm:justify-start">
            <span
              className={`max-w-full truncate rounded-md px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide sm:text-[11px] ${seriesDetailStatusStripClass(data.seriesStatus.variant)}`}
              title="Series status from source"
            >
              {data.seriesStatus.label}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700/90">{data.sourceName}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{data.seriesTitle}</h1>
          {synopsis ? (
            <div className="mt-4 text-left">
              <p className="text-sm leading-relaxed text-zinc-600">{synopsisShown}</p>
              {synopsisLong ? (
                <button
                  type="button"
                  onClick={() => setExpandedSynopsis((v) => !v)}
                  className="mt-2 text-xs font-semibold text-violet-700 transition hover:text-violet-900"
                >
                  {expandedSynopsis ? "Show less" : "Show more"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">No description loaded yet for this series.</p>
          )}

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={!data.firstChapterSlug || bookmarkBusy}
              onClick={() => void toggleBookmark()}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                bookmarkId
                  ? "border border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100"
                  : "bg-violet-600 text-white hover:bg-violet-700"
              }`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M6 4a2 2 0 012-2h8a2 2 0 012 2v16l-6-3.5L6 20V4z" />
              </svg>
              {bookmarkId ? "Bookmarked" : "Bookmark"}
            </button>
            {firstHref ? (
              <Link
                href={firstHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition duration-200 hover:border-violet-300 hover:bg-zinc-50"
              >
                <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                First chapter
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-5 py-3 text-sm font-semibold text-zinc-400">
                First chapter
              </span>
            )}
            {latestHref ? (
              <Link
                href={latestHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-zinc-900"
              >
                <svg className="h-4 w-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                Latest chapter
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-500">
                Latest chapter
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-900/[0.04]">
        <div className="flex flex-col gap-4 border-b border-zinc-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm font-bold text-zinc-900">
            {data.liveChapters.length} {data.liveChapters.length === 1 ? "Chapter" : "Chapters"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setNewestFirst((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-300 hover:bg-white"
            >
              <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
              </svg>
              {newestFirst ? "Newest" : "Oldest"}
            </button>
          </div>
        </div>
        <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
          <label className="relative block">
            <span className="sr-only">Search chapters</span>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chapters…"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/80 py-2.5 pl-3 pr-10 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
            />
          </label>
        </div>
        <ul className="max-h-[min(28rem,55vh)] divide-y divide-zinc-100 overflow-y-auto overscroll-contain">
          {filteredChapters.length === 0 ? (
            <li className="px-4 py-12 text-center text-sm text-zinc-500 sm:px-5">
              {data.liveChapters.length === 0
                ? "No chapters loaded yet."
                : "No chapters match your search."}
            </li>
          ) : (
            filteredChapters.map((chapter) => {
              const href = `/manhwa/${encodeURIComponent(data.seriesSlug)}/chapter/${encodeURIComponent(chapter.slug)}`;
              const when = formatListDate(chapter.publishedAt);
              return (
                <li key={chapter.slug}>
                  <Link
                    href={href}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-violet-50/60 sm:px-5"
                  >
                    <span className="min-w-0 text-sm font-semibold text-zinc-900">{chapter.title}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{when || "—"}</span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {(data.bookmarks.length > 0 || data.recentReads.length > 0) && (
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {data.bookmarks.length > 0 ? (
            <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900">Your bookmarks</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.bookmarks.slice(0, 6).map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/manhwa/${encodeURIComponent(data.seriesSlug)}/chapter/${encodeURIComponent(b.chapterSlug)}`}
                      className="font-medium text-violet-700 hover:underline"
                    >
                      {b.chapterTitle ?? b.chapterSlug}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {data.recentReads.length > 0 ? (
            <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-zinc-900">Recent reading</h2>
              <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {data.recentReads.slice(0, 6).map((r) => {
                  const { seriesLine, chapterLine } = resolveContinueReadingCarouselLabels({
                    seriesTitle: data.seriesTitle,
                    sourceKey: data.sourceKey,
                    seriesSlug: data.seriesSlug,
                    chapterTitle: r.chapterTitle,
                    chapterSlug: r.chapterSlug,
                  });
                  return (
                  <Link
                    key={r.id}
                    href={`/manhwa/${encodeURIComponent(data.seriesSlug)}/chapter/${encodeURIComponent(r.chapterSlug)}`}
                    className="group flex w-[110px] shrink-0 snap-start flex-col sm:w-[120px]"
                  >
                    <div className="overflow-hidden rounded-xl ring-1 ring-zinc-200/80 transition duration-200 group-hover:ring-violet-300/80 group-hover:shadow-md">
                      <RemoteCoverImage
                        src={data.coverImageUrl}
                        alt={seriesLine}
                        variant="poster"
                        className="shadow-sm"
                      />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-center text-[11px] font-bold leading-snug text-zinc-900" title={seriesLine}>
                      {seriesLine}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-center text-[10px] font-medium text-zinc-500">
                      {chapterLine} {r.pageNumber && r.pageNumber > 1 ? `(p.${r.pageNumber})` : ""}
                    </p>
                  </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
