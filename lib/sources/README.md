# Source adapters

Each scanlation site is integrated behind a single `SourceAdapter` implementation (`lib/sources/types.ts`) and registered by **`Source.key`** in the database (`prisma/seed.ts` or admin tooling later).

## Add a new scanlation website

1. **Database** — Ensure a `Source` row exists with a stable unique `key` (kebab-case, e.g. `flame-scans`, `some-group-scans`) and the correct `baseUrl`.
2. **Adapter** — Add `lib/sources/adapters/<key>-source-adapter.ts` implementing `SourceAdapter`:
   - `listSeriesChapters(seriesSlug)`
   - `getChapterDetail(seriesSlug, chapterSlug)`
3. **Registry** — Register the adapter in `lib/sources/registry.ts` inside `createAdapterRegistry()` so `getSourceAdapter(sourceKey)` returns it.
4. **Observability** — Reuse `lib/sources/adapter-observability.ts` (`recordParserSuccess`, `recordParserFailure`, cache helpers) so health metrics stay consistent across sources.
5. **Tests** — Add HTML fixtures and parser tests (see `asura-source-adapter.test.ts`) for chapter list and image URL extraction.

Mock adapters (`mock-source-adapter.ts`) remain valid placeholders until a site is implemented.

## Roadmap (live scrapers)

| Priority | `Source.key` | Site | Status |
|----------|----------------|------|--------|
| 1 | `asura-scans` | Asura | Live adapter |
| 2 | `flame-scans` | [Flame Comics](https://flamecomics.xyz/) | **Next implementation** |
| — | `reaper-scans` | Reaper | Mock until prioritized |

After Flame is stable, additional groups only need a new `Source` row + adapter + registry entry—no core app refactor.
