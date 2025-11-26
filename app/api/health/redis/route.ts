import { NextResponse } from "next/server";
import { createClient } from "redis";

export async function GET() {
  const client = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  });

  try {
    await client.connect();
    await client.ping();
    await client.disconnect();

    return NextResponse.json({
      status: "ok",
      redis: "connected",
      message: "Redis connection successful",
    });
  } catch (error) {
    console.error("Redis health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        redis: "disconnected",
        message: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 503 }
    );
  }
}
