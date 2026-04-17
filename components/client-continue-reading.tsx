"use client";

import { useState } from "react";
import type { ContinueReadingCard } from "@/lib/home-data";
import { ContinueReadingCarousel } from "@/components/continue-reading-carousel";
import { readContinueReadingEntries } from "@/lib/browser-continue-reading";

export function ClientPersonalizedHomeSection() {
  const [recentReads] = useState<ContinueReadingCard[]>(() =>
    typeof window === "undefined" ? [] : readContinueReadingEntries(),
  );

  if (recentReads.length > 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-7">
        <section className="mb-12">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
            Continue reading
          </h2>
          <ContinueReadingCarousel items={recentReads} />
        </section>
      </div>
    );
  }

  return null;
}
