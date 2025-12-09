import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

interface MusicMatchRequest {
  campaignId: string;
  vibe: string;
  bpmRange: { min: number; max: number };
  minDuration?: number;
}

interface AssetMetadata {
  bpm?: number;
  audioBpm?: number;
  vibe?: string;
  audioVibe?: string;
  duration?: number;
  audioDurationSec?: number;
  genre?: string;
  audioGenre?: string;
  energy?: number;
  audioEnergy?: number;
}

interface AudioMatchResult {
  id: string;
  filename: string;
  s3Url: string;
  bpm: number | null;
  vibe: string | null;
  genre: string | null;
  duration: number;
  energy: number;
  matchScore: number;
  fileSize: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body: MusicMatchRequest = await request.json();
    const { campaignId, vibe, bpmRange, minDuration = 15 } = body;

    // Query audio assets from the campaign's Asset Locker
    const audioAssets = await prisma.asset.findMany({
      where: {
        campaignId,
        type: 'AUDIO'
      },
      select: {
        id: true,
        filename: true,
        originalFilename: true,
        s3Url: true,
        metadata: true,
        fileSize: true
      }
    });

    // Estimate BPM based on vibe when not available
    const estimateBpmFromVibe = (targetVibe: string): number => {
      const vibeMap: Record<string, number> = {
        'exciting': 130,
        'emotional': 70,
        'pop': 110,
        'minimal': 100
      };
      return vibeMap[targetVibe.toLowerCase()] || 100;
    };

    const estimatedBpm = estimateBpmFromVibe(vibe);

    // Calculate match scores for each audio asset
    const matches: AudioMatchResult[] = audioAssets.map((asset) => {
      const metadata = (asset.metadata as AssetMetadata) || {};
      // Use metadata BPM if available, otherwise estimate based on target vibe
      const assetBpm = metadata.bpm || metadata.audioBpm || estimatedBpm;
      const assetVibe = metadata.vibe || metadata.audioVibe || null;
      const assetDuration = metadata.duration || metadata.audioDurationSec || 180;
      const assetGenre = metadata.genre || metadata.audioGenre || null;
      const assetEnergy = metadata.energy || metadata.audioEnergy || 0.5;
      const hasRealBpm = !!(metadata.bpm || metadata.audioBpm);
      const hasRealVibe = !!(metadata.vibe || metadata.audioVibe);

      // Calculate match score (0-100%)
      // - Vibe match: 35%
      // - BPM match: 40%
      // - Duration match: 15%
      // - Analysis bonus: 10%
      let matchScore = 0;

      // Vibe match (35%)
      if (assetVibe && assetVibe.toLowerCase() === vibe.toLowerCase()) {
        matchScore += 35;
      } else if (assetVibe) {
        // Partial match based on vibe similarity
        const vibeMap: Record<string, string[]> = {
          'exciting': ['energetic', 'upbeat', 'dynamic'],
          'emotional': ['sad', 'melancholic', 'heartfelt'],
          'pop': ['trendy', 'catchy', 'modern'],
          'minimal': ['clean', 'simple', 'ambient']
        };
        const similarVibes = vibeMap[vibe.toLowerCase()] || [];
        if (similarVibes.some(v => assetVibe.toLowerCase().includes(v))) {
          matchScore += 20;
        }
      } else {
        // No vibe data - give base score
        matchScore += 10;
      }

      // BPM match (40%)
      if (hasRealBpm) {
        // Use actual BPM data for precise matching
        if (assetBpm >= bpmRange.min && assetBpm <= bpmRange.max) {
          matchScore += 40;
        } else {
          // Partial score based on how close the BPM is
          const midBpm = (bpmRange.min + bpmRange.max) / 2;
          const distance = Math.abs(assetBpm - midBpm);
          const maxDistance = 50;
          if (distance < maxDistance) {
            matchScore += Math.round(40 * (1 - distance / maxDistance));
          }
        }
      } else {
        // No real BPM data - give low base score
        matchScore += 15;
      }

      // Duration match (15%)
      if (assetDuration >= minDuration) {
        matchScore += 15;
      } else if (assetDuration >= minDuration * 0.8) {
        matchScore += 8;
      }

      // Analysis bonus (10%) - reward assets that have been properly analyzed
      if (hasRealBpm && hasRealVibe) {
        matchScore += 10;
      }

      return {
        id: asset.id,
        filename: asset.originalFilename || asset.filename,
        s3Url: asset.s3Url,
        bpm: assetBpm,
        vibe: assetVibe,
        genre: assetGenre,
        duration: assetDuration,
        energy: assetEnergy,
        matchScore: Math.min(100, Math.max(0, matchScore)), // Clamp to 0-100
        fileSize: asset.fileSize
      };
    });

    // Sort by match score (descending)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({
      matches,
      totalMatches: matches.length,
    });
  } catch (error) {
    console.error('[Fast Cut Music Match] Error:', error);
    return NextResponse.json(
      { detail: 'Failed to match music' },
      { status: 500 }
    );
  }
}
