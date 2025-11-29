import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { MerchandiseType } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/merchandise/:id - Get single merchandise item
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const merchandise = await prisma.merchandiseItem.findUnique({
      where: { id },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            stageName: true,
            groupName: true,
            labelId: true,
          },
        },
        _count: {
          select: {
            generationMerchandise: true,
          },
        },
      },
    });

    if (!merchandise) {
      return NextResponse.json({ detail: "Merchandise not found" }, { status: 404 });
    }

    // Check RBAC access
    if (user.role !== "ADMIN" && merchandise.artist) {
      if (!user.labelIds.includes(merchandise.artist.labelId)) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    return NextResponse.json({
      id: merchandise.id,
      name: merchandise.name,
      name_ko: merchandise.nameKo,
      artist_id: merchandise.artistId,
      artist: merchandise.artist ? {
        id: merchandise.artist.id,
        name: merchandise.artist.name,
        stage_name: merchandise.artist.stageName,
        group_name: merchandise.artist.groupName,
      } : null,
      type: merchandise.type.toLowerCase(),
      description: merchandise.description,
      s3_url: merchandise.s3Url,
      thumbnail_url: merchandise.thumbnailUrl,
      file_size: merchandise.fileSize,
      release_date: merchandise.releaseDate?.toISOString(),
      metadata: merchandise.metadata,
      is_active: merchandise.isActive,
      usage_count: merchandise._count.generationMerchandise,
      created_at: merchandise.createdAt.toISOString(),
      updated_at: merchandise.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Get merchandise error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/v1/merchandise/:id - Update merchandise item
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    if (user.role === "VIEWER") {
      return NextResponse.json({ detail: "Permission denied" }, { status: 403 });
    }

    const { id } = await params;

    const merchandise = await prisma.merchandiseItem.findUnique({
      where: { id },
      include: {
        artist: {
          select: { labelId: true },
        },
      },
    });

    if (!merchandise) {
      return NextResponse.json({ detail: "Merchandise not found" }, { status: 404 });
    }

    // Check RBAC access
    if (user.role !== "ADMIN" && merchandise.artist) {
      if (!user.labelIds.includes(merchandise.artist.labelId)) {
        return NextResponse.json({ detail: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.name_ko !== undefined) updateData.nameKo = body.name_ko;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.is_active !== undefined) updateData.isActive = body.is_active;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    if (body.type !== undefined) {
      const type = body.type.toUpperCase() as MerchandiseType;
      if (!Object.values(MerchandiseType).includes(type)) {
        return NextResponse.json({
          detail: "Invalid type. Must be one of: album, photocard, lightstick, apparel, accessory, other"
        }, { status: 400 });
      }
      updateData.type = type;
    }

    if (body.release_date !== undefined) {
      if (body.release_date === null) {
        updateData.releaseDate = null;
      } else {
        const releaseDate = new Date(body.release_date);
        if (isNaN(releaseDate.getTime())) {
          return NextResponse.json({ detail: "Invalid release_date format" }, { status: 400 });
        }
        updateData.releaseDate = releaseDate;
      }
    }

    const updated = await prisma.merchandiseItem.update({
      where: { id },
      data: updateData,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            stageName: true,
            groupName: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      name_ko: updated.nameKo,
      artist_id: updated.artistId,
      artist: updated.artist ? {
        id: updated.artist.id,
        name: updated.artist.name,
        stage_name: updated.artist.stageName,
        group_name: updated.artist.groupName,
      } : null,
      type: updated.type.toLowerCase(),
      description: updated.description,
      s3_url: updated.s3Url,
      thumbnail_url: updated.thumbnailUrl,
      is_active: updated.isActive,
      metadata: updated.metadata,
      release_date: updated.releaseDate?.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
      message: "Merchandise updated successfully",
    });
  } catch (error) {
    console.error("Update merchandise error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/v1/merchandise/:id - Delete merchandise item
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Only ADMIN can delete merchandise
    if (user.role !== "ADMIN") {
      return NextResponse.json({ detail: "Only administrators can delete merchandise" }, { status: 403 });
    }

    const { id } = await params;

    const merchandise = await prisma.merchandiseItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: { generationMerchandise: true },
        },
      },
    });

    if (!merchandise) {
      return NextResponse.json({ detail: "Merchandise not found" }, { status: 404 });
    }

    // Soft delete if there are associated generations, hard delete otherwise
    if (merchandise._count.generationMerchandise > 0) {
      await prisma.merchandiseItem.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        message: "Merchandise deactivated (has associated generations)",
        deactivated: true,
      });
    }

    await prisma.merchandiseItem.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Merchandise deleted successfully",
      deleted: true,
    });
  } catch (error) {
    console.error("Delete merchandise error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
