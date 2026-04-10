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
- Modern and clean visual style
- Glassmorphism-inspired cards and panels
- Smooth, subtle micro-animations

## Current Scope

- Core reading flow:
  - Home page with featured manhwa
  - Manhwa detail page with chapter list
  - Chapter reader page with page navigation
- Scraper-first data strategy:
  - Fetch chapter/page content from scanlation sources at runtime
  - Avoid full permanent content mirroring in early versions
  - Store app-owned user state in database
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

## Possible Future Implementation

- Authentication and access control (simple email + password; no social login).
- Password reset and account recovery flow.
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

## Development Commands

- `npm run dev` - start dev server
- `npm run lint` - run lint checks
- `npm run build` - build for production
- `npx prisma studio` - inspect database records

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
