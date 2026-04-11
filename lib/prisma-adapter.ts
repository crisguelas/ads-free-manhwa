import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { normalizePostgresDatabaseUrl } from "@/lib/db-connection-string";

/**
 * Creates the Prisma `pg` adapter for a given `DATABASE_URL`.
 * When `DATABASE_PG_SSL=compat` is set, uses a small connection pool with
 * `ssl.rejectUnauthorized: false` so TLS still encrypts traffic but skips strict
 * certificate chain checks that often break on Windows or restrictive networks.
 * Use only for local/dev when Neon otherwise fails during the TLS handshake.
 */
export function createPostgresAdapter(rawUrl: string): PrismaPg {
  const connectionString = normalizePostgresDatabaseUrl(rawUrl);

  if (process.env.DATABASE_PG_SSL === "compat") {
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 20_000,
      max: 10,
      ssl: { rejectUnauthorized: false },
    });
    return new PrismaPg(pool);
  }

  return new PrismaPg({ connectionString });
}
