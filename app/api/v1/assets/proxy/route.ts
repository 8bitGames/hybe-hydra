import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

// Initialize S3 client
function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || "ap-southeast-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * GET /api/v1/assets/proxy?url=<s3_url>
 * Proxies S3 requests through the server to handle private bucket access
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
    const s3Key = extractS3Key(url);

    if (!s3Key) {
      return NextResponse.json(
        { error: "Invalid S3 URL format" },
        { status: 400 }
      );
    }

    const bucket = process.env.AWS_S3_BUCKET || "hydra-assets-hybe";
    const s3Client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json(
        { error: "Empty response from S3" },
        { status: 404 }
      );
    }

    // Get content type and length
    const contentType = response.ContentType || "application/octet-stream";
    const contentLength = response.ContentLength;

    // Handle range requests for video streaming
    const rangeHeader = request.headers.get("range");

    if (rangeHeader && contentLength) {
      // Parse range header
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : contentLength - 1;

        // Request partial content from S3
        const rangeCommand = new GetObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Range: `bytes=${start}-${end}`,
        });

        const rangeResponse = await s3Client.send(rangeCommand);

        if (rangeResponse.Body) {
          const bodyStream = rangeResponse.Body as Readable;
          const chunks: Uint8Array[] = [];

          for await (const chunk of bodyStream) {
            chunks.push(chunk);
          }

          const buffer = Buffer.concat(chunks);

          return new NextResponse(buffer, {
            status: 206,
            headers: {
              "Content-Type": contentType,
              "Content-Length": buffer.length.toString(),
              "Content-Range": `bytes ${start}-${end}/${contentLength}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      }
    }

    // Full content response
    const bodyStream = response.Body as Readable;
    const chunks: Uint8Array[] = [];

    for await (const chunk of bodyStream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset" },
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
