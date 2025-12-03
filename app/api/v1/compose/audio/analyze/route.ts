import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

interface AnalyzeRequest {
  assetId: string;
  targetDuration?: number;
}

/**
 * Analyze audio asset and find best segment (highest energy section)
 * Uses Modal backend for audio analysis with librosa
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body: AnalyzeRequest = await request.json();
    const { assetId, targetDuration = 15 } = body;

    // Get audio asset
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        s3Url: true,
        metadata: true,
        filename: true
      }
    });

    if (!asset) {
      return NextResponse.json(
        { detail: 'Audio asset not found' },
        { status: 404 }
      );
    }

    const metadata = asset.metadata as Record<string, unknown> || {};
    const audioDuration = (metadata.duration || metadata.audioDurationSec || 180) as number;

    // Call Modal backend for best segment detection
    const modalUrl = process.env.MODAL_COMPOSE_URL;
    if (modalUrl) {
      try {
        // Use the existing /audio/best-segment endpoint
        const segmentResponse = await fetch(`${modalUrl}/audio/best-segment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_url: asset.s3Url,
            target_duration: targetDuration,
            job_id: `analyze-${assetId}`
          })
        });

        if (segmentResponse.ok) {
          const segmentData = await segmentResponse.json();

          // Also get full analysis for BPM
          let bpm: number | null = typeof metadata.bpm === 'number' ? metadata.bpm :
                                   typeof metadata.audioBpm === 'number' ? metadata.audioBpm : null;
          try {
            const analyzeResponse = await fetch(`${modalUrl}/audio/analyze`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audio_url: asset.s3Url,
                job_id: `analyze-${assetId}`
              })
            });
            if (analyzeResponse.ok) {
              const analyzeData = await analyzeResponse.json();
              bpm = typeof analyzeData.bpm === 'number' ? analyzeData.bpm : bpm;
            }
          } catch {
            // BPM analysis failed, use metadata
          }

          // Add buildup time before the climax (전조)
          // Calculate buildup based on BPM - use 2 bars (8 beats in 4/4 time) for musical buildup
          const buildupSeconds = calculateBpmBuildup(bpm);
          const buildupTime = Math.min(buildupSeconds, segmentData.start_time);
          const adjustedStartTime = Math.max(0, segmentData.start_time - buildupTime);

          console.log('[Audio Analyze] Best segment adjustment:', {
            bpm,
            calculated_buildup: buildupSeconds,
            original_start: segmentData.start_time,
            applied_buildup: buildupTime,
            adjusted_start: adjustedStartTime,
            original_end: segmentData.end_time,
          });

          return NextResponse.json({
            assetId,
            duration: audioDuration,
            bpm,
            suggestedStartTime: adjustedStartTime,
            suggestedEndTime: segmentData.end_time,
            analyzed: true
          });
        }
      } catch (modalError) {
        console.warn('Modal audio analysis failed, using fallback:', modalError);
      }
    }

    // Fallback: Use simple heuristics without librosa analysis
    const metadataBpm = (metadata.bpm || metadata.audioBpm || null) as number | null;
    const suggestedStart = calculateFallbackStart(audioDuration, targetDuration, metadataBpm);

    return NextResponse.json({
      assetId,
      duration: audioDuration,
      bpm: metadataBpm,
      suggestedStartTime: suggestedStart,
      suggestedEndTime: Math.min(suggestedStart + targetDuration, audioDuration),
      analyzed: false
    });

  } catch (error) {
    console.error('Audio analysis error:', error);
    return NextResponse.json(
      { detail: 'Failed to analyze audio' },
      { status: 500 }
    );
  }
}

/**
 * Calculate BPM-based buildup time (전조)
 * Uses 2 bars (8 beats in 4/4 time) for musical buildup
 */
function calculateBpmBuildup(bpm: number | null): number {
  if (!bpm || bpm <= 0) {
    return 6; // Fallback to 6 seconds if no BPM
  }
  // 2 bars of 4/4 time = 8 beats
  const beatsPerBar = 4;
  const barsForBuildup = 2;
  const totalBeats = beatsPerBar * barsForBuildup;
  const buildupSeconds = totalBeats / (bpm / 60);

  // Clamp between 3-8 seconds for reasonable range
  return Math.max(3, Math.min(8, buildupSeconds));
}

/**
 * Simple heuristic for finding a good start point without librosa
 * Based on typical song structure (intro → verse → pre-chorus → chorus)
 * Includes buildup time (전조) before the estimated climax
 *
 * K-pop/EDM song structure typically:
 * - Intro: 0-15s
 * - Verse 1: 15-30s
 * - Pre-chorus (buildup): 30-45s ← 이 구간에서 시작해야 함
 * - Chorus (drop): 45-60s ← 클라이막스
 */
function calculateFallbackStart(totalDuration: number, targetDuration: number, bpm: number | null): number {
  // If audio is short enough, start from beginning
  if (totalDuration <= targetDuration * 1.5) {
    return 0;
  }

  // Calculate BPM-based buildup time
  const buildupTime = calculateBpmBuildup(bpm);

  // Estimate first chorus drop position based on song duration
  let estimatedDropPosition: number;

  if (totalDuration > 180) {
    // Full song (3+ min): First chorus typically around 45-60s
    estimatedDropPosition = Math.min(50, totalDuration * 0.25);
  } else if (totalDuration > 120) {
    // Long track (2-3 min): First chorus around 35-45s
    estimatedDropPosition = Math.min(40, totalDuration * 0.28);
  } else if (totalDuration > 60) {
    // Medium track (1-2 min): First drop around 20-30s
    estimatedDropPosition = Math.min(25, totalDuration * 0.3);
  } else if (totalDuration > 30) {
    // Short track (30s-1min): Drop around 12-15s
    estimatedDropPosition = Math.min(15, totalDuration * 0.35);
  } else {
    return 0;
  }

  // Start buildup time before the estimated drop
  const suggestedStart = Math.max(0, estimatedDropPosition - buildupTime);

  console.log('[Fallback] Calculated start position:', {
    bpm,
    buildupTime,
    estimatedDropPosition,
    suggestedStart,
    totalDuration
  });

  return suggestedStart;
}
