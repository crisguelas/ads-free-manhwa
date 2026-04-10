import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeriesDetailData } from "@/lib/reader-data";

/**
 * Defines route params for the series detail page.
 */
type SeriesDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Renders a mobile-first series detail screen with chapter access.
 */
export default async function SeriesDetailPage({
  params,
}: SeriesDetailPageProps) {
  const { id } = await params;
  const data = await getSeriesDetailData(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="min-h-full bg-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Link
          href="/"
          className="w-fit rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
        >
          Back
        </Link>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-indigo-600">
            {data.sourceName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
            {data.seriesTitle}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">{data.sourceBaseUrl}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Adapter: {data.adapterName ?? "not configured yet"} ({data.sourceKey})
          </p>
          <div className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700">
            Latest cached chapter:{" "}
            {data.latestChapterTitle ?? data.latestChapterSlug ?? "Not cached yet"}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Bookmarked Chapters</h2>
          <ul className="mt-4 space-y-3">
            {data.bookmarks.length === 0 ? (
              <li className="rounded-xl border border-dashed border-zinc-200 px-3 py-3 text-sm text-zinc-500">
                No bookmarks yet.
              </li>
            ) : (
              data.bookmarks.map((bookmark) => (
                <li key={bookmark.id} className="rounded-xl border border-zinc-100 px-3 py-2">
                  <Link
                    className="font-medium text-zinc-900 hover:text-indigo-700"
                    href={`/manhwa/${data.seriesSlug}/chapter/${bookmark.chapterSlug}`}
                  >
                    {bookmark.chapterTitle ?? bookmark.chapterSlug}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    Last page: {bookmark.pageNumber ?? 1}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">
            Live Source Chapters ({data.sourceName})
          </h2>
          <ul className="mt-4 space-y-3">
            {data.liveChapters.length === 0 ? (
              <li className="rounded-xl border border-dashed border-zinc-200 px-3 py-3 text-sm text-zinc-500">
                No live chapters loaded yet for this slug.
              </li>
            ) : (
              data.liveChapters.map((chapter) => (
                <li key={chapter.slug} className="rounded-xl border border-zinc-100 px-3 py-2">
                  <Link
                    className="font-medium text-zinc-900 hover:text-indigo-700"
                    href={`/manhwa/${data.seriesSlug}/chapter/${chapter.slug}`}
                  >
                    {chapter.title}
                  </Link>
                  <p className="text-xs text-zinc-500 break-all">{chapter.url}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Recent Reading</h2>
          <ul className="mt-4 space-y-3">
            {data.recentReads.length === 0 ? (
              <li className="rounded-xl border border-dashed border-zinc-200 px-3 py-3 text-sm text-zinc-500">
                No recent reads yet.
              </li>
            ) : (
              data.recentReads.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-zinc-100 px-3 py-2">
                  <Link
                    className="font-medium text-zinc-900 hover:text-indigo-700"
                    href={`/manhwa/${data.seriesSlug}/chapter/${entry.chapterSlug}`}
                  >
                    {entry.chapterTitle ?? entry.chapterSlug}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    Continue from page: {entry.pageNumber ?? 1}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
