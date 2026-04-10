/**
 * Normalizes a Postgres connection URL so `pg` uses an explicit `sslmode=verify-full`.
 * This matches current driver behavior for `require`/`prefer`/`verify-ca` and silences
 * the Node warning about future libpq-compatible semantics (pg-connection-string v3+).
 */
export function normalizePostgresDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");
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
