import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader, hasLabelAccess } from "@/lib/auth";

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

    // Get artists with label info
    let artists;
    if (user.role === "ADMIN") {
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
    const response = artists.map((artist) => ({
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get artists error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
