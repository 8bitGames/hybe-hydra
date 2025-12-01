import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { getAuthorizationUrl, exchangeCodeForToken } from "@/lib/tiktok";
import { randomBytes } from "crypto";

// GET /api/v1/publishing/oauth/tiktok - Start OAuth flow
export async function GET(request: NextRequest) {
  try {
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

    // Clean up expired states
    await prisma.oAuthState.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });

    // Store state in database (expires in 10 minutes)
    await prisma.oAuthState.create({
      data: {
        state,
        userId: user.id,
        labelId,
        redirectUrl,
        platform: "TIKTOK",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }
    });

    // Generate authorization URL
    const authUrl = getAuthorizationUrl(clientKey, oauthRedirectUri, state);

    return NextResponse.json({
      authorization_url: authUrl,
      state,
      message: "Redirect user to authorization_url to connect TikTok account",
    });
  } catch (error) {
    console.error("TikTok OAuth start error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// POST /api/v1/publishing/oauth/tiktok - Handle OAuth callback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state } = body;

    if (!code || !state) {
      return NextResponse.json({ detail: "code and state are required" }, { status: 400 });
    }

    // Retrieve and validate state from database
    const stateData = await prisma.oAuthState.findUnique({
      where: { state }
    });

    if (!stateData) {
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
