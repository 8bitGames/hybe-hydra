import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/presets/[id] - Get a single preset
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const preset = await prisma.stylePreset.findUnique({
      where: { id },
    });

    if (!preset) {
      return NextResponse.json({ detail: "Preset not found" }, { status: 404 });
    }

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
    });
  } catch (error) {
    console.error("Get preset error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/presets/[id] - Update a preset (admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    const preset = await prisma.stylePreset.findUnique({
      where: { id },
    });

    if (!preset) {
      return NextResponse.json({ detail: "Preset not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, name_ko, category, description, parameters, is_active, sort_order } = body;

    const updatedPreset = await prisma.stylePreset.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(name_ko !== undefined && { nameKo: name_ko }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(parameters !== undefined && { parameters }),
        ...(is_active !== undefined && { isActive: is_active }),
        ...(sort_order !== undefined && { sortOrder: sort_order }),
      },
    });

    return NextResponse.json({
      id: updatedPreset.id,
      name: updatedPreset.name,
      name_ko: updatedPreset.nameKo,
      category: updatedPreset.category,
      description: updatedPreset.description,
      parameters: updatedPreset.parameters,
      is_active: updatedPreset.isActive,
      sort_order: updatedPreset.sortOrder,
      created_at: updatedPreset.createdAt.toISOString(),
      updated_at: updatedPreset.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Update preset error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/presets/[id] - Delete a preset (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    const preset = await prisma.stylePreset.findUnique({
      where: { id },
    });

    if (!preset) {
      return NextResponse.json({ detail: "Preset not found" }, { status: 404 });
    }

    await prisma.stylePreset.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Preset deleted successfully" });
  } catch (error) {
    console.error("Delete preset error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
