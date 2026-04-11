import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageSurface } from "@/components/layout/page-surface";
import { getSessionUser } from "@/lib/auth/current-user";
import { getSeriesDetailData } from "@/lib/reader-data";
import { cardElevated } from "@/lib/ui-styles";

/**
 * Defines route params for the series detail page.
 */
type SeriesDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const listRow =
  "flex flex-col gap-0.5 border-b border-zinc-100 bg-white px-3 py-3 transition last:border-0 odd:bg-zinc-50/50 hover:bg-orange-50/30 sm:px-4";
const emptyRow =
  "rounded-xl border border-dashed border-zinc-200 bg-white px-3.5 py-4 text-sm text-zinc-500 shadow-sm";
const sectionEyebrow = "text-xs font-bold uppercase tracking-wider text-orange-600/90";

/**
 * Renders a mobile-first series detail screen with chapter access.
 */
export default async function SeriesDetailPage({
  params,
}: SeriesDetailPageProps) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/manhwa/${id}`)}`);
  }

  const data = await getSeriesDetailData(id);

  if (!data) {
    notFound();
  }

  return (
    <PageSurface>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href="/"
          className="w-fit rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-orange-200/80 hover:bg-zinc-50"
        >
          ← Home
        </Link>

        <section className={cardElevated}>
          <p className={sectionEyebrow}>{data.sourceName}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            {data.seriesTitle}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">{data.sourceBaseUrl}</p>
          <p className="mt-1 text-xs text-zinc-400">
            Source · {data.adapterName ?? "not configured"} ({data.sourceKey})
          </p>
          <div className="mt-5 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3.5 py-3 text-sm text-zinc-700">
            <span className="font-medium text-zinc-800">Latest cached chapter:</span>{" "}
            {data.latestChapterTitle ?? data.latestChapterSlug ?? "Not cached yet"}
          </div>
        </section>

        <section className={cardElevated}>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Bookmarks</h2>
          <p className="mt-1 text-sm text-zinc-500">Chapters you have marked.</p>
          <ul className="mt-4 space-y-2">
            {data.bookmarks.length === 0 ? (
              <li className={emptyRow}>No bookmarks yet.</li>
            ) : (
              data.bookmarks.map((bookmark) => (
                <li key={bookmark.id} className={listRow}>
                  <Link
                    className="block font-semibold text-zinc-900 transition hover:text-orange-800"
                    href={`/manhwa/${data.seriesSlug}/chapter/${bookmark.chapterSlug}`}
                  >
                    {bookmark.chapterTitle ?? bookmark.chapterSlug}
                  </Link>
                  <p className="text-xs text-zinc-500">Last page: {bookmark.pageNumber ?? 1}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className={`${cardElevated} overflow-hidden p-0`}>
          <div className="border-b border-zinc-100 px-6 py-5">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">Chapters</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Live list from {data.sourceName}. Earliest chapter is listed first.
            </p>
          </div>
          <ul className="mt-0">
            {data.liveChapters.length === 0 ? (
              <li className="px-6 py-4">
                <div className={emptyRow}>No chapters loaded for this series yet.</div>
              </li>
            ) : (
              data.liveChapters.map((chapter) => (
                <li key={chapter.slug} className={listRow}>
                  <Link
                    className="font-semibold text-zinc-900 transition hover:text-orange-800"
                    href={`/manhwa/${data.seriesSlug}/chapter/${chapter.slug}`}
                  >
                    {chapter.title}
                  </Link>
                  <p className="break-all text-[11px] leading-relaxed text-zinc-400">{chapter.url}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className={cardElevated}>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Recent reading</h2>
          <p className="mt-1 text-sm text-zinc-500">Pick up where you stopped.</p>
          <ul className="mt-4 space-y-2">
            {data.recentReads.length === 0 ? (
              <li className={emptyRow}>No recent reads yet.</li>
            ) : (
              data.recentReads.map((entry) => (
                <li key={entry.id} className={listRow}>
                  <Link
                    className="block font-semibold text-zinc-900 transition hover:text-orange-800"
                    href={`/manhwa/${data.seriesSlug}/chapter/${entry.chapterSlug}`}
                  >
                    {entry.chapterTitle ?? entry.chapterSlug}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    Continue from page {entry.pageNumber ?? 1}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </PageSurface>
  );
}
