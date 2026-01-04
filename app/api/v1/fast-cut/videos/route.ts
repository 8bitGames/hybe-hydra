import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { prisma, withRetry } from '@/lib/db/prisma';
import { getPresignedUrlFromS3Url } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');
    const campaignId = searchParams.get('campaign_id');

    // Build where clause - get fast-cut-generated videos (ID starts with 'compose-' or 'fastcut-'), exclude soft-deleted
    const where: Record<string, unknown> = {
      OR: [
        { id: { startsWith: 'compose-' } },
        { id: { startsWith: 'fastcut-' } },
      ],
      composedOutputUrl: { not: null },
      status: 'COMPLETED',
      deletedAt: null,
    };

    // Filter by campaign if specified
    if (campaignId) {
      where.campaignId = campaignId;
    }

    // For non-admin users, filter by accessible labels
    if (user.role !== 'ADMIN') {
      where.campaign = {
        artist: {
          labelId: { in: user.labelIds }
        }
      };
    }

    // Parallelize count and findMany queries
    const [total, generations] = await Promise.all([
      withRetry(() => prisma.videoGeneration.count({ where })),
      withRetry(() => prisma.videoGeneration.findMany({
        where,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              artist: {
                select: {
                  id: true,
                  name: true,
                  stageName: true,
                }
              }
            }
          },
          audioAsset: {
            select: {
              id: true,
              filename: true,
              originalFilename: true,
              s3Url: true,
            }
          },
          creator: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })),
    ]);

    const pages = Math.ceil(total / pageSize) || 1;

    // Generate presigned URLs for all videos in parallel
    const items = await Promise.all(generations.map(async (gen) => {
      const videoUrl = gen.composedOutputUrl || gen.outputUrl;
      const presignedUrl = videoUrl ? await getPresignedUrlFromS3Url(videoUrl) : null;

      return {
        id: gen.id,
        campaign_id: gen.campaignId,
        campaign_name: gen.campaign?.name || "Quick Create",
        artist_name: gen.campaign?.artist?.stageName || gen.campaign?.artist?.name || "Unknown Artist",
        prompt: gen.prompt,
        duration_seconds: gen.durationSeconds,
        aspect_ratio: gen.aspectRatio,
        status: gen.status.toLowerCase(),
        composed_output_url: presignedUrl,
        output_url: presignedUrl,
        audio_asset: gen.audioAsset
          ? {
              id: gen.audioAsset.id,
              filename: gen.audioAsset.filename,
              original_filename: gen.audioAsset.originalFilename,
              s3_url: gen.audioAsset.s3Url,
            }
          : null,
        creator: {
          id: gen.creator.id,
          name: gen.creator.name,
        },
        created_at: gen.createdAt.toISOString(),
        updated_at: gen.updatedAt.toISOString(),
        tiktok_seo: gen.tiktokSEO || null,
        tags: gen.tags || [],
        quality_metadata: gen.qualityMetadata || null,
      };
    }));

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      pages,
    });
  } catch (error) {
    console.error('Get fast cut videos error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
