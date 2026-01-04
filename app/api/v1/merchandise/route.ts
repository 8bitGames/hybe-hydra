import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { validateFile, generateS3Key, uploadToS3 } from "@/lib/storage";
import { MerchandiseType } from "@prisma/client";
import { cached, CacheKeys, CacheTTL, createCacheHash, invalidatePattern } from "@/lib/cache";

// GET /api/v1/merchandise - List merchandise items
export async function GET(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "50");
    const artistId = searchParams.get("artist_id");
    const type = searchParams.get("type") as MerchandiseType | null;
    const search = searchParams.get("search");
    const activeOnly = searchParams.get("active_only") !== "false";

    // Create cache key based on filters
    const cacheHash = createCacheHash({
      isAdmin: user.role === "ADMIN",
      labelIds: user.role === "ADMIN" ? [] : user.labelIds.sort(),
      page,
      pageSize,
      artistId: artistId || "",
      type: type || "",
      search: search || "",
      activeOnly,
    });

    // Cache merchandise list (5 minutes)
    const response = await cached(
      CacheKeys.merchandiseList(cacheHash),
      CacheTTL.MEDIUM_STATIC, // 5 minutes
      async () => {
        // Build where clause
        const where: Record<string, unknown> = {};

        if (activeOnly) {
          where.isActive = true;
        }

        if (artistId) {
          where.artistId = artistId;
        }

        if (type) {
          where.type = type.toUpperCase() as MerchandiseType;
        }

        if (search) {
          where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { nameKo: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ];
        }

        // Apply RBAC filter - only show merchandise for accessible artists
        if (user.role !== "ADMIN") {
          where.artist = {
            labelId: { in: user.labelIds },
          };
        }

        // Parallelize count and findMany queries
        const [total, items] = await Promise.all([
          withRetry(() => prisma.merchandiseItem.count({ where })),
          withRetry(() => prisma.merchandiseItem.findMany({
            where,
            orderBy: [{ createdAt: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
              artist: {
                select: {
                  id: true,
                  name: true,
                  stageName: true,
                  groupName: true,
                },
              },
            },
          })),
        ]);

        const pages = Math.ceil(total / pageSize) || 1;

        const responseItems = items.map((item) => ({
          id: item.id,
          name: item.name,
          name_ko: item.nameKo,
          artist_id: item.artistId,
          artist: item.artist ? {
            id: item.artist.id,
            name: item.artist.name,
            stage_name: item.artist.stageName,
            group_name: item.artist.groupName,
          } : null,
          type: item.type.toLowerCase(),
          description: item.description,
          s3_url: item.s3Url,
          thumbnail_url: item.thumbnailUrl,
          file_size: item.fileSize,
          release_date: item.releaseDate?.toISOString(),
          metadata: item.metadata,
          is_active: item.isActive,
          created_at: item.createdAt.toISOString(),
        }));

        return {
          items: responseItems,
          total,
          page,
          page_size: pageSize,
          pages,
        };
      }
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get merchandise error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// POST /api/v1/merchandise - Create merchandise item
export async function POST(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Only ADMIN and PRODUCER can create merchandise
    if (user.role === "VIEWER") {
      return NextResponse.json({ detail: "Permission denied" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string;
    const nameKo = formData.get("name_ko") as string | null;
    const artistId = formData.get("artist_id") as string | null;
    const type = (formData.get("type") as string)?.toUpperCase() as MerchandiseType;
    const description = formData.get("description") as string | null;
    const releaseDateStr = formData.get("release_date") as string | null;
    const metadataStr = formData.get("metadata") as string | null;

    if (!file) {
      return NextResponse.json({ detail: "No file provided" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ detail: "Name is required" }, { status: 400 });
    }

    if (!type || !Object.values(MerchandiseType).includes(type)) {
      return NextResponse.json({
        detail: "Invalid type. Must be one of: album, photocard, lightstick, apparel, accessory, other"
      }, { status: 400 });
    }

    // Validate file (only images for merchandise)
    const validation = validateFile(file.type, file.size);
    if (!validation.valid || validation.type !== "IMAGE") {
      return NextResponse.json({
        detail: validation.error || "Only image files are allowed for merchandise"
      }, { status: 400 });
    }

    // Check artist access if artistId provided
    if (artistId) {
      const artist = await withRetry(() => prisma.artist.findUnique({
        where: { id: artistId },
        select: { labelId: true },
      }));

      if (!artist) {
        return NextResponse.json({ detail: "Artist not found" }, { status: 404 });
      }

      if (user.role !== "ADMIN" && !user.labelIds.includes(artist.labelId)) {
        return NextResponse.json({ detail: "Access denied to this artist" }, { status: 403 });
      }
    }

    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());
    const s3Key = generateS3Key("merchandise", file.name);
    const s3Url = await uploadToS3(buffer, s3Key, file.type);

    // Parse metadata if provided
    let metadata = null;
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        return NextResponse.json({ detail: "Invalid metadata JSON" }, { status: 400 });
      }
    }

    // Parse release date
    let releaseDate = null;
    if (releaseDateStr) {
      releaseDate = new Date(releaseDateStr);
      if (isNaN(releaseDate.getTime())) {
        return NextResponse.json({ detail: "Invalid release_date format" }, { status: 400 });
      }
    }

    // Create merchandise item
    const merchandise = await withRetry(() => prisma.merchandiseItem.create({
      data: {
        name,
        nameKo,
        artistId,
        type,
        description,
        s3Url,
        s3Key,
        fileSize: file.size,
        releaseDate,
        metadata,
        createdBy: user.id,
      },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            stageName: true,
            groupName: true,
          },
        },
      },
    }));

    // Invalidate merchandise list cache
    await invalidatePattern("merchandise:list:*");

    return NextResponse.json(
      {
        id: merchandise.id,
        name: merchandise.name,
        name_ko: merchandise.nameKo,
        artist_id: merchandise.artistId,
        artist: merchandise.artist ? {
          id: merchandise.artist.id,
          name: merchandise.artist.name,
          stage_name: merchandise.artist.stageName,
          group_name: merchandise.artist.groupName,
        } : null,
        type: merchandise.type.toLowerCase(),
        description: merchandise.description,
        s3_url: merchandise.s3Url,
        thumbnail_url: merchandise.thumbnailUrl,
        file_size: merchandise.fileSize,
        release_date: merchandise.releaseDate?.toISOString(),
        metadata: merchandise.metadata,
        is_active: merchandise.isActive,
        created_at: merchandise.createdAt.toISOString(),
        message: "Merchandise created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create merchandise error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
