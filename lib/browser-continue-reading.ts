"use client";

import type { ContinueReadingCard } from "@/lib/home-data";

/**
 * LocalStorage key used for browser-only continue-reading entries.
 */
export const CONTINUE_READING_STORAGE_KEY = "manhwa-cloud:continue-reading:v1";

/**
 * Maximum series entries persisted in browser storage.
 */
export const CONTINUE_READING_MAX_ENTRIES = 48;

/**
 * Browser-persisted resume row shape used to rebuild the home carousel.
 */
export type BrowserContinueReadingEntry = ContinueReadingCard & {
  pageNumber: number;
  lastReadAt: string;
};

/**
 * Parses stored JSON safely; returns an empty list when unavailable or invalid.
 */
export function readContinueReadingEntries(): BrowserContinueReadingEntry[] {
  try {
    const raw = window.localStorage.getItem(CONTINUE_READING_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((row): row is BrowserContinueReadingEntry => {
      if (!row || typeof row !== "object") {
        return false;
      }
      const r = row as Partial<BrowserContinueReadingEntry>;
      return (
        typeof r.id === "string" &&
        typeof r.seriesSlug === "string" &&
        typeof r.sourceKey === "string" &&
        typeof r.chapterSlug === "string" &&
        typeof r.sourceName === "string" &&
        typeof r.pageNumber === "number" &&
        typeof r.lastReadAt === "string"
      );
    });
  } catch {
    return [];
  }
}

/**
 * Writes entries back to localStorage and silently ignores browser quota/privacy failures.
 */
export function writeContinueReadingEntries(entries: BrowserContinueReadingEntry[]): void {
  try {
    window.localStorage.setItem(CONTINUE_READING_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore localStorage write failures */
  }
}

/**
 * Inserts or updates one resume entry, deduped by source+series and ordered newest-first.
 */
export function upsertContinueReadingEntry(
  entry: Omit<BrowserContinueReadingEntry, "id" | "lastReadAt">,
): void {
  const current = readContinueReadingEntries();
  const dedupeKey = `${entry.sourceKey}:${entry.seriesSlug}`;
  const next: BrowserContinueReadingEntry = {
    ...entry,
    id: `${entry.sourceKey}:${entry.seriesSlug}:${entry.chapterSlug}`,
    lastReadAt: new Date().toISOString(),
  };
  const merged = [next, ...current.filter((row) => `${row.sourceKey}:${row.seriesSlug}` !== dedupeKey)];
  writeContinueReadingEntries(merged.slice(0, CONTINUE_READING_MAX_ENTRIES));
}
