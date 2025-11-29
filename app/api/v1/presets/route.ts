import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";

// GET /api/v1/presets - List all style presets
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("active_only") !== "false";

    const where: Record<string, unknown> = {};

    if (activeOnly) {
      where.isActive = true;
    }

    if (category) {
      where.category = category;
    }

    const presets = await prisma.stylePreset.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
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
    });
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
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

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

    const preset = await prisma.stylePreset.create({
      data: {
        name,
        nameKo: name_ko,
        category,
        description,
        parameters,
        isActive: is_active ?? true,
        sortOrder: sort_order ?? 0,
      },
    });

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
