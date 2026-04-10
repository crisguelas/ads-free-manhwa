import test from "node:test";
import assert from "node:assert/strict";
import { normalizePostgresDatabaseUrl } from "@/lib/db-connection-string";

/**
 * Ensures legacy sslmode values are upgraded to verify-full for pg compatibility.
 */
test("normalizePostgresDatabaseUrl sets sslmode=verify-full when missing or legacy", () => {
  assert.match(
    normalizePostgresDatabaseUrl(
      "postgresql://u:p@host:5432/db?sslmode=require",
    ),
    /sslmode=verify-full/,
  );
  assert.match(
    normalizePostgresDatabaseUrl("postgresql://u:p@host:5432/db"),
    /sslmode=verify-full/,
  );
});
