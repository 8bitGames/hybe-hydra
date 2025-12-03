import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { invalidatePattern } from "@/lib/cache";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/publishing/accounts/[id] - Get a specific social account
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const account = await prisma.socialAccount.findUnique({
      where: { id },
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountId: true,
        profileUrl: true,
        followerCount: true,
        isActive: true,
        labelId: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            scheduledPosts: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ detail: "Account not found" }, { status: 404 });
    }

    // Check access
    if (user.role !== "ADMIN" && !user.labelIds.includes(account.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      id: account.id,
      platform: account.platform,
      account_name: account.accountName,
      account_id: account.accountId,
      profile_url: account.profileUrl,
      follower_count: account.followerCount,
      is_active: account.isActive,
      label_id: account.labelId,
      token_expires_at: account.tokenExpiresAt?.toISOString() || null,
      scheduled_posts_count: account._count.scheduledPosts,
      is_token_valid: account.tokenExpiresAt ? account.tokenExpiresAt > new Date() : false,
      created_at: account.createdAt.toISOString(),
      updated_at: account.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Get social account error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/publishing/accounts/[id] - Disconnect a social account
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Only admin and producer can disconnect accounts
    if (user.role === "VIEWER") {
      return NextResponse.json({ detail: "Permission denied" }, { status: 403 });
    }

    const { id } = await params;

    // Find the account
    const account = await prisma.socialAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            scheduledPosts: {
              where: {
                status: { in: ["DRAFT", "SCHEDULED", "PUBLISHING"] },
              },
            },
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ detail: "Account not found" }, { status: 404 });
    }

    // Check access
    if (user.role !== "ADMIN" && !user.labelIds.includes(account.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    // Soft delete by setting isActive to false and clearing tokens
    await prisma.socialAccount.update({
      where: { id },
      data: {
        isActive: false,
        accessToken: null,
        refreshToken: null,
      },
    });

    // Cancel any pending scheduled posts for this account
    await prisma.scheduledPost.updateMany({
      where: {
        socialAccountId: id,
        status: { in: ["DRAFT", "SCHEDULED"] },
      },
      data: {
        status: "CANCELLED",
      },
    });

    // Invalidate publishing accounts cache
    await invalidatePattern("publishing:accounts:*");

    return NextResponse.json({
      success: true,
      message: "Social account disconnected successfully",
      cancelled_posts: account._count.scheduledPosts,
    });
  } catch (error) {
    console.error("Disconnect social account error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
