import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { validateFile, generateS3Key, getPresignedUploadUrl, AssetType as StorageAssetType } from "@/lib/storage";
import { AssetType, MerchandiseType, Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/campaigns/[id]/assets/presign
 *
 * Generate a presigned URL for direct S3 upload.
 * This bypasses the 4.5MB Vercel body limit by allowing
 * the browser to upload directly to S3.
 *
 * Request body:
 * - filename: Original filename
 * - content_type: MIME type of the file
 * - file_size: Size in bytes
 * - asset_type?: "goods" to override type
 * - merchandise_type?: Required if asset_type is "goods"
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // Check campaign access
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        artist: { select: { labelId: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json({ detail: "Campaign not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && !user.labelIds.includes(campaign.artist.labelId)) {
      return NextResponse.json({ detail: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const {
      filename,
      content_type,
      file_size,
      asset_type: assetTypeOverride,
      merchandise_type: merchandiseTypeStr,
    } = body;

    if (!filename || !content_type || !file_size) {
      return NextResponse.json(
        { detail: "filename, content_type, and file_size are required" },
        { status: 400 }
      );
    }

    // Determine if this should be a GOODS type
    const overrideType = assetTypeOverride?.toUpperCase() === "GOODS" ? "GOODS" as StorageAssetType : undefined;

    // Validate file type and size
    const validation = validateFile(content_type, file_size, overrideType);
    if (!validation.valid) {
      return NextResponse.json({ detail: validation.error }, { status: 400 });
    }

    // Validate merchandise_type if asset_type is GOODS
    let merchandiseType: MerchandiseType | null = null;
    if (validation.type === "GOODS") {
      if (!merchandiseTypeStr) {
        return NextResponse.json(
          { detail: "merchandise_type is required when uploading goods" },
          { status: 400 }
        );
      }
      const upperMerchType = merchandiseTypeStr.toUpperCase() as MerchandiseType;
      if (!Object.values(MerchandiseType).includes(upperMerchType)) {
        return NextResponse.json(
          { detail: "Invalid merchandise_type" },
          { status: 400 }
        );
      }
      merchandiseType = upperMerchType;
    }

    // Generate S3 key
    const s3Key = generateS3Key(campaignId, filename);

    // Generate presigned URL
    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
      s3Key,
      content_type,
      3600 // 1 hour expiry
    );

    // Return presigned URL and metadata for confirmation
    return NextResponse.json({
      upload_url: uploadUrl,
      s3_key: s3Key,
      s3_url: publicUrl,
      asset_type: validation.type?.toLowerCase(),
      merchandise_type: merchandiseType?.toLowerCase() || null,
      expires_in: 3600,
    });
  } catch (error) {
    console.error("Presign URL error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
