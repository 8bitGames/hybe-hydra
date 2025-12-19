/**
 * YouTube Data API v3 Service
 * https://developers.google.com/youtube/v3
 *
 * For YouTube Shorts:
 * - Video must be vertical (9:16 aspect ratio)
 * - Duration must be 60 seconds or less
 * - Include #Shorts in title or description
 */

const YOUTUBE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const YOUTUBE_TOKEN_BASE = "https://oauth2.googleapis.com/token";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3";

// YouTube API response types
export interface YouTubeError {
  code: number;
  message: string;
  errors?: Array<{
    domain: string;
    reason: string;
    message: string;
  }>;
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  description: string;
  customUrl?: string;
  thumbnailUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
}

export interface YouTubeVideoMetadata {
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus: "public" | "private" | "unlisted";
  madeForKids?: boolean;
  selfDeclaredMadeForKids?: boolean;
}

export interface YouTubeUploadResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
  error?: string;
  errorCode?: string;
}

export interface YouTubeTokenResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
  error?: string;
  errorDescription?: string;
}

export interface YouTubeVideoStatus {
  uploadStatus: "deleted" | "failed" | "processed" | "rejected" | "uploaded";
  failureReason?: string;
  rejectionReason?: string;
  privacyStatus: string;
  publishAt?: string;
}

export interface YouTubeShortSettings {
  title?: string;
  privacyStatus?: "public" | "private" | "unlisted";
  categoryId?: string;
  madeForKids?: boolean;
  tags?: string[];
}

/**
 * Generate YouTube OAuth authorization URL
 */
export function getYouTubeAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  // Scopes for uploading videos and reading channel info
  const scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state,
    access_type: "offline", // Required for refresh token
    prompt: "consent", // Force consent screen to get refresh token
    include_granted_scopes: "true",
  });

  return `${YOUTUBE_OAUTH_BASE}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeYouTubeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<YouTubeTokenResult> {
  try {
    console.log("[YouTube Token Exchange] Starting token exchange...");

    const response = await fetch(YOUTUBE_TOKEN_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const result = await response.json();
    console.log("[YouTube Token Exchange] Response status:", response.status);

    if (result.error) {
      console.error("[YouTube Token Exchange] Error:", result.error, result.error_description);
      return {
        success: false,
        error: result.error,
        errorDescription: result.error_description,
      };
    }

    return {
      success: true,
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresIn: result.expires_in,
      scope: result.scope,
      tokenType: result.token_type,
    };
  } catch (error) {
    console.error("[YouTube Token Exchange] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Refresh YouTube access token
 */
export async function refreshYouTubeAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<YouTubeTokenResult> {
  try {
    console.log("[YouTube Token Refresh] Refreshing access token...");

    const response = await fetch(YOUTUBE_TOKEN_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error("[YouTube Token Refresh] Error:", result.error);
      return {
        success: false,
        error: result.error,
        errorDescription: result.error_description,
      };
    }

    return {
      success: true,
      accessToken: result.access_token,
      expiresIn: result.expires_in,
      scope: result.scope,
      tokenType: result.token_type,
      // Note: Google doesn't return a new refresh token on refresh
    };
  } catch (error) {
    console.error("[YouTube Token Refresh] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get YouTube channel information for the authenticated user
 */
export async function getYouTubeChannelInfo(
  accessToken: string
): Promise<{ success: boolean; data?: YouTubeChannelInfo; error?: string }> {
  try {
    const params = new URLSearchParams({
      part: "snippet,statistics",
      mine: "true",
    });

    const response = await fetch(`${YOUTUBE_API_BASE}/channels?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const result = await response.json();

    if (result.error) {
      console.error("[YouTube Channel Info] Error:", result.error);
      return {
        success: false,
        error: result.error.message || "Failed to get channel info",
      };
    }

    if (!result.items || result.items.length === 0) {
      return {
        success: false,
        error: "No YouTube channel found for this account",
      };
    }

    const channel = result.items[0];
    return {
      success: true,
      data: {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl,
        thumbnailUrl: channel.snippet.thumbnails?.default?.url,
        subscriberCount: parseInt(channel.statistics?.subscriberCount || "0"),
        videoCount: parseInt(channel.statistics?.videoCount || "0"),
      },
    };
  } catch (error) {
    console.error("[YouTube Channel Info] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download video from URL and return as Buffer
 */
async function downloadVideoFromUrl(videoUrl: string): Promise<{
  success: boolean;
  data?: Buffer;
  size?: number;
  contentType?: string;
  error?: string;
}> {
  try {
    console.log("[YouTube] Downloading video from:", videoUrl.substring(0, 100) + (videoUrl.length > 100 ? "..." : ""));

    if (!videoUrl) {
      return {
        success: false,
        error: "Video URL is empty or undefined",
      };
    }

    const response = await fetch(videoUrl);

    if (!response.ok) {
      console.error(`[YouTube] Video download failed: ${response.status} ${response.statusText}`);
      return {
        success: false,
        error: `Failed to download video: ${response.status} ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("[YouTube] Downloaded video:", buffer.length, "bytes, type:", contentType);

    if (buffer.length === 0) {
      return {
        success: false,
        error: "Downloaded video is empty (0 bytes)",
      };
    }

    return {
      success: true,
      data: buffer,
      size: buffer.length,
      contentType,
    };
  } catch (error) {
    console.error("[YouTube] downloadVideoFromUrl exception:", error);
    return {
      success: false,
      error: `Video download failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Initialize resumable upload session for YouTube
 * Returns upload URL for subsequent chunk uploads
 */
async function initResumableUpload(
  accessToken: string,
  metadata: YouTubeVideoMetadata,
  videoSize: number,
  contentType: string = "video/mp4"
): Promise<{ success: boolean; uploadUrl?: string; error?: string }> {
  try {
    // Prepare video resource metadata
    const videoResource = {
      snippet: {
        title: metadata.title.slice(0, 100), // YouTube max title length
        description: metadata.description.slice(0, 5000), // YouTube max description length
        tags: metadata.tags?.slice(0, 500) || [], // Max 500 tags
        categoryId: metadata.categoryId || "22", // 22 = People & Blogs (default)
      },
      status: {
        privacyStatus: metadata.privacyStatus,
        selfDeclaredMadeForKids: metadata.selfDeclaredMadeForKids ?? metadata.madeForKids ?? false,
      },
    };

    const params = new URLSearchParams({
      uploadType: "resumable",
      part: "snippet,status",
    });

    console.log("[YouTube] Initializing resumable upload:", {
      title: metadata.title.slice(0, 50),
      videoSize,
      privacyStatus: metadata.privacyStatus,
    });

    const response = await fetch(`${YOUTUBE_UPLOAD_BASE}/videos?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(videoSize),
        "X-Upload-Content-Type": contentType,
      },
      body: JSON.stringify(videoResource),
    });

    if (response.status !== 200) {
      const errorBody = await response.json();
      console.error("[YouTube] Resumable upload init failed:", errorBody);
      return {
        success: false,
        error: errorBody.error?.message || `Failed to initialize upload: ${response.status}`,
      };
    }

    const uploadUrl = response.headers.get("Location");
    if (!uploadUrl) {
      return {
        success: false,
        error: "No upload URL returned from YouTube",
      };
    }

    console.log("[YouTube] Resumable upload initialized, got upload URL");
    return {
      success: true,
      uploadUrl,
    };
  } catch (error) {
    console.error("[YouTube] initResumableUpload exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Upload video data to YouTube using resumable upload
 */
async function uploadVideoData(
  uploadUrl: string,
  videoData: Buffer,
  contentType: string = "video/mp4"
): Promise<{ success: boolean; videoId?: string; error?: string }> {
  try {
    console.log("[YouTube] Uploading video data:", videoData.length, "bytes");

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(videoData.length),
      },
      body: new Uint8Array(videoData) as BodyInit,
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[YouTube] Video upload failed:", result);
      return {
        success: false,
        error: result.error?.message || `Upload failed: ${response.status}`,
      };
    }

    console.log("[YouTube] Video uploaded successfully, ID:", result.id);
    return {
      success: true,
      videoId: result.id,
    };
  } catch (error) {
    console.error("[YouTube] uploadVideoData exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check video processing status
 */
export async function getYouTubeVideoStatus(
  accessToken: string,
  videoId: string
): Promise<{ success: boolean; data?: YouTubeVideoStatus; error?: string }> {
  try {
    const params = new URLSearchParams({
      part: "status,processingDetails",
      id: videoId,
    });

    const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    if (!result.items || result.items.length === 0) {
      return {
        success: false,
        error: "Video not found",
      };
    }

    const video = result.items[0];
    return {
      success: true,
      data: {
        uploadStatus: video.status.uploadStatus,
        failureReason: video.status.failureReason,
        rejectionReason: video.status.rejectionReason,
        privacyStatus: video.status.privacyStatus,
        publishAt: video.status.publishAt,
      },
    };
  } catch (error) {
    console.error("[YouTube] getVideoStatus exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Wait for video processing to complete
 */
export async function waitForYouTubeProcessing(
  accessToken: string,
  videoId: string,
  maxAttempts: number = 30,
  intervalMs: number = 10000
): Promise<YouTubeUploadResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`[YouTube] Checking video status, attempt ${attempt + 1}/${maxAttempts}`);

    const statusResult = await getYouTubeVideoStatus(accessToken, videoId);

    if (!statusResult.success) {
      return {
        success: false,
        videoId,
        error: statusResult.error,
      };
    }

    const status = statusResult.data!;
    console.log(`[YouTube] Video status: ${status.uploadStatus}`);

    switch (status.uploadStatus) {
      case "processed":
        console.log("[YouTube] Video processing complete!");
        return {
          success: true,
          videoId,
          videoUrl: `https://youtube.com/shorts/${videoId}`,
        };

      case "uploaded":
        // Still processing, wait and retry
        console.log(`[YouTube] Video still processing, waiting ${intervalMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        break;

      case "failed":
        console.error("[YouTube] Video processing FAILED!", status.failureReason);
        return {
          success: false,
          videoId,
          error: status.failureReason || "Video processing failed",
        };

      case "rejected":
        console.error("[YouTube] Video REJECTED!", status.rejectionReason);
        return {
          success: false,
          videoId,
          error: status.rejectionReason || "Video was rejected",
        };

      case "deleted":
        return {
          success: false,
          videoId,
          error: "Video was deleted",
        };

      default:
        console.warn(`[YouTube] Unknown status: ${status.uploadStatus}`);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        break;
    }
  }

  // If we reach here, processing timed out but upload was successful
  // Return success since the video is uploaded, just not fully processed
  console.log("[YouTube] Processing check timed out, but video was uploaded successfully");
  return {
    success: true,
    videoId,
    videoUrl: `https://youtube.com/shorts/${videoId}`,
  };
}

/**
 * Upload a YouTube Short
 * Main function to upload a video as YouTube Short
 *
 * Requirements for Shorts:
 * - Vertical video (9:16 aspect ratio)
 * - 60 seconds or less
 * - #Shorts hashtag in title or description
 */
export async function uploadYouTubeShort(
  accessToken: string,
  videoUrl: string,
  caption: string,
  hashtags: string[],
  settings?: YouTubeShortSettings
): Promise<YouTubeUploadResult> {
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
    const contentType = downloadResult.contentType || "video/mp4";

    // Step 2: Prepare metadata
    // Ensure #Shorts is in the title or description for YouTube to recognize it as a Short
    const allHashtags = [...(settings?.tags || []), ...hashtags];
    const hashtagsStr = allHashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    const shortsHashtag = allHashtags.some((h) => h.toLowerCase().replace("#", "") === "shorts")
      ? ""
      : "#Shorts";

    // Use settings.title if provided, otherwise use caption
    const title = (settings?.title || caption || "Untitled Short").trim().slice(0, 100);
    const description = `${caption}\n\n${shortsHashtag} ${hashtagsStr}`.trim();

    const metadata: YouTubeVideoMetadata = {
      title,
      description,
      tags: allHashtags.filter((h) => !h.startsWith("#")).concat(["Shorts"]),
      privacyStatus: settings?.privacyStatus || "public",
      categoryId: settings?.categoryId || "22", // People & Blogs
      madeForKids: settings?.madeForKids ?? false,
    };

    console.log("[YouTube Shorts] Starting upload:", {
      title: metadata.title.slice(0, 30),
      videoSize,
      privacyStatus: metadata.privacyStatus,
    });

    // Step 3: Initialize resumable upload
    const initResult = await initResumableUpload(accessToken, metadata, videoSize, contentType);
    if (!initResult.success || !initResult.uploadUrl) {
      return {
        success: false,
        error: initResult.error || "Failed to initialize upload",
      };
    }

    // Step 4: Upload video data
    const uploadResult = await uploadVideoData(initResult.uploadUrl, videoBuffer, contentType);
    if (!uploadResult.success || !uploadResult.videoId) {
      return {
        success: false,
        error: uploadResult.error || "Failed to upload video",
      };
    }

    console.log("[YouTube Shorts] Upload complete, video ID:", uploadResult.videoId);

    // Step 5: Wait for processing (optional, can return early)
    // For immediate response, we return success after upload
    // Processing status can be checked later
    const videoId = uploadResult.videoId;

    // Quick status check (don't wait for full processing)
    const statusResult = await getYouTubeVideoStatus(accessToken, videoId);
    if (statusResult.success && statusResult.data?.uploadStatus === "failed") {
      return {
        success: false,
        videoId,
        error: statusResult.data.failureReason || "Upload failed during processing",
      };
    }

    return {
      success: true,
      videoId,
      videoUrl: `https://youtube.com/shorts/${videoId}`,
    };
  } catch (error) {
    console.error("[YouTube Shorts] uploadYouTubeShort exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user info from YouTube (basic profile)
 */
export async function getYouTubeUserInfo(accessToken: string): Promise<{
  success: boolean;
  data?: {
    channelId: string;
    channelTitle: string;
    channelUrl?: string;
    thumbnailUrl?: string;
  };
  error?: string;
}> {
  const channelResult = await getYouTubeChannelInfo(accessToken);

  if (!channelResult.success || !channelResult.data) {
    return {
      success: false,
      error: channelResult.error || "Failed to get channel info",
    };
  }

  const channel = channelResult.data;
  return {
    success: true,
    data: {
      channelId: channel.id,
      channelTitle: channel.title,
      channelUrl: channel.customUrl
        ? `https://youtube.com/${channel.customUrl}`
        : `https://youtube.com/channel/${channel.id}`,
      thumbnailUrl: channel.thumbnailUrl,
    },
  };
}
