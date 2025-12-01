import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { randomBytes } from "crypto";

// GET /api/v1/debug/db - Test database connectivity and write operations
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    request_info: {
      url: request.url,
      method: request.method,
      headers: {
        host: request.headers.get("host"),
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        user_agent: request.headers.get("user-agent")?.substring(0, 50) + "...",
      }
    },
    env: {
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_preview: process.env.DATABASE_URL
        ? `${process.env.DATABASE_URL.substring(0, 50)}...`
        : null,
      port: process.env.DATABASE_URL?.includes(":6543")
        ? "6543 (pooler)"
        : process.env.DATABASE_URL?.includes(":5432")
          ? "5432 (direct)"
          : "unknown",
      node_env: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
    },
  };

  // Test 1: Check connection
  try {
    const connectionTest = await prisma.$queryRaw`SELECT 1 as test, NOW() as server_time`;
    results.connection_test = { success: true, result: connectionTest };
  } catch (error) {
    results.connection_test = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }

  // Test 2: Count existing states and list them
  try {
    const allStates = await prisma.oAuthState.findMany({
      select: {
        id: true,
        state: true,
        platform: true,
        userId: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    results.oauth_states = allStates.map(s => ({
      id: s.id,
      state_preview: s.state.substring(0, 20) + "...",
      platform: s.platform,
      userId: s.userId,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    }));
    results.oauth_states_count = allStates.length;
  } catch (error) {
    results.oauth_states_error = error instanceof Error ? error.message : "Unknown error";
  }

  // Test 3: Write test state with unique ID to track
  const testId = randomBytes(4).toString("hex");
  const testState = `debug_${testId}_${randomBytes(16).toString("hex")}`;
  try {
    console.log(`[Debug DB] Creating test state: ${testState.substring(0, 30)}...`);
    const created = await prisma.oAuthState.create({
      data: {
        state: testState,
        userId: `debug-user-${testId}`,
        labelId: "debug-test-label",
        redirectUrl: "https://test.example.com",
        platform: "DEBUG_TEST",
        expiresAt: new Date(Date.now() + 60 * 1000), // 1 minute
      },
    });
    console.log(`[Debug DB] State created with ID: ${created.id}`);
    results.write_test = {
      success: true,
      created_id: created.id,
      created_state_preview: testState.substring(0, 30) + "...",
    };
  } catch (error) {
    console.error(`[Debug DB] Write failed:`, error);
    results.write_test = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }

  // Test 4: Verify by reading back immediately
  try {
    const readBack = await prisma.oAuthState.findUnique({
      where: { state: testState }
    });
    results.read_back_test = {
      success: !!readBack,
      found: !!readBack,
      id: readBack?.id,
    };
  } catch (error) {
    results.read_back_test = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }

  // Test 5: Count after write
  try {
    const countAfter = await prisma.oAuthState.count();
    results.count_after_write = countAfter;
  } catch (error) {
    results.count_after_write_error = error instanceof Error ? error.message : "Unknown error";
  }

  // Test 6: Cleanup test states
  try {
    const deleted = await prisma.oAuthState.deleteMany({
      where: { platform: "DEBUG_TEST" },
    });
    results.cleanup = { success: true, deleted_count: deleted.count };
  } catch (error) {
    results.cleanup = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }

  // Test 7: Final count
  try {
    const finalCount = await prisma.oAuthState.count();
    results.final_count = finalCount;
  } catch (error) {
    results.final_count_error = error instanceof Error ? error.message : "Unknown error";
  }

  results.execution_time_ms = Date.now() - startTime;

  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  });
}
