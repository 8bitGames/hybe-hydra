import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl, getPresignedUrlFromS3Url } from "@/lib/storage";

/**
 * GET /api/v1/assets/download?url=<s3_url>&filename=<optional_filename>&stream=true
 *
 * When stream=true: Streams the file directly with Content-Disposition: attachment
 * Otherwise: Returns a fresh presigned URL for downloading S3 objects
 * Supports both default bucket URLs and cross-bucket S3 URLs
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    const filename = request.nextUrl.searchParams.get("filename");
    const stream = request.nextUrl.searchParams.get("stream") === "true";

    if (!url) {
      return NextResponse.json(
        { error: "Missing 'url' query parameter" },
        { status: 400 }
      );
    }

    let presignedUrl: string;
    let extractedFilename: string;

    // Check if it's a full S3 URL (from any bucket)
    const s3UrlMatch = url.match(/https:\/\/([^.]+)\.s3\.([^.]+)\.amazonaws\.com\/(.+)/);

    if (s3UrlMatch) {
      // Full S3 URL - use cross-bucket presigned URL generation
      const [, , , key] = s3UrlMatch;
      presignedUrl = await getPresignedUrlFromS3Url(url, 3600);
      extractedFilename = extractFilename(key);
    } else {
      // Try to extract key for default bucket
      const s3Key = extractS3Key(url);

      if (!s3Key) {
        return NextResponse.json(
          { error: "Invalid S3 URL format" },
          { status: 400 }
        );
      }

      // Generate presigned URL (valid for 1 hour)
      presignedUrl = await getPresignedUrl(s3Key, 3600);
      extractedFilename = extractFilename(s3Key);
    }

    const finalFilename = filename || extractedFilename;

    // If stream mode, fetch and return the file directly
    if (stream) {
      const response = await fetch(presignedUrl);

      if (!response.ok) {
        return NextResponse.json(
          { error: "Failed to fetch file from S3" },
          { status: 500 }
        );
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const contentLength = response.headers.get("content-length");

      // Stream the response directly with download headers
      return new NextResponse(response.body, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(finalFilename)}"`,
          ...(contentLength && { "Content-Length": contentLength }),
          "Cache-Control": "no-cache",
        },
      });
    }

    // Return the download URL (default behavior)
    // Client will use this URL to trigger download
    return NextResponse.json({
      downloadUrl: presignedUrl,
      filename: finalFilename,
    });
  } catch (error) {
    console.error("Download URL generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}

function extractS3Key(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Remove leading slash
    const path = urlObj.pathname.startsWith("/")
      ? urlObj.pathname.slice(1)
      : urlObj.pathname;
    return path || null;
  } catch {
    return null;
  }
}

function extractFilename(s3Key: string): string {
  const parts = s3Key.split("/");
  return parts[parts.length - 1] || "video.mp4";
}
