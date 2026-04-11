"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * Identifies the chapter and source for `POST /api/reading-progress` (scroll → `ReadingHistory`).
 */
export type ReadingProgressSync = {
  sourceKey: string;
  seriesSlug: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterUrl: string | null;
};

/**
 * Props for the vertical chapter reader: remote page URLs, resume position, and fallbacks.
 */
export type ChapterReaderViewProps = {
  /** Ordered list of full image URLs for this chapter. */
  imageUrls: string[];
  /** 1-based page index to scroll to on first mount (from reading history). */
  initialPage: number;
  /** Short label for image alt text (chapter title or slug). */
  chapterLabel: string;
  /** Human-readable source name for the external link fallback. */
  sourceName: string;
  /** Canonical chapter URL on the source site when pages fail to load. */
  chapterUrl: string | null;
  /**
   * When set, visible page index is saved (debounced) to the database for the configured progress user.
   */
  progressSync?: ReadingProgressSync | null;
};

/**
 * Tracks which reader page is most visible in the viewport so the footer counter matches what the user is reading.
 */
function useVisiblePageIndex(
  imageCount: number,
  containerRef: RefObject<HTMLElement | null>,
  seedPage: number,
): number {
  const [page, setPage] = useState(seedPage);

  useEffect(() => {
    setPage(seedPage);
  }, [seedPage]);

  useEffect(() => {
    if (imageCount === 0 || !containerRef.current) {
      return;
    }

    const elements =
      containerRef.current.querySelectorAll<HTMLElement>("[data-reader-page]");
    if (elements.length === 0) {
      return;
    }

    const ratios = new Map<Element, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target, entry.intersectionRatio);
        }
        let bestPage = 1;
        let bestRatio = 0;
        for (const el of elements) {
          const ratio = ratios.get(el) ?? 0;
          const n = Number.parseInt(el.dataset.readerPage ?? "0", 10);
          if (!Number.isFinite(n) || n < 1) {
            continue;
          }
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestPage = n;
          }
        }
        if (bestRatio > 0) {
          setPage(bestPage);
        }
      },
      {
        root: null,
        rootMargin: "-12% 0px -40% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [imageCount, containerRef]);

  return page;
}

const READING_PROGRESS_DEBOUNCE_MS = 1200;

/**
 * Persists the latest visible page via debounced `fetch` and `sendBeacon` when the tab hides (until auth owns the user id).
 */
function usePersistReadingProgress(
  progressSync: ReadingProgressSync | null | undefined,
  visiblePage: number,
  imageCount: number,
): void {
  const lastSentRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncRef = useRef(progressSync);
  const pageRef = useRef(visiblePage);

  useEffect(() => {
    syncRef.current = progressSync;
    pageRef.current = visiblePage;
  }, [progressSync, visiblePage]);

  useEffect(() => {
    lastSentRef.current = null;
  }, [
    progressSync?.sourceKey,
    progressSync?.seriesSlug,
    progressSync?.chapterSlug,
  ]);

  useEffect(() => {
    if (!progressSync || imageCount === 0) {
      return;
    }

    const flushBeacon = (): void => {
      const sync = syncRef.current;
      const page = pageRef.current;
      if (!sync || page < 1) {
        return;
      }
      const body = JSON.stringify({
        sourceKey: sync.sourceKey,
        seriesSlug: sync.seriesSlug,
        chapterSlug: sync.chapterSlug,
        chapterTitle: sync.chapterTitle,
        chapterUrl: sync.chapterUrl,
        pageNumber: page,
      });
      navigator.sendBeacon(
        "/api/reading-progress",
        new Blob([body], { type: "application/json" }),
      );
    };

    const onHidden = (): void => {
      if (document.visibilityState === "hidden") {
        flushBeacon();
      }
    };
    window.addEventListener("pagehide", flushBeacon);
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      window.removeEventListener("pagehide", flushBeacon);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [
    progressSync?.sourceKey,
    progressSync?.seriesSlug,
    progressSync?.chapterSlug,
    imageCount,
    progressSync,
  ]);

  useEffect(() => {
    if (!progressSync || imageCount === 0) {
      return;
    }
    if (visiblePage === lastSentRef.current) {
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void (async () => {
        try {
          const res = await fetch("/api/reading-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceKey: progressSync.sourceKey,
              seriesSlug: progressSync.seriesSlug,
              chapterSlug: progressSync.chapterSlug,
              chapterTitle: progressSync.chapterTitle,
              chapterUrl: progressSync.chapterUrl,
              pageNumber: visiblePage,
            }),
          });
          if (res.ok) {
            lastSentRef.current = visiblePage;
          }
        } catch {
          /* ignore network errors */
        }
      })();
    }, READING_PROGRESS_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [visiblePage, progressSync, imageCount]);
}

/**
 * Renders a mobile-first vertical manhwa reader: full-width images, lazy loading, resume scroll, and a sticky page counter.
 */
export function ChapterReaderView({
  imageUrls,
  initialPage,
  chapterLabel,
  sourceName,
  chapterUrl,
  progressSync = null,
}: ChapterReaderViewProps) {
  const pagesRef = useRef<HTMLElement>(null);
  const clampedInitial = Math.min(
    Math.max(initialPage, 1),
    Math.max(imageUrls.length, 1),
  );
  const visiblePage = useVisiblePageIndex(
    imageUrls.length,
    pagesRef,
    clampedInitial,
  );

  usePersistReadingProgress(progressSync, visiblePage, imageUrls.length);

  const scrollToInitialPage = useCallback(() => {
    if (imageUrls.length === 0) {
      return;
    }
    const el = document.getElementById(`reader-page-${clampedInitial}`);
    el?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [clampedInitial, imageUrls.length]);

  useLayoutEffect(() => {
    scrollToInitialPage();
  }, [scrollToInitialPage]);

  if (imageUrls.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-600">
          No pages could be loaded for this chapter. The source layout may have
          changed, or the chapter is unavailable.
        </p>
        {chapterUrl ? (
          <p className="mt-4 text-sm">
            <a
              href={chapterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-orange-700 underline-offset-2 hover:underline"
            >
              Open on {sourceName}
            </a>
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <section
        ref={pagesRef}
        className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-900/[0.04]"
        aria-label="Chapter pages"
      >
        <div className="flex flex-col">
          {imageUrls.map((url, index) => {
            const pageNum = index + 1;
            return (
              <figure
                key={`${url}-${index}`}
                id={`reader-page-${pageNum}`}
                data-reader-page={String(pageNum)}
                className="m-0 w-full scroll-mt-24"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- remote scanlation CDNs vary; native img avoids brittle remotePatterns. */}
                <img
                  src={url}
                  alt={`${chapterLabel} — page ${pageNum}`}
                  className="block w-full max-w-full bg-white object-contain"
                  loading={pageNum <= 2 ? "eager" : "lazy"}
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </figure>
            );
          })}
        </div>
      </section>

      <div
        className="pointer-events-none sticky bottom-0 z-10 -mx-1 flex justify-center pb-1 pt-2"
        aria-live="polite"
      >
        <div className="pointer-events-auto rounded-full border border-zinc-200/90 bg-white/95 px-4 py-1.5 text-xs font-semibold text-zinc-700 shadow-lg backdrop-blur-sm">
          Page {visiblePage} / {imageUrls.length}
        </div>
      </div>
    </>
  );
}
