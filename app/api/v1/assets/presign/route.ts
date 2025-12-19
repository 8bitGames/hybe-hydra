import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/storage";

/**
 * GET /api/v1/assets/presign?key=<s3_key> or ?url=<s3_url>
 * Returns a presigned URL for accessing private S3 objects
 * Prefer using 'key' parameter directly when available
 */
export async function GET(request: NextRequest) {
  try {
    // Prefer direct key, fallback to extracting from URL
    const directKey = request.nextUrl.searchParams.get("key");
    const url = request.nextUrl.searchParams.get("url");

    console.log("[Presign API] Request params:", { directKey, url: url?.substring(0, 50) });

    let s3Key: string | null = null;

    if (directKey) {
      s3Key = directKey;
    } else if (url) {
      // Extract the S3 key from the URL
      // URL format: https://bucket.s3.region.amazonaws.com/key
      // or: https://bucket.s3.amazonaws.com/key
      s3Key = extractS3Key(url);
    }

    console.log("[Presign API] Extracted S3 key:", s3Key);

    if (!s3Key) {
      console.error("[Presign API] No S3 key found");
      return NextResponse.json(
        { error: "Missing 'key' or 'url' query parameter" },
        { status: 400 }
      );
    }

    // Generate presigned URL (valid for 1 hour)
    const presignedUrl = await getPresignedUrl(s3Key, 3600);
    console.log("[Presign API] Generated presigned URL:", presignedUrl?.substring(0, 80) + "...");

    return NextResponse.json({ presignedUrl });
  } catch (error) {
    console.error("[Presign API] Error:", error);
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
