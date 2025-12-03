import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { cached, CacheKeys, CacheTTL } from "@/lib/cache";

// GET /api/v1/labels - List all labels
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Use cached labels list (labels rarely change)
    const response = await cached(
      CacheKeys.labelsList(),
      CacheTTL.STATIC, // 1 hour cache
      async () => {
        const labels = await prisma.label.findMany({
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            code: true,
            createdAt: true,
          },
        });

        return {
          labels: labels.map((label) => ({
            id: label.id,
            name: label.name,
            code: label.code,
            created_at: label.createdAt.toISOString(),
          })),
          total: labels.length,
        };
      }
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get labels error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
