import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

// Use MODAL_COMPOSE_URL (production) or LOCAL_COMPOSE_URL (development)
const COMPOSE_ENGINE_URL = process.env.MODAL_COMPOSE_URL || process.env.LOCAL_COMPOSE_URL || process.env.COMPOSE_ENGINE_URL || 'http://localhost:8000';

interface AnalyzeRequest {
  assetId: string;
  targetDuration?: number;
}

interface ComposeEngineAnalysisResponse {
  bpm: number;
  beat_times: number[];
  energy_curve: [number, number][];
  duration: number;
  suggested_vibe: string;
}

interface ComposeEngineBestSegmentResponse {
  start_time: number;
  end_time: number;
  duration: number;
}

/**
 * Call compose-engine to analyze audio using librosa
 */
async function analyzeWithComposeEngine(s3Url: string, jobId: string): Promise<ComposeEngineAnalysisResponse | null> {
  const url = `${COMPOSE_ENGINE_URL}/audio/analyze`;
  console.log('[AudioAnalyze] Calling compose-engine:', url);
  console.log('[AudioAnalyze] Audio URL:', s3Url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for audio analysis

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: s3Url, job_id: jobId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[AudioAnalyze] compose-engine analyze failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('[AudioAnalyze] Analysis complete:', {
      bpm: data.bpm,
      duration: data.duration,
      vibe: data.suggested_vibe,
      beatCount: data.beat_times?.length,
      energyPoints: data.energy_curve?.length
    });
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[AudioAnalyze] compose-engine request timed out after 120s');
    } else {
      console.error('[AudioAnalyze] compose-engine connection error:', error);
    }
    return null;
  }
}

/**
 * Call compose-engine to find best audio segment (highest energy)
 */
async function findBestSegmentWithComposeEngine(
  s3Url: string,
  targetDuration: number,
  jobId: string
): Promise<ComposeEngineBestSegmentResponse | null> {
  const url = `${COMPOSE_ENGINE_URL}/audio/best-segment`;
  console.log('[AudioAnalyze] Finding best segment:', { url, targetDuration });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_url: s3Url,
        target_duration: targetDuration,
        job_id: jobId
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[AudioAnalyze] compose-engine best-segment failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('[AudioAnalyze] Best segment found:', data);
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[AudioAnalyze] best-segment request timed out after 60s');
    } else {
      console.error('[AudioAnalyze] compose-engine connection error:', error);
    }
    return null;
  }
}

/**
 * Analyze audio asset and find best segment (highest energy section)
 * Uses compose-engine backend for real audio analysis with librosa
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
    const jobId = `analyze-${assetId}-${Date.now()}`;

    // Try real audio analysis with compose-engine (librosa)
    const analysisResult = await analyzeWithComposeEngine(asset.s3Url, jobId);

    if (analysisResult) {
      // Real analysis succeeded - find best segment
      const bestSegment = await findBestSegmentWithComposeEngine(
        asset.s3Url,
        targetDuration,
        jobId
      );

      // Update asset metadata with real analysis results
      const updatedMetadata = {
        ...metadata,
        bpm: analysisResult.bpm,
        audioBpm: analysisResult.bpm,
        duration: analysisResult.duration,
        audioDurationSec: analysisResult.duration,
        vibe: analysisResult.suggested_vibe,
        audioVibe: analysisResult.suggested_vibe,
        energyCurve: analysisResult.energy_curve,
        beatTimes: analysisResult.beat_times,
        analyzed: true,
        analyzedAt: new Date().toISOString()
      };

      await prisma.asset.update({
        where: { id: assetId },
        data: { metadata: updatedMetadata }
      });

      const suggestedStart = bestSegment?.start_time ?? 0;
      const suggestedEnd = bestSegment?.end_time ?? Math.min(targetDuration, analysisResult.duration);

      return NextResponse.json({
        assetId,
        duration: analysisResult.duration,
        bpm: analysisResult.bpm,
        vibe: analysisResult.suggested_vibe,
        energyCurve: analysisResult.energy_curve,
        beatTimes: analysisResult.beat_times,
        suggestedStartTime: suggestedStart,
        suggestedEndTime: suggestedEnd,
        analyzed: true
      });
    }

    // Fallback to heuristics if compose-engine is unavailable
    console.log('[AudioAnalyze] Using fallback heuristics (compose-engine unavailable)');
    const audioDuration = (metadata.duration || metadata.audioDurationSec || 180) as number;
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
