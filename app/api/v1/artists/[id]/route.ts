import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader, hasLabelAccess } from "@/lib/auth";
import { invalidatePattern } from "@/lib/cache";

// PATCH /api/v1/artists/[id] - Update an artist
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json(
        { detail: "Not authenticated" },
        { status: 401 }
      );
    }

    // Only ADMIN and PRODUCER can update artists
    if (user.role !== "ADMIN" && user.role !== "PRODUCER") {
      return NextResponse.json(
        { detail: "Permission denied" },
        { status: 403 }
      );
    }

    // Find the artist
    const existingArtist = await prisma.artist.findUnique({
      where: { id },
    });

    if (!existingArtist) {
      return NextResponse.json(
        { detail: "Artist not found" },
        { status: 404 }
      );
    }

    // Non-admin users can only update artists from their labels
    if (user.role !== "ADMIN" && !hasLabelAccess(user, existingArtist.labelId)) {
      return NextResponse.json(
        { detail: "You can only update artists from your assigned labels" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, stage_name, group_name, profile_description } = body;

    // Validate name if provided
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json(
        { detail: "Name cannot be empty" },
        { status: 400 }
      );
    }

    // Update the artist
    const artist = await prisma.artist.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(stage_name !== undefined && { stageName: stage_name?.trim() || null }),
        ...(group_name !== undefined && { groupName: group_name?.trim() || null }),
        ...(profile_description !== undefined && { profileDescription: profile_description?.trim() || null }),
      },
      include: {
        label: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    // Invalidate all artists list caches
    await invalidatePattern("artists:list:*");

    return NextResponse.json({
      id: artist.id,
      name: artist.name,
      stage_name: artist.stageName,
      group_name: artist.groupName,
      label_id: artist.labelId,
      profile_description: artist.profileDescription,
      profile_image_url: artist.profileImageUrl,
      label_name: artist.label.name,
      label_code: artist.label.code,
      created_at: artist.createdAt.toISOString(),
      updated_at: artist.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Update artist error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/artists/[id] - Delete an artist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json(
        { detail: "Not authenticated" },
        { status: 401 }
      );
    }

    // Only ADMIN and PRODUCER can delete artists
    if (user.role !== "ADMIN" && user.role !== "PRODUCER") {
      return NextResponse.json(
        { detail: "Permission denied" },
        { status: 403 }
      );
    }

    // Find the artist
    const existingArtist = await prisma.artist.findUnique({
      where: { id },
      include: {
        campaigns: { select: { id: true } },
      },
    });

    if (!existingArtist) {
      return NextResponse.json(
        { detail: "Artist not found" },
        { status: 404 }
      );
    }

    // Non-admin users can only delete artists from their labels
    if (user.role !== "ADMIN" && !hasLabelAccess(user, existingArtist.labelId)) {
      return NextResponse.json(
        { detail: "You can only delete artists from your assigned labels" },
        { status: 403 }
      );
    }

    // Check if artist has campaigns
    if (existingArtist.campaigns.length > 0) {
      return NextResponse.json(
        { detail: "Cannot delete artist with existing campaigns" },
        { status: 400 }
      );
    }

    // Delete the artist
    await prisma.artist.delete({
      where: { id },
    });

    // Invalidate all artists list caches
    await invalidatePattern("artists:list:*");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete artist error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
