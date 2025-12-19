import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import {
  getInstagramAuthorizationUrl,
  exchangeInstagramCodeForToken,
  getInstagramAccountFromPage,
  getInstagramUserInfo,
} from "@/lib/instagram";
import { randomBytes } from "crypto";

// GET /api/v1/publishing/oauth/instagram - Start OAuth flow
export async function GET(request: NextRequest) {
  try {
    console.log("[Instagram OAuth GET] Starting OAuth flow...");

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
    const redirectUrl =
      searchParams.get("redirect_url") || `${process.env.NEXT_PUBLIC_APP_URL}/settings/accounts`;

    if (!labelId) {
      return NextResponse.json({ detail: "label_id is required" }, { status: 400 });
    }

    // Verify user has access to the label
    if (user.role !== "ADMIN" && !user.labelIds.includes(labelId)) {
      return NextResponse.json({ detail: "Access denied to this label" }, { status: 403 });
    }

    const appId = process.env.INSTAGRAM_APP_ID;
    const oauthRedirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!appId || !oauthRedirectUri) {
      return NextResponse.json(
        { detail: "Instagram OAuth is not configured" },
        { status: 500 }
      );
    }

    // Generate state for CSRF protection
    const state = randomBytes(32).toString("hex");
    console.log("[Instagram OAuth GET] Generated state:", state.substring(0, 20) + "...");

    // Clean up expired states (non-blocking)
    prisma.oAuthState
      .deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
      .then((deleted) => {
        console.log("[Instagram OAuth GET] Deleted expired states:", deleted.count);
      })
      .catch((cleanupError) => {
        console.error("[Instagram OAuth GET] Error cleaning up expired states:", cleanupError);
      });

    // Store state in database with 10 minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      // Use raw SQL for more reliable write with Supabase pooler
      const createResult = await prisma.$executeRaw`
        INSERT INTO oauth_states (id, state, user_id, label_id, redirect_url, platform, expires_at, created_at)
        VALUES (gen_random_uuid(), ${state}, ${user.id}, ${labelId}, ${redirectUrl}, 'INSTAGRAM', ${expiresAt}, NOW())
      `;
      console.log("[Instagram OAuth GET] Raw SQL insert result:", createResult);

      if (createResult !== 1) {
        console.error("[Instagram OAuth GET] Insert affected rows:", createResult);
        return NextResponse.json(
          { detail: "Failed to save OAuth state. Please try again." },
          { status: 500 }
        );
      }

      // Verify state was actually saved
      const verifyResult = await prisma.$queryRaw<Array<{ state: string }>>`
        SELECT state FROM oauth_states WHERE state = ${state} LIMIT 1
      `;

      if (!verifyResult || verifyResult.length === 0) {
        console.error("[Instagram OAuth GET] CRITICAL: State not found after insert!");
        return NextResponse.json(
          { detail: "Failed to verify OAuth state. Database consistency issue." },
          { status: 500 }
        );
      }

      console.log("[Instagram OAuth GET] State verified successfully");
    } catch (dbError) {
      console.error("[Instagram OAuth GET] CRITICAL: Failed to save state to database:", dbError);
      return NextResponse.json(
        { detail: "Failed to initialize OAuth flow. Database error." },
        { status: 500 }
      );
    }

    // Generate authorization URL
    const authUrl = getInstagramAuthorizationUrl(appId, oauthRedirectUri, state);

    return NextResponse.json({
      authorization_url: authUrl,
      state,
      message: "Redirect user to authorization_url to connect Instagram account",
    });
  } catch (error) {
    console.error("[Instagram OAuth GET] Unexpected error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// POST /api/v1/publishing/oauth/instagram - Handle OAuth callback
export async function POST(request: NextRequest) {
  try {
    console.log("[Instagram OAuth POST] Processing callback...");

    const body = await request.json();
    const { code, state } = body;
    console.log("[Instagram OAuth POST] Received state:", state?.substring(0, 20) + "...");

    if (!code || !state) {
      return NextResponse.json({ detail: "code and state are required" }, { status: 400 });
    }

    // Retrieve and validate state from database
    const stateResults = await prisma.$queryRaw<
      Array<{
        id: string;
        state: string;
        user_id: string;
        label_id: string;
        redirect_url: string;
        platform: string;
        expires_at: Date;
      }>
    >`
      SELECT id, state, user_id, label_id, redirect_url, platform, expires_at
      FROM oauth_states WHERE state = ${state} AND platform = 'INSTAGRAM' LIMIT 1
    `;

    const stateData = stateResults[0] || null;
    console.log("[Instagram OAuth POST] Found state data:", !!stateData);

    if (!stateData) {
      console.error("[Instagram OAuth POST] State not found in database");
      return NextResponse.json(
        { detail: "Invalid or expired state. Please restart OAuth flow." },
        { status: 400 }
      );
    }

    // Check if state is expired
    if (new Date(stateData.expires_at) < new Date()) {
      await prisma.$executeRaw`DELETE FROM oauth_states WHERE state = ${state}`;
      return NextResponse.json(
        { detail: "OAuth state expired. Please restart OAuth flow." },
        { status: 400 }
      );
    }

    // Delete used state (one-time use)
    await prisma.$executeRaw`DELETE FROM oauth_states WHERE state = ${state}`;

    const stateDataCamel = {
      userId: stateData.user_id,
      labelId: stateData.label_id,
      redirectUrl: stateData.redirect_url,
      platform: stateData.platform,
      expiresAt: stateData.expires_at,
    };

    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    console.log("[Instagram OAuth POST] Environment check:", {
      hasAppId: !!appId,
      hasAppSecret: !!appSecret,
      redirectUri: redirectUri,
    });

    if (!appId || !appSecret || !redirectUri) {
      console.error("[Instagram OAuth POST] Missing Instagram credentials");
      return NextResponse.json(
        { detail: "Instagram OAuth is not configured" },
        { status: 500 }
      );
    }

    // Exchange code for token
    console.log("[Instagram OAuth POST] Exchanging code for token...");
    const tokenResult = await exchangeInstagramCodeForToken(
      appId,
      appSecret,
      code,
      redirectUri
    );

    console.log("[Instagram OAuth POST] Token exchange result:", {
      success: tokenResult.success,
      error: tokenResult.error,
      hasAccessToken: !!tokenResult.accessToken,
    });

    if (!tokenResult.success || !tokenResult.accessToken) {
      console.error("[Instagram OAuth POST] Token exchange failed:", tokenResult.error);
      return NextResponse.json(
        { detail: `OAuth failed: ${tokenResult.error || tokenResult.errorDescription}` },
        { status: 400 }
      );
    }

    // Get Instagram Business Account from connected Facebook Page
    console.log("[Instagram OAuth POST] Getting Instagram account from Facebook Page...");
    const accountResult = await getInstagramAccountFromPage(tokenResult.accessToken);

    if (!accountResult.success || !accountResult.instagramAccountId) {
      console.error("[Instagram OAuth POST] Failed to get Instagram account:", accountResult.error);
      return NextResponse.json(
        { detail: `Failed to get Instagram account: ${accountResult.error}` },
        { status: 400 }
      );
    }

    // Fetch Instagram user info
    console.log("[Instagram OAuth POST] Fetching Instagram user info...");
    const userInfoResult = await getInstagramUserInfo(
      tokenResult.accessToken,
      accountResult.instagramAccountId
    );

    if (!userInfoResult.success || !userInfoResult.data) {
      console.error("[Instagram OAuth POST] Failed to get Instagram user info:", userInfoResult.error);
      return NextResponse.json(
        { detail: `Failed to fetch Instagram user info: ${userInfoResult.error}` },
        { status: 400 }
      );
    }

    const instagramUser = userInfoResult.data;
    console.log("[Instagram OAuth POST] User info:", {
      id: instagramUser.id,
      username: instagramUser.username,
      accountType: instagramUser.accountType,
    });

    // Check if account already exists
    const existingAccount = await prisma.socialAccount.findFirst({
      where: {
        platform: "INSTAGRAM",
        accountId: instagramUser.id,
      },
    });

    let socialAccount;

    console.log("[Instagram OAuth POST] Creating/updating social account for:", instagramUser.username);

    if (existingAccount) {
      // Update existing account
      socialAccount = await prisma.socialAccount.update({
        where: { id: existingAccount.id },
        data: {
          accountName: instagramUser.username,
          accessToken: tokenResult.accessToken,
          tokenExpiresAt: tokenResult.expiresIn
            ? new Date(Date.now() + tokenResult.expiresIn * 1000)
            : null,
          profileUrl: `https://instagram.com/${instagramUser.username}`,
          isActive: true,
        },
      });
    } else {
      // Create new account
      socialAccount = await prisma.socialAccount.create({
        data: {
          platform: "INSTAGRAM",
          accountId: instagramUser.id,
          accountName: instagramUser.username,
          accessToken: tokenResult.accessToken,
          tokenExpiresAt: tokenResult.expiresIn
            ? new Date(Date.now() + tokenResult.expiresIn * 1000)
            : null,
          profileUrl: `https://instagram.com/${instagramUser.username}`,
          labelId: stateDataCamel.labelId,
          createdBy: stateDataCamel.userId,
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
      redirect_url: stateDataCamel.redirectUrl,
      message: "Instagram account connected successfully",
    });
  } catch (error) {
    console.error("[Instagram OAuth POST] Unexpected error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
