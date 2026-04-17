# Development History

This file tracks implementation steps so future developers can understand what was done, why it was done, and what comes next.

## How to Use This File

- Add a new dated entry for every meaningful milestone.
- Keep entries short and factual.
- Include: objective, changes made, verification, and next step.

## Timeline

### 2026-04-17 - Enforce Asura-only UI filters + purge legacy Flame rows

**Objective**
- Remove remaining user-visible Flame entries caused by old database rows and ensure all UI/API paths only expose supported sources.

**Changes made**
- Added `lib/supported-sources.ts` with `SUPPORTED_SOURCE_KEYS` runtime allowlist.
- Applied source-key filtering (`asura-scans` only) in:
  - `lib/home-data.ts` (home source list query)
  - `app/api/personal/home/route.ts` (continue-reading + follow lookups)
  - `app/api/search/route.ts` (search cache results)
  - `lib/bookmarks-page-data.ts` (bookmarks/follows/cache lookups)
  - `lib/reader-data.ts` (follow + cache context resolution)
- Executed database cleanup to remove legacy Flame rows:
  - deleted `ChapterCache`, `SeriesCache`, `Bookmark`, `ReadingHistory`, `Follow`, and `Source` records linked to `Source.key = 'flame-scans'`.

**Verification**
- `npm run lint`
- `npm run build`
- Deep grep sweep in `app/`, `components/`, and `lib/` confirms no Flame references remain.

**Next**
- Keep `SUPPORTED_SOURCE_KEYS` in sync whenever a new source is added so stale DB rows from disabled sources cannot reappear in UI.

---

### 2026-04-17 - Remove Flame Comics integration (Asura-only)

**Objective**
- Remove all `flame-scans` / Flame Comics runtime code so the app runs with Asura as the only active source.

**Changes made**
- Removed Flame source implementation and helpers:
  - deleted `lib/sources/adapters/flame-source-adapter.ts` (+ tests/fixtures)
  - deleted `lib/flame-series-slug.ts`
  - deleted Flame cleanup script pair (`lib/run-delete-flame-novel-reading-history.ts`, `scripts/delete-flame-novel-reading-history.ts`)
- Updated source wiring and data flow to Asura-only:
  - `lib/sources/registry.ts`, `lib/browse-constants.ts`, `lib/home-data.ts`, `components/home-browse.tsx`, `lib/live-source-browse.ts`
  - removed Flame-specific fallback/enrichment paths from `lib/reader-data.ts`, `lib/catalog-covers.ts`, `lib/series-synopsis.ts`, `app/api/personal/home/route.ts`
  - updated seeds in `prisma/seed.ts` to stop creating `flame-scans` and delete legacy Flame source rows
- Updated tests and scripts:
  - removed Flame adapter test from `package.json`
  - updated `lib/live-source-browse.test.ts`, `lib/continue-reading-display.test.ts`, `lib/follow-source-disambiguation.test.ts`, `lib/reading-progress.test.ts`

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- If a new source is reintroduced, add it via `Source` seed row + adapter + registry entry and update docs/routes in the same milestone.

---

### 2026-04-16 - Flame browse last-known-good DB fallback (SeriesCache)

**Objective**
- Prevent `/browse/flame-scans` from collapsing to curated-only rows when Flame returns sustained 403s by serving a persistent last-known-good catalog from the database.

**Changes made**
- `lib/live-source-browse.ts`:
  - Added `SeriesCache`-backed helpers for Flame browse resilience:
    - `persistFlameBrowseRowsToSeriesCache()`
    - `loadFlameBrowseRowsFromSeriesCache()`
  - Added cached Flame source-id resolver via Prisma (`getCachedFlameSourceId`).
  - Updated `buildLiveBrowseCatalogForSource("flame-scans")` fallback chain:
    - live cache/direct fetch retries
    - **new:** `series-cache-fallback`
    - curated fallback (only if DB fallback is also empty/unavailable)
  - On successful live rows, upserts title/cover into `SeriesCache` to keep fallback fresh.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- Trigger production traffic on `/browse/flame-scans` and confirm logs show `tier=series-cache-fallback` (instead of `curated-fallback`) during upstream 403 windows.

---

### 2026-04-16 - Flame per-host fetch attempt logging (production diagnostics)

**Objective**
- Make Vercel troubleshooting actionable by logging host-level and endpoint-level Flame fetch failures (status/error + attempt count) before fallback tiers are selected.

**Changes made**
- `lib/fetch-utils.ts`:
  - Added optional `onAttempt` callback in `fetchHtmlWithOptions` to emit structured attempt metadata (`url`, `status`, `errorName`, `attempt/maxAttempts`).
- `lib/live-source-browse.ts`:
  - Added `flameAttemptLogger()` and wired it into Flame browse/home JSON fetches:
    - browse HTML fetch
    - browse Next-data JSON fetch
    - home build HTML fetch
    - home JSON fetch
  - Logs now include stage, URL, HTTP status (when present), and retry attempt index.
- `lib/sources/adapters/flame-source-adapter.ts`:
  - Added `flameAdapterAttemptLogger()` and wired it into adapter host failover fetches so `/series/{id}` and chapter fetch failures include per-host diagnostics.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- Pull fresh Vercel logs and identify the exact failing host/endpoint combination; then target a minimal functional fallback path based on observed status patterns.

---

### 2026-04-16 - Flame multi-host adapter fetch hardening (anti-block reliability)

**Objective**
- Reduce production fallback collapse for Flame (`curated-fallback`) by making series/chapter fetches and browse/home JSON calls more resilient to host-specific blocking in serverless runtime.

**Changes made**
- `lib/fetch-utils.ts`:
  - Expanded `fetchHtmlWithOptions` to support `origin` and `extraHeaders`.
  - Added browser-like request headers (`sec-ch-ua*`, `sec-fetch-*`, `pragma`) to better match real navigation requests.
- `lib/live-source-browse.ts`:
  - Added `getFlameFetchOptions()` helper and applied it to Flame browse/home and `_next/data` fetches.
  - Increased Flame retries from 1 to 2 on critical browse/home JSON fetch paths.
- `lib/sources/adapters/flame-source-adapter.ts`:
  - Added host-variant fallback list (`flamecomics.xyz`, `www.flamecomics.xyz`, `flamecomics.com`) for adapter-level series and chapter fetches.
  - Added `fetchFlameHtmlAcrossHosts()` + shared `flameRequestOptions()` and wired them into `listSeriesChapters`, `getChapterDetail`, and `fetchFlameSeriesOverviewHomeExtras`.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- Re-check Vercel logs for `[flame-live]` and `[flame-adapter]` markers; confirm `browse-catalog` no longer lands on `curated-fallback` for warm production requests.

---

### 2026-04-15 - Flame browse fallback hardening (Vercel resilience)

**Objective**
- Stop `/browse/flame-scans` from collapsing to the 5-item curated fallback when Flame browse fetch/parsing intermittently fails in serverless production.

**Changes made**
- `lib/fetch-utils.ts`: added configurable retry support (`retries`) in `fetchHtmlWithOptions` so upstream transient failures/timeouts can recover automatically without returning empty HTML on first failure.
- `lib/live-source-browse.ts`:
  - increased Flame browse and Next-data fetch timeout windows and enabled retries.
  - added `fetchFlameBrowseSeriesFromHomeBuildJson()` fallback: parse `buildId` from Flame home HTML and fetch `/_next/data/<buildId>/browse.json` directly when `/browse` HTML path fails.
  - hardened `fetchFlameBrowseRows()` to chain fallbacks: browse HTML -> browse Next-data JSON -> home build-id browse JSON -> home latest subset (instead of immediate curated-only collapse).
  - enabled one retry on Flame home latest fetch (`getHomeLatestFlameHighlights`) for consistency with production network variance.

**Verification**
- `npm run lint`
- `npm run test`
- `npm run build`

**Next**
- Monitor production logs for Flame upstream anti-bot/timeout patterns; if instability persists, persist last-known-good Flame browse rows in DB for outage-proof full-catalog fallback.

---

### 2026-04-15 - Flame home latest fallback hardening (avoid unavailable chapters)

**Objective**
- Ensure the home "Latest Updates" section for Flame Comics keeps live chapter labels when Flame home JSON fails, instead of dropping straight to curated cards with "Latest chapter unavailable".

**Changes made**
- `lib/live-source-browse.ts`:
  - Hardened `getHomeLatestFlameHighlights()` to avoid immediate curated fallback on home JSON parse/fetch failures.
  - Added browse-based resilience fallback in this order: home `latestEntries` JSON -> browse recency scrape (`fetchFlameBrowseRowsByRecency`) -> chapter enrichment -> curated fallback.
  - Bumped cache key for home Flame latest (`home-latest-flame` to `v10`) so stale fallback-only cache is invalidated after deploy.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- Confirm production home route now consistently shows real Flame chapter labels; if upstream instability remains, add structured logs indicating which fallback tier served each rebuild.

---

### 2026-04-15 - Flame multi-domain fetch fallback (Vercel scrape reliability)

**Objective**
- Prevent Flame scrape failures in environments where one Flame host variant is blocked or unstable (`flamecomics.xyz` vs `www.flamecomics.xyz` vs `flamecomics.com`).

**Changes made**
- `lib/live-source-browse.ts`:
  - Added multi-host fallback lists for Flame browse and home fetches.
  - Updated browse HTML fetch attempts to cycle across all known host variants before failing.
  - Updated Next-data JSON fallback (`/_next/data/<buildId>/browse.json`) to try all host variants with per-host referers.
  - Updated home latest loader to attempt all host variants before moving to browse-recency fallback.
  - Bumped home Flame latest cache key to `v11` so deployments invalidate stale fallback-heavy cache entries.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- Re-check production `/browse/flame-scans` and home Flame latest after deploy; if a host keeps failing, add per-host success/failure log markers for quick ops visibility.

---

### 2026-04-15 - Flame fallback tier logging for Vercel diagnostics

**Objective**
- Make production troubleshooting explicit by logging which Flame fallback tier is used for home latest and browse catalog paths.

**Changes made**
- `lib/live-source-browse.ts`:
  - Added `logFlameTier()` helper that emits consistent one-line markers: `[flame-live] scope=... tier=...`.
  - Added tier logs on all major Flame decision branches:
    - home latest: `home-json`, `browse-recency`, `curated-fallback`
    - browse catalog: `cached-live-rows`, `cache-retry-direct-fetch`, `second-direct-fetch`, `curated-fallback`, plus parser-source tiers (`browse-html-next-data`, `browse-next-data-json`, `home-build-json`, `home-latest-bridge`, `empty`).
  - Bumped home Flame latest cache key from `v11` to `v12` so fresh rebuilds produce the new diagnostic pathing.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- Check Vercel runtime logs for `[flame-live]` lines while loading `/` and `/browse/flame-scans` to confirm active data tier in production.

---

### 2026-04-15 - Flame browse cache reset + remove subset bridge fallback

**Objective**
- Stop `/browse/flame-scans` from reusing a small fallback subset as if it were full live browse data, and force Vercel to rebuild Flame browse cache from fresh source fetches.

**Changes made**
- `lib/live-source-browse.ts`:
  - Removed the `home-latest-bridge` fallback branch from `fetchFlameBrowseRows()` so browse cache rows are only sourced from browse/home-build scrape paths (not from the limited home latest subset).
  - Bumped `live-flame-browse-series` cache key from `v8` to `v9` to invalidate stale Flame browse cache entries.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- Re-check `/browse/flame-scans`; if it still resolves to curated fallback, use `[flame-live]` logs to identify failing scrape tier and add per-tier HTTP status logging.

---

### 2026-04-14 - Robust Flame Comics Chapter Scraping (JSON-based)

**Objective**
- Fix "Latest chapter unavailable" for Flame Comics on the home dashboard and resolve brittle HTML scraping for individual series pages.

**Changes made**
- `lib/live-source-browse.ts`: switched "Latest Updates" discovery to fetch the Flame home page and parse the robust `__NEXT_DATA__` JSON (`latestEntries`) which contains chapters. This avoids brittle HTML scraping of the browse page.
- `lib/sources/adapters/flame-source-adapter.ts`: updated the regex and added HTML tag stripping to `extractChapterSummaries` to correctly parse nested tags (e.g., `<div>`, `<p>`) within chapter labels.
- `lib/live-source-browse.ts`: updated `FlameBrowseSeriesJson` type and map functions to support embedded chapter data.

**Verification**
- Verified with scratch scripts `analyze-flame-home.js` and `verify-flame-fix.js` that both JSON parsing and HTML regex fallbacks work correctly and extract accurate chapter labels (e.g., "Chapter 216.00").

**Next**
- None.

---

### 2026-04-11 - Series detail: status pill on cover (Asura-style)

**Objective**
- Show publication status (ongoing / completed / dropped / ?) at the bottom of the poster on `/manhwa/[id]`, similar to Asura?s per-series badges.

**Changes made**
- `lib/reader-data.ts`: `SeriesDetailData` includes `seriesStatus`; `getSeriesDetailData` calls `resolveSeriesStatusForReader` (same source as chapter reader).
- `components/series-detail-view.tsx`: gradient strip + pill overlay on the cover; always show poster column with status even when cover URL is missing (placeholder).

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- None.

---

### 2026-04-11 - Asura browse: fetch all pages (not only nav window)

**Objective**
- `/browse/asura-scans` stopped after ~5?6 source pages because Asura?s HTML only links to the next few `?page=` URLs; the app used that as the total page count and missed most series.

**Changes made**
- `lib/live-source-browse.ts`: `fetchAllAsuraBrowseRows` now requests page 1, 2, ? until a page yields zero parsed cards (with a high safety cap); raised `ASURA_BROWSE_MAX_PAGES`; `live-asura-browse-series` cache **v4**; JSDoc on `maxAsuraBrowsePageFromHtml`.
- `README.md`: note on Asura pagination walk.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- None unless Asura changes browse URL shape.

---

### 2026-04-11 - Browse format allowlist: add Webtoon

**Objective**
- Include **Webtoon** alongside manhwa, manga, and manhua so Asura/Flame rows tagged as webtoon are not dropped.

**Changes made**
- `lib/scanlation-format-filter.ts`: allowlist includes `webtoon`.
- `lib/live-source-browse.ts`, tests, `README.md`: copy/comments; browse cache keys bumped (Asura v3, Flame v5).

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- None unless new format labels need mapping.

---

### 2026-04-11 - Browse filters: manhwa / manga / manhua only (Flame + Asura)

**Objective**
- Restrict live catalog scraping to comic-strip formats the group cares about: manhwa, manga, manhua ? not Flame web novels, ?Comic?, ?Web Novel?, etc.

**Changes made**
- `lib/scanlation-format-filter.ts`: shared allowlist helper.
- `lib/asura-comic-format.ts`: parse format pill from Asura series HTML.
- `lib/live-source-browse.ts`: Flame browse JSON filters by `type`; novel rows omitted; Asura browse rows filtered after fetching each `/comics/{slug}` (batched concurrency); cache keys bumped (`home-latest-*` / `live-*-browse-series` v2 or v4).
- Tests: `lib/asura-comic-format.test.ts`, `lib/scanlation-format-filter.test.ts`; extended `lib/live-source-browse.test.ts`.
- `README.md`: scope note on browse filtering.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- If Asura labels many Korean series as ?Webtoon? instead of ?Manhwa?, consider adding `webtoon` to the allowlist or mapping rules.

---

### 2026-04-11 - Hide Flame web-novel slugs; manhwa chapter titles from `__NEXT_DATA__`

**Objective**
- Stop linking `/manhwa/novel-8` (web novel ORV) when the comic is `/manhwa/2`; remove `novel-*` from continue reading, home Flame latest, and browse catalog. Show real chapter names on `/manhwa/2` instead of `Chapter {hex}`.

**Changes made**
- `lib/flame-series-slug.ts`: `isFlameWebNovelSeriesSlug`.
- `lib/live-source-browse.ts`: filter `novel-*` from home latest + merged browse; cache bump to **v3**.
- `lib/home-data.ts`: skip Flame web-novel rows in continue-reading history.
- `lib/reader-data.ts`: removed `novel-` resolver fallback (novel URLs are not in catalog).
- `lib/series-synopsis.ts`: removed unused `getCachedFlameOverviewTitle`.
- `lib/sources/adapters/flame-source-adapter.ts`: `parseFlameSeriesChaptersFromNextData` reads `pageProps.chapters` before anchor scrape; regression test added.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- Run `npm run cleanup:flame-novel-reading-history` once per environment if you want those rows removed from the database (see entry below).

---

### 2026-04-11 - Cleanup: delete Flame `novel-*` reading history rows

**Objective**
- Provide an optional, idempotent way to remove legacy `ReadingHistory` rows left over when the UI still linked Flame web novels (`novel-{id}` slugs).

**Changes made**
- `lib/run-delete-flame-novel-reading-history.ts`: `runDeleteFlameNovelReadingHistory` (SQL delete scoped to `flame-scans` + `seriesSlug` ~ `^novel-[0-9]+$`).
- `scripts/delete-flame-novel-reading-history.ts`, `package.json` script `cleanup:flame-novel-reading-history`.

**Verification**
- `npm run lint`, `npm run build`, `npm run cleanup:flame-novel-reading-history` (local DB: second run reported 0 deleted).

**Next**
- None unless Flame slug conventions change again.

---

### 2026-04-11 - Flame `novel-{id}` series 404 + browse cache mismatch

**Objective**
- `/manhwa/novel-8` (and similar) returned 404 because `resolveSeriesContextForUser` only looked up `buildLiveBrowseCatalogForSource`, which used a **stale** `unstable_cache` key (`live-flame-browse-series` v1) from before web-novel slugs existed, while the home ?latest? column used a **separate** cache that already listed `novel-{id}` rows.

**Changes made**
- `lib/live-source-browse.ts`: bumped Flame caches to **v2** (`live-flame-browse-series`, `home-latest-flame`) so merged catalog includes `novel-*` slugs without waiting for the old TTL.
- `lib/series-synopsis.ts`: `getCachedFlameOverviewTitle` for `<title>` on manhwa/novel overview pages.
- `lib/reader-data.ts`: if the live list still misses a slug matching `novel-{digits}`, resolve Flame context via overview title + `resolveSeriesCoverUrl` instead of 404.

**Verification**
- `npm run lint`, `npm run test`, `npm run build`.

**Next**
- None unless Flame changes URL shapes again.

---

### 2026-04-11 - Flame browse: web novels use `novel_id` (fix wrong title / empty chapters from home latest)

**Objective**
- Home ?Latest from Flame Comics? showed the Web Novel ORV tile with a broken slug (`series_id` missing ? `undefined`), duplicate React keys, links to `/series/8` (a different manhwa) instead of `/novel/8`, and empty or wrong detail data.

**Changes made**
- `lib/flame-series-slug.ts`: `parseFlameSeriesSlug`, `flameOverviewPageUrl` for manhwa (`/series/{id}`) vs web novel (`/novel/{id}`).
- `lib/live-source-browse.ts`: `flameJsonSeriesToRow` uses `series_id ?? novel_id`, slug `novel-{id}` for novels, CDN under `uploads/images/novels/{id}/`; skip invalid rows; `flatMap` to drop nulls.
- `lib/sources/adapters/flame-source-adapter.ts`: list/chapter fetches use parsed kind; chapter summaries and reader support novel HTML + `novels/` CDN paths.
- `lib/catalog-covers.ts`, `lib/series-synopsis.ts`: Flame overview URLs via `parseFlameSeriesSlug`; cache key `v2` for Flame covers.
- Tests: `flame-source-adapter.test.ts`, `live-source-browse.test.ts`.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- None unless Flame changes JSON shape again.

---

### 2026-04-11 - Fix wrong series page when same slug exists on Asura + Flame follows

**Objective**
- Opening a Flame numeric series (e.g. from home ?Latest from Flame Comics?) sometimes showed another title, no cover, and zero chapters because `resolveSeriesContextForUser` used `follow.findFirst` on `seriesSlug` only; `Follow` allows the same slug for both sources, and an arbitrary row could win.

**Changes made**
- `lib/follow-source-disambiguation.ts`: `pickRowWhenSeriesSlugSpansScanSources` mirrors live-browse rules (all-digit slug ? Flame, otherwise Asura when both follow rows exist).
- `lib/reader-data.ts`: `findMany` on follows + picker before catalog/live resolution.
- `components/browse-ui-client.tsx`: latest-update list keys use `sourceKey` + `seriesSlug` for stable React identity.
- `lib/follow-source-disambiguation.test.ts`; `package.json` test script entry.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- Optional: disambiguate `readingHistory.findFirst` by `sourceId` where the same chapter slug could theoretically collide across sources.

---

### 2026-04-11 - Continue reading: cover images without Follow rows

**Objective**
- Show poster images on the home ?Continue reading? carousel when reading history exists but `Follow.coverImageUrl` is unset (common for history-only or legacy follows).

**Changes made**
- `lib/catalog-covers.ts`: exported `resolveSeriesCoverUrl` (cached live Asura/Flame `og:image`, then `CATALOG_HIGHLIGHTS` static URLs); private `staticCatalogCoverFallback` with Asura hash normalization.
- `lib/home-data.ts`: `attachFollowCoversToRecentReads` fills missing covers via `resolveSeriesCoverUrl` after the follow map lookup.
- `README.md`: noted continue-reading cover resolution.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- None unless upstream blocks `og:image` fetches in deployment (then tune caching or fallbacks).

---

### 2026-04-10 - Project initialization from scratch

**Objective**
- Start the project baseline and set up the initial repository.

**Changes made**
- Installed and initialized Next.js 16 app scaffold in `my-app`.
- Pushed initial project baseline to GitHub repository.
- Set up local development environment for ongoing milestones.

**Verification**
- Project boots with standard Next.js scripts.
- Repository baseline is available in GitHub.

**Next**
- Define documentation standards and working rules.

---

### 2026-04-10 - Platform accounts and infrastructure setup

**Objective**
- Prepare cloud database and ORM tooling for development.

**Changes made**
- Created and configured Neon database project.
- Connected app environment to Neon via `.env` (git-ignored).
- Initialized Prisma and linked it to Neon through `DATABASE_URL`.

**Verification**
- Prisma can reach Neon database endpoint.
- Migration tooling is operational.

**Next**
- Finalize schema design aligned to scraper-first architecture.

---

### 2026-04-10 - Project baseline and docs cleanup

**Objective**
- Clean project documentation and establish clear agent instructions.

**Changes made**
- Rewrote `README.md` to remove redundancy and define a focused project scope.
- Documented future implementation direction in `README.md`.
- Rewrote `AGENTS.md` with strict pre-coding workflow and quality gates.
- Added auth scope guidance (email/password only; no social/community features).

**Verification**
- Documentation reviewed and aligned with current direction.

**Next**
- Set up baseline structure and database tooling.

---

### 2026-04-10 - Baseline structure and Prisma initialization

**Objective**
- Prepare the repository for implementation after initial Next.js setup.

**Changes made**
- Added base folders: `components/`, `lib/`, `styles/` with `.gitkeep`.
- Installed Prisma dependencies (`prisma`, `@prisma/client`).
- Initialized Prisma (`prisma/`, `prisma.config.ts`, `.env`).
- Added `.env.example` with safe placeholder value.

**Verification**
- `npm run lint` passed.
- `npm run build` passed.
- `npx prisma generate` passed.

**Next**
- Connect Neon correctly and run migration.

---

### 2026-04-10 - Neon + Prisma connectivity

**Objective**
- Connect Prisma to Neon PostgreSQL and confirm migration pipeline.

**Changes made**
- Updated local `.env` to use Neon pooler connection string.
- Resolved credential mismatch and duplicate `DATABASE_URL` entry.
- Confirmed Prisma uses `DATABASE_URL` via `prisma.config.ts`.

**Verification**
- `npx prisma migrate dev` succeeded (connection valid).
- `npx prisma migrate status` reports database schema is up to date.

**Next**
- Implement lean scraper-first schema.

---

### 2026-04-10 - Lean scraper-first schema migration

**Objective**
- Model app-owned user state while keeping content scraping runtime-first.

**Changes made**
- Added Prisma models:
  - `User`
  - `Source`
  - `Follow`
  - `Bookmark`
  - `ReadingHistory`
  - `SeriesCache`
  - `ChapterCache`
- Created and applied migration:
  - `prisma/migrations/20260410154046_init_lean_schema/migration.sql`

**Verification**
- `npx prisma format` passed.
- `npx prisma migrate dev --name init_lean_schema` passed.
- `npx prisma generate` passed.
- `npm run lint` passed.
- `npm run build` passed.

**Next**
- Add seeding (`prisma/seed.ts`) for initial source and development test data.

---

### 2026-04-10 - Seed pipeline and development data

**Objective**
- Create repeatable seed workflow for local and shared development setup.

**Changes made**
- Added Prisma seed script configuration in `package.json`:
  - `npm run seed`
  - Prisma seed command wiring for CLI usage
- Added `prisma/seed.ts` with idempotent seed operations.
- Seeded baseline records for:
  - `Source` entries (`asura-scans`, `reaper-scans`, `flame-scans`)
  - Development `User` (`dev@manhwa.local`)
  - Example `Follow`, `Bookmark`, and `ReadingHistory` rows

**Verification**
- Seed command execution and lint/build checks to confirm no regressions.

**Next**
- Start frontend data wiring (server data fetch + initial list/detail reader screens).

---

### 2026-04-10 - Home page data wiring from Prisma

**Objective**
- Replace the default Next.js landing page with project-specific data-driven UI.

**Changes made**
- Added `lib/prisma.ts` singleton client setup using Prisma Postgres adapter.
- Added `lib/home-data.ts` to fetch source, follow, and reading history data.
- Added `components/source-overview.tsx` for home screen sections.
- Replaced `app/page.tsx` with a server-rendered home page using live Prisma data.

**Verification**
- Run seed, lint, and production build to confirm data flow and app health.

**Next**
- Implement series/chapter list screens and connect source adapters in a controlled way.

---

### 2026-04-10 - Mobile-first detail and reader route scaffolding

**Objective**
- Implement the next core UX screens with clean mobile-first navigation.

**Changes made**
- Added dynamic series detail route: `app/manhwa/[id]/page.tsx`.
- Added dynamic chapter reader route: `app/manhwa/[id]/chapter/[cid]/page.tsx`.
- Added data service `lib/reader-data.ts` for detail and reader queries.
- Updated `components/source-overview.tsx` to link into detail/reader routes.
- Updated app metadata in `app/layout.tsx` with project title/description.

**Verification**
- Route compilation and lint/build checks to verify new pages and links.

**Next**
- Start implementing source adapter contracts for selected scanlation websites.

---

### 2026-04-10 - Source adapter contract and registry foundation

**Objective**
- Add a clean integration layer so real scraping adapters can be plugged in per website later.

**Changes made**
- Added `lib/sources/types.ts` with adapter contract and result models.
- Added `lib/sources/adapters/mock-source-adapter.ts` as safe placeholder behavior.
- Added `lib/sources/registry.ts` to resolve adapters from `Source.key`.
- Wired adapter metadata into `lib/reader-data.ts` and displayed it in `app/manhwa/[id]/page.tsx`.

**Verification**
- Lint/build checks after introducing adapter files and data wiring.

**Next**
- Implement first real source adapter and connect chapter list/detail fetch paths.

---

### 2026-04-10 - First live source integration (Asura Scans)

**Objective**
- Start real scraper integration using `https://asurascans.com/` as the first source.

**Changes made**
- Added `lib/sources/adapters/asura-source-adapter.ts` with:
  - series slug resolution against Asura's hashed comic slugs
  - live chapter list extraction from comic pages
  - chapter detail fetch with premium/login fallback handling
- Switched `asura-scans` in adapter registry to use `AsuraSourceAdapter`.
- Updated `lib/reader-data.ts`:
  - detail page now exposes `liveChapters`
  - reader page now falls back to adapter data when history is missing
- Updated UI pages:
  - `app/manhwa/[id]/page.tsx` now shows live chapter links
  - `app/manhwa/[id]/chapter/[cid]/page.tsx` now shows detected image count

**Verification**
- Lint/build and route checks after adapter wiring.

**Next**
- Harden parser selectors and add persistent cache-sync from adapter responses.

---

### 2026-04-10 - Asura hardening: parser resilience + cache fallback

**Objective**
- Stabilize the first live adapter by improving parser durability and graceful degradation behavior.

**Changes made**
- Hardened `lib/sources/adapters/asura-source-adapter.ts`:
  - added slug-resolution TTL caching to reduce homepage scan frequency
  - added request timeout handling and structured adapter logs
  - expanded chapter/image extraction selectors with fallback patterns
  - added normalized adapter error categories for network/auth/not-found/parse failures
- Improved `lib/reader-data.ts` data flow:
  - introduced chapter cache freshness checks (TTL-based refresh strategy)
  - added adapter-to-cache sync pipeline (`SeriesCache` + `ChapterCache` upserts)
  - added stale cache fallback for detail page chapter list when live adapter fetch returns empty
  - added cache metadata fallback for reader route when chapter detail fetch fails
- Updated detail UI label in `app/manhwa/[id]/page.tsx` to show dynamic source name.
- Updated `README.md` to reflect live Asura adapter and cache fallback strategy.

**Verification**
- Lint/build validation executed after hardening changes.

**Next**
- Add focused parser regression tests/fixtures for chapter list and chapter image extraction edge cases.

---

### 2026-04-10 - Asura parser regression tests and fixtures

**Objective**
- Lock down core Asura parsing behavior with repeatable regression coverage before adding another live source.

**Changes made**
- Added parser fixtures:
  - `lib/sources/adapters/__fixtures__/asura-chapter-list.fixture.html`
  - `lib/sources/adapters/__fixtures__/asura-chapter-images.fixture.html`
- Added adapter regression tests in `lib/sources/adapters/asura-source-adapter.test.ts` covering:
  - chapter list extraction with fallback selectors + deduplication
  - image extraction across mixed URL patterns and escaped script content
  - login/premium guard detection behavior
- Exposed scoped test helpers via `ASURA_TEST_UTILS` in `lib/sources/adapters/asura-source-adapter.ts`.
- Added project test command in `package.json`:
  - `npm run test`

**Verification**
- Executed test/lint/build checks after adding fixtures and adapter tests.

**Next**
- Add cache-sync observability counters and alerting thresholds for sustained parser failure rates.

---

### 2026-04-10 - Source observability counters and parser alert thresholds

**Objective**
- Add lightweight runtime observability for parser reliability and cache-sync behavior before onboarding the second source.

**Changes made**
- Added `lib/sources/adapter-observability.ts` with in-memory counters for:
  - parser success/failure tracking
  - cache-sync success tracking
  - stale-cache fallback tracking
- Added parser-failure threshold alerting:
  - emits an alert log when repeated parser failures hit threshold within a rolling time window
- Wired observability into Asura adapter (`lib/sources/adapters/asura-source-adapter.ts`):
  - parser success recorded after valid chapter/image parsing
  - parser failure recorded for parse-failed and zero-image parsing cases
- Wired cache-sync observability in `lib/reader-data.ts`:
  - logs successful adapter-to-cache sync events
  - logs stale-cache fallback events when live refresh returns no chapters
- Extended adapter test coverage in `lib/sources/adapters/asura-source-adapter.test.ts` for parser failure metric increments.

**Verification**
- Executed `npm run test`, `npm run lint`, and `npm run build` after observability wiring.

**Next**
- Introduce the second live source adapter behind the same observability hooks and hardening checks.

---

### 2026-04-10 - Postgres SSL connection string normalization

**Objective**
- Remove noisy `pg` SSL mode deprecation warnings in dev and production when using Neon-style URLs.

**Changes made**
- Added `lib/db-connection-string.ts` to normalize `DATABASE_URL` to `sslmode=verify-full` when absent or set to legacy aliases (`require`, `prefer`, `verify-ca`).
- Applied normalization in `lib/prisma.ts` and `prisma/seed.ts` before creating the Prisma Postgres adapter.
- Updated `.env.example` and added `lib/db-connection-string.test.ts`; extended `npm run test` script.

**Verification**
- `npm run test` and `npm run lint` passed.

**Next**
- Optional: document that local `.env` may omit `sslmode` and rely on normalization.

---

### 2026-04-10 - Server / Prisma SSL warnings (full stack fix)

**Objective**
- Stop `pg` SSL deprecation warnings for Prisma CLI, Next.js dev server, and runtime by normalizing `DATABASE_URL` everywhere it is consumed.

**Changes made**
- `prisma.config.ts`: datasource URL passed through `normalizePostgresDatabaseUrl()` so `migrate`, `studio`, etc. use `sslmode=verify-full`.
- `instrumentation.ts`: on Node runtime startup, patch `process.env.DATABASE_URL` before app modules load so dev/prod logs stay clean.
- Existing `lib/prisma.ts` + `prisma/seed.ts` normalization unchanged.

**Verification**
- `npm run build`, `npx prisma migrate status`, `npm run lint` passed; CLI no longer prints the SSL warning in local runs.

**Next**
- Implement Flame Comics live adapter (`flame-scans`) per roadmap.

---

### 2026-04-10 - Flame Comics next source + extensibility documentation

**Objective**
- Queue [Flame Comics](https://flamecomics.xyz/) as the next live scraper target and document how to plug in future scanlation groups without refactors.

**Changes made**
- Added `lib/sources/README.md` with adapter checklist, observability/testing notes, and a roadmap table (Asura live, Flame next, Reaper mock).
- Updated `README.md` with a short source integration roadmap and pointer to the adapter guide.
- Updated `prisma/seed.ts` Flame `Source` to use `https://flamecomics.xyz/` and display name aligned with the site.
- Added registry comment in `lib/sources/registry.ts` linking to the adapter guide.

**Verification**
- Documentation-only change; `npm run lint` recommended before merge.

**Next**
- Implement `FlameSourceAdapter` for `flame-scans`, then proceed with UI/UX finalization while keeping the registry pattern for additional sources.

---

### 2026-04-10 - Remove Reaper Scans; scope to Asura + Flame only

**Objective**
- Drop Reaper from UI, seed data, and adapter registry so the app only targets Asura (live) and Flame (next).

**Changes made**
- `prisma/seed.ts`: removed `reaper-scans` from `SOURCE_SEEDS`; added `deleteMany` for legacy `reaper-scans` rows on seed runs.
- `lib/sources/registry.ts`: removed Reaper mock adapter registration.
- `lib/sources/README.md` and `README.md`: documented two-source scope.

**Verification**
- `npm run lint` and `npm run seed` (or migrate) after changes.

**Next**
- Implement Flame live adapter per roadmap.

---

### 2026-04-10 - Flame Comics live source adapter (`flame-scans`)

**Objective**
- Implement the second live scraper for [Flame Comics](https://flamecomics.xyz/) with chapter list + reader image extraction aligned with existing cache and observability patterns.

**Changes made**
- Added `lib/sources/adapters/flame-source-adapter.ts`:
  - series slug = numeric Flame series id (`/series/{id}`); chapter slug = 16-char hex token
  - chapter list from series HTML (chapter URLs + anchor titles)
  - chapter images from `__NEXT_DATA__.props.pageProps.chapter.images` with CDN fallback from `<img src>`
- Registered `FlameSourceAdapter` in `lib/sources/registry.ts` (removed unused `MockSourceAdapter` import).
- Extended `prisma/seed.ts` with a dev `Follow` for Flame series id `2` (Omniscient Reader's Viewpoint).
- Added fixtures/tests: `__fixtures__/flame-series-page.fixture.html`, `flame-source-adapter.test.ts`; extended `npm run test`.
- Updated `README.md` and `lib/sources/README.md` (Flame live + slug convention).

**Verification**
- `npm run test`, `npm run lint`, `npm run build`, `npm run seed`.

**Next**
- UI/UX polish for reader (render real pages) and optional auth/bookmarks.

---

### 2026-04-10 - Chapter reader: live page rendering + history-path images

**Objective**
- Deliver the post-Flame roadmap priority: reader UI that shows real chapter images, and fix gaps when opening chapters from reading history.

**Changes made**
- Added `components/chapter-reader-view.tsx` (client): vertical full-width images, lazy loading, scroll-to-resume from `pageNumber`, viewport-based page counter, external link when zero images.
- Updated `app/manhwa/[id]/chapter/[cid]/page.tsx` to render `ChapterReaderView` instead of placeholder copy.
- Fixed `getChapterReaderData` in `lib/reader-data.ts` for the reading-history branch: load `source.key`, call adapter `getChapterDetail` + `listSeriesChapters` so `imageUrls` and prev/next order match the live chapter list (no longer always empty).

**Verification**
- `npm run lint`, `npm run test`, `npm run build`.

**Next**
- Optional: persist scroll position / reading progress from the reader; optional auth and bookmarks UX.

---

### 2026-04-10 - Reading progress persistence (scroll ? ReadingHistory)

**Objective**
- Save the visible page while reading, resume on return, and align list/detail queries with the same ?progress user? until real authentication exists.

**Changes made**
- Added `lib/reading-progress.ts` (payload validation, `upsertReadingProgress`, `getReadingProgressUserEmail` defaulting to `dev@manhwa.local`) and `POST` handler `app/api/reading-progress/route.ts`.
- Extended `ChapterReaderView` with optional `progressSync`: debounced `fetch` plus `sendBeacon` on `pagehide` / tab hide.
- Extended `ChapterReaderData` with `sourceKey`; reader page passes `progressSync` into the client component.
- Scoped `getChapterReaderData`, `getSeriesDetailData`, and `getHomePageData` to `READING_PROGRESS_USER_EMAIL` when that user exists (follows, bookmarks, history lists, resume row).
- Documented `READING_PROGRESS_USER_EMAIL` in `.env.example`; added `lib/reading-progress.test.ts` and wired it into `npm run test`.

**Verification**
- `npm run lint`, `npm run test`, `npm run build`.

**Next**
- Email/password auth and per-session user (replace env-based progress user); bookmark UX tied to signed-in user.

---

### 2026-04-10 - Email/password auth and session-scoped library

**Objective**
- Replace env-based ?progress user? with real accounts: login, registration, HttpOnly session, and user-scoped follows/history/reader access.

**Changes made**
- Added `lib/auth/` (`password` bcrypt + legacy SHA-256 verify, `session-token` JWT via `jose`, `session-cookie`, `current-user`, `safe-redirect`).
- API routes: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`; `POST /api/reading-progress` now requires a valid session.
- Pages: `app/login`, `app/register`; `SiteHeader` + forms; root layout loads session for the header.
- `getHomePageData` exposes `currentUserEmail`; `getSeriesDetailData` / `getChapterReaderData` require session; manhwa routes redirect to `login?next=` when anonymous.
- `prisma/seed.ts` hashes the dev password with bcrypt on create/update; `upsertReadingProgress` takes `userId` (removed `READING_PROGRESS_USER_EMAIL`).
- Dependencies: `jose`, `bcryptjs`; `.env.example` documents `AUTH_SECRET`.

**Verification**
- `npm run lint`, `npm run test`, `npm run build`.

**Next**
- Password reset flow; optional rate limiting on auth routes; UI for managing follows without raw DB edits.

---

### 2026-04-10 - Password reset (forgot + token + new password)

**Objective**
- Add email-based recovery without leaking whether an address is registered, with a path to real email delivery.

**Changes made**
- Prisma `PasswordResetToken` model (hashed token, expiry, relation to `User`) and migration `20260410201908_password_reset_tokens`.
- `lib/auth/reset-token.ts` (generate/hash/validate), `app-base-url.ts`, `deliver-password-reset.ts` (Resend or console log), `password-reset.ts` (`requestPasswordReset`, `completePasswordReset`).
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`; pages `/forgot-password`, `/reset-password`; login link to forgot flow.
- Tests: `lib/auth/reset-token.test.ts` in `npm run test`; `lib/auth/password-reset.integration.test.ts` behind `npm run test:integration`.
- `.env.example`: `APP_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

**Verification**
- `npx prisma migrate dev`, `npm run lint`, `npm run test` (16), `npm run test:integration` (1), `npm run build`.

**Next**
- Rate limiting on auth endpoints; follow/bookmark management UI.

---

### 2026-04-11 - Scan-style UI rebuild (premium white + dual-source browse)

**Objective**
- Rebuild the public browse experience to feel closer to scan-site layouts (Asura-style structure) while keeping a premium white theme and clear separation of Asura vs Flame content.

**Changes made**
- Expanded `lib/featured-series.ts` with verified Asura comic slugs and Flame numeric series ids (covers from Flame CDN where applicable).
- Replaced `components/home-browse.tsx` with spotlight carousel, per-source ?latest? sections, poster grid, sidebar (popular + source status), and URL filter pills via `/?source=?`.
- Updated `app/page.tsx` to pass `searchParams.source` into the browse UI.
- Refreshed global shell: `app/globals.css` (`--browse-canvas`, selection tint), `components/site-header.tsx` (accent bar, Browse link), `components/layout/page-surface.tsx`, `lib/ui-styles.ts`, and `components/brand/cloud-mark.tsx` for orange/amber accent cohesion.
- Light-themed chapter reader shell (`app/manhwa/[id]/chapter/[cid]/page.tsx`, `components/chapter-reader-view.tsx`) and denser chapter list styling on `app/manhwa/[id]/page.tsx`.

**Verification**
- `npm run lint`, `npm run test`, `npm run build`.

**Next**
- Optional follow-management UI; rate limiting on auth routes.

---

### 2026-04-11 - Prisma TLS / home DB resilience

**Objective**
- Address runtime failures when Postgres TLS handshake drops before connect, and avoid a hard crash on the home page when the database is unreachable.

**Changes made**
- `lib/db-connection-string.ts`: optional `DATABASE_PG_SSL=compat` normalizes to `sslmode=require` (including downgrading `verify-full` / `verify-ca` URLs) for flaky TLS handshakes.
- `lib/home-data.ts`: `getHomePageData` wraps Prisma in try/catch, adds `dbOk` and `OFFLINE_SOURCES` fallback; session email still shown when JWT exists.
- `components/home-browse.tsx`: alert banner when `dbOk` is false with env hints.
- `lib/db-connection-string.test.ts`, `.env.example`, `README.md` (TLS troubleshooting).

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- User confirms Neon URL and network; use `DATABASE_PG_SSL=compat` only if needed.

---

### 2026-04-11 - Compat mode: pg Pool + relaxed TLS for Prisma

**Objective**
- Fix persistent `Client network socket disconnected before secure TLS connection was established` when URL-only `sslmode=require` is not enough for Node `pg` on some hosts.

**Changes made**
- Added `lib/prisma-adapter.ts`: when `DATABASE_PG_SSL=compat`, `PrismaPg` is backed by `pg.Pool` with `ssl: { rejectUnauthorized: false }`.
- Wired `lib/prisma.ts` and `prisma/seed.ts` through the factory; home DB catch now logs a one-line `console.warn` instead of dumping the full Prisma error.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- Prefer Neon?s documented pooler URL + default SSL when compat is not needed.

---

### 2026-04-11 - Home catalog cover images (Asura CDN + enrichment)

**Objective**
- Show poster images for mixed Asura / Flame titles on the browse UI instead of empty placeholders.

**Changes made**
- `lib/featured-series.ts`: set Asura `coverImageUrl` to current `cdn.asurascans.com` cover assets where slugs resolve on the live site; left TBATE without a static URL when the main site no longer serves that slug at `/comics/the-beginning-after-the-end`.
- `lib/sources/adapters/asura-source-adapter.ts`: exported `fetchAsuraSeriesCoverUrl` (resolve slug + `og:image`).
- `lib/catalog-covers.ts`: `enrichCatalogHighlightCovers` fills missing Asura covers via `unstable_cache` (24h revalidate).
- `lib/home-data.ts`: runs enrichment before Prisma so covers appear even in DB-offline fallback.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- If TBATE returns to Asura with a new slug, add its CDN cover URL to `featured-series.ts` or rely on enrichment once resolution finds it.

---

### 2026-04-11 - Fix 404 on catalog titles without a Follow row

**Objective**
- Open any home-browse title without requiring a `Follow` database row (previously only followed series resolved).

**Changes made**
- `lib/reader-data.ts`: added `resolveSeriesContextForUser` (follow first, else `CATALOG_HIGHLIGHTS` + enabled `Source`); `getSeriesDetailData` and `getChapterReaderData` use it.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- Optional ?Add to library? UI to create follows from the detail page.

---

### 2026-04-11 - Chapter list order, cache depth, reader navigation, start from page 1

**Objective**
- Fix confusing chapter order (newest-first hid ?chapter 1?), shallow lists (20/40 cap), inverted prev/next for reading forward, possible wrong image order, and resume-always-on-last-page UX.

**Changes made**
- Asura/Flame adapters: sort chapter lists ascending (earliest chapter first); Asura page images sorted by trailing numeric filename when present.
- `lib/reader-data.ts`: `MAX_CACHED_CHAPTERS_PER_SERIES` (500), sort cached+live rows for the detail UI, derive ?latest? as newest in that order, `adjacentChapterSlugs` for prev/next, `ChapterReaderOptions.fromStart` to skip saved `ReadingHistory` page.
- Chapter page: `?start=1` / `?start=true` and ?Start from page 1? link when resuming past page 1.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- Optional pagination for 500+ chapter series.

---

### 2026-04-11 - Resilient catalog cover images

**Objective**
- Reduce broken cover tiles when CDN filenames change or hotlinking fails.

**Changes made**
- `lib/catalog-covers.ts`: always prefer live `og:image` for Asura and Flame catalog rows (new cache keys); Flame uses a small series-page fetch + shared OG parser.
- `components/remote-cover-image.tsx`: client cover/thumb with `onError` ? placeholder; wired through `components/home-browse.tsx`.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- None required unless a source drops `og:image` entirely.

---

### 2026-04-11 - TBATE catalog cover (off-Asura fallback)

**Objective**
- Restore a visible poster for ?The Beginning After the End? on the home browse UI.

**Changes made**
- `lib/featured-series.ts`: set `coverImageUrl` to LINE Webtoon?s CDN `og:image` for TBATE; Asura no longer lists the series, so live Asura `og:image` enrichment stays null.

**Verification**
- `npm run lint`, `npm run build`; cover URL returns HTTP 200.

**Next**
- If Asura re-adds the series, slug + live enrichment may override this fallback automatically.

---

### 2026-04-11 - Home UI: Asura-style layout on premium white chrome

**Objective**
- Match scan-portal information architecture (hero carousel, trending strip, two-column latest + sidebar) while keeping a light, premium theme and distinct branding.

**Changes made**
- `components/home-browse.tsx`: hero with blurred backdrop, spotlight carousel, trending row, paged ?latest updates? grid, sidebar (popular tabs, staff pick, sources), announcements strip, library anchor.
- `components/site-header.tsx`: Home / Library / Browse / Resources, header search (scrolls to catalog), violet accent bar and register CTA.
- `components/browse-ui-client.tsx`: client pieces for search, dismissible promo ribbon, latest pagination, popular period tabs.
- `components/site-footer.tsx`, `app/layout.tsx`, `app/page.tsx`: footer shell and a single home `<main>` landmark.
- `lib/browse-rating.ts`: shared pseudo star score for layout-only cards.
- `app/globals.css`: slightly brighter white canvas token.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- Optional real search/index; wire popular tabs to analytics when available.

---

### 2026-04-11 - Home browse: trim hero, trending, sidebar extras

**Objective**
- Simplify the home page by dropping spotlight, trending, staff pick, sources panel, and announcements.

**Changes made**
- `components/home-browse.tsx`: removed those sections; kept continue reading, source filters, latest updates + pagination, all-series grid, popular sidebar, and library block.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- None required unless new browse modules are requested.

---

### 2026-04-11 - Nav + per-source browse routes + bookmarks page

**Objective**
- Simplify header to Home, Browse (submenu), and Bookmarks; remove Library/Resources. Add paginated catalog pages per scanlation source.

**Changes made**
- `components/site-header.tsx`: Browse `<details>` links to `/browse/asura-scans` and `/browse/flame-scans`; Bookmarks ? `/bookmarks`.
- `app/browse/[sourceKey]/page.tsx`, `components/source-browse-view.tsx`, `components/browse-pagination.tsx`, `lib/source-browse-data.ts`: enriched catalog slice, 12 per page, `?page=` navigation.
- `app/bookmarks/page.tsx`, `lib/bookmarks-page-data.ts`: list user bookmarks (login required).
- `components/home-browse.tsx`, `app/page.tsx`: dropped `?source=` filter; home links into browse routes; removed library section.
- `lib/home-data.ts`: removed follows payload from home data (continue-reading cover resolution unchanged).
- `components/site-footer.tsx`, `components/source-overview.tsx`: align copy/links with new routes.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- Optional bookmark creation UI in chapter reader if not yet exposed.

---

### 2026-04-11 - Browse: live Asura/Flame series index + test wiring

**Objective**
- Show the full discoverable series set on `/browse/asura-scans` and `/browse/flame-scans` (not only the small curated highlight list), while keeping curated-only supplements when the scrape omits a title.

**Changes made**
- `lib/live-source-browse.ts`: fetch and parse Asura `/browse` (paginated) and Flame `/browse` (`__NEXT_DATA__`), merge with `CATALOG_HIGHLIGHTS` (Asura slug hash normalization for dedupe), `unstable_cache` tags ~1h.
- `lib/browse-constants.ts`, `lib/source-browse-data.ts`: `getBrowseCatalogForSource` delegates to live builder; re-export browse source keys/labels.
- `lib/live-source-browse.test.ts`: `node:test` coverage for Asura helpers; `package.json` `test` script includes this file.
- `lib/source-browse-data.ts`: drop unused re-imports (lint clean).

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- Tune page caps or parallelism if upstream rate-limits; expand tests with recorded HTML fixtures if network flakiness appears in CI.

---

### 2026-04-11 - Browse pagination: 20 titles, five-row grid

**Objective**
- Show 20 series per `/browse/asura-scans` and `/browse/flame-scans` page and align the grid so those titles form five rows (four columns from the `sm` breakpoint up).

**Changes made**
- `lib/browse-constants.ts`: added `BROWSE_PAGE_SIZE` (20) with documentation.
- `app/browse/[sourceKey]/page.tsx`: slice catalog with `BROWSE_PAGE_SIZE` instead of a hard-coded 12.
- `components/source-browse-view.tsx`: `sm:grid-cols-4` (was up to five columns on large screens) so 20 items fill five rows; narrow viewports stay two columns.
- `README.md`: noted 20 series per browse page in Current Scope.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- None unless browse density or mobile column count should be adjusted further.

---

### 2026-04-11 - Home: dual live latest panels, drop popular + all-series grid, header polish

**Objective**
- Simplify the home page (no popular sidebar, no duplicate ?all series? grid), show real latest-style lists per source (Asura + Flame), and make header nav interactions feel smoother.

**Changes made**
- `lib/live-source-browse.ts`: `parseFlameBrowseSeriesByRecency`, shared `flameJsonSeriesToRow`, cached `getHomeLatestAsuraHighlights` / `getHomeLatestFlameHighlights` (30m revalidate) with curated fallbacks.
- `lib/home-data.ts`: `latestAsura` / `latestFlame` replace `catalogHighlights`; parallel `enrichCatalogHighlightCovers` on both lists.
- `components/home-browse.tsx`: two `SourceLatestUpdatesSection` blocks, tighter layout, lifted browse pills.
- `components/browse-ui-client.tsx`: `SourceLatestUpdatesSection`, refreshed `LatestUpdateBlock` / `PagedLatestUpdates`; removed `PopularRankingTabs`.
- `components/site-header.tsx`: backdrop blur, duration-based hovers, focus rings, animated Browse dropdown (`group-open/?`).
- Tests: `parseFlameBrowseSeriesByRecency` ordering; `README.md` / copy tweaks in `featured-series.ts`, `app/page.tsx`.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- Optional: scrape Asura homepage widget if browse page order diverges from ?latest? expectations.

---

### 2026-04-11 - Series detail page: synopsis, actions, chapter search

**Objective**
- Match scan-style series layout: title + description, Bookmark / First / Latest actions, and a searchable chapter list with sort and optional dates.

**Changes made**
- `lib/series-synopsis.ts` + `getCachedSeriesSynopsis`: meta / Flame `__NEXT_DATA__` synopsis fetch; `resolveAsuraSeriesSlug` exported from Asura adapter for URL resolution.
- `lib/reader-data.ts`: `SeriesDetailData` gains synopsis, cover, first/latest slugs, `bookmarkIdForFirstChapter`, chapter `publishedAt`; `resolveSeriesContextForUser` exported; follow/catalog `coverImageUrl` on context.
- `lib/bookmark-api.ts`, `app/api/bookmarks/route.ts`: POST upsert (returns `bookmarkId`), DELETE by id.
- `components/series-detail-view.tsx` (client): hero, expandable synopsis, buttons, chapter toolbar + search + scroll list; compact bookmarks/recent blocks below.
- `app/manhwa/[id]/page.tsx`: renders `SeriesDetailView`.
- Tests: `lib/series-synopsis.test.ts`; `package.json` test script extended; `README.md` API note.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- Optional: populate `ChapterCache.publishedAt` from adapters when sources expose dates.

---

### 2026-04-11 - Fix 404 opening series from home latest lists

**Objective**
- Detail and reader routes must resolve slugs from the live Asura/Flame browse merge, not only `CATALOG_HIGHLIGHTS`, so home ?latest? tiles match `/manhwa/[id]`.

**Changes made**
- `lib/reader-data.ts`: after follow + curated lookup, `resolveSeriesContextForUser` checks `buildLiveBrowseCatalogForSource` for both sources; disambiguates rare slug collisions (numeric ? Flame).

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- None unless URL strategy changes (e.g. explicit `sourceKey` in path).

---

### 2026-04-11 - Reader UX: clarify ?page? counter, strip layout, chrome

**Objective**
- Explain that ?Page 3 / 3? meant the 3rd image in a vertical chapter strip (not paginated chapters), and improve reader immersion and navigation.

**Changes made**
- `components/chapter-reader-view.tsx`: violet top scroll-progress bar; images in one column with light dividers; copy ?Image X of Y? + strip/resume hint; floating counter above bottom nav; eager-load first five images; `onLoad` triggers progress recalc after lazy decode.
- `app/manhwa/[id]/chapter/[cid]/page.tsx`: sticky compact header (below progress bar), resume/start hints, fixed bottom prev/next with safe-area padding, extra bottom padding for content.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- Optional tap-to-hide chrome for a fuller fullscreen read.

---

### 2026-04-11 - Reader: dark theme, scroll-to-top, series status

**Objective**
- Dark reader shell, lower-left smooth scroll-to-top control, and ongoing/finished (etc.) status on the chapter header.

**Changes made**
- `lib/series-synopsis.ts`: `getCachedSeriesPageMeta` (synopsis + status, single cache); Flame JSON reads `status` / `series_status` / `publication_status`; Asura `extractAsuraSeriesStatusFromHtml`; `getCachedSeriesSynopsis` delegates to page meta.
- `lib/reader-data.ts`: `SeriesReaderStatus`, `formatSeriesStatusForReader`, `resolveSeriesStatusForReader`; `ChapterReaderData.seriesStatus`; detail page cache select + fill uses page meta for status; reader loads status from cache or meta.
- `components/chapter-reader-view.tsx`: dark strip/chrome, scroll-to-top button (after ~6% scroll), violet progress on zinc track.
- `app/manhwa/[id]/chapter/[cid]/page.tsx`: `bg-zinc-950` layout, status pill, dark nav.
- `lib/series-synopsis.test.ts`: Asura status extraction test.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- Optional: show the same status pill on the series detail page.

---

### 2026-04-11 - Header Browse hover, submenu fade, HTML title entities

**Objective**
- Make the Browse submenu follow hover (and hide when the pointer leaves), use smooth fade motion instead of a stuck-open `details` panel, and show apostrophes correctly in scraped titles (e.g. `&#x27;`).

**Changes made**
- Added `components/browse-nav-dropdown.tsx` (client): hover-open on `(hover: hover)` devices, tap-to-toggle on touch-first viewports, short close delay for the trigger?panel gap, opacity + translate transition; wired from `components/site-header.tsx`.
- Added `lib/html-entities.ts` with `decodeBasicHtmlEntities` (named + decimal/hex numeric references); used in live browse, synopsis meta parsing, and Asura/Flame chapter title paths; `lib/html-entities.test.ts` + `package.json` test script entry.
- Header nav links use the same transition timing properties for consistent fade-friendly motion.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- None unless submenu should also close on outside tap for touch-only users.

---

### 2026-04-11 - Follow `seriesTitle`: decode on read/write + optional backfill

**Objective**
- Keep follow-based series labels stable and readable: decode HTML entities on read, normalize on write, and offer a one-time DB backfill for legacy rows.

**Changes made**
- Added `lib/follow-series-title.ts` with `normalizeFollowSeriesTitleForStorage` and `displayFollowSeriesTitle`.
- `lib/reader-data.ts` `resolveSeriesContextForUser`: follow branch uses `displayFollowSeriesTitle`; catalog/live branches decode titles defensively.
- `prisma/seed.ts`: follow upserts pass titles through `normalizeFollowSeriesTitleForStorage`.
- `scripts/backfill-follow-series-titles.ts` + `npm run backfill:follow-titles`; `lib/follow-series-title.test.ts`; `README.md` command note.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- When a follow-creation API/UI is added, call `normalizeFollowSeriesTitleForStorage` before `create`/`upsert`.

---

### 2026-04-11 - Automatic follow title backfill on production startup

**Objective**
- Avoid manual `npm run backfill:follow-titles` on each host: run the same normalization when the production Node server starts, safely under concurrency.

**Changes made**
- Added `lib/run-follow-series-title-backfill.ts` (`runFollowSeriesTitleBackfill`) using `prisma.$transaction` + `pg_try_advisory_xact_lock(872341001)` so pooled connections and multiple instances are safe; only scans follow rows whose title likely contains HTML entities (`&#`, `&amp;`, etc.) so cold starts stay cheap once data is clean.
- `instrumentation.ts`: after URL normalization, in production only (unless `SKIP_FOLLOW_TITLE_BACKFILL=1`), dynamic-imports and runs the backfill; errors are logged non-fatally.
- `scripts/backfill-follow-series-titles.ts` delegates to the shared runner; `.env.example`, `README.md` document auto behavior and opt-out.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- If cold-start latency becomes an issue at very large `Follow` counts, consider batching updates or a dedicated release job.

---

### 2026-04-11 - Vercel deploy readiness + single home ?continue reading? row

**Objective**
- Document and script Prisma client generation for GitHub ? Vercel deploys; simplify signed-in home resume UI to one most-recent chapter with clearer series context.

**Changes made**
- `package.json`: `postinstall` runs `prisma generate` so Vercel installs produce the client before `next build`.
- `README.md`: ?Deploying on Vercel (GitHub)? checklist (env vars, migrations, runtime notes).
- `lib/home-data.ts`: `readingHistory` query `take: 1`; `ContinueReadingCard` adds optional `seriesTitle` from follow rows (`displayFollowSeriesTitle`).
- `components/home-browse.tsx`: one resume card (cover + series + chapter + source); `components/source-overview.tsx` shows `seriesTitle` when present for type alignment.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- Run `npx prisma migrate deploy` against production DB after first Vercel env setup.

---

### 2026-04-11 - Continue reading: dedupe by series, clean titles, shorter chapter line

**Objective**
- Home ?Continue reading? should list each series once with only the latest opened chapter, avoid repeating the series name in the chapter line, and strip Asura hash tokens from displayed titles (slug or stored follow title).

**Changes made**
- `lib/continue-reading-display.ts`: normalized dedupe key (`stripAsuraHashSuffix` for Asura), follow map lookup for hashed vs unhashed slugs, `displaySeriesTitleForContinueCard`, `shortChapterLineForContinueCard` (drops leading series title from chapter labels).
- `lib/home-data.ts`: fetch recent history window, dedupe by `sourceId` + normalized slug, cap 48 series; `ContinueReadingCard.sourceKey`; follow cover/title resolution via `followRowLookupKeys`.
- `components/home-browse.tsx`: stacked resume cards using the new helpers; `components/source-overview.tsx` aligned for `sourceKey`.
- `lib/continue-reading-display.test.ts` + `package.json` test script.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- If readers exceed the fetch window for unique series, raise `CONTINUE_READING_HISTORY_FETCH` or add a SQL `DISTINCT ON` query.

---

### 2026-04-11 - Continue reading horizontal carousel

**Objective**
- Match scan-style home resume: one horizontal row of vertical tiles (cover, truncated title, last chapter) with prev/next controls when the list overflows.

**Changes made**
- `components/continue-reading-carousel.tsx` (client): scroll-snap row, `ResizeObserver` + scroll listeners for arrow visibility, smooth `scrollBy` paging.
- `components/home-browse.tsx`: uses the carousel instead of stacked wide cards.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- None unless carousel should loop or show source label on tiles again.

---

### 2026-04-11 - Continue reading carousel: correct series vs chapter labels

**Objective**
- Fix tiles where the series name appeared on the chapter row (Flame numeric slugs), ?Solo Leveling? split across rows, and `<title>` tails like `- Read Online` broke parsing.

**Changes made**
- `lib/continue-reading-display.ts`: `cleanChapterPageTitleForSplit` strips `- Read Online` / `- Premium` without requiring `|`; `splitSeriesAndChapterFromPageTitle`, `resolveContinueReadingCarouselLabels`, and `isWholeWordPrefix` to prefer parsed series when slug/follow says `Series {id}` or a short prefix of the real title.
- `components/continue-reading-carousel.tsx`: uses `resolveContinueReadingCarouselLabels`; slightly wider tiles and `line-clamp-2` for titles.
- `lib/continue-reading-display.test.ts`: regression cases for Flame slug + short follow title.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- None unless sources emit non-`Chapter n` patterns (e.g. ?Episode?).
### 2026-04-12 - Fix Asura status parsing and layout  
  
**Objective**  
- Fix bug where all Asura series show as \" "Finished\ and move status pill below poster.  
  
**Changes made**  
### 2026-04-12 - Fix Asura status parsing and layout

**Objective**
- Fix bug where all Asura series show as "Finished" and move status pill below poster.

**Changes made**
- lib/series-synopsis.ts: Strip <script> tags before extractAsuraSeriesStatusFromHtml so 
eadyState==="complete" doesn't match.
- components/series-detail-view.tsx: Move status pill layout below RemoteCoverImage.

**Verification**
- 
pm run build, 
pm run lint.

**Next**
- None.

---

### 2026-04-12 - Fix Flame Comics chapter sorting and missing chapter numbers

**Objective**
- Fix chapter lists from Flame Comics omitting chapter numbers (e.g. "Dokja's Fable (Part 1)") which broke default list sorting and resulted in jumbled ordering.

**Changes made**
- lib/sources/adapters/flame-source-adapter.ts: Updated parseFlameSeriesChaptersFromNextData to append c.title to c.chapter resulting in correctly structured standard titles like Chapter 303 - Dokja's Fable (Part 5). 
- Nixed local chapter caches.

**Verification**
- Flame database adapter sorts properly by the "Chapter X" prefix. 
pm run build, 
pm run lint.

**Next**
- None.

---

### 2026-04-12 - Reader footer integration

**Objective**
- Embed the image progress indicator into the bottom navigation bar and remove the detached floating pill and explanatory text.

**Changes made**
- components/chapter-reader-view.tsx: Extracted 
av markup from page shell and inserted it directly into the component. Display {visiblePage} / {total} between the previous and next hooks.
- pp/manhwa/[id]/chapter/[cid]/page.tsx: Deleted external 
av shell and bridged 
extChapterHref and previousChapterHref downward.

**Verification**
- 
pm run build, 
pm run lint.

**Next**
- None.

---

### 2026-04-12 - Remove chapter reader explanatory text

**Objective**
- Remove the text stating 'Resumed near image X ? all images load below in one scroll.' from the top of the chapter screen.

**Changes made**
- pp/manhwa/[id]/chapter/[cid]/page.tsx: Deleted the conditional <p> block from the reader header.

**Verification**
- 
pm run build, 
pm run lint.

**Next**
- None.

---

### 2026-04-12 - Force flush Asura Scans cached series statuses

**Objective**
- Ensure Asura's newly fixed parser logic propagates to the UI instead of returning old cached "Finished" results.
- Hardened Asura's regex status parser.

**Changes made**
- lib/series-synopsis.ts: Bumped the cache key version in getCachedSeriesPageMeta from 1 to 2 to aggressively reset Next.js global fetch caching across all routes. Tightened regex so it's impossible to falsely trigger on unrelated text or classes.

**Verification**
- 
pm run build, 
pm run lint. Cleared database records successfully via node execution previously.

**Next**
- None.

---

### 2026-04-12 - Fix Asura image extraction failure for Astro Island payloads

**Objective**
- Fix a bug where Asura chapters loaded zero images because they migrated payload arrays behind HTML entity encodings (&quot;).

**Changes made**
- lib/sources/adapters/asura-source-adapter.ts: Added HTML sanitization regex replacement .replace(/&quot;/ig, '"').replace(/\\\//g, '/') prior to extracting URLs so boundary markers strictly match un-escaped standard layouts.

**Verification**
- Scanned Genius Prismatic Mage Chapter 68 via 
un_command scraping pipeline yielding full 20 WebP objects successfully. Built successfully.

**Next**
- None.

---

### 2026-04-12 - Final cleanup and lint fixes

**Objective**
- Fix lint errors and type mismatches introduced during layout refactors.

**Changes made**
- components/chapter-reader-view.tsx: Restored progressSync to the component interface. Removed unused counterLabel variable.
- Cleaned up forgotten temporary files.

**Verification**
- 
pm run lint && npm run build passed successfully.

**Next**
- None.

---


## Milestone: Fix Asura Chapter Image Order

### Objective
Fix scrambled image order for Asura chapters.

### Changes Made
* Updated `extractChapterImages` in `asura-source-adapter.ts` to parse the RSC `"pages"` payload first, preserving the correct server-defined reading order. The previous numeric-alphabetical sort scrambled the hash-based filenames.
* Maintained the original regex extraction as a fallback.
* Exposed `extractImagesFromRscPagesPayload` in `ASURA_TEST_UTILS` and added regression tests for correct order preservation.

### Verification
* Added unit tests for order preservation.
* All adapter tests pass, full suite passes, Next.js build succeeds.
* Confirmed Asura chapter pages now correctly sequence panels.

## Milestone: Finalize Bookmarks Page to Industry Standard

### Objective
Redesign the simple bookmarks list into a premium, interactive component featuring full series metadata (covers, accurate titles) and inline deletion capabilities without requiring full page reloading.

### Changes Made
* Enhanced `getBookmarksForUser` in `lib/bookmarks-page-data.ts` to efficiently pre-fetch `Follow` and `SeriesCache` records to attach resolving `seriesTitle` and `coverImageUrl` dynamically.
* Implemented `bookmark-list-row.tsx` bringing in a compact `RemoteCoverImage` thumbnail alongside clear chapter tracking labels and a soft-UX "Remove" Trash button hook invoking `DELETE /api/bookmarks`.
* Implemented `bookmark-list-client.tsx` to act as the primary state wrapper allowing smooth unmounting of deleted bookmarks and rendering an empty-state block immediately when the list becomes zero.
* Upgraded page container in `app/bookmarks/page.tsx` aligning the core layout to modern, mobile-friendly design practices (drop shadows, padded headers).

### Verification
* TypeScript types align.
* Next.js build passes.

## Milestone: Latest Updates Grid Chapter Rendering

### Objective
Update the "Latest from Asura" and "Latest from Flame Comics" grids on the Home Dashboard to display the most recently uploaded chapter name (e.g. Chapter 123) rather than a generic "Chapters & reader" fallback placeholder, mirroring the actual host sites.

### Changes Made
* Extended `CatalogHighlight` in `lib/featured-series.ts` to accept a `latestChapter` metadata snippet.
* Restructured `getHomeLatestAsuraHighlights` and `getHomeLatestFlameHighlights` inside `lib/live-source-browse.ts` to import `getSourceAdapter` and query the `listSeriesChapters()` module asyncronysly for every curated row.
* Updated `components/browse-ui-client.tsx` (`LatestUpdateBlock`) to render the newest chapter dynamically.

### Verification
* Ran `npm run build` successfully ensuring data payload typing was safe across caching interfaces.

## Milestone: Modernizing Manhwa Reader UI & Home Dashboard

### Objective
Clean up redundant dashboard navigation and upgrade the "Recent Reading" section into a premium, graphical component.

### Changes Made
- **Recent Reading:** Refactored `SeriesDetailView` to use graphical poster cards (`RemoteCoverImage`) with horizontal scrolling, replacing the previous textual list.
- **Home Cleanup:** Removed the redundant "Browse by Source" row and simplified "Latest Updates" headers to a clean, minimalist design.
- **Footer Sanitization:** Removed site-branding disclaimers and external source link labels.
- **Logic Fix:** Corrected chapter ordering in `live-source-browse.ts` to accurately pull the latest chapter from the source array.

### Verification
- Components render correctly with resolved labels; duplications prevent.

---

## Milestone: Real-time Search Dropdown with Live Covers

### Objective
Overhaul the header search to provide instant feedback with a premium, glassy dropdown and direct series navigation.

### Changes Made
- **Search API (`app/api/search/route.ts`):** Created a merged search layer that queries database cache + static highlights and resolves fresh cover art from live site `og:image` targets.
- **Search UI (`components/browse-ui-client.tsx`):** Refactored search into a stateful component with Glassy Light Theme styling, source-origin labels, and automatic closing on selection/blur.
- **UX Improvement:** Removed legacy "on-focus page jump" behavior.

### Verification
- Production build succeeded. All results show accurate titles/covers.

---

## Milestone: Git Authentication Fix (System Identity)

### Objective
Resolve "Permission denied (publickey)" error when pushing to GitHub from the agent terminal.

### Changes Made
- Configured local Git to specifically use the Windows System OpenSSH client (`C:/Windows/System32/OpenSSH/ssh.exe`) instead of the bundled Git for Windows client. This allows the Git process to inherit the user's active SSH agent and keys.
- Command: `git config core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"`

### Verification
- Successfully authenticated and pushed all pending milestones to the remote repository.
  
---  
  
### 2026-04-13 - Performance Optimization Audit & Implementation  
  
**Objective**  
- Reduce page load times, cut outbound HTTP waterfalls, and improve Core Web Vitals (LCP/CLS).  
  
**Changes made**  
- **Home Page Waterfall Fix**: Removed per-series listSeriesChapters() calls during cache rebuilds by parsing chapter info directly from browse HTML. Reduced outbound requests from 40+ to near-zero on cached hits.  
- **ISR Implementation**: Converted the home page from force-dynamic to static ISR (5-minute revalidation). Moved personalized sections to a client-side fetch (/api/personal/home).  
- **Caching & Authentication**: Wrapped getSessionUser in React cache() to deduplicate JWT verification. Removed live cover resolution from search API.  
- **Database & Parallelization**: Parallelized DB/meta fetches in series detail. Batch-crawled Asura browse pages (6 at a time). Made chapter cache sync fire-and-forget.  
- **UX & Rendering**: Added width/height to covers to prevent Layout Shift. Added sizes hints for optimized image decoding. Updated next.config.ts with compression and security headers.  
  
**Verification**  
- npm run build and npm run lint passed successfully.  
  
**Next**  
- None. 

### 2026-04-13 - Code Hygiene & Bundle Optimization

**Objective**
- Standardize network logic and reduce client bundle size.

**Changes made**
- **Logic Consolidation**: Created lib/fetch-utils.ts and replaced duplicate etchHtml implementations across all adapters and scrapers.
- **Bundle Splitting**: Moved BrowseHeaderSearch to its own standalone client component file to separate global header logic from heavy browse grid components.
- **Bug Fixes**: Resolved variable duplication and missing type regressions introduced during refactoring.

**Verification**
- Full production build (
pm run build) passed successfully.

**Next**
- Monitor source sites for HTML changes.

---

### 2026-04-13 - Performance follow-through completion

**Objective**
- Close remaining gaps from the performance audit so all 12 tracked items are fully implemented in code.

**Changes made**
- `lib/live-source-browse.ts`: removed home-page per-row Asura format fetches by parsing coarse format labels directly from browse card HTML and filtering locally; added Flame browse HTML chapter-label extraction map so latest cards can carry chapter text without adapter calls.
- `lib/catalog-covers.ts`: replaced custom Flame cover HTML fetch/timeout path with shared `fetchHtml` utility to finish scraper fetch consolidation.
- `components/remote-cover-image.tsx`: applied intrinsic `width`/`height` and `sizes` for both `poster` and `thumb` variants to reduce CLS risk in latest/search thumbnail rows.
- `components/site-header.tsx`: switched header search to dynamic client loading (`next/dynamic`, `ssr: false`) for real runtime code-splitting instead of file-only separation.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- Monitor Asura/Flame browse HTML changes and adjust card-level chapter/type selectors if upstream markup shifts.

---

### 2026-04-13 - Restore latest-card format + Flame latest resilience

**Objective**
- Restore latest update card copy to the intended structure and prevent Flame latest/browse from collapsing to the 5-item curated fallback on transient scrape failures.

**Changes made**
- `components/browse-ui-client.tsx`: forced latest cards to always render:
  - line 2: `Latest from {source}`
  - line 3: latest chapter label (or a neutral unavailable fallback), removing subtitle/genre fallback text in latest rows.
- `lib/live-source-browse.ts`:
  - Added Flame browse retry (cache-busting second request) when the first HTML fetch returns empty.
  - Added `enrichFlameRowsWithLatestChapterLabels` to backfill missing chapter labels for home latest cards using the Flame adapter (cached home window).
  - Bumped Flame cache keys (`home-latest-flame` and `live-flame-browse-series`) and added a direct retry path in `buildLiveBrowseCatalogForSource` before falling back to curated-only entries.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- Monitor Flame upstream for anti-bot or payload shape changes; if retries still fail in production, add persistent last-known-good catalog storage.

---

### 2026-04-13 - Flame browse JSON fallback for full catalog

**Objective**
- Fix recurring Flame fallback state (5 curated series only) and missing latest-chapter labels in environments where inline browse HTML parsing is unreliable.

**Changes made**
- `lib/live-source-browse.ts`:
  - Added parsing for Flame Next.js `buildId` from browse HTML and a fallback fetch of `/_next/data/<buildId>/browse.json`.
  - Added row mapping helper reused by both HTML and JSON browse paths.
  - Updated home-latest recency loader to use HTML-first, JSON-fallback retrieval before chapter enrichment.
  - Updated browse-catalog loader to use JSON fallback when inline `__NEXT_DATA__` extraction yields zero rows.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- If Flame blocks both HTML and `_next/data` in production, persist last-known-good Flame rows in DB and serve those during outages.

---

### 2026-04-13 - Flame home latest: chapter titles + OG covers (Vercel reliability)

**Objective**
- Fix Flame Comics home latest rows showing `Latest chapter unavailable` while Asura worked, and reduce missing cover tiles when browse JSON points at bad CDN filenames.

**Changes made**
- `lib/fetch-utils.ts`: added `fetchHtmlWithOptions` (custom timeout + optional `Referer` header).
- `lib/sources/adapters/flame-source-adapter.ts`: series chapter list fetch uses longer timeout + Referer; added `fetchFlameSeriesOverviewHomeExtras` (one overview fetch returns newest chapter title + `og:image` when present).
- `lib/live-source-browse.ts`: Flame browse HTML fetch uses `fetchHtmlWithOptions`; Flame home enrichment prefers `fetchFlameSeriesOverviewHomeExtras`, merges OG cover when available, then falls back to adapter; lowered parallel concurrency; bumped Flame cache keys to `v8`.

**Verification**
- `npm run lint`
- `npm run build`

**Next**
- If Flame rate-limits overview fetches, add a short TTL in-memory map from `seriesSlug` to latest chapter title to reuse across ISR rebuilds.
