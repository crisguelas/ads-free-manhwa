import Link from "next/link";
import type { HomePageData } from "@/lib/home-data";
import { cardElevated, textLink } from "@/lib/ui-styles";

/**
 * Defines props for the source overview home sections.
 */
type SourceOverviewProps = {
  data: HomePageData;
};

const sectionTitle = "text-lg font-semibold tracking-tight text-zinc-900";
const sectionEyebrow = "mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-600/90";
const listRow =
  "flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/40 px-3.5 py-2.5 transition hover:border-zinc-200 hover:bg-white";

/**
 * Renders the source and reading overview cards on the home page.
 */
export function SourceOverview({ data }: SourceOverviewProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className={`${cardElevated} flex flex-col`}>
        <div>
          <p className={sectionEyebrow}>Sources</p>
          <h2 className={sectionTitle}>Enabled connectors</h2>
          <p className="mt-1 text-sm text-zinc-500">Sites your reader can pull chapters from.</p>
        </div>
        <ul className="mt-5 space-y-2">
          {data.sources.map((source) => (
            <li key={source.id} className={listRow}>
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900">{source.name}</p>
                <p className="truncate text-xs text-zinc-500">{source.baseUrl}</p>
              </div>
              <span
                className={
                  source.isEnabled
                    ? "shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
                    : "shrink-0 rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-600"
                }
              >
                {source.isEnabled ? "Active" : "Off"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${cardElevated} flex flex-col`}>
        <div>
          <p className={sectionEyebrow}>Library</p>
          <h2 className={sectionTitle}>Your follows</h2>
          <p className="mt-1 text-sm text-zinc-500">Series you are tracking.</p>
        </div>
        <ul className="mt-5 space-y-2">
          {data.currentUserEmail === null ? (
            <li className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 px-3.5 py-4 text-sm leading-relaxed text-zinc-600">
              <Link href="/login" className={textLink}>
                Log in
              </Link>{" "}
              to see your library, or{" "}
              <Link href="/register" className={textLink}>
                register
              </Link>{" "}
              for an account.
            </li>
          ) : data.follows.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 px-3.5 py-4 text-sm text-zinc-500">
              No followed series yet. Follows appear here once you add them.
            </li>
          ) : (
            data.follows.map((entry) => (
              <li key={entry.id} className={listRow}>
                <div className="min-w-0">
                  <Link
                    className="block truncate font-medium text-zinc-900 transition hover:text-indigo-700"
                    href={`/manhwa/${entry.seriesSlug}`}
                  >
                    {entry.seriesTitle}
                  </Link>
                  <p className="truncate text-xs text-zinc-500">
                    {entry.sourceName} · {entry.seriesSlug}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className={`${cardElevated} md:col-span-2`}>
        <div>
          <p className={sectionEyebrow}>Activity</p>
          <h2 className={sectionTitle}>Recent reads</h2>
          <p className="mt-1 text-sm text-zinc-500">Jump back into the last chapters you opened.</p>
        </div>
        <ul className="mt-5 space-y-2">
          {data.currentUserEmail === null ? (
            <li className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 px-3.5 py-4 text-sm text-zinc-600">
              Sign in to track recent chapters and resume reading.
            </li>
          ) : data.recentReads.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 px-3.5 py-4 text-sm text-zinc-500">
              No reading history yet. Open a chapter to see it listed here.
            </li>
          ) : (
            data.recentReads.map((entry) => (
              <li key={entry.id} className={listRow}>
                <div className="min-w-0">
                  <Link
                    className="block truncate font-medium text-zinc-900 transition hover:text-indigo-700"
                    href={`/manhwa/${entry.seriesSlug}/chapter/${entry.chapterSlug}`}
                  >
                    {entry.chapterTitle ?? entry.chapterSlug}
                  </Link>
                  <p className="truncate text-xs text-zinc-500">
                    {entry.sourceName} · {entry.seriesSlug}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
