"use client";

import Link from "next/link";
import { useState } from "react";
import type { BookmarkListEntry } from "@/lib/bookmarks-page-data";
import { RemoteCoverImage } from "@/components/remote-cover-image";

/**
 * Standard trash icon
 */
function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export function BookmarkListRow({ entry, onRemove }: { entry: BookmarkListEntry; onRemove: (id: string) => void }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onRemove(entry.id);
      } else {
        // Revert UI aggressively if failed
        setIsDeleting(false);
      }
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <li
      className={`group relative flex items-center gap-4 rounded-xl border border-zinc-200/90 bg-white p-3 pr-4 shadow-sm transition hover:border-violet-200/80 hover:shadow-md ${
        isDeleting ? "opacity-50 pointer-events-none scale-[0.98]" : "opacity-100 scale-100"
      }`}
    >
      <Link
        href={`/manhwa/${encodeURIComponent(entry.seriesSlug)}/chapter/${encodeURIComponent(entry.chapterSlug)}`}
        className="flex shrink-0"
      >
        <div className="h-[72px] w-[54px] sm:h-[96px] sm:w-[72px] shrink-0 overflow-hidden rounded-md ring-1 ring-zinc-200/80">
          <RemoteCoverImage
            src={entry.coverImageUrl}
            alt={entry.seriesTitle}
            variant="poster"
            className="object-cover"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Link
          href={`/manhwa/${encodeURIComponent(entry.seriesSlug)}/chapter/${encodeURIComponent(entry.chapterSlug)}`}
          className="line-clamp-1 font-bold leading-tight text-zinc-900 group-hover:text-violet-800 sm:text-lg"
          title={entry.seriesTitle}
        >
          {entry.seriesTitle}
        </Link>
        <div className="mt-1 flex items-center text-sm font-medium text-zinc-700">
          <Link
            href={`/manhwa/${encodeURIComponent(entry.seriesSlug)}/chapter/${encodeURIComponent(entry.chapterSlug)}`}
            className="hover:underline"
          >
            {entry.chapterTitle ?? entry.chapterSlug}
          </Link>
          {entry.pageNumber != null && entry.pageNumber > 1 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600">
              PAGE {entry.pageNumber}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-zinc-500 sm:mt-1.5">
          {entry.sourceName} <span className="mx-1.5 opacity-50">•</span> Saved {entry.bookmarkedAt.toLocaleDateString()}
        </p>
      </div>

      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-100"
        title="Remove bookmark"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        <TrashIcon />
      </button>
    </li>
  );
}
