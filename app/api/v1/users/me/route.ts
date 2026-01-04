import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { cached, CacheKeys, CacheTTL, deleteCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    // Get user from cookies (primary) or Authorization header (fallback)
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { detail: "Not authenticated" },
        { status: 401 }
      );
    }

    // Cache user profile (called on every page load)
    const response = await cached(
      CacheKeys.userProfile(user.id),
      CacheTTL.USER_PROFILE, // 90 seconds
      async () => {
        // Get full user data (with retry for reliability)
        const userData = await withRetry(() =>
          prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              labelIds: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        );

        if (!userData) {
          return null;
        }

        return {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role.toLowerCase(),
          label_ids: userData.labelIds,
          is_active: userData.isActive,
          created_at: userData.createdAt.toISOString(),
          updated_at: userData.updatedAt.toISOString(),
        };
      }
    );

    if (!response) {
      return NextResponse.json(
        { detail: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get user from cookies (primary) or Authorization header (fallback)
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { detail: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    const updatedUser = await withRetry(() =>
      prisma.user.update({
        where: { id: user.id },
        data: {
          ...(name && { name }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      })
    );

    // Invalidate user profile cache
    await deleteCache(CacheKeys.userProfile(user.id));

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role.toLowerCase(),
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
