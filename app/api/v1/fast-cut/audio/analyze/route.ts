import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { getComposeEngineUrl } from '@/lib/compose/client';

interface AnalyzeRequest {
  assetId: string;
  targetDuration?: number;
}

interface ClimaxCandidate {
  start_time: number;
  drop_time: number;
  score: number;
  type: string;  // 'drop', 'energy_peak', 'onset_burst', 'combined', etc.
}

interface AudioAnalysisResponse {
  bpm: number;
  beat_times: number[];
  energy_curve: [number, number][];
  duration: number;
  suggested_vibe: string;
  best_15s_start: number;
  // New advanced climax detection fields
  climax_candidates?: ClimaxCandidate[];
  drops?: number[];
  builds?: [number, number][];
  best_hook_start?: number;
}

/**
 * Call compose engine to analyze audio using librosa
 */
async function analyzeAudio(s3Url: string, jobId: string, targetDuration: number): Promise<AudioAnalysisResponse | null> {
  const url = `${getComposeEngineUrl()}/audio/analyze`;

  console.log('[Fast Cut AudioAnalyze] Calling compose engine:', url);
  console.log('[Fast Cut AudioAnalyze] Audio URL:', s3Url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_url: s3Url,
        job_id: jobId,
        target_duration: targetDuration
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[Fast Cut AudioAnalyze] Compose engine failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();

    console.log('[Fast Cut AudioAnalyze] Analysis complete:', {
      bpm: data.bpm,
      duration: data.duration,
      vibe: data.suggested_vibe,
      best_15s_start: data.best_15s_start,
      best_hook_start: data.best_hook_start,
      beatCount: data.beat_times?.length,
      energyPoints: data.energy_curve?.length,
      dropsFound: data.drops?.length ?? 0,
      climaxCandidates: data.climax_candidates?.length ?? 0
    });

    return {
      bpm: data.bpm,
      beat_times: data.beat_times || [],
      energy_curve: data.energy_curve || [],
      duration: data.duration,
      suggested_vibe: data.suggested_vibe,
      best_15s_start: data.best_15s_start ?? 0,
      // New advanced climax detection fields
      climax_candidates: data.climax_candidates || [],
      drops: data.drops || [],
      builds: data.builds || [],
      best_hook_start: data.best_hook_start ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Fast Cut AudioAnalyze] Request timed out after 120s');
    } else {
      console.error('[Fast Cut AudioAnalyze] Connection error:', error);
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

    // Try real audio analysis with compose engine (librosa)
    const analysisResult = await analyzeAudio(asset.s3Url, jobId, targetDuration);

    if (analysisResult) {
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
        // Store advanced analysis data
        climaxCandidates: analysisResult.climax_candidates,
        drops: analysisResult.drops,
        builds: analysisResult.builds,
        bestHookStart: analysisResult.best_hook_start,
        analyzed: true,
        analyzedAt: new Date().toISOString()
      };

      await prisma.asset.update({
        where: { id: assetId },
        data: { metadata: updatedMetadata }
      });

      // Determine best start time from climax candidates
      let suggestedStart = 0;
      const candidates = analysisResult.climax_candidates || [];

      if (candidates.length > 0) {
        // Use the highest scored candidate
        const topCandidate = candidates[0];
        suggestedStart = topCandidate.start_time;

        console.log('[Fast Cut AudioAnalyze] Using climax candidate:', {
          type: topCandidate.type,
          score: topCandidate.score.toFixed(2),
          startTime: topCandidate.start_time.toFixed(2),
          dropTime: topCandidate.drop_time.toFixed(2)
        });
      } else if (analysisResult.best_hook_start && analysisResult.best_hook_start > 0) {
        // Fallback to best hook start
        suggestedStart = analysisResult.best_hook_start;
        console.log('[Fast Cut AudioAnalyze] Using best hook start:', suggestedStart.toFixed(2));
      } else if (analysisResult.best_15s_start && analysisResult.best_15s_start > 0) {
        // Fallback to best 15s (energy-based)
        suggestedStart = analysisResult.best_15s_start;
        console.log('[Fast Cut AudioAnalyze] Using best 15s start:', suggestedStart.toFixed(2));
      }

      // Final fallback to heuristics
      if (suggestedStart === 0 && analysisResult.duration > targetDuration * 1.5) {
        console.log('[Fast Cut AudioAnalyze] No good candidates, using heuristics fallback');
        suggestedStart = calculateFallbackStart(analysisResult.duration, targetDuration, analysisResult.bpm);
      }

      const suggestedEnd = Math.min(suggestedStart + targetDuration, analysisResult.duration);

      console.log('[Fast Cut AudioAnalyze] Final segment selection:', {
        suggestedStart: suggestedStart.toFixed(2),
        suggestedEnd: suggestedEnd.toFixed(2),
        targetDuration,
        totalDuration: analysisResult.duration.toFixed(2),
        candidatesCount: candidates.length,
        dropsFound: analysisResult.drops?.length ?? 0
      });

      return NextResponse.json({
        assetId,
        duration: analysisResult.duration,
        bpm: analysisResult.bpm,
        vibe: analysisResult.suggested_vibe,
        energyCurve: analysisResult.energy_curve,
        beatTimes: analysisResult.beat_times,
        suggestedStartTime: suggestedStart,
        suggestedEndTime: suggestedEnd,
        // New: provide all candidates for user selection
        climaxCandidates: candidates.map(c => ({
          startTime: c.start_time,
          dropTime: c.drop_time,
          score: c.score,
          type: c.type
        })),
        drops: analysisResult.drops,
        builds: analysisResult.builds,
        bestHookStart: analysisResult.best_hook_start,
        analyzed: true
      });
    }

    // Fallback to heuristics if compose engine is unavailable
    console.log('[Fast Cut AudioAnalyze] Using fallback heuristics (compose engine unavailable)');
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
    console.error('[Fast Cut AudioAnalyze] Error:', error);
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

  console.log('[Fast Cut Fallback] Calculated start position:', {
    bpm,
    buildupTime,
    estimatedDropPosition,
    suggestedStart,
    totalDuration
  });

  return suggestedStart;
}
