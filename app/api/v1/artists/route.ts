import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader, hasLabelAccess } from "@/lib/auth";
import { cached, CacheKeys, CacheTTL, invalidatePattern } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json(
        { detail: "Not authenticated" },
        { status: 401 }
      );
    }

    const isAdmin = user.role === "ADMIN";
    const cacheKey = CacheKeys.artistsList(isAdmin, user.labelIds);

    // Use cached artists list (artists rarely change)
    const response = await cached(
      cacheKey,
      CacheTTL.STATIC, // 1 hour cache
      async () => {
        // Get artists with label info
        let artists;
        if (isAdmin) {
          // Admin can see all artists
          artists = await prisma.artist.findMany({
            include: {
              label: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
            orderBy: { groupName: "asc" },
          });
        } else {
          // Non-admin only sees artists from their labels
          artists = await prisma.artist.findMany({
            where: {
              labelId: { in: user.labelIds },
            },
            include: {
              label: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
            orderBy: { groupName: "asc" },
          });
        }

        // Transform to API response format
        return artists.map((artist) => ({
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
        }));
      }
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get artists error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/v1/artists - Create a new artist
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json(
        { detail: "Not authenticated" },
        { status: 401 }
      );
    }

    // Only ADMIN and PRODUCER can create artists
    if (user.role !== "ADMIN" && user.role !== "PRODUCER") {
      return NextResponse.json(
        { detail: "Permission denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, stage_name, group_name, label_id, profile_description } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { detail: "Name is required" },
        { status: 400 }
      );
    }

    if (!label_id || typeof label_id !== "string") {
      return NextResponse.json(
        { detail: "Label ID is required" },
        { status: 400 }
      );
    }

    // Verify label exists
    const label = await prisma.label.findUnique({
      where: { id: label_id },
    });

    if (!label) {
      return NextResponse.json(
        { detail: "Label not found" },
        { status: 404 }
      );
    }

    // Non-admin users can only create artists for their own labels
    if (user.role !== "ADMIN" && !hasLabelAccess(user, label_id)) {
      return NextResponse.json(
        { detail: "You can only create artists for your assigned labels" },
        { status: 403 }
      );
    }

    // Create the artist
    const artist = await prisma.artist.create({
      data: {
        name: name.trim(),
        stageName: stage_name?.trim() || null,
        groupName: group_name?.trim() || null,
        labelId: label_id,
        profileDescription: profile_description?.trim() || null,
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

    // Return the created artist
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
    }, { status: 201 });
  } catch (error) {
    console.error("Create artist error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
