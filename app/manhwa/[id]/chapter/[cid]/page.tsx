import Link from "next/link";
import { notFound } from "next/navigation";
import { getChapterReaderData } from "@/lib/reader-data";

/**
 * Defines route params for the chapter reader page.
 */
type ChapterReaderPageProps = {
  params: Promise<{
    id: string;
    cid: string;
  }>;
};

/**
 * Renders a clean, mobile-first chapter reader shell.
 */
export default async function ChapterReaderPage({
  params,
}: ChapterReaderPageProps) {
  const { id, cid } = await params;
  const data = await getChapterReaderData(id, cid);

  if (!data) {
    notFound();
  }

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/manhwa/${data.seriesSlug}`}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-200"
            >
              Back to series
            </Link>
            <p className="text-xs text-zinc-400">{data.sourceName}</p>
          </div>
          <h1 className="mt-3 text-lg font-semibold">{data.chapterTitle}</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Resume page: {data.pageNumber}
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-sm text-zinc-300">
            Reader view is ready. Source-specific page scraping will be plugged in
            after website adapter selection.
          </p>
          <p className="mt-3 break-all text-xs text-zinc-500">
            Chapter URL: {data.chapterUrl ?? "Not available yet"}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Images detected: {data.imageUrls.length}
          </p>
        </section>

        <nav className="grid grid-cols-2 gap-3">
          <Link
            href={
              data.previousChapterSlug
                ? `/manhwa/${data.seriesSlug}/chapter/${data.previousChapterSlug}`
                : "#"
            }
            className={`rounded-xl border px-4 py-3 text-center text-sm font-medium ${
              data.previousChapterSlug
                ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                : "cursor-not-allowed border-zinc-800 bg-zinc-900/50 text-zinc-500"
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
            className={`rounded-xl border px-4 py-3 text-center text-sm font-medium ${
              data.nextChapterSlug
                ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                : "cursor-not-allowed border-zinc-800 bg-zinc-900/50 text-zinc-500"
            }`}
          >
            Next
          </Link>
        </nav>
      </main>
    </div>
  );
}
