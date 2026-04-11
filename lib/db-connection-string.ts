/**
 * Normalizes a Postgres connection URL so `pg` uses an explicit `sslmode`.
 * Default: upgrade legacy modes to `verify-full` (Neon-friendly, silences pg sslmode deprecation noise).
 * When `DATABASE_PG_SSL=compat` is set, keeps or sets `sslmode=require` instead — helps environments
 * where TLS handshakes fail with `verify-full` (e.g. some Windows / proxy setups).
 */
export function normalizePostgresDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");

    if (process.env.DATABASE_PG_SSL === "compat") {
      if (
        !sslMode ||
        sslMode === "prefer" ||
        sslMode === "verify-full" ||
        sslMode === "verify-ca"
      ) {
        url.searchParams.set("sslmode", "require");
      }
      return url.toString();
    }

    if (
      !sslMode ||
      sslMode === "require" ||
      sslMode === "prefer" ||
      sslMode === "verify-ca"
    ) {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}
