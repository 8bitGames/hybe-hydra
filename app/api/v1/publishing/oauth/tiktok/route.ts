import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { getAuthorizationUrl, exchangeCodeForToken } from "@/lib/tiktok";
import { randomBytes } from "crypto";

// GET /api/v1/publishing/oauth/tiktok - Start OAuth flow
export async function GET(request: NextRequest) {
  try {
    console.log("[TikTok OAuth GET] Starting OAuth flow...");

    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    if (user.role === "VIEWER") {
      return NextResponse.json({ detail: "Permission denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const labelId = searchParams.get("label_id");
    const redirectUrl = searchParams.get("redirect_url") || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

    if (!labelId) {
      return NextResponse.json({ detail: "label_id is required" }, { status: 400 });
    }

    // Verify user has access to the label
    if (user.role !== "ADMIN" && !user.labelIds.includes(labelId)) {
      return NextResponse.json({ detail: "Access denied to this label" }, { status: 403 });
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const oauthRedirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !oauthRedirectUri) {
      return NextResponse.json(
        { detail: "TikTok OAuth is not configured" },
        { status: 500 }
      );
    }

    // Generate state for CSRF protection
    const state = randomBytes(32).toString("hex");
    console.log("[TikTok OAuth GET] Generated state:", state);

    // Clean up expired states
    try {
      const deleted = await prisma.oAuthState.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      });
      console.log("[TikTok OAuth GET] Deleted expired states:", deleted.count);
    } catch (cleanupError) {
      console.error("[TikTok OAuth GET] Error cleaning up expired states:", cleanupError);
      // Continue even if cleanup fails
    }

    // Store state in database (expires in 10 minutes)
    try {
      const savedState = await prisma.oAuthState.create({
        data: {
          state,
          userId: user.id,
          labelId,
          redirectUrl,
          platform: "TIKTOK",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        }
      });
      console.log("[TikTok OAuth GET] State saved to database:", savedState.id);
    } catch (dbError) {
      console.error("[TikTok OAuth GET] CRITICAL: Failed to save state to database:", dbError);
      return NextResponse.json(
        { detail: "Failed to initialize OAuth flow. Database error." },
        { status: 500 }
      );
    }

    // Verify state was saved
    const verifyState = await prisma.oAuthState.findUnique({
      where: { state }
    });
    console.log("[TikTok OAuth GET] Verified state exists:", !!verifyState);

    // Generate authorization URL
    const authUrl = getAuthorizationUrl(clientKey, oauthRedirectUri, state);

    return NextResponse.json({
      authorization_url: authUrl,
      state,
      message: "Redirect user to authorization_url to connect TikTok account",
    });
  } catch (error) {
    console.error("[TikTok OAuth GET] Unexpected error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// POST /api/v1/publishing/oauth/tiktok - Handle OAuth callback
export async function POST(request: NextRequest) {
  try {
    console.log("[TikTok OAuth POST] Processing callback...");

    const body = await request.json();
    const { code, state } = body;
    console.log("[TikTok OAuth POST] Received state:", state);

    if (!code || !state) {
      return NextResponse.json({ detail: "code and state are required" }, { status: 400 });
    }

    // Check all existing states in database for debugging
    const allStates = await prisma.oAuthState.findMany();
    console.log("[TikTok OAuth POST] All states in DB:", allStates.length, allStates.map(s => s.state.substring(0, 10) + "..."));

    // Retrieve and validate state from database
    const stateData = await prisma.oAuthState.findUnique({
      where: { state }
    });
    console.log("[TikTok OAuth POST] Found state data:", !!stateData);

    if (!stateData) {
      console.error("[TikTok OAuth POST] State not found in database. Requested:", state);
      return NextResponse.json(
        { detail: "Invalid or expired state. Please restart OAuth flow." },
        { status: 400 }
      );
    }

    // Check if state is expired
    if (stateData.expiresAt < new Date()) {
      // Clean up expired state
      await prisma.oAuthState.delete({ where: { state } });
      return NextResponse.json(
        { detail: "OAuth state expired. Please restart OAuth flow." },
        { status: 400 }
      );
    }

    // Delete used state (one-time use)
    await prisma.oAuthState.delete({ where: { state } });

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { detail: "TikTok OAuth is not configured" },
        { status: 500 }
      );
    }

    // Exchange code for token
    const tokenResult = await exchangeCodeForToken(
      clientKey,
      clientSecret,
      code,
      redirectUri
    );

    if (!tokenResult.success) {
      return NextResponse.json(
        { detail: `OAuth failed: ${tokenResult.error}` },
        { status: 400 }
      );
    }

    // Fetch user info from TikTok
    const userInfoResponse = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      }
    );

    const userInfoResult = await userInfoResponse.json();
    const tiktokUser = userInfoResult.data?.user;

    if (!tiktokUser) {
      return NextResponse.json(
        { detail: "Failed to fetch TikTok user info" },
        { status: 400 }
      );
    }

    // Check if account already exists
    const existingAccount = await prisma.socialAccount.findFirst({
      where: {
        platform: "TIKTOK",
        accountId: tokenResult.openId,
      },
    });

    let socialAccount;

    if (existingAccount) {
      // Update existing account
      socialAccount = await prisma.socialAccount.update({
        where: { id: existingAccount.id },
        data: {
          accountName: tiktokUser.display_name || tiktokUser.username || "TikTok User",
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          tokenExpiresAt: tokenResult.expiresIn
            ? new Date(Date.now() + tokenResult.expiresIn * 1000)
            : null,
          profileUrl: tiktokUser.username
            ? `https://www.tiktok.com/@${tiktokUser.username}`
            : null,
          isActive: true,
        },
      });
    } else {
      // Create new account
      socialAccount = await prisma.socialAccount.create({
        data: {
          platform: "TIKTOK",
          accountId: tokenResult.openId!,
          accountName: tiktokUser.display_name || tiktokUser.username || "TikTok User",
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          tokenExpiresAt: tokenResult.expiresIn
            ? new Date(Date.now() + tokenResult.expiresIn * 1000)
            : null,
          profileUrl: tiktokUser.username
            ? `https://www.tiktok.com/@${tiktokUser.username}`
            : null,
          labelId: stateData.labelId,
          createdBy: stateData.userId,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      social_account: {
        id: socialAccount.id,
        platform: socialAccount.platform,
        account_name: socialAccount.accountName,
        profile_url: socialAccount.profileUrl,
      },
      redirect_url: stateData.redirectUrl,
      message: "TikTok account connected successfully",
    });
  } catch (error) {
    console.error("TikTok OAuth callback error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
