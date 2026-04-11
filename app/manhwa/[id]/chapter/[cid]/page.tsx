import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChapterReaderView } from "@/components/chapter-reader-view";
import { getSessionUser } from "@/lib/auth/current-user";
import { type SeriesReaderStatus, getChapterReaderData } from "@/lib/reader-data";

/**
 * Defines route params for the chapter reader page.
 */
type ChapterReaderPageProps = {
  params: Promise<{
    id: string;
    cid: string;
  }>;
  searchParams?: Promise<{ start?: string }>;
};

/**
 * Maps normalized status to dark-theme pill styles for the reader header.
 */
function readerStatusPillClass(variant: SeriesReaderStatus["variant"]): string {
  switch (variant) {
    case "ongoing":
      return "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "completed":
      return "border border-zinc-500/50 bg-zinc-700/80 text-zinc-200";
    case "hiatus":
      return "border border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "unknown":
      return "border border-zinc-600 bg-zinc-800/90 text-zinc-400";
    default:
      return "border border-violet-500/35 bg-violet-500/10 text-violet-200";
  }
}

/**
 * Renders an immersive vertical reader on a dark canvas: strip, progress, status, and chapter navigation.
 */
export default async function ChapterReaderPage({
  params,
  searchParams,
}: ChapterReaderPageProps) {
  const { id, cid } = await params;
  const sp = searchParams ? await searchParams : {};
  const fromStart = sp.start === "1" || sp.start === "true";
  const user = await getSessionUser();
  if (!user) {
    const q = fromStart ? "?start=1" : "";
    redirect(
      `/login?next=${encodeURIComponent(`/manhwa/${id}/chapter/${cid}${q}`)}`,
    );
  }

  const data = await getChapterReaderData(id, cid, { fromStart });

  if (!data) {
    notFound();
  }

  const seriesPath = `/manhwa/${encodeURIComponent(data.seriesSlug)}`;
  const chapterPathBase = `${seriesPath}/chapter/${encodeURIComponent(data.chapterSlug)}`;
  const st = data.seriesStatus;

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="sticky top-1 z-40 border-b border-zinc-800 bg-zinc-950/95 shadow-md shadow-black/20 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
          <Link
            href={seriesPath}
            className="shrink-0 rounded-full border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-violet-500/50 hover:bg-zinc-800 hover:text-white"
          >
            ← Series
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 flex-1 truncate text-sm font-bold leading-tight text-zinc-50 sm:text-base">
                {data.chapterTitle}
              </h1>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:text-[11px] ${readerStatusPillClass(st.variant)}`}
                title="Series status from source when available"
              >
                {st.label}
              </span>
            </div>
            <p className="truncate text-[10px] text-zinc-500 sm:text-xs">{data.sourceName}</p>
          </div>
          {!fromStart && data.pageNumber > 1 && data.imageUrls.length > 0 ? (
            <Link
              href={`${chapterPathBase}?start=1`}
              className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold text-violet-300 hover:bg-violet-500/10 sm:text-xs"
            >
              From start
            </Link>
          ) : null}
        </div>
        {fromStart ? (
          <p className="border-t border-zinc-800 bg-amber-950/50 px-3 py-1.5 text-center text-[10px] font-medium text-amber-100/95 sm:text-xs">
            Reading from the top — saved scroll position is ignored for this visit.
          </p>
        ) : data.imageUrls.length > 0 ? (
          <p className="border-t border-zinc-800 px-3 py-1.5 text-center text-[10px] text-zinc-500 sm:text-xs">
            Resumed near image {data.pageNumber} — all images load below in one scroll.
          </p>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-3xl px-2 pb-28 pt-3 sm:px-4 sm:pb-32 sm:pt-4">
        <ChapterReaderView
          imageUrls={data.imageUrls}
          initialPage={data.pageNumber}
          chapterLabel={data.chapterTitle}
          sourceName={data.sourceName}
          chapterUrl={data.chapterUrl}
          progressSync={{
            sourceKey: data.sourceKey,
            seriesSlug: data.seriesSlug,
            chapterSlug: data.chapterSlug,
            chapterTitle: data.chapterTitle,
            chapterUrl: data.chapterUrl,
          }}
        />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 px-3 py-2 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
        aria-label="Chapter navigation"
      >
        <div className="mx-auto flex max-w-3xl gap-2 sm:gap-3">
          <Link
            href={
              data.previousChapterSlug
                ? `/manhwa/${encodeURIComponent(data.seriesSlug)}/chapter/${encodeURIComponent(data.previousChapterSlug)}`
                : "#"
            }
            aria-disabled={!data.previousChapterSlug}
            className={`flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl text-sm font-semibold transition ${
              data.previousChapterSlug
                ? "border border-zinc-600 bg-zinc-900 text-zinc-100 hover:border-violet-500/50 hover:bg-zinc-800"
                : "cursor-not-allowed border border-transparent bg-zinc-900/40 text-zinc-600"
            }`}
          >
            ← Previous
          </Link>
          <Link
            href={
              data.nextChapterSlug
                ? `/manhwa/${encodeURIComponent(data.seriesSlug)}/chapter/${encodeURIComponent(data.nextChapterSlug)}`
                : "#"
            }
            aria-disabled={!data.nextChapterSlug}
            className={`flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl text-sm font-semibold transition ${
              data.nextChapterSlug
                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40 hover:bg-violet-500"
                : "cursor-not-allowed bg-zinc-900/40 text-zinc-600"
            }`}
          >
            Next →
          </Link>
        </div>
      </nav>
    </div>
  );
}
