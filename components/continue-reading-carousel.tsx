"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ContinueReadingCard } from "@/lib/home-data";
import { resolveContinueReadingCarouselLabels } from "@/lib/continue-reading-display";
import { RemoteCoverImage } from "@/components/remote-cover-image";

type ContinueReadingCarouselProps = {
  /** Deduped resume rows (one latest chapter per series) from the home data loader. */
  items: ContinueReadingCard[];
};

/**
 * Horizontal scroll row of vertical “poster + title + chapter” tiles; shows prev/next controls when content overflows.
 */
export function ContinueReadingCarousel({ items }: ContinueReadingCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const refreshScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const end = scrollWidth - clientWidth;
    const epsilon = 4;
    setCanLeft(scrollLeft > epsilon);
    setCanRight(end > epsilon && scrollLeft < end - epsilon);
  }, []);

  useEffect(() => {
    refreshScrollState();
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.addEventListener("scroll", refreshScrollState, { passive: true });
    const ro = new ResizeObserver(() => refreshScrollState());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", refreshScrollState);
      ro.disconnect();
    };
  }, [items, refreshScrollState]);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const step = Math.max(220, Math.floor(el.clientWidth * 0.72)) * direction;
    el.scrollBy({ left: step, behavior: "smooth" });
  }, []);

  const showArrows = canLeft || canRight;

  return (
    <div className="relative">
      {showArrows && canLeft ? (
        <button
          type="button"
          className="absolute left-0 top-[42%] z-10 flex -translate-x-0.5 -translate-y-1/2 rounded-full border border-zinc-200/90 bg-white/95 p-2 text-zinc-700 shadow-md shadow-zinc-900/10 backdrop-blur-sm transition hover:bg-violet-50 hover:text-violet-900 sm:-translate-x-1 sm:p-2.5"
          aria-label="Scroll continue reading left"
          onClick={() => scrollByPage(-1)}
        >
          <CarouselChevron direction="left" />
        </button>
      ) : null}
      {showArrows && canRight ? (
        <button
          type="button"
          className="absolute right-0 top-[42%] z-10 flex translate-x-0.5 -translate-y-1/2 rounded-full border border-zinc-200/90 bg-white/95 p-2 text-zinc-700 shadow-md shadow-zinc-900/10 backdrop-blur-sm transition hover:bg-violet-50 hover:text-violet-900 sm:translate-x-1 sm:p-2.5"
          aria-label="Scroll continue reading right"
          onClick={() => scrollByPage(1)}
        >
          <CarouselChevron direction="right" />
        </button>
      ) : null}

      <div
        ref={scrollRef}
        className={`flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden ${showArrows ? "px-1 sm:px-10" : ""}`}
      >
        {items.map((r) => {
          const { seriesLine, chapterLine } = resolveContinueReadingCarouselLabels({
            seriesTitle: r.seriesTitle,
            sourceKey: r.sourceKey,
            seriesSlug: r.seriesSlug,
            chapterTitle: r.chapterTitle,
            chapterSlug: r.chapterSlug,
          });
          return (
            <Link
              key={r.id}
              href={`/manhwa/${encodeURIComponent(r.seriesSlug)}/chapter/${encodeURIComponent(r.chapterSlug)}`}
              className="group flex w-[128px] shrink-0 snap-start flex-col sm:w-[148px]"
            >
              <div className="overflow-hidden rounded-xl ring-1 ring-zinc-200/80 transition duration-200 group-hover:ring-violet-300/80 group-hover:shadow-md">
                <RemoteCoverImage
                  src={r.coverImageUrl}
                  alt={seriesLine}
                  variant="poster"
                  className="shadow-sm"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-center text-[12px] font-bold leading-snug text-zinc-900 sm:text-[13px]" title={seriesLine}>
                {seriesLine}
              </p>
              <p className="mt-1 line-clamp-1 text-center text-[11px] font-medium text-zinc-500">{chapterLine}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Simple chevron icon for carousel controls (inline SVG keeps the bundle free of icon dependencies).
 */
function CarouselChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      aria-hidden
    >
      {direction === "left" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
      )}
    </svg>
  );
}
