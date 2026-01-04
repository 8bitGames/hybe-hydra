import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { getAuthHeaders } from "@/lib/models/gcp-auth";

// Initialize S3 client
function getS3Client(): S3Client {
  return new S3Client({
    region: (process.env.AWS_REGION || "ap-southeast-2").trim(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

// Check if URL is a GCS URL
function isGcsUrl(url: string): boolean {
  return url.includes('storage.googleapis.com/') || url.includes('storage.cloud.google.com/');
}

// Get GCS auth headers if available (for private bucket access)
async function getGcsAuthHeaders(): Promise<Record<string, string> | null> {
  try {
    return await getAuthHeaders();
  } catch (error) {
    console.log('[GCS Proxy] GCP auth not available, using unsigned request:', error);
    return null;
  }
}

// Handle GCS URL proxy with range request support and authentication
async function handleGcsProxy(url: string, rangeHeader: string | null): Promise<NextResponse> {
  // Get GCP auth headers for authenticated access to GCS
  const authHeaders = await getGcsAuthHeaders();
  const baseHeaders: Record<string, string> = authHeaders || {};

  console.log('[GCS Proxy] Fetching URL:', url.substring(0, 80), 'with auth:', !!authHeaders);

  // First, get the content length with a HEAD request
  const headResponse = await fetch(url, {
    method: 'HEAD',
    headers: baseHeaders,
  });

  if (!headResponse.ok) {
    console.error('[GCS Proxy] HEAD request failed:', headResponse.status, headResponse.statusText);
    return NextResponse.json(
      { error: `GCS request failed: ${headResponse.status}` },
      { status: headResponse.status }
    );
  }

  const contentType = headResponse.headers.get('content-type') || 'video/mp4';
  const contentLength = parseInt(headResponse.headers.get('content-length') || '0', 10);

  // Handle range request for video streaming
  if (rangeHeader && contentLength > 0) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : contentLength - 1;

      // Fetch partial content from GCS with auth
      const rangeResponse = await fetch(url, {
        headers: {
          ...baseHeaders,
          'Range': `bytes=${start}-${end}`
        }
      });

      if (rangeResponse.ok || rangeResponse.status === 206) {
        const buffer = await rangeResponse.arrayBuffer();

        return new NextResponse(buffer, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': buffer.byteLength.toString(),
            'Content-Range': `bytes ${start}-${end}/${contentLength}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }
  }

  // Full content response with auth
  const response = await fetch(url, { headers: baseHeaders });

  if (!response.ok) {
    console.error('[GCS Proxy] Full content request failed:', response.status, response.statusText);
    return NextResponse.json(
      { error: `GCS request failed: ${response.status}` },
      { status: response.status }
    );
  }

  const buffer = await response.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': buffer.byteLength.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/**
 * GET /api/v1/assets/proxy?url=<s3_or_gcs_url>
 * Proxies S3/GCS requests through the server to handle private bucket access and CORS
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

    const rangeHeader = request.headers.get("range");

    // Handle GCS URLs separately (they come with signed params)
    if (isGcsUrl(url)) {
      return handleGcsProxy(url, rangeHeader);
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

    // Handle range requests for video streaming (rangeHeader already extracted above)
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
