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
  videoData: Buffer | ArrayBuffer,
  startByte: number,
  endByte: number,
  totalSize: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Convert Buffer to Uint8Array for fetch compatibility
    const bodyData = Buffer.isBuffer(videoData)
      ? new Uint8Array(videoData)
      : new Uint8Array(videoData);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(bodyData.byteLength),
        "Content-Range": `bytes ${startByte}-${endByte}/${totalSize}`,
      },
      body: bodyData,
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
      console.error("[TikTok] getPublishStatus error response:", JSON.stringify(result));
      return {
        success: false,
        error: `${result.error?.code || "unknown"}: ${result.error?.message || "Failed to get publish status"}`,
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("[TikTok] getPublishStatus exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Poll publish status until complete or failed
 * @param isInboxUpload - If true, treats SEND_TO_USER_INBOX as success (for sandbox mode)
 */
export async function waitForPublishComplete(
  accessToken: string,
  publishId: string,
  maxAttempts: number = 30,
  intervalMs: number = 5000,
  isInboxUpload: boolean = false
): Promise<TikTokPublishResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`[TikTok] Checking publish status, attempt ${attempt + 1}/${maxAttempts}`);
    const statusResult = await getPublishStatus(accessToken, publishId);

    if (!statusResult.success) {
      return {
        success: false,
        publishId,
        error: statusResult.error,
      };
    }

    const status = statusResult.data!;
    console.log(`[TikTok] Publish status: ${status.status}`, status.uploaded_bytes ? `(${status.uploaded_bytes} bytes uploaded)` : "");

    switch (status.status) {
      case "PUBLISH_COMPLETE":
        const postId = status.publicaly_available_post_id?.[0];
        console.log("[TikTok] Publish complete! Post ID:", postId);
        return {
          success: true,
          publishId,
          postId,
          postUrl: postId ? `https://www.tiktok.com/@username/video/${postId}` : undefined,
        };

      case "SEND_TO_USER_INBOX":
        // For Inbox Upload (sandbox mode), this is the success state
        // The video is sent to the user's TikTok app inbox as a draft
        if (isInboxUpload) {
          console.log("[TikTok] Video successfully sent to user's TikTok inbox (draft)!");
          return {
            success: true,
            publishId,
            postUrl: undefined, // No direct post URL for inbox uploads
          };
        }
        // For direct post, continue waiting
        console.log("[TikTok] Received SEND_TO_USER_INBOX status for direct post, waiting...");
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        break;

      case "FAILED":
        console.error("[TikTok] Publish FAILED!", status.fail_reason);
        return {
          success: false,
          publishId,
          error: status.fail_reason || "Publish failed (no reason provided)",
        };

      case "PROCESSING_UPLOAD":
      case "PROCESSING_DOWNLOAD":
        // Still processing, wait and retry
        console.log(`[TikTok] Still processing (${status.status}), waiting ${intervalMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        break;

      default:
        // Handle unexpected status - log and continue waiting
        console.warn(`[TikTok] Unexpected status received: "${status.status}", full response:`, JSON.stringify(status));
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        break;
    }
  }

  console.error(`[TikTok] Publish timed out after ${maxAttempts} attempts (${maxAttempts * intervalMs / 1000}s)`);
  return {
    success: false,
    publishId,
    error: `Publish timed out after ${maxAttempts * intervalMs / 1000} seconds`,
  };
}

/**
 * Download video from URL and return as Buffer
 */
async function downloadVideoFromUrl(videoUrl: string): Promise<{ success: boolean; data?: Buffer; size?: number; error?: string }> {
  try {
    console.log("[TikTok] Downloading video from:", videoUrl.substring(0, 100) + (videoUrl.length > 100 ? "..." : ""));

    if (!videoUrl) {
      console.error("[TikTok] Video URL is empty or undefined");
      return {
        success: false,
        error: "Video URL is empty or undefined",
      };
    }

    const response = await fetch(videoUrl);

    if (!response.ok) {
      console.error(`[TikTok] Video download failed: ${response.status} ${response.statusText}`);
      console.error(`[TikTok] Response headers:`, Object.fromEntries(response.headers.entries()));
      return {
        success: false,
        error: `Failed to download video: ${response.status} ${response.statusText}. URL may be expired or inaccessible.`,
      };
    }

    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("video")) {
      console.warn(`[TikTok] Unexpected content type: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("[TikTok] Downloaded video successfully:", buffer.length, "bytes");

    if (buffer.length === 0) {
      console.error("[TikTok] Downloaded video is empty (0 bytes)");
      return {
        success: false,
        error: "Downloaded video is empty (0 bytes)",
      };
    }

    return {
      success: true,
      data: buffer,
      size: buffer.length,
    };
  } catch (error) {
    console.error("[TikTok] downloadVideoFromUrl exception:", error);
    return {
      success: false,
      error: `Video download failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Publish video to TikTok using FILE_UPLOAD method
 * Downloads video from URL and uploads directly to TikTok
 * This method doesn't require domain verification
 */
export async function publishVideoToTikTokViaUpload(
  accessToken: string,
  videoUrl: string,
  caption: string,
  hashtags: string[],
  settings?: Partial<TikTokPostSettings>
): Promise<TikTokPublishResult> {
  try {
    // Step 1: Download video from URL
    const downloadResult = await downloadVideoFromUrl(videoUrl);
    if (!downloadResult.success || !downloadResult.data) {
      return {
        success: false,
        error: downloadResult.error || "Failed to download video",
      };
    }

    const videoBuffer = downloadResult.data;
    const videoSize = downloadResult.size!;

    // Step 2: Prepare title and settings
    const hashtagsStr = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    const title = `${caption} ${hashtagsStr}`.trim();

    const postSettings: TikTokPostSettings = {
      privacy_level: settings?.privacy_level || "PUBLIC_TO_EVERYONE",
      disable_duet: settings?.disable_duet ?? false,
      disable_comment: settings?.disable_comment ?? false,
      disable_stitch: settings?.disable_stitch ?? false,
      video_cover_timestamp_ms: settings?.video_cover_timestamp_ms ?? 1000,
      brand_content_toggle: settings?.brand_content_toggle ?? false,
      brand_organic_toggle: settings?.brand_organic_toggle ?? false,
    };

    // Step 3: Calculate chunk info
    // TikTok requires: min 5MB per chunk (except last), max 64MB, max 4GB total
    // For small videos (<5MB), use single chunk upload
    const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB minimum
    const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB default

    // If video is smaller than min chunk size, upload as single chunk
    const CHUNK_SIZE = videoSize < MIN_CHUNK_SIZE ? videoSize : DEFAULT_CHUNK_SIZE;
    const totalChunkCount = videoSize < MIN_CHUNK_SIZE ? 1 : Math.ceil(videoSize / CHUNK_SIZE);

    console.log("[TikTok] Initializing FILE_UPLOAD:", {
      videoSize,
      chunkSize: CHUNK_SIZE,
      totalChunkCount,
    });

    // Step 4: Initialize upload
    const initResult = await initVideoPublishFileUpload(
      accessToken,
      title,
      videoSize,
      CHUNK_SIZE,
      totalChunkCount,
      postSettings
    );

    if (!initResult.success || !initResult.publishId || !initResult.uploadUrl) {
      return {
        success: false,
        error: initResult.error || "Failed to initialize upload",
      };
    }

    console.log("[TikTok] Upload initialized, publishId:", initResult.publishId);

    // Step 5: Upload video in chunks
    for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++) {
      const startByte = chunkIndex * CHUNK_SIZE;
      const endByte = Math.min(startByte + CHUNK_SIZE - 1, videoSize - 1);
      const chunkData = videoBuffer.slice(startByte, endByte + 1);

      console.log(`[TikTok] Uploading chunk ${chunkIndex + 1}/${totalChunkCount}: bytes ${startByte}-${endByte}`);

      const uploadResult = await uploadVideoChunk(
        initResult.uploadUrl,
        chunkData,
        startByte,
        endByte,
        videoSize
      );

      if (!uploadResult.success) {
        return {
          success: false,
          publishId: initResult.publishId,
          error: uploadResult.error || `Failed to upload chunk ${chunkIndex + 1}`,
        };
      }
    }

    console.log("[TikTok] All chunks uploaded, waiting for processing...");

    // Step 6: Wait for publish to complete
    const result = await waitForPublishComplete(accessToken, initResult.publishId);
    return result;
  } catch (error) {
    console.error("[TikTok] publishVideoToTikTokViaUpload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Initialize video upload to TikTok Inbox (Sandbox compatible)
 * Uses /v2/post/publish/inbox/video/init/ endpoint
 * This works with video.upload scope and sends video to user's TikTok inbox
 */
export async function initInboxVideoUpload(
  accessToken: string,
  videoSize: number,
  chunkSize: number,
  totalChunkCount: number
): Promise<{ success: boolean; publishId?: string; uploadUrl?: string; error?: string; errorCode?: string }> {
  try {
    const requestBody = {
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount,
      },
    };

    console.log("[TikTok Inbox] Initializing upload:", JSON.stringify(requestBody));

    const response = await fetch(`${TIKTOK_API_BASE}/v2/post/publish/inbox/video/init/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log("[TikTok Inbox] Init response:", JSON.stringify(result));

    if (result.error?.code !== "ok") {
      return {
        success: false,
        error: result.error?.message || "Failed to initialize inbox upload",
        errorCode: result.error?.code,
      };
    }

    return {
      success: true,
      publishId: result.data?.publish_id,
      uploadUrl: result.data?.upload_url,
    };
  } catch (error) {
    console.error("[TikTok Inbox] initInboxVideoUpload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Publish video to TikTok Inbox (Sandbox compatible)
 * Downloads video from URL and uploads to user's TikTok inbox as a draft
 * This method uses video.upload scope and works in Sandbox mode
 */
export async function publishVideoToTikTokInbox(
  accessToken: string,
  videoUrl: string
): Promise<TikTokPublishResult> {
  try {
    // Step 1: Download video from URL
    console.log("[TikTok Inbox] Starting inbox upload for:", videoUrl);
    const downloadResult = await downloadVideoFromUrl(videoUrl);
    if (!downloadResult.success || !downloadResult.data) {
      return {
        success: false,
        error: downloadResult.error || "Failed to download video",
      };
    }

    const videoBuffer = downloadResult.data;
    const videoSize = downloadResult.size!;

    // Step 2: Calculate chunk info
    // TikTok requires: min 5MB per chunk (except last), max 64MB, max 4GB total
    // For small videos (<5MB), use single chunk upload
    const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB minimum
    const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB default

    // If video is smaller than min chunk size, upload as single chunk
    const CHUNK_SIZE = videoSize < MIN_CHUNK_SIZE ? videoSize : DEFAULT_CHUNK_SIZE;
    const totalChunkCount = videoSize < MIN_CHUNK_SIZE ? 1 : Math.ceil(videoSize / CHUNK_SIZE);

    console.log("[TikTok Inbox] Upload params:", {
      videoSize,
      chunkSize: CHUNK_SIZE,
      totalChunkCount,
    });

    // Step 3: Initialize inbox upload
    const initResult = await initInboxVideoUpload(
      accessToken,
      videoSize,
      CHUNK_SIZE,
      totalChunkCount
    );

    if (!initResult.success || !initResult.publishId || !initResult.uploadUrl) {
      return {
        success: false,
        error: initResult.error || "Failed to initialize inbox upload",
        errorCode: initResult.errorCode,
      };
    }

    console.log("[TikTok Inbox] Upload initialized, publishId:", initResult.publishId);

    // Step 4: Upload video in chunks
    for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++) {
      const startByte = chunkIndex * CHUNK_SIZE;
      const endByte = Math.min(startByte + CHUNK_SIZE - 1, videoSize - 1);
      const chunkData = videoBuffer.slice(startByte, endByte + 1);

      console.log(`[TikTok Inbox] Uploading chunk ${chunkIndex + 1}/${totalChunkCount}: bytes ${startByte}-${endByte}`);

      const uploadResult = await uploadVideoChunk(
        initResult.uploadUrl,
        chunkData,
        startByte,
        endByte,
        videoSize
      );

      if (!uploadResult.success) {
        return {
          success: false,
          publishId: initResult.publishId,
          error: uploadResult.error || `Failed to upload chunk ${chunkIndex + 1}`,
        };
      }
    }

    console.log("[TikTok Inbox] All chunks uploaded, waiting for processing...");

    // Step 5: Wait for upload to complete (sends to inbox)
    // Pass isInboxUpload=true so SEND_TO_USER_INBOX is treated as success
    const result = await waitForPublishComplete(accessToken, initResult.publishId, 30, 5000, true);

    if (result.success) {
      console.log("[TikTok Inbox] Video successfully sent to user's TikTok inbox!");
    }

    return result;
  } catch (error) {
    console.error("[TikTok Inbox] publishVideoToTikTokInbox error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
  // Request both video.publish (Direct Post) and video.upload (Inbox Upload) scopes
  // video.upload works in Sandbox mode, video.publish requires Production approval
  const scope = "video.publish,video.upload,user.info.basic";

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

    console.log("[TikTok Token Exchange] Request params:", {
      client_key: clientKey?.substring(0, 10) + "...",
      redirect_uri: redirectUri,
      code_length: code.length,
      grant_type: "authorization_code",
    });

    const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });

    const result = await response.json();
    console.log("[TikTok Token Exchange] Response status:", response.status);
    console.log("[TikTok Token Exchange] Response body:", JSON.stringify(result));

    if (result.error) {
      console.error("[TikTok Token Exchange] Error:", result.error, result.error_description);
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
