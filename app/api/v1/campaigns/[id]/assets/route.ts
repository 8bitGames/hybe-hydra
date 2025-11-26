import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserFromHeader } from "@/lib/auth";
import { validateFile, generateS3Key, uploadToS3 } from "@/lib/storage";
import { AssetType } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "50");
    const type = searchParams.get("type") as AssetType | null;

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

    // Build where clause
    const where: Record<string, unknown> = { campaignId };
    if (type) {
      where.type = type.toUpperCase() as AssetType;
    }

    const total = await prisma.asset.count({ where });

    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const pages = Math.ceil(total / pageSize) || 1;

    const items = assets.map((asset) => ({
      id: asset.id,
      campaign_id: asset.campaignId,
      type: asset.type.toLowerCase(),
      filename: asset.filename,
      original_filename: asset.originalFilename,
      s3_url: asset.s3Url,
      file_size: asset.fileSize,
      mime_type: asset.mimeType,
      vector_embedding_id: asset.vectorEmbeddingId,
      thumbnail_url: asset.thumbnailUrl,
      metadata: asset.metadata,
      created_by: asset.createdBy,
      created_at: asset.createdAt.toISOString(),
    }));

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      pages,
    });
  } catch (error) {
    console.error("Get assets error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ detail: "No file provided" }, { status: 400 });
    }

    // Validate file
    const validation = validateFile(file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json({ detail: validation.error }, { status: 400 });
    }

    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());
    const s3Key = generateS3Key(campaignId, file.name);
    const s3Url = await uploadToS3(buffer, s3Key, file.type);

    // Create asset record
    const asset = await prisma.asset.create({
      data: {
        campaignId,
        type: validation.type as AssetType,
        filename: s3Key.split("/").pop() || file.name,
        originalFilename: file.name,
        s3Url,
        s3Key,
        fileSize: file.size,
        mimeType: file.type,
        createdBy: user.id,
      },
    });

    return NextResponse.json(
      {
        id: asset.id,
        filename: asset.filename,
        s3_url: asset.s3Url,
        type: asset.type.toLowerCase(),
        message: "Asset uploaded successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload asset error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
