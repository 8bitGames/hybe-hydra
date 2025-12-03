import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { PublishPlatform } from "@prisma/client";
import { cached, CacheKeys, CacheTTL, invalidatePattern } from "@/lib/cache";

// GET /api/v1/publishing/accounts - List connected social accounts
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") as PublishPlatform | null;
    const labelId = searchParams.get("label_id");

    // Determine which labels to query
    const effectiveLabelIds = user.role !== "ADMIN"
      ? user.labelIds
      : labelId
        ? [labelId]
        : null; // null means all labels for admin

    // Create cache key based on user access and filters
    const cacheKey = `publishing:accounts:${user.role === "ADMIN" ? "admin" : user.labelIds.sort().join(",")}:${platform || "all"}:${labelId || "all"}`;

    const response = await cached(
      cacheKey,
      CacheTTL.MEDIUM, // 5 minutes - accounts don't change often
      async () => {
        // Build where clause based on user's accessible labels
        const whereClause: Record<string, unknown> = {
          isActive: true,
        };

        // Non-admin users can only see accounts from their labels
        if (user.role !== "ADMIN") {
          whereClause.labelId = { in: user.labelIds };
        } else if (labelId) {
          whereClause.labelId = labelId;
        }

        if (platform) {
          whereClause.platform = platform;
        }

        const accounts = await prisma.socialAccount.findMany({
          where: whereClause,
          orderBy: [
            { platform: "asc" },
            { accountName: "asc" },
          ],
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

        // Transform response
        return {
          accounts: accounts.map((account) => ({
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
          })),
          total: accounts.length,
        };
      }
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get social accounts error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/v1/publishing/accounts - Connect a new social account
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Only admin and producer can connect accounts
    if (user.role === "VIEWER") {
      return NextResponse.json({ detail: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const {
      platform,
      account_name,
      account_id,
      label_id,
      access_token,
      refresh_token,
      token_expires_at,
      profile_url,
      follower_count,
    } = body;

    // Validate required fields
    if (!platform || !account_name || !account_id || !label_id) {
      return NextResponse.json(
        { detail: "platform, account_name, account_id, and label_id are required" },
        { status: 400 }
      );
    }

    // Validate platform
    const validPlatforms: PublishPlatform[] = ["TIKTOK", "YOUTUBE", "INSTAGRAM", "TWITTER"];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { detail: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if user has access to this label
    if (user.role !== "ADMIN" && !user.labelIds.includes(label_id)) {
      return NextResponse.json({ detail: "Access denied to this label" }, { status: 403 });
    }

    // Check for existing account
    const existing = await prisma.socialAccount.findUnique({
      where: {
        platform_accountId: {
          platform,
          accountId: account_id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { detail: "This account is already connected" },
        { status: 409 }
      );
    }

    // Create the social account
    const account = await prisma.socialAccount.create({
      data: {
        platform,
        accountName: account_name,
        accountId: account_id,
        labelId: label_id,
        accessToken: access_token, // Should be encrypted in production
        refreshToken: refresh_token, // Should be encrypted in production
        tokenExpiresAt: token_expires_at ? new Date(token_expires_at) : null,
        profileUrl: profile_url,
        followerCount: follower_count,
        createdBy: user.id,
      },
    });

    // Invalidate publishing accounts cache
    await invalidatePattern("publishing:accounts:*");

    return NextResponse.json({
      id: account.id,
      platform: account.platform,
      account_name: account.accountName,
      account_id: account.accountId,
      profile_url: account.profileUrl,
      follower_count: account.followerCount,
      is_active: account.isActive,
      label_id: account.labelId,
      created_at: account.createdAt.toISOString(),
      message: "Social account connected successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Connect social account error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
