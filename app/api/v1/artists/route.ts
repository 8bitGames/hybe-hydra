import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader, hasLabelAccess } from "@/lib/auth";
import { cached, CacheKeys, CacheTTL } from "@/lib/cache";

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
