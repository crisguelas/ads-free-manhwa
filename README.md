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
- **Premium white chrome:** light gray canvas (`--browse-canvas`), white cards, high-contrast type
- **Scan-site information architecture** (Asura-inspired): spotlight carousel, dense “latest” lists per source, poster grid, ranked sidebar — without cloning third-party branding
- Warm **orange / amber** accents for labels, filters, and focus rings (distinct from scan sites’ dark themes)
- Smooth, subtle hover and border transitions; reader uses the same light shell as the rest of the app

## Current Scope

- Core reading flow:
  - Home page with Asura + Flame browse UI, optional filter `/?source=asura-scans` or `/?source=flame-scans`
  - Manhwa detail page with chapter list (works for home catalog titles without a `Follow` row; follows still preferred for library metadata)
  - Chapter reader page with vertical page images (adapter URLs), resume scroll, prev/next chapter links, and server-persisted page progress (`ReadingHistory` for the signed-in user); add `?start=1` on a chapter URL to reopen from page 1
  - Email + password accounts with HttpOnly session cookie (`AUTH_SECRET`); library, history, and reader routes require login
- Home catalog covers: `lib/catalog-covers.ts` prefers live `og:image` from Asura/Flame series pages (cached); `lib/featured-series.ts` holds fallbacks; `RemoteCoverImage` swaps broken URLs for a placeholder.
- Scraper-first data strategy:
  - Fetch chapter/page content from scanlation sources at runtime
  - **Asura** and **Flame Comics** only (no other sources in UI or seed)
  - Asura and Flame Comics live adapters (chapter lists + reader image extraction)
  - Avoid full permanent content mirroring in early versions
  - Store app-owned user state in database
  - Persist lightweight chapter cache and fall back to stale cache when live parsing fails
- Database schema (initial) for:
  - `User`
  - `Bookmark`
  - `Follow` (library/favorites)
  - `ReadingHistory`
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

- **Done:** Asura (first live adapter) and [Flame Comics](https://flamecomics.xyz/) (`flame-scans`) live adapter.
- **Next:** Optional admin invite flow, follow management UI, and bookmarks polish.
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
AUTH_SECRET="at-least-32-characters-random-string-for-session-signing"
```

Use a long random value for `AUTH_SECRET` (required for log in and registration). After `npm run seed`, you can sign in as `dev@manhwa.local` with password `dev-password-change-me` (change both in production).

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

## Development Commands

- `npm run dev` - start dev server
- `npm run lint` - run lint checks
- `npm run test` - unit tests (parsers, auth token helpers, reading-progress validation)
- `npm run test:integration` - DB integration tests (requires `DATABASE_URL`, e.g. password reset flow)
- `npm run build` - build for production
- `npx prisma studio` - inspect database records

### Password reset

- **Forgot:** `/forgot-password` → `POST /api/auth/forgot-password` creates a one-hour token (SHA-256 stored, raw token only in email or **server log** if Resend is not configured).
- **Complete:** link to `/reset-password?token=…` → `POST /api/auth/reset-password` sets a new bcrypt password and clears tokens for that user.
- **Email:** set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env` to send mail; otherwise check server logs for `[password-reset]`.
- **Links in production:** set `APP_BASE_URL` if the app is behind a proxy so reset URLs are correct.

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
