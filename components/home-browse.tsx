import Link from "next/link";
import type { HomePageData } from "@/lib/home-data";
import { BrowsePromoRibbon, SourceLatestUpdatesSection } from "@/components/browse-ui-client";
import { ContinueReadingCarousel } from "@/components/continue-reading-carousel";
import { BROWSE_SOURCE_KEYS, BROWSE_SOURCE_LABELS } from "@/lib/source-browse-data";

type HomeBrowseProps = {
  data: HomePageData;
};

/**
 * Home dashboard: continue reading, source shortcuts, and two live “latest updates” columns (Asura + Flame).
 */
export function HomeBrowse({ data }: HomeBrowseProps) {
  return (
    <div className="min-h-full bg-[var(--browse-canvas)] text-zinc-900">
      {!data.dbOk ? (
        <div
          role="alert"
          className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950 sm:px-6"
        >
          <strong className="font-semibold">Database unreachable.</strong>{" "}
          Showing the catalog only; sign-in data and source status may be missing. Check{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">DATABASE_URL</code> and your network. If TLS
          fails on Windows, add{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">DATABASE_PG_SSL=compat</code> to{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">.env</code> and restart the dev server (dev
          only).
        </div>
      ) : null}

      {!data.currentUserEmail ? (
        <BrowsePromoRibbon
          message="Save reading progress and library across devices — create a free account."
          ctaLabel="Register"
          ctaHref="/register"
        />
      ) : null}

      <div className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-7">
        {data.currentUserEmail && data.recentReads.length > 0 ? (
          <section className="mb-12">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Continue reading</h2>
            <ContinueReadingCarousel items={data.recentReads} />
          </section>
        ) : null}

        <div id="browse" className="scroll-mt-28">
          <div className="mb-10 rounded-2xl border border-zinc-200/80 bg-white/80 px-5 py-5 shadow-sm shadow-zinc-900/[0.03] backdrop-blur-sm sm:px-6">
            <p className="text-xs font-medium text-zinc-500">Browse the full catalog by source</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {BROWSE_SOURCE_KEYS.map((key) => (
                <Link
                  key={key}
                  href={`/browse/${key}`}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900 hover:shadow-md"
                >
                  {BROWSE_SOURCE_LABELS[key]}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-10 sm:gap-12">
            <SourceLatestUpdatesSection
              eyebrow={BROWSE_SOURCE_LABELS["asura-scans"]}
              title="Latest Updates"
              description=""
              items={data.latestAsura}
              viewAllHref="/browse/asura-scans"
              viewAllLabel="Browse all Asura series"
              accentClass="border-l-4 border-l-violet-600"
            />
            <SourceLatestUpdatesSection
              eyebrow={BROWSE_SOURCE_LABELS["flame-scans"]}
              title="Latest Updates"
              description=""
              items={data.latestFlame}
              viewAllHref="/browse/flame-scans"
              viewAllLabel="Browse all Flame series"
              accentClass="border-l-4 border-l-amber-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
