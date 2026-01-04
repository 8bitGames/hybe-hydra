import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { cached, CacheKeys, CacheTTL, invalidatePattern } from "@/lib/cache";

// GET /api/v1/presets - List all style presets
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const activeOnly = searchParams.get("active_only") !== "false";

    // Use cached presets (presets rarely change)
    const response = await cached(
      CacheKeys.stylePresets(category, activeOnly),
      CacheTTL.STATIC, // 1 hour cache
      async () => {
        const where: Record<string, unknown> = {};

        if (activeOnly) {
          where.isActive = true;
        }

        if (category) {
          where.category = category;
        }

        const presets = await withRetry(() => prisma.stylePreset.findMany({
          where,
          orderBy: { sortOrder: "asc" },
        }));

        return {
          presets: presets.map((preset) => ({
            id: preset.id,
            name: preset.name,
            name_ko: preset.nameKo,
            category: preset.category,
            description: preset.description,
            parameters: preset.parameters,
            is_active: preset.isActive,
            sort_order: preset.sortOrder,
            created_at: preset.createdAt.toISOString(),
            updated_at: preset.updatedAt.toISOString(),
          })),
          total: presets.length,
        };
      }
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("List presets error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/v1/presets - Create a new style preset (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { name, name_ko, category, description, parameters, is_active, sort_order } = body;

    if (!name || !category || !parameters) {
      return NextResponse.json(
        { detail: "name, category, and parameters are required" },
        { status: 400 }
      );
    }

    const preset = await withRetry(() => prisma.stylePreset.create({
      data: {
        name,
        nameKo: name_ko,
        category,
        description,
        parameters,
        isActive: is_active ?? true,
        sortOrder: sort_order ?? 0,
      },
    }));

    // Invalidate presets cache
    await invalidatePattern("presets:styles:*");

    return NextResponse.json({
      id: preset.id,
      name: preset.name,
      name_ko: preset.nameKo,
      category: preset.category,
      description: preset.description,
      parameters: preset.parameters,
      is_active: preset.isActive,
      sort_order: preset.sortOrder,
      created_at: preset.createdAt.toISOString(),
      updated_at: preset.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Create preset error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
