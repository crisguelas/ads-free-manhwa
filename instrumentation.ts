import { normalizePostgresDatabaseUrl } from "@/lib/db-connection-string";

/**
 * Runs once when the Node.js server starts so `DATABASE_URL` matches `pg` sslmode expectations
 * before any route or Prisma import runs, avoiding SSL deprecation warnings in dev/prod logs.
 * In production, also normalizes legacy `Follow.seriesTitle` HTML entities (idempotent; guarded by DB advisory lock).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return;
  }
  process.env.DATABASE_URL = normalizePostgresDatabaseUrl(raw);

  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (process.env.SKIP_FOLLOW_TITLE_BACKFILL === "1") {
    return;
  }

  try {
    const { runFollowSeriesTitleBackfill } = await import(
      "@/lib/run-follow-series-title-backfill"
    );
    const result = await runFollowSeriesTitleBackfill();
    if (result.updated > 0) {
      console.log(
        `[follow-series-title-backfill] updated ${result.updated} of ${result.scanned} follow row(s).`,
      );
    } else if (result.skippedDueToLock) {
      console.log(
        "[follow-series-title-backfill] skipped (another instance holds the advisory lock).",
      );
    }
  } catch (err) {
    console.error("[follow-series-title-backfill] failed (non-fatal):", err);
  }
}
