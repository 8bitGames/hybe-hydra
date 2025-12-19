import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { PublishPlatform } from "@prisma/client";
import { CacheTTL, invalidatePattern } from "@/lib/cache";
import { refreshAccessToken } from "@/lib/tiktok";
import { refreshYouTubeAccessToken } from "@/lib/youtube";

// Buffer time before token expiry to trigger refresh (5 minutes)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Check if token needs refresh (expired or about to expire)
function needsTokenRefresh(tokenExpiresAt: Date | null): boolean {
  if (!tokenExpiresAt) return true;
  return new Date().getTime() + TOKEN_REFRESH_BUFFER_MS > tokenExpiresAt.getTime();
}

// Refresh TikTok token and update database
async function refreshTikTokToken(
  accountId: string,
  refreshToken: string
): Promise<{ success: boolean; newExpiresAt?: Date; error?: string }> {
  try {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      return { success: false, error: "TikTok credentials not configured" };
    }

    const result = await refreshAccessToken(clientKey, clientSecret, refreshToken);

    if (!result.success || !result.accessToken || !result.expiresIn) {
      return { success: false, error: result.error || "Token refresh failed" };
    }

    const newExpiresAt = new Date(Date.now() + result.expiresIn * 1000);

    // Update database with new tokens
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenExpiresAt: newExpiresAt,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache since we updated tokens
    await invalidatePattern("publishing:accounts:*");

    console.log(`[TikTok Token Refresh] Successfully refreshed token for account ${accountId}`);
    return { success: true, newExpiresAt };
  } catch (error) {
    console.error(`[TikTok Token Refresh] Error refreshing token for account ${accountId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Refresh YouTube token and update database
async function refreshYouTubeToken(
  accountId: string,
  refreshToken: string
): Promise<{ success: boolean; newExpiresAt?: Date; error?: string }> {
  try {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return { success: false, error: "YouTube credentials not configured" };
    }

    const result = await refreshYouTubeAccessToken(clientId, clientSecret, refreshToken);

    if (!result.success || !result.accessToken || !result.expiresIn) {
      return { success: false, error: result.error || "Token refresh failed" };
    }

    const newExpiresAt = new Date(Date.now() + result.expiresIn * 1000);

    // Update database with new tokens (YouTube doesn't return a new refresh token)
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        accessToken: result.accessToken,
        tokenExpiresAt: newExpiresAt,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache since we updated tokens
    await invalidatePattern("publishing:accounts:*");

    console.log(`[YouTube Token Refresh] Successfully refreshed token for account ${accountId}`);
    return { success: true, newExpiresAt };
  } catch (error) {
    console.error(`[YouTube Token Refresh] Error refreshing token for account ${accountId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

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
    const skipRefresh = searchParams.get("skip_refresh") === "true";

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

    // Fetch accounts with refresh token for potential auto-refresh
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
        refreshToken: true, // Include for auto-refresh
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            scheduledPosts: true,
          },
        },
      },
    });

    // Process accounts and auto-refresh tokens if needed (TikTok and YouTube)
    const processedAccounts = await Promise.all(
      accounts.map(async (account) => {
        let tokenExpiresAt = account.tokenExpiresAt;
        let isTokenValid = tokenExpiresAt ? tokenExpiresAt > new Date() : false;

        // Auto-refresh tokens if expired/expiring and not skipped
        if (
          !skipRefresh &&
          account.refreshToken &&
          needsTokenRefresh(account.tokenExpiresAt)
        ) {
          if (account.platform === "TIKTOK") {
            console.log(`[TikTok Token Refresh] Attempting refresh for ${account.accountName}...`);
            const refreshResult = await refreshTikTokToken(account.id, account.refreshToken);

            if (refreshResult.success && refreshResult.newExpiresAt) {
              tokenExpiresAt = refreshResult.newExpiresAt;
              isTokenValid = true;
            }
          } else if (account.platform === "YOUTUBE") {
            console.log(`[YouTube Token Refresh] Attempting refresh for ${account.accountName}...`);
            const refreshResult = await refreshYouTubeToken(account.id, account.refreshToken);

            if (refreshResult.success && refreshResult.newExpiresAt) {
              tokenExpiresAt = refreshResult.newExpiresAt;
              isTokenValid = true;
            }
          }
        }

        return {
          id: account.id,
          platform: account.platform,
          account_name: account.accountName,
          account_id: account.accountId,
          profile_url: account.profileUrl,
          follower_count: account.followerCount,
          is_active: account.isActive,
          label_id: account.labelId,
          token_expires_at: tokenExpiresAt?.toISOString() || null,
          scheduled_posts_count: account._count.scheduledPosts,
          is_token_valid: isTokenValid,
          created_at: account.createdAt.toISOString(),
          updated_at: account.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({
      accounts: processedAccounts,
      total: processedAccounts.length,
    });
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
