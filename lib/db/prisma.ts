import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // Use DIRECT_URL for pg adapter (avoids PgBouncer issues)
  // Fall back to DATABASE_URL if DIRECT_URL not set
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL environment variable is not set");
  }

  // Configure pool for Supabase direct connection
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // SSL configuration for Supabase
    ssl: {
      rejectUnauthorized: false,
    },
  });

  // Handle pool errors gracefully
  pool.on("error", (err) => {
    console.error("Unexpected database pool error:", err);
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
