import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/storage";

/**
 * GET /api/v1/assets/presign?url=<s3_url>
 * Returns a presigned URL for accessing private S3 objects
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "Missing 'url' query parameter" },
        { status: 400 }
      );
    }

    // Extract the S3 key from the URL
    // URL format: https://bucket.s3.region.amazonaws.com/key
    // or: https://bucket.s3.amazonaws.com/key
    const s3Key = extractS3Key(url);

    if (!s3Key) {
      return NextResponse.json(
        { error: "Invalid S3 URL format" },
        { status: 400 }
      );
    }

    // Generate presigned URL (valid for 1 hour)
    const presignedUrl = await getPresignedUrl(s3Key, 3600);

    return NextResponse.json({ presignedUrl });
  } catch (error) {
    console.error("Presign error:", error);
    return NextResponse.json(
      { error: "Failed to generate presigned URL" },
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
