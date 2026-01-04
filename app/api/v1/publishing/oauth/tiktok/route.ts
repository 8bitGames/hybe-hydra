import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getAuthorizationUrl, exchangeCodeForToken, getCreatorInfo } from "@/lib/tiktok";
import { randomBytes } from "crypto";

// GET /api/v1/publishing/oauth/tiktok - Start OAuth flow
export async function GET(request: NextRequest) {
  try {
    console.log("[TikTok OAuth GET] Starting OAuth flow...");

    const user = await getUserFromRequest(request);

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

    // Clean up expired states (non-blocking)
    withRetry(() =>
      prisma.oAuthState.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
    )
      .then((deleted) => {
        console.log("[TikTok OAuth GET] Deleted expired states:", deleted.count);
      })
      .catch((cleanupError) => {
        console.error("[TikTok OAuth GET] Error cleaning up expired states:", cleanupError);
      });

    // Store state in database with transaction to ensure consistency
    // Use 10 minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      // Use raw SQL for more reliable write with Supabase pooler
      const createResult = await withRetry(() =>
        prisma.$executeRaw`
          INSERT INTO oauth_states (id, state, user_id, label_id, redirect_url, platform, expires_at, created_at)
          VALUES (gen_random_uuid(), ${state}, ${user.id}, ${labelId}, ${redirectUrl}, 'TIKTOK', ${expiresAt}, NOW())
        `
      );
      console.log("[TikTok OAuth GET] Raw SQL insert result:", createResult);

      if (createResult !== 1) {
        console.error("[TikTok OAuth GET] Insert affected rows:", createResult);
        return NextResponse.json(
          { detail: "Failed to save OAuth state. Please try again." },
          { status: 500 }
        );
      }

      // Verify state was actually saved with a direct query
      const verifyResult = await withRetry(() =>
        prisma.$queryRaw<Array<{ state: string }>>`
          SELECT state FROM oauth_states WHERE state = ${state} LIMIT 1
        `
      );
      console.log("[TikTok OAuth GET] Verify result:", verifyResult);

      if (!verifyResult || verifyResult.length === 0) {
        console.error("[TikTok OAuth GET] CRITICAL: State not found after insert!");
        return NextResponse.json(
          { detail: "Failed to verify OAuth state. Database consistency issue." },
          { status: 500 }
        );
      }

      console.log("[TikTok OAuth GET] State verified successfully:", state.substring(0, 20) + "...");
    } catch (dbError) {
      console.error("[TikTok OAuth GET] CRITICAL: Failed to save state to database:", dbError);
      return NextResponse.json(
        { detail: "Failed to initialize OAuth flow. Database error." },
        { status: 500 }
      );
    }

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
    console.log("[TikTok OAuth POST] DATABASE_URL configured:", !!process.env.DATABASE_URL);

    const body = await request.json();
    const { code, state } = body;
    console.log("[TikTok OAuth POST] Received state:", state?.substring(0, 20) + "...");
    console.log("[TikTok OAuth POST] Received code:", code?.substring(0, 20) + "...");

    if (!code || !state) {
      return NextResponse.json({ detail: "code and state are required" }, { status: 400 });
    }

    // Check all existing states in database for debugging using raw SQL
    let allStates: Array<{ state: string; platform: string; created_at: Date }> = [];
    try {
      allStates = await withRetry(() =>
        prisma.$queryRaw<Array<{ state: string; platform: string; created_at: Date }>>`
          SELECT state, platform, created_at FROM oauth_states ORDER BY created_at DESC LIMIT 10
        `
      );
      console.log("[TikTok OAuth POST] All states in DB:", allStates.length, allStates.map(s => s.state.substring(0, 20) + "..."));
    } catch (dbError) {
      console.error("[TikTok OAuth POST] DB query error:", dbError);
      return NextResponse.json(
        { detail: "Database connection error. Please try again." },
        { status: 500 }
      );
    }

    // Retrieve and validate state from database using raw SQL
    const stateResults = await withRetry(() =>
      prisma.$queryRaw<
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
        FROM oauth_states WHERE state = ${state} LIMIT 1
      `
    );

    const stateData = stateResults[0] || null;
    console.log("[TikTok OAuth POST] Found state data:", !!stateData, stateData ? `userId: ${stateData.user_id}` : "");

    // Additional debug: check if state exists with different casing or trimming
    if (!stateData && allStates.length > 0) {
      const matchingState = allStates.find(s => s.state === state);
      const similarState = allStates.find(s => s.state.includes(state.substring(0, 10)));
      console.log("[TikTok OAuth POST] Exact match in allStates:", !!matchingState);
      console.log("[TikTok OAuth POST] Similar state found:", !!similarState);
      console.log("[TikTok OAuth POST] Requested state length:", state.length);
      console.log("[TikTok OAuth POST] DB states lengths:", allStates.map(s => s.state.length));
    }

    if (!stateData) {
      console.error("[TikTok OAuth POST] State not found in database. Requested:", state);
      return NextResponse.json(
        { detail: "Invalid or expired state. Please restart OAuth flow." },
        { status: 400 }
      );
    }

    // Check if state is expired
    if (new Date(stateData.expires_at) < new Date()) {
      // Clean up expired state
      await withRetry(() => prisma.$executeRaw`DELETE FROM oauth_states WHERE state = ${state}`);
      return NextResponse.json(
        { detail: "OAuth state expired. Please restart OAuth flow." },
        { status: 400 }
      );
    }

    // Delete used state (one-time use) - use raw SQL
    await withRetry(() => prisma.$executeRaw`DELETE FROM oauth_states WHERE state = ${state}`);

    // Map snake_case to camelCase for rest of the code
    const stateDataCamel = {
      userId: stateData.user_id,
      labelId: stateData.label_id,
      redirectUrl: stateData.redirect_url,
      platform: stateData.platform,
      expiresAt: stateData.expires_at,
    };

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    console.log("[TikTok OAuth POST] Environment check:", {
      hasClientKey: !!clientKey,
      hasClientSecret: !!clientSecret,
      redirectUri: redirectUri,
    });

    if (!clientKey || !clientSecret || !redirectUri) {
      console.error("[TikTok OAuth POST] Missing TikTok credentials");
      return NextResponse.json(
        { detail: "TikTok OAuth is not configured" },
        { status: 500 }
      );
    }

    // Exchange code for token
    console.log("[TikTok OAuth POST] Exchanging code for token...");
    console.log("[TikTok OAuth POST] Code length:", code.length);
    const tokenResult = await exchangeCodeForToken(
      clientKey,
      clientSecret,
      code,
      redirectUri
    );

    console.log("[TikTok OAuth POST] Token exchange result:", {
      success: tokenResult.success,
      error: tokenResult.error,
      hasAccessToken: !!tokenResult.accessToken,
      hasRefreshToken: !!tokenResult.refreshToken,
      openId: tokenResult.openId,
    });

    if (!tokenResult.success) {
      console.error("[TikTok OAuth POST] Token exchange failed:", tokenResult.error);
      return NextResponse.json(
        { detail: `OAuth failed: ${tokenResult.error}` },
        { status: 400 }
      );
    }

    // Fetch user info from TikTok (basic info)
    console.log("[TikTok OAuth POST] Fetching user info with token:", tokenResult.accessToken?.substring(0, 20) + "...");
    const userInfoResponse = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      }
    );

    console.log("[TikTok OAuth POST] User info response status:", userInfoResponse.status);
    const userInfoResult = await userInfoResponse.json();
    console.log("[TikTok OAuth POST] User info result:", JSON.stringify(userInfoResult));
    const tiktokUser = userInfoResult.data?.user;

    if (!tiktokUser) {
      console.error("[TikTok OAuth POST] Failed to get TikTok user - response:", JSON.stringify(userInfoResult));
      return NextResponse.json(
        { detail: `Failed to fetch TikTok user info: ${userInfoResult.error?.message || JSON.stringify(userInfoResult)}` },
        { status: 400 }
      );
    }

    // Fetch creator info to get username (available via video.publish scope)
    console.log("[TikTok OAuth POST] Fetching creator info for username...");
    const creatorInfoResult = await getCreatorInfo(tokenResult.accessToken!);
    console.log("[TikTok OAuth POST] Creator info result:", JSON.stringify(creatorInfoResult));
    const creatorUsername = creatorInfoResult.data?.creator_username;

    // Check if account already exists
    const existingAccount = await withRetry(() =>
      prisma.socialAccount.findFirst({
        where: {
          platform: "TIKTOK",
          accountId: tokenResult.openId,
        },
      })
    );

    let socialAccount;

    console.log("[TikTok OAuth POST] Creating/updating social account for:", tiktokUser.display_name);

    // Use creator_username for profile URL, fallback to display_name or openId if not available
    // In sandbox mode, creator_info might not work, so display_name is the fallback
    const profileUsername = creatorUsername || tiktokUser.display_name || tokenResult.openId;

    if (existingAccount) {
      // Update existing account
      socialAccount = await withRetry(() =>
        prisma.socialAccount.update({
          where: { id: existingAccount.id },
          data: {
            accountName: tiktokUser.display_name || "TikTok User",
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
            tokenExpiresAt: tokenResult.expiresIn
              ? new Date(Date.now() + tokenResult.expiresIn * 1000)
              : null,
            profileUrl: `https://www.tiktok.com/@${profileUsername}`,
            isActive: true,
          },
        })
      );
    } else {
      // Create new account
      socialAccount = await withRetry(() =>
        prisma.socialAccount.create({
          data: {
            platform: "TIKTOK",
            accountId: tokenResult.openId!,
            accountName: tiktokUser.display_name || "TikTok User",
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
            tokenExpiresAt: tokenResult.expiresIn
              ? new Date(Date.now() + tokenResult.expiresIn * 1000)
              : null,
            profileUrl: `https://www.tiktok.com/@${profileUsername}`,
            labelId: stateDataCamel.labelId,
            createdBy: stateDataCamel.userId,
            isActive: true,
          },
        })
      );
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
      message: "TikTok account connected successfully",
    });
  } catch (error) {
    console.error("TikTok OAuth callback error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
