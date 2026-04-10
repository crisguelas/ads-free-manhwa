import Link from "next/link";
import type { HomePageData } from "@/lib/home-data";

/**
 * Defines props for the source overview home sections.
 */
type SourceOverviewProps = {
  data: HomePageData;
};

/**
 * Renders the source and reading overview cards on the home page.
 */
export function SourceOverview({ data }: SourceOverviewProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Enabled Sources</h2>
        <ul className="mt-4 space-y-3">
          {data.sources.map((source) => (
            <li
              key={source.id}
              className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2"
            >
              <div>
                <p className="font-medium text-zinc-900">{source.name}</p>
                <p className="text-xs text-zinc-500">{source.baseUrl}</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                {source.isEnabled ? "active" : "disabled"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Library Follow List</h2>
        <ul className="mt-4 space-y-3">
          {data.follows.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-200 px-3 py-3 text-sm text-zinc-500">
              No followed series yet.
            </li>
          ) : (
            data.follows.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-zinc-100 px-3 py-2">
                <Link
                  className="font-medium text-zinc-900 hover:text-indigo-700"
                  href={`/manhwa/${entry.seriesSlug}`}
                >
                  {entry.seriesTitle}
                </Link>
                <p className="text-xs text-zinc-500">
                  {entry.sourceName} - {entry.seriesSlug}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:col-span-2">
        <h2 className="text-lg font-semibold text-zinc-900">Recent Reads</h2>
        <ul className="mt-4 space-y-3">
          {data.recentReads.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-200 px-3 py-3 text-sm text-zinc-500">
              No reading history yet.
            </li>
          ) : (
            data.recentReads.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-zinc-100 px-3 py-2">
                <Link
                  className="font-medium text-zinc-900 hover:text-indigo-700"
                  href={`/manhwa/${entry.seriesSlug}/chapter/${entry.chapterSlug}`}
                >
                  {entry.chapterTitle ?? entry.chapterSlug}
                </Link>
                <p className="text-xs text-zinc-500">
                  {entry.sourceName} - {entry.seriesSlug}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
