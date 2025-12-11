import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/storage";

/**
 * GET /api/v1/assets/download?url=<s3_url>&filename=<optional_filename>
 * Returns a fresh presigned URL for downloading S3 objects
 * The presigned URL includes Content-Disposition header for proper download behavior
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    const filename = request.nextUrl.searchParams.get("filename");

    if (!url) {
      return NextResponse.json(
        { error: "Missing 'url' query parameter" },
        { status: 400 }
      );
    }

    // Extract the S3 key from the URL
    const s3Key = extractS3Key(url);

    if (!s3Key) {
      return NextResponse.json(
        { error: "Invalid S3 URL format" },
        { status: 400 }
      );
    }

    // Generate presigned URL (valid for 1 hour)
    const presignedUrl = await getPresignedUrl(s3Key, 3600);

    // Return the download URL
    // Client will use this URL to trigger download
    return NextResponse.json({
      downloadUrl: presignedUrl,
      filename: filename || extractFilename(s3Key),
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
