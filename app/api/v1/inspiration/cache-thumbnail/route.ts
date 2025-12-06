import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { cacheImageToS3 } from "@/lib/storage";

/**
 * POST /api/v1/inspiration/cache-thumbnail
 * Caches a TikTok thumbnail image to S3 for permanent storage
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { thumbnailUrl, videoId } = body as {
      thumbnailUrl: string;
      videoId: string;
    };

    if (!thumbnailUrl) {
      return NextResponse.json(
        { detail: "thumbnailUrl is required" },
        { status: 400 }
      );
    }

    if (!videoId) {
      return NextResponse.json(
        { detail: "videoId is required" },
        { status: 400 }
      );
    }

    // Skip if not a valid URL or already an S3 URL
    if (!thumbnailUrl.startsWith("http")) {
      return NextResponse.json({
        success: false,
        message: "Invalid thumbnail URL",
        cachedUrl: null,
      });
    }

    // Skip if already cached to S3
    if (thumbnailUrl.includes(".s3.") && thumbnailUrl.includes("amazonaws.com")) {
      return NextResponse.json({
        success: true,
        message: "Already cached",
        cachedUrl: thumbnailUrl,
      });
    }

    console.log(`[INSPIRATION-CACHE] Caching thumbnail for video ${videoId}...`);

    // Cache to S3 with user-specific folder
    const result = await cacheImageToS3(thumbnailUrl, `cache/inspiration/${user.id}`);

    if (!result.success) {
      console.warn(`[INSPIRATION-CACHE] Failed to cache thumbnail: ${result.error}`);
      return NextResponse.json({
        success: false,
        message: result.error || "Cache failed",
        cachedUrl: null,
      });
    }

    console.log(`[INSPIRATION-CACHE] Successfully cached thumbnail for video ${videoId}`);

    return NextResponse.json({
      success: true,
      message: "Thumbnail cached to S3",
      cachedUrl: result.url,
      key: result.key,
    });
  } catch (err) {
    console.error("[INSPIRATION-CACHE] Error:", err);
    return NextResponse.json(
      {
        detail: "Failed to cache thumbnail",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/inspiration/cache-thumbnail (batch)
 * Batch cache multiple thumbnails
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { videos } = body as {
      videos: Array<{ videoId: string; thumbnailUrl: string }>;
    };

    if (!videos || !Array.isArray(videos)) {
      return NextResponse.json(
        { detail: "videos array is required" },
        { status: 400 }
      );
    }

    console.log(`[INSPIRATION-CACHE] Batch caching ${videos.length} thumbnails...`);

    const results: Array<{
      videoId: string;
      originalUrl: string;
      cachedUrl: string | null;
      success: boolean;
    }> = [];

    // Process in parallel with concurrency limit
    const CONCURRENCY = 5;
    for (let i = 0; i < videos.length; i += CONCURRENCY) {
      const batch = videos.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (video) => {
          // Skip if not a valid URL
          if (!video.thumbnailUrl?.startsWith("http")) {
            return {
              videoId: video.videoId,
              originalUrl: video.thumbnailUrl,
              cachedUrl: null,
              success: false,
            };
          }

          // Skip if already cached to S3
          if (
            video.thumbnailUrl.includes(".s3.") &&
            video.thumbnailUrl.includes("amazonaws.com")
          ) {
            return {
              videoId: video.videoId,
              originalUrl: video.thumbnailUrl,
              cachedUrl: video.thumbnailUrl,
              success: true,
            };
          }

          const result = await cacheImageToS3(
            video.thumbnailUrl,
            `cache/inspiration/${user.id}`
          );

          return {
            videoId: video.videoId,
            originalUrl: video.thumbnailUrl,
            cachedUrl: result.success ? result.url || null : null,
            success: result.success,
          };
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`[INSPIRATION-CACHE] Batch complete: ${successCount}/${videos.length} cached`);

    return NextResponse.json({
      success: true,
      message: `Cached ${successCount}/${videos.length} thumbnails`,
      results,
    });
  } catch (err) {
    console.error("[INSPIRATION-CACHE] Batch error:", err);
    return NextResponse.json(
      {
        detail: "Failed to batch cache thumbnails",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
