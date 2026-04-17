"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RemoteCoverImage } from "@/components/remote-cover-image";

type SearchResult = {
  title: string;
  slug: string;
  coverImageUrl: string | null;
  sourceName: string;
  sourceKey: string;
};

/**
 * Returns true when a pointer event originated inside `root`, including targets inside
 * user-agent shadow trees (e.g. WebKit/Chromium clear button on `type="search"` inputs),
 * where `root.contains(event.target)` is often false even though the click is still on the field.
 */
function isPointerEventInsideContainer(event: PointerEvent, root: HTMLElement | null): boolean {
  if (!root) {
    return false;
  }
  const path =
    typeof event.composedPath === "function" ? event.composedPath() : [event.target];
  for (const candidate of path) {
    if (candidate === root) {
      return true;
    }
    if (candidate instanceof Node && root.contains(candidate)) {
      return true;
    }
  }
  return false;
}

/**
 * Header search field: real-time dropdown of series results as the user types.
 */
export function BrowseHeaderSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  /** Set when the API returns an error shape or non-OK status so the panel can show feedback instead of vanishing. */
  const [searchError, setSearchError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Latest trimmed query; used to ignore stale fetch completions after the user types ahead. */
  const queryRef = useRef(query);

  queryRef.current = query.trim();

  // Close dropdown when clicking outside (use composedPath so UA shadow controls still count as “inside”).
  useEffect(() => {
    function handlePointerDownOutside(event: PointerEvent) {
      if (!isPointerEventInsideContainer(event, containerRef.current)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside);
  }, []);

  // Fetch results as query changes
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      setSearchError(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsOpen(true);
      setIsLoading(true);
      setSearchError(false);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (queryRef.current !== q) {
          return;
        }
        if (!res.ok) {
          setResults([]);
          setSearchError(true);
          return;
        }
        const data: unknown = await res.json();
        if (queryRef.current !== q) {
          return;
        }
        if (!Array.isArray(data)) {
          setResults([]);
          setSearchError(true);
          return;
        }
        setResults(data as SearchResult[]);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (queryRef.current === q) {
          setResults([]);
          setSearchError(true);
        }
        console.error("Search fetch error:", err);
      } finally {
        if (queryRef.current === q) {
          setIsLoading(false);
        }
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div ref={containerRef} className="relative hidden flex-1 max-w-sm md:flex">
      <label className="relative flex-1">
        <span className="sr-only">Search or jump to catalog</span>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Search series…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
          className="h-10 w-full rounded-full border border-zinc-200 bg-zinc-50/90 py-2 pl-9 pr-4 text-sm text-zinc-900 shadow-inner outline-none transition placeholder:text-zinc-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
        />
      </label>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-2 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-xl shadow-zinc-900/10 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-[min(380px,70vh)] overflow-y-auto overscroll-contain px-2 py-2">
            {isLoading && results.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
              </div>
            ) : searchError ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                Couldn&apos;t load results. Check your connection and try again.
              </div>
            ) : results.length > 0 ? (
              <ul className="grid gap-1">
                {results.map((r) => (
                  <li key={`${r.sourceKey}-${r.slug}`}>
                    <Link
                      href={`/manhwa/${encodeURIComponent(r.slug)}`}
                      onClick={() => setIsOpen(false)}
                      className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-violet-50/80 active:scale-[0.99]"
                    >
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-100 shadow-sm ring-1 ring-zinc-200/70 transition group-hover:ring-violet-200">
                        <RemoteCoverImage src={r.coverImageUrl} alt="" variant="thumb" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-bold text-zinc-900 group-hover:text-violet-900">
                          {r.title}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-violet-500">
                          {r.sourceName}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                No series found for &quot;<span className="font-semibold text-zinc-900">{query}</span>&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
