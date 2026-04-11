# Development History

This file tracks implementation steps so future developers can understand what was done, why it was done, and what comes next.

## How to Use This File

- Add a new dated entry for every meaningful milestone.
- Keep entries short and factual.
- Include: objective, changes made, verification, and next step.

## Timeline

### 2026-04-11 - Series detail: status pill on cover (Asura-style)

**Objective**
- Show publication status (ongoing / completed / dropped / …) at the bottom of the poster on `/manhwa/[id]`, similar to Asura’s per-series badges.

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
- `/browse/asura-scans` stopped after ~5–6 source pages because Asura’s HTML only links to the next few `?page=` URLs; the app used that as the total page count and missed most series.

**Changes made**
- `lib/live-source-browse.ts`: `fetchAllAsuraBrowseRows` now requests page 1, 2, … until a page yields zero parsed cards (with a high safety cap); raised `ASURA_BROWSE_MAX_PAGES`; `live-asura-browse-series` cache **v4**; JSDoc on `maxAsuraBrowsePageFromHtml`.
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
- Restrict live catalog scraping to comic-strip formats the group cares about: manhwa, manga, manhua — not Flame web novels, “Comic”, “Web Novel”, etc.

**Changes made**
- `lib/scanlation-format-filter.ts`: shared allowlist helper.
- `lib/asura-comic-format.ts`: parse format pill from Asura series HTML.
- `lib/live-source-browse.ts`: Flame browse JSON filters by `type`; novel rows omitted; Asura browse rows filtered after fetching each `/comics/{slug}` (batched concurrency); cache keys bumped (`home-latest-*` / `live-*-browse-series` v2 or v4).
- Tests: `lib/asura-comic-format.test.ts`, `lib/scanlation-format-filter.test.ts`; extended `lib/live-source-browse.test.ts`.
- `README.md`: scope note on browse filtering.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- If Asura labels many Korean series as “Webtoon” instead of “Manhwa”, consider adding `webtoon` to the allowlist or mapping rules.

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
- `/manhwa/novel-8` (and similar) returned 404 because `resolveSeriesContextForUser` only looked up `buildLiveBrowseCatalogForSource`, which used a **stale** `unstable_cache` key (`live-flame-browse-series` v1) from before web-novel slugs existed, while the home “latest” column used a **separate** cache that already listed `novel-{id}` rows.

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
- Home “Latest from Flame Comics” showed the Web Novel ORV tile with a broken slug (`series_id` missing → `undefined`), duplicate React keys, links to `/series/8` (a different manhwa) instead of `/novel/8`, and empty or wrong detail data.

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
- Opening a Flame numeric series (e.g. from home “Latest from Flame Comics”) sometimes showed another title, no cover, and zero chapters because `resolveSeriesContextForUser` used `follow.findFirst` on `seriesSlug` only; `Follow` allows the same slug for both sources, and an arbitrary row could win.

**Changes made**
- `lib/follow-source-disambiguation.ts`: `pickRowWhenSeriesSlugSpansScanSources` mirrors live-browse rules (all-digit slug → Flame, otherwise Asura when both follow rows exist).
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
- Show poster images on the home “Continue reading” carousel when reading history exists but `Follow.coverImageUrl` is unset (common for history-only or legacy follows).

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

### 2026-04-10 - Reading progress persistence (scroll → ReadingHistory)

**Objective**
- Save the visible page while reading, resume on return, and align list/detail queries with the same “progress user” until real authentication exists.

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
- Replace env-based “progress user” with real accounts: login, registration, HttpOnly session, and user-scoped follows/history/reader access.

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
- Replaced `components/home-browse.tsx` with spotlight carousel, per-source “latest” sections, poster grid, sidebar (popular + source status), and URL filter pills via `/?source=…`.
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
- Prefer Neon’s documented pooler URL + default SSL when compat is not needed.

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
- Optional “Add to library” UI to create follows from the detail page.

---

### 2026-04-11 - Chapter list order, cache depth, reader navigation, start from page 1

**Objective**
- Fix confusing chapter order (newest-first hid “chapter 1”), shallow lists (20/40 cap), inverted prev/next for reading forward, possible wrong image order, and resume-always-on-last-page UX.

**Changes made**
- Asura/Flame adapters: sort chapter lists ascending (earliest chapter first); Asura page images sorted by trailing numeric filename when present.
- `lib/reader-data.ts`: `MAX_CACHED_CHAPTERS_PER_SERIES` (500), sort cached+live rows for the detail UI, derive “latest” as newest in that order, `adjacentChapterSlugs` for prev/next, `ChapterReaderOptions.fromStart` to skip saved `ReadingHistory` page.
- Chapter page: `?start=1` / `?start=true` and “Start from page 1” link when resuming past page 1.

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
- `components/remote-cover-image.tsx`: client cover/thumb with `onError` → placeholder; wired through `components/home-browse.tsx`.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- None required unless a source drops `og:image` entirely.

---

### 2026-04-11 - TBATE catalog cover (off-Asura fallback)

**Objective**
- Restore a visible poster for “The Beginning After the End” on the home browse UI.

**Changes made**
- `lib/featured-series.ts`: set `coverImageUrl` to LINE Webtoon’s CDN `og:image` for TBATE; Asura no longer lists the series, so live Asura `og:image` enrichment stays null.

**Verification**
- `npm run lint`, `npm run build`; cover URL returns HTTP 200.

**Next**
- If Asura re-adds the series, slug + live enrichment may override this fallback automatically.

---

### 2026-04-11 - Home UI: Asura-style layout on premium white chrome

**Objective**
- Match scan-portal information architecture (hero carousel, trending strip, two-column latest + sidebar) while keeping a light, premium theme and distinct branding.

**Changes made**
- `components/home-browse.tsx`: hero with blurred backdrop, spotlight carousel, trending row, paged “latest updates” grid, sidebar (popular tabs, staff pick, sources), announcements strip, library anchor.
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
- `components/site-header.tsx`: Browse `<details>` links to `/browse/asura-scans` and `/browse/flame-scans`; Bookmarks → `/bookmarks`.
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
- Simplify the home page (no popular sidebar, no duplicate “all series” grid), show real latest-style lists per source (Asura + Flame), and make header nav interactions feel smoother.

**Changes made**
- `lib/live-source-browse.ts`: `parseFlameBrowseSeriesByRecency`, shared `flameJsonSeriesToRow`, cached `getHomeLatestAsuraHighlights` / `getHomeLatestFlameHighlights` (30m revalidate) with curated fallbacks.
- `lib/home-data.ts`: `latestAsura` / `latestFlame` replace `catalogHighlights`; parallel `enrichCatalogHighlightCovers` on both lists.
- `components/home-browse.tsx`: two `SourceLatestUpdatesSection` blocks, tighter layout, lifted browse pills.
- `components/browse-ui-client.tsx`: `SourceLatestUpdatesSection`, refreshed `LatestUpdateBlock` / `PagedLatestUpdates`; removed `PopularRankingTabs`.
- `components/site-header.tsx`: backdrop blur, duration-based hovers, focus rings, animated Browse dropdown (`group-open/…`).
- Tests: `parseFlameBrowseSeriesByRecency` ordering; `README.md` / copy tweaks in `featured-series.ts`, `app/page.tsx`.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- Optional: scrape Asura homepage widget if browse page order diverges from “latest” expectations.

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
- Detail and reader routes must resolve slugs from the live Asura/Flame browse merge, not only `CATALOG_HIGHLIGHTS`, so home “latest” tiles match `/manhwa/[id]`.

**Changes made**
- `lib/reader-data.ts`: after follow + curated lookup, `resolveSeriesContextForUser` checks `buildLiveBrowseCatalogForSource` for both sources; disambiguates rare slug collisions (numeric → Flame).

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- None unless URL strategy changes (e.g. explicit `sourceKey` in path).

---

### 2026-04-11 - Reader UX: clarify “page” counter, strip layout, chrome

**Objective**
- Explain that “Page 3 / 3” meant the 3rd image in a vertical chapter strip (not paginated chapters), and improve reader immersion and navigation.

**Changes made**
- `components/chapter-reader-view.tsx`: violet top scroll-progress bar; images in one column with light dividers; copy “Image X of Y” + strip/resume hint; floating counter above bottom nav; eager-load first five images; `onLoad` triggers progress recalc after lazy decode.
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
- Added `components/browse-nav-dropdown.tsx` (client): hover-open on `(hover: hover)` devices, tap-to-toggle on touch-first viewports, short close delay for the trigger–panel gap, opacity + translate transition; wired from `components/site-header.tsx`.
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

### 2026-04-11 - Vercel deploy readiness + single home “continue reading” row

**Objective**
- Document and script Prisma client generation for GitHub → Vercel deploys; simplify signed-in home resume UI to one most-recent chapter with clearer series context.

**Changes made**
- `package.json`: `postinstall` runs `prisma generate` so Vercel installs produce the client before `next build`.
- `README.md`: “Deploying on Vercel (GitHub)” checklist (env vars, migrations, runtime notes).
- `lib/home-data.ts`: `readingHistory` query `take: 1`; `ContinueReadingCard` adds optional `seriesTitle` from follow rows (`displayFollowSeriesTitle`).
- `components/home-browse.tsx`: one resume card (cover + series + chapter + source); `components/source-overview.tsx` shows `seriesTitle` when present for type alignment.

**Verification**
- `npm run lint`, `npm run build`.

**Next**
- Run `npx prisma migrate deploy` against production DB after first Vercel env setup.

---

### 2026-04-11 - Continue reading: dedupe by series, clean titles, shorter chapter line

**Objective**
- Home “Continue reading” should list each series once with only the latest opened chapter, avoid repeating the series name in the chapter line, and strip Asura hash tokens from displayed titles (slug or stored follow title).

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
- Fix tiles where the series name appeared on the chapter row (Flame numeric slugs), “Solo Leveling” split across rows, and `<title>` tails like `- Read Online` broke parsing.

**Changes made**
- `lib/continue-reading-display.ts`: `cleanChapterPageTitleForSplit` strips `- Read Online` / `- Premium` without requiring `|`; `splitSeriesAndChapterFromPageTitle`, `resolveContinueReadingCarouselLabels`, and `isWholeWordPrefix` to prefer parsed series when slug/follow says `Series {id}` or a short prefix of the real title.
- `components/continue-reading-carousel.tsx`: uses `resolveContinueReadingCarouselLabels`; slightly wider tiles and `line-clamp-2` for titles.
- `lib/continue-reading-display.test.ts`: regression cases for Flame slug + short follow title.

**Verification**
- `npm run test`, `npm run lint`, `npm run build`.

**Next**
- None unless sources emit non-`Chapter n` patterns (e.g. “Episode”).
