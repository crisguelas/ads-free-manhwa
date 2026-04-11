import "dotenv/config";
import { createPostgresAdapter } from "@/lib/prisma-adapter";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Builds a Prisma client backed by the Postgres adapter.
 */
function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("DATABASE_URL is required for Prisma client initialization.");
  }

  const adapter = createPostgresAdapter(rawUrl);
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
