import Link from "next/link";
import { redirect } from "next/navigation";
import { getBookmarksForUser } from "@/lib/bookmarks-page-data";
import { getSessionUser } from "@/lib/auth/current-user";
import { textLink } from "@/lib/ui-styles";

/**
 * Lists saved chapter bookmarks for the signed-in user; guests are redirected to login.
 */
export default async function BookmarksPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=%2Fbookmarks");
  }

  let dbOk = true;
  let entries: Awaited<ReturnType<typeof getBookmarksForUser>> = [];
  try {
    entries = await getBookmarksForUser(user.id);
  } catch {
    dbOk = false;
  }

  return (
    <main className="flex flex-1 flex-col bg-[var(--browse-canvas)] text-zinc-900">
      <div className="border-b border-zinc-200/90 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Bookmarks</h1>
          <p className="mt-2 text-sm text-zinc-600">Chapters you have bookmarked in the reader.</p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {!dbOk ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Database unavailable. Try again later.
          </p>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-600 shadow-sm">
            <p>No bookmarks yet.</p>
            <p className="mt-2">
              Open a chapter and save a bookmark from the reader to see it here.
            </p>
            <p className="mt-4">
              <Link href="/" className={textLink}>
                ← Back to home
              </Link>
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((b) => (
              <li
                key={b.id}
                className="rounded-xl border border-zinc-200/90 bg-white px-4 py-3 shadow-sm transition hover:border-violet-200/80"
              >
                <Link
                  href={`/manhwa/${encodeURIComponent(b.seriesSlug)}/chapter/${encodeURIComponent(b.chapterSlug)}`}
                  className="block font-semibold text-zinc-900 hover:text-violet-800"
                >
                  {b.chapterTitle ?? b.chapterSlug}
                </Link>
                <p className="mt-1 text-xs text-zinc-500">
                  {b.sourceName} · series <span className="font-mono text-[11px]">{b.seriesSlug}</span>
                  {b.pageNumber != null ? ` · page ${b.pageNumber}` : null}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Saved {b.bookmarkedAt.toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
