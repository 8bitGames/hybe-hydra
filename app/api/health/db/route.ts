import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "postgresql",
      message: "Database connection successful",
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        database: "postgresql",
        message: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 503 }
    );
  }
}
