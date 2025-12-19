import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import {
  getYouTubeAuthorizationUrl,
  exchangeYouTubeCodeForToken,
  getYouTubeUserInfo,
} from "@/lib/youtube";
import { randomBytes } from "crypto";

// GET /api/v1/publishing/oauth/youtube - Start OAuth flow OR handle callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Check if this is a callback from Google (has code and state)
    const callbackCode = searchParams.get("code");
    const callbackState = searchParams.get("state");

    if (callbackCode && callbackState) {
      // This is a callback from Google OAuth - handle it
      return handleOAuthCallback(callbackCode, callbackState);
    }

    // Otherwise, this is a request to start OAuth flow
    console.log("[YouTube OAuth GET] Starting OAuth flow...");

    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    if (user.role === "VIEWER") {
      return NextResponse.json({ detail: "Permission denied" }, { status: 403 });
    }

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

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const oauthRedirectUri = process.env.YOUTUBE_REDIRECT_URI;

    if (!clientId || !oauthRedirectUri) {
      return NextResponse.json(
        { detail: "YouTube OAuth is not configured" },
        { status: 500 }
      );
    }

    // Generate state for CSRF protection
    const state = randomBytes(32).toString("hex");
    console.log("[YouTube OAuth GET] Generated state:", state.substring(0, 20) + "...");

    // Clean up expired states (non-blocking)
    prisma.oAuthState
      .deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
      .then((deleted) => {
        console.log("[YouTube OAuth GET] Deleted expired states:", deleted.count);
      })
      .catch((cleanupError) => {
        console.error("[YouTube OAuth GET] Error cleaning up expired states:", cleanupError);
      });

    // Store state in database with 10 minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      // Use raw SQL for more reliable write with Supabase pooler
      const createResult = await prisma.$executeRaw`
        INSERT INTO oauth_states (id, state, user_id, label_id, redirect_url, platform, expires_at, created_at)
        VALUES (gen_random_uuid(), ${state}, ${user.id}, ${labelId}, ${redirectUrl}, 'YOUTUBE', ${expiresAt}, NOW())
      `;
      console.log("[YouTube OAuth GET] Raw SQL insert result:", createResult);

      if (createResult !== 1) {
        console.error("[YouTube OAuth GET] Insert affected rows:", createResult);
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
        console.error("[YouTube OAuth GET] CRITICAL: State not found after insert!");
        return NextResponse.json(
          { detail: "Failed to verify OAuth state. Database consistency issue." },
          { status: 500 }
        );
      }

      console.log("[YouTube OAuth GET] State verified successfully");
    } catch (dbError) {
      console.error("[YouTube OAuth GET] CRITICAL: Failed to save state to database:", dbError);
      return NextResponse.json(
        { detail: "Failed to initialize OAuth flow. Database error." },
        { status: 500 }
      );
    }

    // Generate authorization URL
    const authUrl = getYouTubeAuthorizationUrl(clientId, oauthRedirectUri, state);

    return NextResponse.json({
      authorization_url: authUrl,
      state,
      message: "Redirect user to authorization_url to connect YouTube account",
    });
  } catch (error) {
    console.error("[YouTube OAuth GET] Unexpected error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// Helper function to handle OAuth callback (used by both GET redirect and POST)
async function handleOAuthCallback(code: string, state: string) {
  console.log("[YouTube OAuth Callback] Processing...");
  console.log("[YouTube OAuth Callback] State:", state?.substring(0, 20) + "...");

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
    FROM oauth_states WHERE state = ${state} AND platform = 'YOUTUBE' LIMIT 1
  `;

  const stateData = stateResults[0] || null;
  console.log("[YouTube OAuth Callback] Found state data:", !!stateData);

  if (!stateData) {
    console.error("[YouTube OAuth Callback] State not found in database");
    // Redirect to settings with error
    const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/accounts?error=invalid_state&message=${encodeURIComponent("Invalid or expired state. Please try again.")}`;
    return NextResponse.redirect(errorUrl);
  }

  // Check if state is expired
  if (new Date(stateData.expires_at) < new Date()) {
    await prisma.$executeRaw`DELETE FROM oauth_states WHERE state = ${state}`;
    const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/accounts?error=expired&message=${encodeURIComponent("OAuth session expired. Please try again.")}`;
    return NextResponse.redirect(errorUrl);
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

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[YouTube OAuth Callback] Missing YouTube credentials");
    const errorUrl = `${stateDataCamel.redirectUrl}?error=config&message=${encodeURIComponent("YouTube OAuth is not configured")}`;
    return NextResponse.redirect(errorUrl);
  }

  // Exchange code for token
  console.log("[YouTube OAuth Callback] Exchanging code for token...");
  const tokenResult = await exchangeYouTubeCodeForToken(
    clientId,
    clientSecret,
    code,
    redirectUri
  );

  console.log("[YouTube OAuth Callback] Token exchange result:", {
    success: tokenResult.success,
    error: tokenResult.error,
    hasAccessToken: !!tokenResult.accessToken,
    hasRefreshToken: !!tokenResult.refreshToken,
  });

  if (!tokenResult.success || !tokenResult.accessToken) {
    console.error("[YouTube OAuth Callback] Token exchange failed:", tokenResult.error);
    const errorUrl = `${stateDataCamel.redirectUrl}?error=token_exchange&message=${encodeURIComponent(tokenResult.error || tokenResult.errorDescription || "Failed to exchange code for token")}`;
    return NextResponse.redirect(errorUrl);
  }

  // Fetch YouTube channel info
  console.log("[YouTube OAuth Callback] Fetching YouTube channel info...");
  const userInfoResult = await getYouTubeUserInfo(tokenResult.accessToken);

  if (!userInfoResult.success || !userInfoResult.data) {
    console.error("[YouTube OAuth Callback] Failed to get YouTube channel info:", userInfoResult.error);
    const errorUrl = `${stateDataCamel.redirectUrl}?error=user_info&message=${encodeURIComponent(userInfoResult.error || "Failed to fetch YouTube channel info")}`;
    return NextResponse.redirect(errorUrl);
  }

  const youtubeChannel = userInfoResult.data;
  console.log("[YouTube OAuth Callback] Channel info:", {
    channelId: youtubeChannel.channelId,
    channelTitle: youtubeChannel.channelTitle,
  });

  // Check if account already exists
  const existingAccount = await prisma.socialAccount.findFirst({
    where: {
      platform: "YOUTUBE",
      accountId: youtubeChannel.channelId,
    },
  });

  let socialAccount;

  console.log("[YouTube OAuth Callback] Creating/updating social account for:", youtubeChannel.channelTitle);

  if (existingAccount) {
    // Update existing account
    socialAccount = await prisma.socialAccount.update({
      where: { id: existingAccount.id },
      data: {
        accountName: youtubeChannel.channelTitle,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        tokenExpiresAt: tokenResult.expiresIn
          ? new Date(Date.now() + tokenResult.expiresIn * 1000)
          : null,
        profileUrl: youtubeChannel.channelUrl,
        isActive: true,
      },
    });
  } else {
    // Create new account
    socialAccount = await prisma.socialAccount.create({
      data: {
        platform: "YOUTUBE",
        accountId: youtubeChannel.channelId,
        accountName: youtubeChannel.channelTitle,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        tokenExpiresAt: tokenResult.expiresIn
          ? new Date(Date.now() + tokenResult.expiresIn * 1000)
          : null,
        profileUrl: youtubeChannel.channelUrl,
        labelId: stateDataCamel.labelId,
        createdBy: stateDataCamel.userId,
        isActive: true,
      },
    });
  }

  console.log("[YouTube OAuth Callback] Success! Account ID:", socialAccount.id);

  // Redirect to the original redirect URL with success
  const successUrl = `${stateDataCamel.redirectUrl}?success=true&platform=youtube&account=${encodeURIComponent(youtubeChannel.channelTitle)}`;
  return NextResponse.redirect(successUrl);
}

// POST /api/v1/publishing/oauth/youtube - Handle OAuth callback (API style)
export async function POST(request: NextRequest) {
  try {
    console.log("[YouTube OAuth POST] Processing callback...");

    const body = await request.json();
    const { code, state } = body;
    console.log("[YouTube OAuth POST] Received state:", state?.substring(0, 20) + "...");

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
      FROM oauth_states WHERE state = ${state} AND platform = 'YOUTUBE' LIMIT 1
    `;

    const stateData = stateResults[0] || null;
    console.log("[YouTube OAuth POST] Found state data:", !!stateData);

    if (!stateData) {
      console.error("[YouTube OAuth POST] State not found in database");
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

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

    console.log("[YouTube OAuth POST] Environment check:", {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      redirectUri: redirectUri,
    });

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("[YouTube OAuth POST] Missing YouTube credentials");
      return NextResponse.json(
        { detail: "YouTube OAuth is not configured" },
        { status: 500 }
      );
    }

    // Exchange code for token
    console.log("[YouTube OAuth POST] Exchanging code for token...");
    const tokenResult = await exchangeYouTubeCodeForToken(
      clientId,
      clientSecret,
      code,
      redirectUri
    );

    console.log("[YouTube OAuth POST] Token exchange result:", {
      success: tokenResult.success,
      error: tokenResult.error,
      hasAccessToken: !!tokenResult.accessToken,
      hasRefreshToken: !!tokenResult.refreshToken,
    });

    if (!tokenResult.success || !tokenResult.accessToken) {
      console.error("[YouTube OAuth POST] Token exchange failed:", tokenResult.error);
      return NextResponse.json(
        { detail: `OAuth failed: ${tokenResult.error || tokenResult.errorDescription}` },
        { status: 400 }
      );
    }

    // Fetch YouTube channel info
    console.log("[YouTube OAuth POST] Fetching YouTube channel info...");
    const userInfoResult = await getYouTubeUserInfo(tokenResult.accessToken);

    if (!userInfoResult.success || !userInfoResult.data) {
      console.error("[YouTube OAuth POST] Failed to get YouTube channel info:", userInfoResult.error);
      return NextResponse.json(
        { detail: `Failed to fetch YouTube channel info: ${userInfoResult.error}` },
        { status: 400 }
      );
    }

    const youtubeChannel = userInfoResult.data;
    console.log("[YouTube OAuth POST] Channel info:", {
      channelId: youtubeChannel.channelId,
      channelTitle: youtubeChannel.channelTitle,
    });

    // Check if account already exists
    const existingAccount = await prisma.socialAccount.findFirst({
      where: {
        platform: "YOUTUBE",
        accountId: youtubeChannel.channelId,
      },
    });

    let socialAccount;

    console.log("[YouTube OAuth POST] Creating/updating social account for:", youtubeChannel.channelTitle);

    if (existingAccount) {
      // Update existing account
      socialAccount = await prisma.socialAccount.update({
        where: { id: existingAccount.id },
        data: {
          accountName: youtubeChannel.channelTitle,
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          tokenExpiresAt: tokenResult.expiresIn
            ? new Date(Date.now() + tokenResult.expiresIn * 1000)
            : null,
          profileUrl: youtubeChannel.channelUrl,
          isActive: true,
        },
      });
    } else {
      // Create new account
      socialAccount = await prisma.socialAccount.create({
        data: {
          platform: "YOUTUBE",
          accountId: youtubeChannel.channelId,
          accountName: youtubeChannel.channelTitle,
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          tokenExpiresAt: tokenResult.expiresIn
            ? new Date(Date.now() + tokenResult.expiresIn * 1000)
            : null,
          profileUrl: youtubeChannel.channelUrl,
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
      message: "YouTube account connected successfully",
    });
  } catch (error) {
    console.error("[YouTube OAuth POST] Unexpected error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
