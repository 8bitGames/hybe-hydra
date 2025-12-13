import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// Lazy initialization to ensure environment variables are loaded
let _s3Client: S3Client | null = null;
let _s3PresignClient: S3Client | null = null;

function getS3Credentials() {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = (process.env.AWS_REGION || "ap-northeast-2").trim();

  if (!accessKey || !secretKey) {
    throw new Error("AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.");
  }

  return { accessKey, secretKey, region };
}

function getS3Client(): S3Client {
  if (!_s3Client) {
    const { accessKey, secretKey, region } = getS3Credentials();

    console.log("AWS S3 Config Debug:", {
      region,
      accessKey: accessKey.substring(0, 4) + "***",
      hasSecretKey: !!secretKey,
      bucket: process.env.AWS_S3_BUCKET || "hydra-assets-hybe",
    });

    _s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
  }
  return _s3Client;
}

// Separate client for presigning without checksum (for browser uploads)
function getS3PresignClient(): S3Client {
  if (!_s3PresignClient) {
    const { accessKey, secretKey, region } = getS3Credentials();

    _s3PresignClient = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      // Disable request checksums for browser-compatible presigned URLs
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return _s3PresignClient;
}

function getBucketName(): string {
  return process.env.AWS_S3_BUCKET || "hydra-assets-hybe";
}

function getPublicUrl(key: string): string {
  const bucket = getBucketName();
  const region = (process.env.AWS_REGION || "ap-northeast-2").trim();
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export type AssetType = "IMAGE" | "VIDEO" | "AUDIO" | "GOODS";

const ALLOWED_MIME_TYPES: Record<string, AssetType> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "IMAGE",
  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
  "video/quicktime": "VIDEO",
  "audio/mpeg": "AUDIO",
  "audio/wav": "AUDIO",
  "audio/flac": "AUDIO",
  "audio/ogg": "AUDIO",
};

// GOODS uses same image formats
const GOODS_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const MAX_FILE_SIZES: Record<AssetType, number> = {
  IMAGE: 20 * 1024 * 1024, // 20MB
  VIDEO: 2 * 1024 * 1024 * 1024, // 2GB
  AUDIO: 500 * 1024 * 1024, // 500MB
  GOODS: 20 * 1024 * 1024, // 20MB (same as IMAGE)
};

export function getAssetType(mimeType: string): AssetType | null {
  return ALLOWED_MIME_TYPES[mimeType] || null;
}

export function isValidGoodsMimeType(mimeType: string): boolean {
  return GOODS_MIME_TYPES.includes(mimeType);
}

export function validateFile(
  mimeType: string,
  fileSize: number,
  overrideType?: AssetType // Allow overriding type (e.g., IMAGE -> GOODS)
): { valid: boolean; error?: string; type?: AssetType } {
  const detectedType = getAssetType(mimeType);

  if (!detectedType) {
    return { valid: false, error: `Unsupported file type: ${mimeType}` };
  }

  // If overrideType is GOODS, validate that mime type is valid for goods
  if (overrideType === "GOODS") {
    if (!isValidGoodsMimeType(mimeType)) {
      return { valid: false, error: `Only image files can be uploaded as goods` };
    }
  }

  // Use override type if provided, otherwise use detected type
  const assetType = overrideType || detectedType;

  const maxSize = MAX_FILE_SIZES[assetType];
  if (fileSize > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File too large. Maximum size for ${assetType} is ${maxSizeMB}MB` };
  }

  return { valid: true, type: assetType };
}

export function generateS3Key(campaignId: string, filename: string): string {
  const ext = filename.split(".").pop() || "";
  const uniqueId = uuidv4();
  return `campaigns/${campaignId}/${uniqueId}.${ext}`;
}

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  mimeType: string,
  options?: { returnPresignedUrl?: boolean; presignedUrlExpiry?: number }
): Promise<string> {
  const bucketName = getBucketName();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  try {
    await getS3Client().send(command);
  } catch (error) {
    console.error("S3 Upload Error Details:", {
      error: error instanceof Error ? error.message : error,
      code: (error as { Code?: string }).Code,
      bucket: bucketName,
      key,
      mimeType,
    });
    throw error;
  }

  // Return presigned URL by default (bucket blocks public access)
  // Presigned URL is valid for 7 days (604800 seconds) by default
  const expiry = options?.presignedUrlExpiry ?? 604800;
  return getPresignedUrl(key, expiry);
}

export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  await getS3Client().send(command);
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  return getSignedUrl(getS3Client(), command, { expiresIn });
}

/**
 * Generate a presigned URL from a direct S3 URL.
 * Parses the S3 URL to extract bucket and key, then generates a presigned URL.
 * Works with any S3 bucket that the AWS credentials have access to.
 *
 * @param s3Url - Full S3 URL (e.g., https://bucket.s3.region.amazonaws.com/key)
 * @param expiresIn - Expiration time in seconds (default: 7 days - maximum allowed)
 * @returns Presigned URL or original URL if not a valid S3 URL
 */
export async function getPresignedUrlFromS3Url(
  s3Url: string,
  expiresIn = 604800 // 7 days (maximum allowed for presigned URLs)
): Promise<string> {
  // Parse S3 URL: https://BUCKET.s3.REGION.amazonaws.com/KEY
  // Use [^?]+ to stop at query string (handles already-presigned URLs)
  const match = s3Url.match(/https:\/\/([^.]+)\.s3\.([^.]+)\.amazonaws\.com\/([^?]+)/);

  if (!match) {
    // Not a valid S3 URL, return as-is
    console.warn('[getPresignedUrlFromS3Url] Not a valid S3 URL format:', s3Url.substring(0, 50));
    return s3Url;
  }

  const [, bucket, region, rawKey] = match;

  // Decode the key in case it was URL-encoded (handles double-encoding issues)
  const key = decodeURIComponent(rawKey);

  // Create a new S3 client for this specific bucket/region
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKey || !secretKey) {
    console.warn('[getPresignedUrlFromS3Url] AWS credentials not available, returning original URL');
    return s3Url;
  }

  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

  console.log('[getPresignedUrlFromS3Url] Generated presigned URL:', {
    bucket,
    key: key.substring(0, 50),
    expiresIn,
  });

  return presignedUrl;
}

/**
 * Download file from S3 and return as Buffer
 */
export async function downloadFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  const response = await getS3Client().send(command);

  if (!response.Body) {
    throw new Error(`No body in S3 response for key: ${key}`);
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Download file from S3 and return as base64 string
 */
export async function downloadFromS3AsBase64(key: string): Promise<string> {
  const buffer = await downloadFromS3(key);
  return buffer.toString('base64');
}

/**
 * Generate a presigned URL for direct upload to S3
 * This allows browsers to upload large files directly to S3 without going through the server
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
  });

  // Use presign client without checksum for browser-compatible URLs
  const uploadUrl = await getSignedUrl(getS3PresignClient(), command, {
    expiresIn,
  });
  const publicUrl = getPublicUrl(key);

  console.log("[S3 Presign Debug]", {
    bucket: getBucketName(),
    key,
    contentType,
    uploadUrl: uploadUrl.substring(0, 100) + "...",
    publicUrl,
  });

  return { uploadUrl, publicUrl };
}

/**
 * Upload video from base64 encoded data
 */
export async function uploadVideoFromBase64(
  base64Data: string,
  campaignId: string,
  mimeType: string = "video/mp4"
): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const ext = mimeType.split("/")[1] || "mp4";
    const key = generateS3Key(campaignId, `video.${ext}`);

    const url = await uploadToS3(buffer, key, mimeType);

    return { success: true, url, key };
  } catch (error) {
    console.error("Upload from base64 error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload video from URL (fetch and upload)
 */
export async function uploadVideoFromUrl(
  videoUrl: string,
  campaignId: string
): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "video/mp4";
    const ext = contentType.split("/")[1] || "mp4";
    const key = generateS3Key(campaignId, `video.${ext}`);

    const url = await uploadToS3(buffer, key, contentType);

    return { success: true, url, key };
  } catch (error) {
    console.error("Upload from URL error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload from URL failed",
    };
  }
}

/**
 * Generate a video-specific S3 key
 */
export function generateVideoKey(campaignId: string, generationId: string): string {
  return `campaigns/${campaignId}/videos/${generationId}.mp4`;
}

/**
 * Cache an external image to S3
 * Useful for caching TikTok CDN images that expire
 */
export async function cacheImageToS3(
  imageUrl: string,
  folder: string = "cache/images"
): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
  try {
    // Generate a hash-based key from the URL to enable deduplication
    const urlHash = Buffer.from(imageUrl).toString("base64url").slice(0, 32);
    const ext = imageUrl.includes(".webp") ? "webp" : imageUrl.includes(".png") ? "png" : "jpeg";
    const key = `${folder}/${urlHash}.${ext}`;

    // Fetch the image with TikTok-compatible headers
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.tiktok.com/",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch image: ${response.status}`,
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || `image/${ext}`;

    const url = await uploadToS3(buffer, key, contentType);

    return { success: true, url, key };
  } catch (error) {
    console.error("[S3 Image Cache] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Cache failed",
    };
  }
}

/**
 * Batch cache multiple images to S3
 * Returns a map of original URL -> S3 URL
 */
export async function batchCacheImagesToS3(
  imageUrls: string[],
  folder: string = "cache/trends"
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  const chunks = [];
  for (let i = 0; i < imageUrls.length; i += CONCURRENCY) {
    chunks.push(imageUrls.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (url) => {
        const result = await cacheImageToS3(url, folder);
        if (result.success && result.url) {
          return { original: url, cached: result.url };
        }
        return null;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        urlMap.set(result.value.original, result.value.cached);
      }
    }
  }

  return urlMap;
}
