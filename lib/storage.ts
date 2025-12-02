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

function getS3Client(): S3Client {
  if (!_s3Client) {
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "ap-southeast-2";

    if (!accessKey || !secretKey) {
      throw new Error("AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.");
    }

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
      // No endpoint or forcePathStyle for AWS S3 (uses default virtual-hosted style)
    });
  }
  return _s3Client;
}

function getBucketName(): string {
  return process.env.AWS_S3_BUCKET || "hydra-assets-hybe";
}

function getPublicUrl(key: string): string {
  const bucket = getBucketName();
  const region = process.env.AWS_REGION || "ap-northeast-2";
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
  mimeType: string
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

  // Return public URL (AWS S3 format)
  return getPublicUrl(key);
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
