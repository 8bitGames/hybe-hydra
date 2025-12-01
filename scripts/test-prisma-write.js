// Test script to verify Prisma can write to oauth_states table
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const crypto = require("crypto");

async function main() {
  console.log("=== Prisma Write Test ===\n");

  // Show current DATABASE_URL (masked)
  const dbUrl = process.env.DATABASE_URL || "";
  const maskedUrl = dbUrl.replace(/:([^@]+)@/, ":***@");
  console.log("DATABASE_URL:", maskedUrl);
  console.log("Port:", dbUrl.includes(":6543") ? "6543 (pooler)" : dbUrl.includes(":5432") ? "5432 (direct)" : "unknown");
  console.log("");

  // Create Prisma client with pg adapter (same as lib/db/prisma.ts)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log: ["query", "error", "warn"],
  });

  try {
    // Test 1: Check table exists
    console.log("1. Checking oauth_states table exists...");
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'oauth_states'
    `;
    console.log("   Table exists:", tableCheck.length > 0);

    // Test 2: Count existing states
    console.log("\n2. Counting existing states...");
    const countBefore = await prisma.oAuthState.count();
    console.log("   States before:", countBefore);

    // Test 3: Create a test state
    console.log("\n3. Creating test OAuth state...");
    const testState = crypto.randomBytes(32).toString("hex");
    console.log("   Generated state:", testState.substring(0, 20) + "...");

    const created = await prisma.oAuthState.create({
      data: {
        state: testState,
        userId: "test-user-123",
        labelId: "test-label-456",
        redirectUrl: "https://example.com/callback",
        platform: "TIKTOK",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    console.log("   Created ID:", created.id);

    // Test 4: Verify it was saved
    console.log("\n4. Verifying state was saved...");
    const found = await prisma.oAuthState.findUnique({
      where: { state: testState },
    });
    console.log("   Found:", !!found);
    if (found) {
      console.log("   Found ID matches:", found.id === created.id);
    }

    // Test 5: Count after create
    console.log("\n5. Counting states after create...");
    const countAfter = await prisma.oAuthState.count();
    console.log("   States after:", countAfter);
    console.log("   Difference:", countAfter - countBefore);

    // Test 6: Using raw query to double-check
    console.log("\n6. Raw query verification...");
    const rawCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM oauth_states`;
    console.log("   Raw count:", rawCount[0].count);

    // Cleanup
    console.log("\n7. Cleaning up test state...");
    await prisma.oAuthState.delete({ where: { state: testState } });
    console.log("   Deleted test state");

    console.log("\n=== SUCCESS: Prisma writes are working! ===");
  } catch (error) {
    console.error("\n!!! ERROR:", error.message);
    console.error("Full error:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
