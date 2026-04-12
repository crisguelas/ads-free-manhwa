"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import Link from "next/link";

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
 * Props for the vertical chapter reader: remote image URLs in one continuous scroll strip.
 */
export type ChapterReaderViewProps = {
  /** Ordered list of full image URLs for this chapter (rendered top-to-bottom in a single column). */
  imageUrls: string[];
  /** 1-based image index to scroll to on first mount (from reading history). */
  initialPage: number;
  /** Short label for image alt text (chapter title or slug). */
  chapterLabel: string;
  /** Human-readable source name for the external link fallback. */
  sourceName: string;
  /** Canonical chapter URL on the source site when pages fail to load. */
  chapterUrl: string | null;
  /**
   * When set, visible image index is saved (debounced) to the database for the configured progress user.
   */
  /** Link to next chapter, if any. */
  nextChapterHref?: string | null;
  /** Link to previous chapter, if any. */
  previousChapterHref?: string | null;
};

/**
 * Tracks which reader image is most visible in the viewport so progress sync matches what the user is reading.
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
        rootMargin: "-10% 0px -38% 0px",
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

/**
 * 0–1 scroll depth through the document (updates on scroll, resize, and lazy image loads).
 */
function useDocumentScrollProgress(imageUrlCount: number): number {
  const [progress, setProgress] = useState(0);

  const recalc = useCallback(() => {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) {
      setProgress(1);
      return;
    }
    setProgress(Math.min(1, Math.max(0, el.scrollTop / max)));
  }, []);

  useEffect(() => {
    let raf = 0;
    raf = requestAnimationFrame(() => {
      recalc();
    });
    window.addEventListener("scroll", recalc, { passive: true });
    window.addEventListener("resize", recalc);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", recalc);
      window.removeEventListener("resize", recalc);
    };
  }, [recalc, imageUrlCount]);

  return progress;
}

const READING_PROGRESS_DEBOUNCE_MS = 1200;

/**
 * Persists the latest visible image index via debounced `fetch` and `sendBeacon` when the tab hides.
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

const EAGER_IMAGE_COUNT = 5;

/**
 * Renders all chapter images in one vertical scroll strip (webtoon-style), with scroll progress and resume sync.
 */
export function ChapterReaderView({
  imageUrls,
  initialPage,
  chapterLabel,
  sourceName,
  chapterUrl,
  progressSync = null,
  previousChapterHref = null,
  nextChapterHref = null,
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

  const scrollProgress = useDocumentScrollProgress(imageUrls.length);

  /** Lazy-loaded images change document height; nudge scroll-progress listeners. */
  const onImageLoad = useCallback(() => {
    window.dispatchEvent(new Event("resize"));
  }, []);

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

  const scrollToTopSmooth = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (imageUrls.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-700/80 bg-zinc-900/90 p-6 shadow-lg shadow-black/30">
        <p className="text-sm leading-relaxed text-zinc-300">
          No images could be loaded for this chapter. The source may have changed or the chapter is unavailable.
        </p>
        {chapterUrl ? (
          <p className="mt-4 text-sm">
            <a
              href={chapterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-violet-400 underline-offset-2 hover:text-violet-300 hover:underline"
            >
              Open on {sourceName}
            </a>
          </p>
        ) : null}
      </section>
    );
  }

  const total = imageUrls.length;
  const counterLabel =
    total === 1 ? "Single image in this chapter" : `Image ${visiblePage} of ${total}`;

  return (
    <>
      {/* Scroll depth through the whole chapter (all images load in one long strip). */}
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-[60] h-1 bg-zinc-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(scrollProgress * 100)}
        aria-label="Scroll progress through this chapter"
      >
        <div
          className="h-full bg-violet-500 transition-[width] duration-150 ease-out"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      <section
        ref={pagesRef}
        className="w-full"
        aria-label="Chapter images, one continuous vertical strip"
      >
        <div className="flex flex-col overflow-hidden rounded-xl bg-zinc-950 shadow-xl shadow-black/40 ring-1 ring-zinc-700/80">
          {imageUrls.map((url, index) => {
            const pageNum = index + 1;
            return (
              <figure
                key={`${url}-${index}`}
                id={`reader-page-${pageNum}`}
                data-reader-page={String(pageNum)}
                className="m-0 w-full scroll-mt-32 border-b border-zinc-800/90 last:border-b-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- remote scanlation CDNs vary; native img avoids brittle remotePatterns. */}
                <img
                  src={url}
                  alt={`${chapterLabel} — image ${pageNum} of ${total}`}
                  className="block w-full max-w-full bg-black object-contain"
                  loading={pageNum <= EAGER_IMAGE_COUNT ? "eager" : "lazy"}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onLoad={onImageLoad}
                />
              </figure>
            );
          })}
        </div>
      </section>

      {scrollProgress > 0.06 ? (
        <button
          type="button"
          onClick={scrollToTopSmooth}
          className="fixed bottom-[calc(4.35rem+env(safe-area-inset-bottom))] left-3 z-[55] flex h-11 w-11 items-center justify-center rounded-full border border-zinc-600/90 bg-zinc-900/95 text-zinc-100 shadow-lg shadow-black/40 backdrop-blur-md transition hover:border-violet-500/60 hover:bg-zinc-800 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-violet-500 sm:bottom-[calc(4.6rem+env(safe-area-inset-bottom))] sm:left-4"
          aria-label="Back to top"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      ) : null}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 px-3 py-2 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
        aria-label="Chapter navigation"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 sm:gap-3">
          <Link
            href={previousChapterHref ?? "#"}
            aria-disabled={!previousChapterHref}
            className={`flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl text-sm font-semibold transition ${
              previousChapterHref
                ? "border border-zinc-600 bg-zinc-900 text-zinc-100 hover:border-violet-500/50 hover:bg-zinc-800"
                : "cursor-not-allowed border border-transparent bg-zinc-900/40 text-zinc-600"
            }`}
          >
            ← Prev
          </Link>

          <div className="flex shrink-0 min-w-[5.5rem] items-center justify-center">
            <span className="text-[11px] font-semibold tracking-wide text-zinc-300 sm:text-xs">
              {visiblePage} / {total}
            </span>
          </div>

          <Link
            href={nextChapterHref ?? "#"}
            aria-disabled={!nextChapterHref}
            className={`flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl text-sm font-semibold transition ${
              nextChapterHref
                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40 hover:bg-violet-500"
                : "cursor-not-allowed bg-zinc-900/40 text-zinc-600"
            }`}
          >
            Next →
          </Link>
        </div>
      </nav>
    </>
  );
}
