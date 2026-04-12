import Link from "next/link";
import { redirect } from "next/navigation";
import { getBookmarksForUser } from "@/lib/bookmarks-page-data";
import { getSessionUser } from "@/lib/auth/current-user";
import { textLink } from "@/lib/ui-styles";
import { BookmarkListClient } from "@/components/bookmark-list-client";

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
    <main className="flex flex-1 flex-col bg-[var(--browse-canvas)] text-zinc-900 pb-16">
      <div className="border-b border-zinc-200/90 bg-white shadow-sm">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl">Bookmarks</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Pick up exactly where you left off.</p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {!dbOk ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 shadow-sm">
            Database unavailable. Try again later.
          </p>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-zinc-500 shadow-sm">
            <p className="text-lg font-medium text-zinc-900">No bookmarks yet.</p>
            <p className="mt-2 text-sm">
              Open a chapter and save a bookmark from the reader to see it here.
            </p>
            <p className="mt-6">
              <Link href="/" className={textLink}>
                ← Back to Home
              </Link>
            </p>
          </div>
        ) : (
          <BookmarkListClient initialEntries={entries} />
        )}
      </div>
    </main>
  );
}
