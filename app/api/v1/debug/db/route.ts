import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { randomBytes } from "crypto";

// GET /api/v1/debug/db - Test database connectivity and write operations
export async function GET(request: NextRequest) {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_preview: process.env.DATABASE_URL
        ? `${process.env.DATABASE_URL.substring(0, 30)}...`
        : null,
      port: process.env.DATABASE_URL?.includes(":6543")
        ? "6543 (pooler)"
        : process.env.DATABASE_URL?.includes(":5432")
          ? "5432 (direct)"
          : "unknown",
    },
  };

  // Test 1: Check connection
  try {
    const connectionTest = await prisma.$queryRaw`SELECT 1 as test`;
    results.connection_test = { success: true, result: connectionTest };
  } catch (error) {
    results.connection_test = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }

  // Test 2: Check oauth_states table exists
  try {
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'oauth_states'
    ` as Array<{ table_name: string }>;
    results.table_exists = tableCheck.length > 0;
  } catch (error) {
    results.table_exists_error = error instanceof Error ? error.message : "Unknown error";
  }

  // Test 3: Count existing states
  try {
    const count = await prisma.oAuthState.count();
    results.oauth_states_count = count;
  } catch (error) {
    results.oauth_states_count_error = error instanceof Error ? error.message : "Unknown error";
  }

  // Test 4: Write test state
  const testState = `test_${randomBytes(16).toString("hex")}`;
  try {
    const created = await prisma.oAuthState.create({
      data: {
        state: testState,
        userId: "debug-test-user",
        labelId: "debug-test-label",
        redirectUrl: "https://test.example.com",
        platform: "TEST",
        expiresAt: new Date(Date.now() + 60 * 1000), // 1 minute
      },
    });
    results.write_test = { success: true, created_id: created.id };
  } catch (error) {
    results.write_test = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }

  // Test 5: Read back the test state
  try {
    const found = await prisma.oAuthState.findUnique({
      where: { state: testState },
    });
    results.read_back_test = { success: !!found, found: !!found };
  } catch (error) {
    results.read_back_test = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }

  // Test 6: Count after write
  try {
    const countAfter = await prisma.oAuthState.count();
    results.count_after_write = countAfter;
  } catch (error) {
    results.count_after_write_error = error instanceof Error ? error.message : "Unknown error";
  }

  // Test 7: Cleanup test state
  try {
    await prisma.oAuthState.deleteMany({
      where: { platform: "TEST" },
    });
    results.cleanup = { success: true };
  } catch (error) {
    results.cleanup = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }

  // Test 8: Final count
  try {
    const finalCount = await prisma.oAuthState.count();
    results.final_count = finalCount;
  } catch (error) {
    results.final_count_error = error instanceof Error ? error.message : "Unknown error";
  }

  return NextResponse.json(results);
}
