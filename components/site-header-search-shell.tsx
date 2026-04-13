"use client";

import dynamic from "next/dynamic";

/**
 * Lazily loads the interactive browse search UI so it can be code-split from the server header shell.
 */
const BrowseHeaderSearch = dynamic(
  () =>
    import("@/components/browse-header-search").then(
      (module) => module.BrowseHeaderSearch,
    ),
  { ssr: false },
);

/**
 * Client boundary for the header search, kept separate so the server header can stay lean.
 */
export function SiteHeaderSearchShell() {
  return <BrowseHeaderSearch />;
}
