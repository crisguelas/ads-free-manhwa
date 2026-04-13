"use client";

import { useEffect, useState } from "react";
import type { ContinueReadingCard } from "@/lib/home-data";
import { ContinueReadingCarousel } from "@/components/continue-reading-carousel";
import { BrowsePromoRibbon } from "@/components/browse-ui-client";

type PersonalData = {
  authenticated: boolean;
  currentUserEmail?: string;
  recentReads?: ContinueReadingCard[];
};

export function ClientPersonalizedHomeSection() {
  const [data, setData] = useState<PersonalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/personal/home")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load personal data");
        return res.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    // Optionally return a skeleton or just empty space while loading personal data
    return <div className="animate-pulse h-8" />;
  }

  if (!data?.authenticated) {
    return (
      <BrowsePromoRibbon
        message="Save reading progress and library across devices — create a free account."
        ctaLabel="Register"
        ctaHref="/register"
      />
    );
  }

  if (data.recentReads && data.recentReads.length > 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-7">
        <section className="mb-12">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
            Continue reading
          </h2>
          <ContinueReadingCarousel items={data.recentReads} />
        </section>
      </div>
    );
  }

  return null;
}
