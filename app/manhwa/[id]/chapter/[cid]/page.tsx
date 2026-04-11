import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChapterReaderView } from "@/components/chapter-reader-view";
import { getSessionUser } from "@/lib/auth/current-user";
import { getChapterReaderData } from "@/lib/reader-data";

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
 * Renders a clean, mobile-first chapter reader shell.
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

  return (
    <div className="min-h-full bg-[var(--browse-canvas)] text-zinc-900">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
        <header className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm shadow-zinc-900/[0.04]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/manhwa/${data.seriesSlug}`}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-white"
            >
              Back to series
            </Link>
            <p className="text-xs font-medium text-orange-700/90">{data.sourceName}</p>
          </div>
          <h1 className="mt-3 text-lg font-bold tracking-tight text-zinc-900">{data.chapterTitle}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span>
              {fromStart
                ? "Reading from page 1 (saved position ignored for this visit)."
                : `Resume page: ${data.pageNumber}`}
            </span>
            {!fromStart && data.pageNumber > 1 && data.imageUrls.length > 0 ? (
              <Link
                href={`/manhwa/${encodeURIComponent(data.seriesSlug)}/chapter/${encodeURIComponent(data.chapterSlug)}?start=1`}
                className="font-semibold text-orange-700 underline-offset-2 hover:underline"
              >
                Start from page 1
              </Link>
            ) : null}
          </div>
        </header>

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

        <nav className="grid grid-cols-2 gap-3">
          <Link
            href={
              data.previousChapterSlug
                ? `/manhwa/${data.seriesSlug}/chapter/${data.previousChapterSlug}`
                : "#"
            }
            className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold ${
              data.previousChapterSlug
                ? "border-zinc-200 bg-white text-zinc-900 shadow-sm hover:border-orange-200/80"
                : "cursor-not-allowed border-zinc-100 bg-zinc-100/80 text-zinc-400"
            }`}
          >
            Previous
          </Link>
          <Link
            href={
              data.nextChapterSlug
                ? `/manhwa/${data.seriesSlug}/chapter/${data.nextChapterSlug}`
                : "#"
            }
            className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold ${
              data.nextChapterSlug
                ? "border-zinc-900 bg-zinc-900 text-white shadow-sm hover:bg-zinc-800"
                : "cursor-not-allowed border-zinc-100 bg-zinc-100/80 text-zinc-400"
            }`}
          >
            Next
          </Link>
        </nav>
      </main>
    </div>
  );
}
