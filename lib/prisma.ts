import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizePostgresDatabaseUrl } from "@/lib/db-connection-string";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Builds a Prisma client backed by the Postgres adapter.
 */
function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("DATABASE_URL is required for Prisma client initialization.");
  }

  const connectionString = normalizePostgresDatabaseUrl(rawUrl);
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Stores a singleton Prisma client during development hot reloads.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

/**
 * Exposes the shared Prisma client instance for server-side data access.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
