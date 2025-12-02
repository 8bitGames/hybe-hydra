/**
 * TikTok Content Posting API Service
 * https://developers.tiktok.com/doc/content-posting-api-get-started
 */

const TIKTOK_API_BASE = "https://open.tiktokapis.com";

// TikTok API response types
export interface TikTokError {
  code: string;
  message: string;
  log_id?: string;
}

export interface TikTokCreatorInfo {
  creator_avatar_url: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

export interface TikTokPublishInit {
  publish_id: string;
  upload_url?: string; // Only for FILE_UPLOAD
}

export interface TikTokPublishStatus {
  status: "PROCESSING_UPLOAD" | "PROCESSING_DOWNLOAD" | "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE" | "FAILED";
  fail_reason?: string;
  publicaly_available_post_id?: string[];
  uploaded_bytes?: number;
}

export interface TikTokPostSettings {
  privacy_level: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
  disable_duet?: boolean;
  disable_comment?: boolean;
  disable_stitch?: boolean;
  video_cover_timestamp_ms?: number;
  brand_content_toggle?: boolean;
  brand_organic_toggle?: boolean;
}

export interface TikTokPublishResult {
  success: boolean;
  publishId?: string;
  postId?: string;
  postUrl?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Get creator info to check permissions and settings
 */
export async function getCreatorInfo(accessToken: string): Promise<{
  success: boolean;
  data?: TikTokCreatorInfo;
  error?: string;
}> {
  try {
    const response = await fetch(`${TIKTOK_API_BASE}/v2/post/publish/creator_info/query/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();

    if (result.error?.code !== "ok") {
      return {
        success: false,
        error: result.error?.message || "Failed to get creator info",
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("TikTok getCreatorInfo error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Initialize video publish using PULL_FROM_URL method
 * TikTok will pull the video from a publicly accessible URL
 */
export async function initVideoPublishFromUrl(
  accessToken: string,
  videoUrl: string,
  title: string,
  settings: TikTokPostSettings
): Promise<{ success: boolean; publishId?: string; error?: string }> {
  try {
    const requestBody = {
      post_info: {
        title: title.slice(0, 2200), // TikTok max title length
        privacy_level: settings.privacy_level,
        disable_duet: settings.disable_duet ?? false,
        disable_comment: settings.disable_comment ?? false,
        disable_stitch: settings.disable_stitch ?? false,
        video_cover_timestamp_ms: settings.video_cover_timestamp_ms ?? 0,
        brand_content_toggle: settings.brand_content_toggle ?? false,
        brand_organic_toggle: settings.brand_organic_toggle ?? false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: videoUrl,
      },
    };

    const response = await fetch(`${TIKTOK_API_BASE}/v2/post/publish/video/init/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (result.error?.code !== "ok") {
      return {
        success: false,
        error: result.error?.message || "Failed to initialize video publish",
      };
    }

    return {
      success: true,
      publishId: result.data?.publish_id,
    };
  } catch (error) {
    console.error("TikTok initVideoPublishFromUrl error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Initialize video publish using FILE_UPLOAD method
 * Returns upload URL for chunked upload
 */
export async function initVideoPublishFileUpload(
  accessToken: string,
  title: string,
  videoSize: number,
  chunkSize: number,
  totalChunkCount: number,
  settings: TikTokPostSettings
): Promise<{ success: boolean; publishId?: string; uploadUrl?: string; error?: string }> {
  try {
    const requestBody = {
      post_info: {
        title: title.slice(0, 2200),
        privacy_level: settings.privacy_level,
        disable_duet: settings.disable_duet ?? false,
        disable_comment: settings.disable_comment ?? false,
        disable_stitch: settings.disable_stitch ?? false,
        video_cover_timestamp_ms: settings.video_cover_timestamp_ms ?? 0,
        brand_content_toggle: settings.brand_content_toggle ?? false,
        brand_organic_toggle: settings.brand_organic_toggle ?? false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount,
      },
    };

    const response = await fetch(`${TIKTOK_API_BASE}/v2/post/publish/video/init/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (result.error?.code !== "ok") {
      return {
        success: false,
        error: result.error?.message || "Failed to initialize video upload",
      };
    }

    return {
      success: true,
      publishId: result.data?.publish_id,
      uploadUrl: result.data?.upload_url,
    };
  } catch (error) {
    console.error("TikTok initVideoPublishFileUpload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Upload video chunk to TikTok
 * Note: This is for FILE_UPLOAD method. For most cases, use PULL_FROM_URL instead.
 */
export async function uploadVideoChunk(
  uploadUrl: string,
  videoData: ArrayBuffer,
  startByte: number,
  endByte: number,
  totalSize: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoData.byteLength),
        "Content-Range": `bytes ${startByte}-${endByte}/${totalSize}`,
      },
      body: videoData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Upload failed: ${response.status} - ${errorText}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("TikTok uploadVideoChunk error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check publish status
 */
export async function getPublishStatus(
  accessToken: string,
  publishId: string
): Promise<{ success: boolean; data?: TikTokPublishStatus; error?: string }> {
  try {
    const response = await fetch(`${TIKTOK_API_BASE}/v2/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    const result = await response.json();

    if (result.error?.code !== "ok") {
      return {
        success: false,
        error: result.error?.message || "Failed to get publish status",
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("TikTok getPublishStatus error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Poll publish status until complete or failed
 */
export async function waitForPublishComplete(
  accessToken: string,
  publishId: string,
  maxAttempts: number = 30,
  intervalMs: number = 5000
): Promise<TikTokPublishResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusResult = await getPublishStatus(accessToken, publishId);

    if (!statusResult.success) {
      return {
        success: false,
        publishId,
        error: statusResult.error,
      };
    }

    const status = statusResult.data!;

    switch (status.status) {
      case "PUBLISH_COMPLETE":
        const postId = status.publicaly_available_post_id?.[0];
        return {
          success: true,
          publishId,
          postId,
          postUrl: postId ? `https://www.tiktok.com/@username/video/${postId}` : undefined,
        };

      case "FAILED":
        return {
          success: false,
          publishId,
          error: status.fail_reason || "Publish failed",
        };

      case "PROCESSING_UPLOAD":
      case "PROCESSING_DOWNLOAD":
      case "SEND_TO_USER_INBOX":
        // Still processing, wait and retry
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        break;
    }
  }

  return {
    success: false,
    publishId,
    error: "Publish timed out",
  };
}

/**
 * Publish video to TikTok using URL pull method (recommended)
 * This is the main function to use for publishing
 */
export async function publishVideoToTikTok(
  accessToken: string,
  videoUrl: string,
  caption: string,
  hashtags: string[],
  settings?: Partial<TikTokPostSettings>
): Promise<TikTokPublishResult> {
  try {
    // Build title with caption and hashtags
    const hashtagsStr = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    const title = `${caption} ${hashtagsStr}`.trim();

    // Default settings for TikTok posts
    const postSettings: TikTokPostSettings = {
      privacy_level: settings?.privacy_level || "PUBLIC_TO_EVERYONE",
      disable_duet: settings?.disable_duet ?? false,
      disable_comment: settings?.disable_comment ?? false,
      disable_stitch: settings?.disable_stitch ?? false,
      video_cover_timestamp_ms: settings?.video_cover_timestamp_ms ?? 1000,
      brand_content_toggle: settings?.brand_content_toggle ?? false,
      brand_organic_toggle: settings?.brand_organic_toggle ?? false,
    };

    // Initialize publish
    const initResult = await initVideoPublishFromUrl(accessToken, videoUrl, title, postSettings);

    if (!initResult.success || !initResult.publishId) {
      return {
        success: false,
        error: initResult.error || "Failed to initialize publish",
      };
    }

    // Wait for publish to complete (polling)
    const result = await waitForPublishComplete(accessToken, initResult.publishId);

    return result;
  } catch (error) {
    console.error("TikTok publishVideoToTikTok error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Refresh TikTok access token
 */
export async function refreshAccessToken(
  clientKey: string,
  clientSecret: string,
  refreshToken: string
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: result.error_description || result.error,
      };
    }

    return {
      success: true,
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresIn: result.expires_in,
    };
  } catch (error) {
    console.error("TikTok refreshAccessToken error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate TikTok OAuth authorization URL
 */
export function getAuthorizationUrl(
  clientKey: string,
  redirectUri: string,
  state: string,
  codeVerifier?: string
): string {
  const scope = "video.publish,user.info.basic";

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope,
    redirect_uri: redirectUri,
    state,
  });

  if (codeVerifier) {
    // PKCE flow
    params.append("code_challenge", codeVerifier);
    params.append("code_challenge_method", "S256");
  }

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  clientKey: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  openId?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
  error?: string;
}> {
  try {
    const params: Record<string, string> = {
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    if (codeVerifier) {
      params.code_verifier = codeVerifier;
    }

    const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: result.error_description || result.error,
      };
    }

    return {
      success: true,
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      openId: result.open_id,
      expiresIn: result.expires_in,
      refreshExpiresIn: result.refresh_expires_in,
    };
  } catch (error) {
    console.error("TikTok exchangeCodeForToken error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
