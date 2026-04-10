import { normalizePostgresDatabaseUrl } from "@/lib/db-connection-string";

/**
 * Runs once when the Node.js server starts so `DATABASE_URL` matches `pg` sslmode expectations
 * before any route or Prisma import runs, avoiding SSL deprecation warnings in dev/prod logs.
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
}
