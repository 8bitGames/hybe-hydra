/**
 * Instagram Graph API Service
 * https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 *
 * Instagram Reels Publishing Requirements:
 * - Business or Creator Instagram account
 * - Connected Facebook Page
 * - 2-step process: Create container → Publish
 * - Video: 3-90 seconds, recommended ≤60 seconds
 * - Aspect ratio: 9:16 (vertical)
 * - Max file size: 1GB
 */

const INSTAGRAM_OAUTH_BASE = "https://api.instagram.com";
const INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com";
const FACEBOOK_GRAPH_BASE = "https://graph.facebook.com/v21.0";

// Instagram API Types
export interface InstagramTokenResult {
  success: boolean;
  accessToken?: string;
  userId?: string;
  expiresIn?: number;
  error?: string;
  errorDescription?: string;
}

export interface InstagramUserInfo {
  id: string;
  username: string;
  name?: string;
  accountType: "BUSINESS" | "MEDIA_CREATOR" | "PERSONAL";
  profilePictureUrl?: string;
  followersCount?: number;
  mediaCount?: number;
}

export interface InstagramContainerResult {
  success: boolean;
  containerId?: string;
  error?: string;
  errorCode?: number;
  errorSubcode?: number;
}

export interface InstagramContainerStatus {
  status: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";
  statusCode?: string;
}

export interface InstagramPublishResult {
  success: boolean;
  mediaId?: string;
  permalink?: string;
  error?: string;
  errorCode?: number;
}

export interface InstagramReelSettings {
  shareToFeed?: boolean;
  coverUrl?: string;
  thumbOffset?: number; // Cover frame offset in ms
  locationId?: string;
  collaboratorUsernames?: string[];
}

/**
 * Generate Instagram OAuth authorization URL
 * Uses Facebook Login for Instagram
 */
export function getInstagramAuthorizationUrl(
  appId: string,
  redirectUri: string,
  state: string
): string {
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state: state,
  });

  // Use Facebook OAuth for Instagram Business accounts
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange authorization code for short-lived access token
 */
export async function exchangeInstagramCodeForToken(
  appId: string,
  appSecret: string,
  code: string,
  redirectUri: string
): Promise<InstagramTokenResult> {
  try {
    console.log("[Instagram] Exchanging code for token...");

    // Facebook OAuth token exchange
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code: code,
    });

    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/oauth/access_token?${params.toString()}`
    );

    const data = await response.json();

    if (data.error) {
      console.error("[Instagram] Token exchange error:", data.error);
      return {
        success: false,
        error: data.error.message,
        errorDescription: data.error.error_user_msg,
      };
    }

    console.log("[Instagram] Got short-lived token, exchanging for long-lived...");

    // Exchange for long-lived token
    const longLivedResult = await exchangeForLongLivedToken(
      appId,
      appSecret,
      data.access_token
    );

    return longLivedResult;
  } catch (error) {
    console.error("[Instagram] exchangeInstagramCodeForToken error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
export async function exchangeForLongLivedToken(
  appId: string,
  appSecret: string,
  shortLivedToken: string
): Promise<InstagramTokenResult> {
  try {
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/oauth/access_token?${params.toString()}`
    );

    const data = await response.json();

    if (data.error) {
      console.error("[Instagram] Long-lived token exchange error:", data.error);
      return {
        success: false,
        error: data.error.message,
      };
    }

    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in, // Usually 5184000 (60 days)
    };
  } catch (error) {
    console.error("[Instagram] exchangeForLongLivedToken error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Refresh long-lived token (extends by 60 days)
 * Can only be done once per 24 hours
 */
export async function refreshInstagramToken(
  accessToken: string
): Promise<InstagramTokenResult> {
  try {
    const params = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: accessToken,
    });

    const response = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/refresh_access_token?${params.toString()}`
    );

    const data = await response.json();

    if (data.error) {
      console.error("[Instagram] Token refresh error:", data.error);
      return {
        success: false,
        error: data.error.message,
      };
    }

    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error("[Instagram] refreshInstagramToken error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get Instagram Business Account ID from Facebook Page
 */
export async function getInstagramAccountFromPage(
  accessToken: string
): Promise<{ success: boolean; instagramAccountId?: string; pageId?: string; error?: string }> {
  try {
    // First get user's pages
    const pagesResponse = await fetch(
      `${FACEBOOK_GRAPH_BASE}/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      return {
        success: false,
        error: pagesData.error.message,
      };
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      return {
        success: false,
        error: "No Facebook Pages found. Instagram Business accounts require a connected Facebook Page.",
      };
    }

    // Get Instagram Business Account from first page with Instagram connected
    for (const page of pagesData.data) {
      const igResponse = await fetch(
        `${FACEBOOK_GRAPH_BASE}/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
      );
      const igData = await igResponse.json();

      if (igData.instagram_business_account) {
        return {
          success: true,
          instagramAccountId: igData.instagram_business_account.id,
          pageId: page.id,
        };
      }
    }

    return {
      success: false,
      error: "No Instagram Business Account found connected to your Facebook Pages.",
    };
  } catch (error) {
    console.error("[Instagram] getInstagramAccountFromPage error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get Instagram account info
 */
export async function getInstagramUserInfo(
  accessToken: string,
  instagramAccountId: string
): Promise<{ success: boolean; data?: InstagramUserInfo; error?: string }> {
  try {
    const fields = "id,username,name,account_type,profile_picture_url,followers_count,media_count";
    const response = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/${instagramAccountId}?fields=${fields}&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: data.error.message,
      };
    }

    return {
      success: true,
      data: {
        id: data.id,
        username: data.username,
        name: data.name,
        accountType: data.account_type,
        profilePictureUrl: data.profile_picture_url,
        followersCount: data.followers_count,
        mediaCount: data.media_count,
      },
    };
  } catch (error) {
    console.error("[Instagram] getInstagramUserInfo error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Step 1: Create a media container for Reels
 * Returns a container ID that needs to be polled for status
 */
export async function createReelsContainer(
  accessToken: string,
  instagramAccountId: string,
  videoUrl: string,
  caption: string,
  settings?: InstagramReelSettings
): Promise<InstagramContainerResult> {
  try {
    console.log("[Instagram] Creating Reels container...");

    const params: Record<string, string> = {
      media_type: "REELS",
      video_url: videoUrl,
      caption: caption.slice(0, 2200), // Instagram caption limit
      access_token: accessToken,
    };

    // Optional settings
    if (settings?.shareToFeed !== undefined) {
      params.share_to_feed = settings.shareToFeed.toString();
    }
    if (settings?.coverUrl) {
      params.cover_url = settings.coverUrl;
    }
    if (settings?.thumbOffset !== undefined) {
      params.thumb_offset = settings.thumbOffset.toString();
    }
    if (settings?.locationId) {
      params.location_id = settings.locationId;
    }
    if (settings?.collaboratorUsernames && settings.collaboratorUsernames.length > 0) {
      params.collaborators = settings.collaboratorUsernames.join(",");
    }

    const searchParams = new URLSearchParams(params);

    const response = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/${instagramAccountId}/media?${searchParams.toString()}`,
      { method: "POST" }
    );

    const data = await response.json();

    if (data.error) {
      console.error("[Instagram] Create container error:", data.error);
      return {
        success: false,
        error: data.error.message,
        errorCode: data.error.code,
        errorSubcode: data.error.error_subcode,
      };
    }

    console.log("[Instagram] Container created:", data.id);
    return {
      success: true,
      containerId: data.id,
    };
  } catch (error) {
    console.error("[Instagram] createReelsContainer error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check container status
 * Poll until status is FINISHED or ERROR
 */
export async function checkContainerStatus(
  accessToken: string,
  containerId: string
): Promise<{ success: boolean; status?: InstagramContainerStatus; error?: string }> {
  try {
    const response = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/${containerId}?fields=status,status_code&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: data.error.message,
      };
    }

    return {
      success: true,
      status: {
        status: data.status,
        statusCode: data.status_code,
      },
    };
  } catch (error) {
    console.error("[Instagram] checkContainerStatus error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Wait for container to be ready for publishing
 */
export async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  maxAttempts: number = 30,
  intervalMs: number = 10000
): Promise<{ success: boolean; ready: boolean; error?: string }> {
  console.log("[Instagram] Waiting for container to be ready...");

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await checkContainerStatus(accessToken, containerId);

    if (!result.success) {
      return { success: false, ready: false, error: result.error };
    }

    const status = result.status?.status;
    console.log(`[Instagram] Container status (attempt ${attempt + 1}/${maxAttempts}): ${status}`);

    if (status === "FINISHED") {
      return { success: true, ready: true };
    }

    if (status === "ERROR" || status === "EXPIRED") {
      return {
        success: false,
        ready: false,
        error: `Container status: ${status} - ${result.status?.statusCode}`,
      };
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    success: false,
    ready: false,
    error: "Container processing timed out",
  };
}

/**
 * Step 2: Publish the media container
 */
export async function publishContainer(
  accessToken: string,
  instagramAccountId: string,
  containerId: string
): Promise<InstagramPublishResult> {
  try {
    console.log("[Instagram] Publishing container...");

    const params = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    });

    const response = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/${instagramAccountId}/media_publish?${params.toString()}`,
      { method: "POST" }
    );

    const data = await response.json();

    if (data.error) {
      console.error("[Instagram] Publish error:", data.error);
      return {
        success: false,
        error: data.error.message,
        errorCode: data.error.code,
      };
    }

    console.log("[Instagram] Published successfully:", data.id);

    // Get permalink
    const mediaResponse = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/${data.id}?fields=permalink&access_token=${accessToken}`
    );
    const mediaData = await mediaResponse.json();

    return {
      success: true,
      mediaId: data.id,
      permalink: mediaData.permalink,
    };
  } catch (error) {
    console.error("[Instagram] publishContainer error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Full Reels publishing flow
 * Creates container → Waits for ready → Publishes
 */
export async function publishInstagramReel(
  accessToken: string,
  instagramAccountId: string,
  videoUrl: string,
  caption: string,
  hashtags: string[],
  settings?: InstagramReelSettings
): Promise<InstagramPublishResult> {
  try {
    // Combine caption with hashtags
    const fullCaption = hashtags.length > 0
      ? `${caption}\n\n${hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}`
      : caption;

    // Step 1: Create container
    const containerResult = await createReelsContainer(
      accessToken,
      instagramAccountId,
      videoUrl,
      fullCaption,
      settings
    );

    if (!containerResult.success || !containerResult.containerId) {
      return {
        success: false,
        error: containerResult.error || "Failed to create container",
        errorCode: containerResult.errorCode,
      };
    }

    // Step 2: Wait for container to be ready
    const readyResult = await waitForContainerReady(
      accessToken,
      containerResult.containerId
    );

    if (!readyResult.success || !readyResult.ready) {
      return {
        success: false,
        error: readyResult.error || "Container not ready for publishing",
      };
    }

    // Step 3: Publish
    const publishResult = await publishContainer(
      accessToken,
      instagramAccountId,
      containerResult.containerId
    );

    return publishResult;
  } catch (error) {
    console.error("[Instagram] publishInstagramReel error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get publishing quota/limits
 */
export async function getPublishingLimit(
  accessToken: string,
  instagramAccountId: string
): Promise<{ success: boolean; quotaUsage?: number; quotaTotal?: number; error?: string }> {
  try {
    const response = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/${instagramAccountId}/content_publishing_limit?fields=quota_usage,config&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: data.error.message,
      };
    }

    return {
      success: true,
      quotaUsage: data.data?.[0]?.quota_usage,
      quotaTotal: data.data?.[0]?.config?.quota_total,
    };
  } catch (error) {
    console.error("[Instagram] getPublishingLimit error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
