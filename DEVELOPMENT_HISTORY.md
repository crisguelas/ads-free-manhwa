# Development History

This file tracks implementation steps so future developers can understand what was done, why it was done, and what comes next.

## How to Use This File

- Add a new dated entry for every meaningful milestone.
- Keep entries short and factual.
- Include: objective, changes made, verification, and next step.

## Timeline

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
