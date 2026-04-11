import Link from "next/link";
import type { CatalogHighlight } from "@/lib/featured-series";
import type { HomePageData } from "@/lib/home-data";
import { RemoteCoverImage } from "@/components/remote-cover-image";

const ASURA_KEY = "asura-scans";
const FLAME_KEY = "flame-scans";

type HomeBrowseProps = {
  data: HomePageData;
  /** When set to a known source key, grids and sidebars only show that source’s curated rows. */
  sourceFilter: string | null;
};

/**
 * Maps the raw query value to a safe filter mode; unknown values behave like “all”.
 */
function normalizeSourceFilter(raw: string | null): "all" | typeof ASURA_KEY | typeof FLAME_KEY {
  if (raw === ASURA_KEY || raw === FLAME_KEY) {
    return raw;
  }
  return "all";
}

/**
 * Splits highlights into Asura vs Flame buckets for sectioned layout (scan-site style).
 */
function partitionHighlights(items: CatalogHighlight[]) {
  const asura = items.filter((h) => h.sourceKey === ASURA_KEY);
  const flame = items.filter((h) => h.sourceKey === FLAME_KEY);
  return { asura, flame };
}

/**
 * Applies the URL filter so featured, grids, and sidebar stay consistent.
 */
function filterHighlights(
  items: CatalogHighlight[],
  mode: ReturnType<typeof normalizeSourceFilter>,
): CatalogHighlight[] {
  if (mode === "all") {
    return items;
  }
  return items.filter((h) => h.sourceKey === mode);
}

type FilterPillProps = {
  href: string;
  label: string;
  active: boolean;
};

/**
 * Pill-shaped source filter control; active state uses a warm accent (Asura-adjacent) on white chrome.
 */
function FilterPill({ href, label, active }: FilterPillProps) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition sm:text-sm ${
        active
          ? "bg-zinc-900 text-white shadow-sm ring-1 ring-zinc-900/10"
          : "border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      {label}
    </Link>
  );
}

type LatestRowProps = { series: CatalogHighlight };

/**
 * Compact “latest updates” row: cover, title stack, and chevron — mirrors scan-site list density on light UI.
 */
function LatestRow({ series }: LatestRowProps) {
  return (
    <li className="border-b border-zinc-100 last:border-0">
      <Link
        href={`/manhwa/${encodeURIComponent(series.seriesSlug)}`}
        className="flex items-center gap-3 py-3 pr-1 transition hover:bg-zinc-50/80 sm:gap-4 sm:py-3.5"
      >
        <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-100 ring-1 ring-zinc-200/80 sm:h-[4.5rem] sm:w-12">
          <RemoteCoverImage
            src={series.coverImageUrl}
            alt=""
            variant="thumb"
            className="h-full w-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900">{series.title}</p>
          {series.subtitle ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{series.subtitle}</p>
          ) : null}
          {series.genres.length > 0 ? (
            <p className="mt-1 line-clamp-1 text-[11px] text-zinc-400">{series.genres.slice(0, 4).join(" · ")}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-zinc-300" aria-hidden>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </Link>
    </li>
  );
}

type SourceSectionProps = {
  title: string;
  accentClass: string;
  items: CatalogHighlight[];
  description: string;
};

/**
 * Block heading + list rows for one translator group (Asura or Flame).
 */
function SourceSection({ title, accentClass, items, description }: SourceSectionProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-900/[0.04]">
      <div className={`border-b border-zinc-100 px-4 py-4 sm:px-5 ${accentClass}`}>
        <h2 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 sm:text-sm">{description}</p>
      </div>
      <ul className="px-3 sm:px-4">
        {items.map((s) => (
          <LatestRow key={s.id} series={s} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Scan-inspired home: spotlight carousel, per-source “latest” lists, poster grid, and ranked sidebar — premium white chrome.
 */
export function HomeBrowse({ data, sourceFilter }: HomeBrowseProps) {
  const mode = normalizeSourceFilter(sourceFilter);
  const highlights = filterHighlights(data.catalogHighlights, mode);
  const { asura, flame } = partitionHighlights(highlights);
  const featured = highlights.slice(0, 8);
  const popular = [...highlights].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 10);

  const allHref = "/";
  const asuraHref = `/?source=${ASURA_KEY}`;
  const flameHref = `/?source=${FLAME_KEY}`;

  return (
    <div className="min-h-full bg-[var(--browse-canvas)] text-zinc-900">
      {!data.dbOk ? (
        <div
          role="alert"
          className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950 sm:px-6"
        >
          <strong className="font-semibold">Database unreachable.</strong>{" "}
          Showing the catalog only; sign-in data and source status may be missing. Check{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">DATABASE_URL</code> and your
          network.           If TLS fails on Windows, add{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">DATABASE_PG_SSL=compat</code> to{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">.env</code> and restart the dev server
          (relaxed cert check; dev only).
        </div>
      ) : null}
      <div className="border-b border-zinc-200/80 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600/90">
                Browse
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl sm:leading-tight">
                Asura &amp; Flame — in a calm reader
              </h1>
              <p className="text-sm leading-relaxed text-zinc-600">
                Pick a series to open chapters in our vertical reader. Pages load from the original hosts;
                we keep navigation, progress, and layout minimal.
              </p>
            </div>
            {!data.currentUserEmail ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/register"
                  className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
                >
                  Create account
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  Log in
                </Link>
              </div>
            ) : null}
          </div>

          <div
            id="browse"
            className="mt-8 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-6"
          >
            <span className="mr-1 text-xs font-medium text-zinc-500">Show:</span>
            <FilterPill href={allHref} label="All sources" active={mode === "all"} />
            <FilterPill href={asuraHref} label="Asura Scans" active={mode === ASURA_KEY} />
            <FilterPill href={flameHref} label="Flame Comics" active={mode === FLAME_KEY} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {data.currentUserEmail && data.recentReads.length > 0 ? (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-500">
              Continue reading
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {data.recentReads.map((r) => (
                <Link
                  key={r.id}
                  href={`/manhwa/${encodeURIComponent(r.seriesSlug)}/chapter/${encodeURIComponent(r.chapterSlug)}`}
                  className="w-[104px] shrink-0 sm:w-[120px]"
                >
                  <RemoteCoverImage
                    src={r.coverImageUrl}
                    alt={r.chapterTitle ?? r.chapterSlug}
                    variant="poster"
                    className="shadow-md shadow-zinc-900/5 ring-1 ring-zinc-200/80"
                  />
                  <p className="mt-2 line-clamp-2 text-center text-[11px] font-medium leading-snug text-zinc-700">
                    {r.chapterTitle ?? r.chapterSlug}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {featured.length > 0 ? (
          <section className="mb-12">
            <div className="mb-4 flex items-end justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight text-zinc-900">Spotlight</h2>
              <span className="text-xs text-zinc-500">Featured picks</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [scroll-snap-type:x_mandatory] [&::-webkit-scrollbar]:hidden">
              {featured.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/manhwa/${encodeURIComponent(s.seriesSlug)}`}
                  className={`relative shrink-0 scroll-snap-start overflow-hidden rounded-xl bg-white shadow-md shadow-zinc-900/8 ring-1 ring-zinc-200/90 transition hover:ring-orange-200/80 ${
                    i === 0 ? "w-[min(100%,300px)] sm:w-[320px]" : "w-[168px] sm:w-[188px]"
                  }`}
                >
                  <RemoteCoverImage
                    src={s.coverImageUrl}
                    alt={s.title}
                    variant="poster"
                    className="rounded-none"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/95 via-zinc-900/50 to-transparent px-3 pb-3 pt-12 sm:px-4 sm:pb-4 sm:pt-14">
                    <p className="line-clamp-2 text-sm font-semibold text-white">{s.title}</p>
                    <p className="mt-1 text-[11px] font-medium text-orange-200/95">{s.sourceName}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[1fr_280px] lg:gap-10">
          <div className="flex flex-col gap-8">
            {mode === "all" ? (
              <>
                <SourceSection
                  title="Asura Scans"
                  accentClass="border-l-4 border-l-orange-500 pl-3 sm:pl-4"
                  items={asura}
                  description="Series hosted on Asura — open any row to load the live chapter list in your library."
                />
                <SourceSection
                  title="Flame Comics"
                  accentClass="border-l-4 border-l-amber-500 pl-3 sm:pl-4"
                  items={flame}
                  description="Flame catalog entries use numeric series ids in the URL; covers load from their CDN when available."
                />
              </>
            ) : mode === ASURA_KEY ? (
              <SourceSection
                title="Asura Scans"
                accentClass="border-l-4 border-l-orange-500 pl-3 sm:pl-4"
                items={asura}
                description="Filtered to Asura-only picks from the curated list."
              />
            ) : (
              <SourceSection
                title="Flame Comics"
                accentClass="border-l-4 border-l-amber-500 pl-3 sm:pl-4"
                items={flame}
                description="Filtered to Flame-only picks from the curated list."
              />
            )}

            <section>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold tracking-tight text-zinc-900">All posters</h2>
                <span className="text-xs text-zinc-500">Grid view</span>
              </div>
              {highlights.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center shadow-sm">
                  <p className="font-medium text-zinc-800">Nothing to show</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Adjust the filter or add entries in{" "}
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">lib/featured-series.ts</code>
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {highlights.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/manhwa/${encodeURIComponent(s.seriesSlug)}`}
                        className="group block rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-sm transition hover:border-orange-200/80 hover:shadow-md"
                      >
                        <RemoteCoverImage
                          src={s.coverImageUrl}
                          alt={s.title}
                          variant="poster"
                          className="ring-0 group-hover:opacity-[0.98]"
                        />
                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-zinc-900">
                          {s.title}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-orange-700/90">{s.sourceName}</p>
                        {s.genres.length > 0 ? (
                          <p className="mt-1 line-clamp-1 text-[10px] text-zinc-500">
                            {s.genres.slice(0, 2).join(" · ")}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="lg:pt-0">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm shadow-zinc-900/[0.04]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-orange-600/90">Popular</h2>
                <p className="mt-1 text-xs text-zinc-500">Curated list, A–Z</p>
                <ol className="mt-4 space-y-1">
                  {popular.map((s, rank) => (
                    <li key={s.id}>
                      <Link
                        href={`/manhwa/${encodeURIComponent(s.seriesSlug)}`}
                        className="flex gap-3 rounded-lg p-2 transition hover:bg-zinc-50"
                      >
                        <span className="flex h-12 w-7 shrink-0 items-center justify-center text-xs font-bold text-zinc-400">
                          {rank + 1}
                        </span>
                        <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-zinc-100 ring-1 ring-zinc-200">
                          <RemoteCoverImage
                            src={s.coverImageUrl}
                            alt=""
                            variant="thumb"
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-semibold text-zinc-900">{s.title}</p>
                          <p className="mt-0.5 text-[10px] text-orange-700/85">{s.sourceName}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
                {popular.length === 0 ? (
                  <p className="mt-3 text-xs text-zinc-500">Nothing listed yet.</p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Sources</h2>
                <ul className="mt-3 space-y-2">
                  {data.sources.map((src) => (
                    <li key={src.id}>
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2">
                        <span className="text-xs font-semibold text-zinc-800">{src.name}</span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            src.isEnabled ? "text-emerald-600" : "text-zinc-400"
                          }`}
                        >
                          {src.isEnabled ? "Live" : "Off"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
                  Respect each site’s terms when reading. This app does not re-host their images.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {data.currentUserEmail && data.follows.length > 0 ? (
          <section className="mt-14 border-t border-zinc-200 pt-10">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-500">Your follows</h2>
            <ul className="flex flex-wrap gap-2">
              {data.follows.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/manhwa/${encodeURIComponent(f.seriesSlug)}`}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200/90 bg-white py-2 pl-2 pr-4 shadow-sm transition hover:border-zinc-300 hover:shadow"
                  >
                    <div className="h-11 w-8 overflow-hidden rounded-md bg-zinc-100 ring-1 ring-zinc-200">
                      <RemoteCoverImage
                        src={f.coverImageUrl}
                        alt={f.seriesTitle}
                        variant="thumb"
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{f.seriesTitle}</p>
                      <p className="text-xs text-zinc-500">{f.sourceName}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
