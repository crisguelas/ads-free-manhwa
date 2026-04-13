"use client";

import { useState } from "react";
import type { BookmarkListEntry } from "@/lib/bookmarks-page-data";
import { BookmarkListRow } from "@/components/bookmark-list-row";

export function BookmarkListClient({ initialEntries }: { initialEntries: BookmarkListEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);

  const handleRemove = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-zinc-500 shadow-sm">
        <p className="text-lg font-medium text-zinc-900">All caught up!</p>
        <p className="mt-2 text-sm">
          You don&apos;t have any bookmarks left. Open a chapter and save a bookmark to find it here later.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3 sm:space-y-4">
      {entries.map((entry) => (
        <BookmarkListRow key={entry.id} entry={entry} onRemove={handleRemove} />
      ))}
    </ul>
  );
}
