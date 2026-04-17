# Personal Manhwa Reader

An ad-free, mobile-first manhwa reading platform for a small private group.

## Project Purpose

This app provides a clean reading experience with a premium UI while keeping the stack simple and maintainable.

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL (Neon)
- Import alias: `@/*`

## Design Direction

- Mobile-first layout
- **Premium white chrome:** near-white canvas (`--browse-canvas`), white cards, high-contrast type, subtle shadows
- **Scan-site information architecture** (Asura-inspired): two-column “latest” list with pagination, poster grid, popular sidebar with period tabs — without cloning third-party logos or branding
- **Violet** accent on the top bar and primary nav CTAs (light-theme nod to portal layouts); **orange / amber** for star ratings and warm secondary emphasis
- Smooth, subtle hover and border transitions; reader uses the same light shell as the rest of the app

## Current Scope

- Core reading flow:
  - Home page with a live “latest updates” panel for Asura (cached ~30 minutes), source shortcuts, and browser-cached continue-reading; full grid and pagination at `/browse` (20 series per page; Asura list from the site’s live browse index ~1 hour, merged with curated highlights so delisted titles can still appear)
  - Manhwa detail page with chapter list (opens for any series slug on the live Asura browse index or curated highlights, without a `Follow` row; follows still preferred for metadata)
  - Chapter reader page with vertical page images (adapter URLs), resume scroll, prev/next chapter links, and browser-local progress cache; add `?start=1` on a chapter URL to reopen from page 1
- Home catalog covers: `lib/catalog-covers.ts` prefers live `og:image` from Asura series pages (cached); `lib/featured-series.ts` holds fallbacks; `RemoteCoverImage` swaps broken URLs for a placeholder. Continue reading uses the same `resolveSeriesCoverUrl` path when the user has no matching library row or `Follow.coverImageUrl` is empty.
- Scraper-first data strategy:
  - Fetch chapter/page content from scanlation sources at runtime
  - **Asura** only (no other sources in UI or seed). **Browse / home “latest”** lists are filtered to **manhwa, manga, manhua, and webtoon**. Asura walks every `/browse?page=` until a page has no series cards (the site’s pagination links only show a small window, so the scraper cannot rely on the first page’s nav), then resolves the format pill on each `/comics/{slug}` page during the cached scrape (parallel fetches).
  - Asura live adapter (chapter lists + reader image extraction)
  - Avoid full permanent content mirroring in early versions
  - Store app-owned user state in database
  - Persist lightweight chapter cache and fall back to stale cache when live parsing fails
- Database schema (initial) for:
  - `Follow` (library/favorites metadata)
  - `Source`
  - Optional lightweight cache tables (`SeriesCache`, `ChapterCache`) if needed for performance

Out of scope for now:

- Full archive-level storage of all chapter images/pages
- Advanced authentication flows (can be added later)

## Implementation Plan (Current)

1. Finalize lean Prisma schema for user state + source metadata.
2. Create initial migration and verify Neon connectivity.
3. Add basic seed data for sources and test records.
4. Build frontend pages/components against this schema.
5. Integrate scraper adapters for selected scanlation sources.
6. Add caching only where performance requires it.

### Source integration roadmap

- **Done:** Asura live adapter.
- **Next:** Optional admin invite flow and follow management UI polish.
- **Extensibility:** New translator groups are added by creating a `Source` row + a new adapter class + one registry entry; see `lib/sources/README.md`.

## Possible Future Implementation

- Stronger access control (e.g. invite-only registration, roles).
- Account recovery beyond password reset (e.g. backup codes).
- Background sync jobs for source updates.
- Smarter caching and invalidation strategy per source.
- Search indexing and recommendation features.
- Reader enhancements: progress sync, reading goals, offline prefetch.
- Admin tools for source health monitoring and manual overrides.
- CI/CD hardening, test coverage expansion, and observability dashboards.
- Non-goals: comments, community feed, social features, and public discussion tools.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Add environment variables in `.env`:

```env
DATABASE_URL="your_neon_postgresql_connection_string"
```

3. Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Deploying on Vercel (GitHub)

1. Push this repo to GitHub and import the project in [Vercel](https://vercel.com); use the default **Next.js** preset (build: `next build`, output: Next.js).
2. **Environment variables** (Project → Settings → Environment Variables), at minimum for Production (and Preview if you use a real DB there):
   - `DATABASE_URL` — use your **Neon** (or other Postgres) connection string. For serverless, prefer the **pooled** / transaction-pooler URL Neon documents for Vercel.
   - Optional: `DATABASE_PG_SSL=compat` — only if you hit TLS handshake errors against your host (see Database / TLS notes below).
   - Optional: `SKIP_FOLLOW_TITLE_BACKFILL=1` — disables the automatic follow-title normalization on server startup.
3. **Database schema:** run migrations against the **same** database Vercel uses, e.g. from your machine: `npx prisma migrate deploy` with `DATABASE_URL` pointing at production (or use Neon’s migration workflow). The Vercel build does **not** run migrations by default.
4. **Prisma client:** `npm run build` runs `postinstall` → `prisma generate`, so the generated client is present on Vercel without extra config.
5. **Runtime:** routes use the **Node.js** runtime (Prisma + `pg`). `instrumentation.ts` runs on production Node startup (follow-title backfill + URL normalization); failures are logged and do not block the app.

## Development Commands

- `npm run dev` - start dev server
- `npm run lint` - run lint checks
- `npm run test` - unit tests (parsers, source helpers, and display utilities)
- `npm run test:integration` - integration test runner
- `npm run build` - build for production
- `npm run backfill:follow-titles` - manual run of `Follow.seriesTitle` HTML-entity normalization (same logic as production startup; requires `DATABASE_URL`)
- `npx prisma studio` - inspect database records

### Production: follow title backfill

In production (`NODE_ENV=production`), the Node server runs an **idempotent** HTML-entity normalization pass on `Follow.seriesTitle` when the process starts (`instrumentation.ts`). A PostgreSQL **transaction advisory lock** prevents duplicate work if several instances boot at once. Failures are logged and do not crash the app. To disable, set `SKIP_FOLLOW_TITLE_BACKFILL=1` in the host environment. Local `npm run dev` does **not** run this; use `npm run backfill:follow-titles` against your local DB if needed.

## Project Structure

- `app/` - routes and page-level UI
- `components/` - reusable UI components
- `lib/` - shared utilities (including Prisma client setup)
- `prisma/` - schema and migrations
- `styles/` - global styles and theme tokens

## Quality Checklist

Before finishing major changes, run:

```bash
npm run lint
npm run build
```

Also verify:

- Mobile viewport usability
- Route navigation correctness
- Database connectivity for relevant features

## Notes

- Keep the UI consistent with the premium mobile-first direction.
- Keep secrets in environment variables only; never hard-code credentials.

### Database / TLS (Neon)

If Prisma fails with **“Client network socket disconnected before secure TLS connection was established”**:

- Confirm `DATABASE_URL` uses Neon’s current host (pooler or direct) and that the Neon project is not paused.
- Try adding to `.env`: `DATABASE_PG_SSL=compat`. That normalizes the URL to `sslmode=require` **and** uses a `pg` pool with relaxed certificate verification (`rejectUnauthorized: false`) so encrypted TLS still runs but strict chain checks are skipped — often required on Windows when the handshake dies before connect. **Restart `npm run dev`** after changing this. Do not use compat mode in production unless you accept that tradeoff.
- The home page falls back to a static source list when the DB is unreachable so you can still browse the curated catalog; other routes that require Prisma will still need a working connection.
