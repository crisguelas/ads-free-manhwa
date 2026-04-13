import type { HomePageData } from "@/lib/home-data";
import { SourceLatestUpdatesSection } from "@/components/browse-ui-client";
import { BROWSE_SOURCE_LABELS } from "@/lib/source-browse-data";
import { ClientPersonalizedHomeSection } from "@/components/client-continue-reading";

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

      <ClientPersonalizedHomeSection />

      <div className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-7">
        <div id="browse" className="scroll-mt-28">
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
