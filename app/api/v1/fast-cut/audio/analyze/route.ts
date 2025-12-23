import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { getComposeEngineUrl } from '@/lib/compose/client';
import { createLyricsExtractorAgent, type LyricsExtractorOutput } from '@/lib/agents/analyzers/lyrics-extractor';

interface AnalyzeRequest {
  assetId: string;
  targetDuration?: number;
  preferVariety?: boolean;      // Enable variety in climax selection (default: true)
  candidateIndex?: number;      // Force specific candidate index (0-based)
  excludeStarts?: number[];     // Exclude these start times (avoid repeats)
  includeLyrics?: boolean;      // Include lyrics-based chorus detection (default: false)
}

interface LyricsSegment {
  text: string;
  start: number;
  end: number;
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
    const {
      assetId,
      targetDuration = 15,
      preferVariety = true,
      candidateIndex,
      excludeStarts,
      includeLyrics = false
    } = body;

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

    // Check if we have cached analysis data
    const cachedCandidates = metadata.climaxCandidates as ClimaxCandidate[] | undefined;
    const hasCachedAnalysis = cachedCandidates && cachedCandidates.length > 0;

    let analysisResult: AudioAnalysisResponse | null = null;

    if (hasCachedAnalysis) {
      // Use cached data - no need to call compose engine
      console.log('[Fast Cut AudioAnalyze] Using cached analysis data:', {
        climaxCandidates: cachedCandidates.length,
        bpm: metadata.bpm,
        duration: metadata.duration
      });

      analysisResult = {
        bpm: (metadata.bpm || metadata.audioBpm || 120) as number,
        beat_times: (metadata.beatTimes || []) as number[],
        energy_curve: (metadata.energyCurve || []) as [number, number][],
        duration: (metadata.duration || metadata.audioDurationSec || 0) as number,
        suggested_vibe: (metadata.suggestedVibe || metadata.vibe || 'Unknown') as string,
        best_15s_start: (metadata.best15sStart || 0) as number,
        climax_candidates: cachedCandidates,
        drops: (metadata.drops || []) as number[],
        builds: (metadata.builds || []) as [number, number][],
        best_hook_start: (metadata.bestHookStart || 0) as number,
      };
    } else {
      // No cache - call compose engine for fresh analysis
      console.log('[Fast Cut AudioAnalyze] No cached data, calling compose engine...');
      analysisResult = await analyzeAudio(asset.s3Url, jobId, targetDuration);

      // Update asset metadata with fresh analysis results
      if (analysisResult) {
        // Sample beat_times and energy_curve for storage efficiency
        const sampledBeatTimes = analysisResult.beat_times.length > 200
          ? analysisResult.beat_times.filter((_, i) => i % Math.ceil(analysisResult!.beat_times.length / 200) === 0)
          : analysisResult.beat_times;

        const sampledEnergyCurve = analysisResult.energy_curve.length > 400
          ? analysisResult.energy_curve.filter((_, i) => i % Math.ceil(analysisResult!.energy_curve.length / 400) === 0)
          : analysisResult.energy_curve;

        const updatedMetadata = {
          ...metadata,
          bpm: analysisResult.bpm,
          audioBpm: analysisResult.bpm,
          duration: analysisResult.duration,
          audioDurationSec: analysisResult.duration,
          suggestedVibe: analysisResult.suggested_vibe,
          vibe: analysisResult.suggested_vibe,
          audioVibe: analysisResult.suggested_vibe,
          energyCurve: sampledEnergyCurve,
          beatTimes: sampledBeatTimes,
          // Store advanced analysis data
          climaxCandidates: analysisResult.climax_candidates,
          drops: analysisResult.drops,
          builds: analysisResult.builds,
          bestHookStart: analysisResult.best_hook_start,
          best15sStart: analysisResult.best_15s_start,
          analyzed: true,
          analyzedAt: new Date().toISOString()
        };

        await prisma.asset.update({
          where: { id: assetId },
          data: { metadata: updatedMetadata as Prisma.InputJsonValue }
        });

        console.log('[Fast Cut AudioAnalyze] Analysis cached to metadata');
      }
    }

    if (analysisResult) {

      // Determine best start time from climax candidates with variety selection
      let suggestedStart = 0;
      let selectedIndex = -1;
      let selectionReason = 'none';
      let candidates = analysisResult.climax_candidates || [];
      let lyricsData: LyricsExtractorOutput | undefined;

      // Include lyrics-based chorus detection if requested
      if (includeLyrics && asset.s3Url) {
        // Check for cached lyrics data
        const cachedLyrics = metadata.lyrics as {
          analyzed: boolean;
          analyzedAt?: string;
          chorusCandidates?: ClimaxCandidate[];
          language?: string;
          confidence?: number;
          isInstrumental?: boolean;
          segmentCount?: number;
          fullText?: string;
        } | undefined;

        if (cachedLyrics?.analyzed && cachedLyrics.chorusCandidates) {
          // Use cached lyrics data
          console.log('[Fast Cut AudioAnalyze] Using cached lyrics data:', {
            chorusCandidates: cachedLyrics.chorusCandidates.length,
            language: cachedLyrics.language
          });

          if (cachedLyrics.chorusCandidates.length > 0) {
            candidates = mergeCandidates(candidates, cachedLyrics.chorusCandidates);
          }

          lyricsData = {
            language: (cachedLyrics.language as 'ko' | 'en' | 'ja' | 'mixed' | 'auto') || 'auto',
            extractedAt: cachedLyrics.analyzedAt || new Date().toISOString(),
            source: 'gemini' as const,
            confidence: cachedLyrics.confidence || 0,
            isInstrumental: cachedLyrics.isInstrumental || false,
            fullText: cachedLyrics.fullText || '',
            segments: [], // Don't need full segments for response
          };
        } else {
          // Fresh lyrics analysis
          console.log('[Fast Cut AudioAnalyze] Analyzing lyrics (not cached)...');
          const lyricsResult = await analyzeLyricsForChorus(
            asset.s3Url,
            analysisResult.duration,
            targetDuration
          );

          if (lyricsResult.candidates.length > 0) {
            console.log('[Fast Cut AudioAnalyze] Merging lyrics candidates:', {
              audioCandidates: candidates.length,
              lyricsCandidates: lyricsResult.candidates.length
            });
            candidates = mergeCandidates(candidates, lyricsResult.candidates);
          }

          lyricsData = lyricsResult.lyricsData;

          // Cache lyrics analysis to metadata
          if (lyricsData || lyricsResult.candidates.length > 0) {
            const lyricsCache = {
              analyzed: true,
              analyzedAt: new Date().toISOString(),
              language: lyricsData?.language,
              confidence: lyricsData?.confidence,
              isInstrumental: lyricsData?.isInstrumental,
              segmentCount: lyricsData?.segments?.length || 0,
              chorusCandidates: lyricsResult.candidates
            };

            await prisma.asset.update({
              where: { id: assetId },
              data: {
                metadata: {
                  ...metadata,
                  lyrics: lyricsCache
                } as unknown as Prisma.InputJsonValue
              }
            });

            console.log('[Fast Cut AudioAnalyze] Lyrics analysis cached to metadata');
          }
        }
      }

      if (candidates.length > 0) {
        // Use variety selection for diverse results
        const selection = selectClimaxWithVariety(candidates, targetDuration, {
          preferVariety,
          candidateIndex,
          excludeStarts
        });

        if (selection.candidate) {
          suggestedStart = selection.candidate.start_time;
          selectedIndex = selection.selectedIndex;
          selectionReason = selection.selectionReason;

          console.log('[Fast Cut AudioAnalyze] Using climax candidate with variety:', {
            type: selection.candidate.type,
            score: selection.candidate.score.toFixed(2),
            startTime: selection.candidate.start_time.toFixed(2),
            dropTime: selection.candidate.drop_time.toFixed(2),
            selectedIndex,
            selectionReason,
            preferVariety,
            totalCandidates: candidates.length
          });
        }
      }

      // Fallback chain if no candidate selected
      if (suggestedStart === 0 && analysisResult.best_hook_start && analysisResult.best_hook_start > 0) {
        suggestedStart = analysisResult.best_hook_start;
        selectionReason = 'best_hook_start_fallback';
        console.log('[Fast Cut AudioAnalyze] Using best hook start:', suggestedStart.toFixed(2));
      } else if (suggestedStart === 0 && analysisResult.best_15s_start && analysisResult.best_15s_start > 0) {
        suggestedStart = analysisResult.best_15s_start;
        selectionReason = 'best_15s_fallback';
        console.log('[Fast Cut AudioAnalyze] Using best 15s start:', suggestedStart.toFixed(2));
      }

      // Final fallback to heuristics
      if (suggestedStart === 0 && analysisResult.duration > targetDuration * 1.5) {
        console.log('[Fast Cut AudioAnalyze] No good candidates, using heuristics fallback');
        suggestedStart = calculateFallbackStart(analysisResult.duration, targetDuration, analysisResult.bpm);
        selectionReason = 'heuristics_fallback';
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
        // Variety selection info
        selectedCandidateIndex: selectedIndex,
        selectionReason,
        // All candidates for user selection or re-analysis
        climaxCandidates: candidates.map(c => ({
          startTime: c.start_time,
          dropTime: c.drop_time,
          score: c.score,
          type: c.type
        })),
        drops: analysisResult.drops,
        builds: analysisResult.builds,
        bestHookStart: analysisResult.best_hook_start,
        analyzed: true,
        // Lyrics analysis data (if requested)
        ...(lyricsData && {
          lyrics: {
            language: lyricsData.language,
            confidence: lyricsData.confidence,
            isInstrumental: lyricsData.isInstrumental,
            segmentCount: lyricsData.segments.length,
            hasChorus: candidates.some(c => c.type.includes('chorus'))
          }
        })
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

// ============================================
// VARIETY SELECTION FUNCTIONS
// ============================================

/**
 * Type priority based on target duration
 * - Short clips (5-10s): Impact and dynamic moments work best
 * - Medium clips (10-20s): Drops and combined moments with buildup
 * - Long clips (20s+): Gentle/vocal sections with story arc
 */
function getTypePriority(targetDuration: number): Record<string, number> {
  if (targetDuration <= 10) {
    // Short clips: prioritize high-impact moments
    return {
      'impact': 1.5,
      'dynamic': 1.4,
      'combined': 1.2,
      'drop': 1.1,
      'energy': 1.0,
      'onset': 0.9,
      'spectral': 0.8,
      'vocal': 0.7,
      'gentle': 0.6,
      'energy_peak': 1.0
    };
  } else if (targetDuration <= 20) {
    // Medium clips: balanced approach with drops
    return {
      'combined': 1.4,
      'drop': 1.3,
      'energy': 1.2,
      'onset': 1.1,
      'dynamic': 1.0,
      'impact': 1.0,
      'spectral': 0.9,
      'vocal': 0.8,
      'gentle': 0.7,
      'energy_peak': 1.1
    };
  } else {
    // Long clips: prefer sections with story arc
    return {
      'gentle': 1.3,
      'vocal': 1.3,
      'combined': 1.2,
      'drop': 1.1,
      'energy': 1.0,
      'dynamic': 0.9,
      'onset': 0.8,
      'spectral': 0.8,
      'impact': 0.7,
      'energy_peak': 1.0
    };
  }
}

/**
 * Rerank candidates based on target duration
 * Different durations benefit from different types of climax moments
 */
function rerankCandidates(
  candidates: ClimaxCandidate[],
  targetDuration: number,
  excludeStarts?: number[]
): ClimaxCandidate[] {
  if (candidates.length === 0) return [];

  const typePriority = getTypePriority(targetDuration);

  // Apply type-based reranking
  const reranked = candidates.map(c => ({
    ...c,
    adjustedScore: c.score * (typePriority[c.type] || 1.0)
  }));

  // Filter out excluded starts (within 3 seconds tolerance)
  const filtered = excludeStarts && excludeStarts.length > 0
    ? reranked.filter(c => !excludeStarts.some(ex => Math.abs(c.start_time - ex) < 3))
    : reranked;

  // Sort by adjusted score
  return filtered.sort((a, b) => b.adjustedScore - a.adjustedScore);
}

/**
 * Weighted random selection from top K candidates
 * Uses flatter probability distribution to encourage variety
 * Each call should return a different candidate with reasonable probability
 */
function weightedRandomSelect(
  candidates: ClimaxCandidate[],
  topK: number = 4,  // Increased from 3 to 4 for more variety
  minScore: number = 0.2  // Lowered threshold to include more candidates
): { candidate: ClimaxCandidate; selectedIndex: number } {
  if (candidates.length === 0) {
    throw new Error('No candidates to select from');
  }

  if (candidates.length === 1) {
    return { candidate: candidates[0], selectedIndex: 0 };
  }

  // Filter by minimum score and take top K
  const eligible = candidates
    .filter(c => c.score >= minScore)
    .slice(0, topK);

  if (eligible.length === 0) {
    // Fallback to top candidate if none meet minimum score
    return { candidate: candidates[0], selectedIndex: 0 };
  }

  if (eligible.length === 1) {
    return { candidate: eligible[0], selectedIndex: 0 };
  }

  // Use FLAT probability distribution for more variety
  // Each eligible candidate gets roughly equal chance with slight score bonus
  // This ensures different segments are selected on different calls
  const scores = eligible.map(c => c.score);
  const minScoreInEligible = Math.min(...scores);
  const maxScoreInEligible = Math.max(...scores);
  const scoreRange = maxScoreInEligible - minScoreInEligible || 1;

  // Normalize to 0-1 range, then flatten with sqrt to reduce score dominance
  // Result: top candidate might have 1.0, second has ~0.9, third has ~0.8 instead of 1.0, 0.5, 0.25
  const flattenedScores = scores.map(s => {
    const normalized = (s - minScoreInEligible) / scoreRange;  // 0 to 1
    return 0.5 + (Math.sqrt(normalized) * 0.5);  // Range: 0.5 to 1.0 (flattened)
  });

  const totalWeight = flattenedScores.reduce((a, b) => a + b, 0);
  const probabilities = flattenedScores.map(s => s / totalWeight);

  // Log probabilities for debugging
  console.log('[Fast Cut AudioAnalyze] Variety selection probabilities:',
    eligible.map((c, i) => ({
      type: c.type,
      score: c.score.toFixed(2),
      probability: (probabilities[i] * 100).toFixed(1) + '%',
      startTime: c.start_time.toFixed(1)
    }))
  );

  // Weighted random selection
  const random = Math.random();
  let cumulative = 0;

  for (let i = 0; i < eligible.length; i++) {
    cumulative += probabilities[i];
    if (random <= cumulative) {
      // Find the original index in candidates array
      const originalIndex = candidates.findIndex(
        c => c.start_time === eligible[i].start_time && c.type === eligible[i].type
      );
      console.log('[Fast Cut AudioAnalyze] Selected candidate:', {
        index: i,
        originalIndex,
        type: eligible[i].type,
        score: eligible[i].score.toFixed(2),
        startTime: eligible[i].start_time.toFixed(1),
        random: random.toFixed(3)
      });
      return { candidate: eligible[i], selectedIndex: originalIndex };
    }
  }

  // Fallback (shouldn't reach here)
  return { candidate: eligible[0], selectedIndex: 0 };
}

/**
 * Select climax with variety options
 */
function selectClimaxWithVariety(
  candidates: ClimaxCandidate[],
  targetDuration: number,
  options: {
    preferVariety?: boolean;
    candidateIndex?: number;
    excludeStarts?: number[];
  } = {}
): { candidate: ClimaxCandidate | null; selectedIndex: number; selectionReason: string } {
  const { preferVariety = true, candidateIndex, excludeStarts } = options;

  if (!candidates || candidates.length === 0) {
    return { candidate: null, selectedIndex: -1, selectionReason: 'no_candidates' };
  }

  // If specific index requested, use it
  if (candidateIndex !== undefined && candidateIndex >= 0 && candidateIndex < candidates.length) {
    return {
      candidate: candidates[candidateIndex],
      selectedIndex: candidateIndex,
      selectionReason: `forced_index_${candidateIndex}`
    };
  }

  // Rerank based on target duration and exclusions
  const reranked = rerankCandidates(candidates, targetDuration, excludeStarts);

  if (reranked.length === 0) {
    // All candidates excluded, fall back to original top
    return {
      candidate: candidates[0],
      selectedIndex: 0,
      selectionReason: 'fallback_after_exclusion'
    };
  }

  // If variety disabled, just use top reranked
  if (!preferVariety) {
    const originalIndex = candidates.findIndex(
      c => c.start_time === reranked[0].start_time && c.type === reranked[0].type
    );
    return {
      candidate: reranked[0],
      selectedIndex: originalIndex,
      selectionReason: `top_reranked_for_${targetDuration}s`
    };
  }

  // Weighted random selection from top 3
  const { candidate, selectedIndex } = weightedRandomSelect(reranked, 3, 0.25);

  // Find original index
  const originalIndex = candidates.findIndex(
    c => c.start_time === candidate.start_time && c.type === candidate.type
  );

  return {
    candidate,
    selectedIndex: originalIndex >= 0 ? originalIndex : selectedIndex,
    selectionReason: `variety_selection_${candidate.type}_for_${targetDuration}s`
  };
}

// ============================================
// LYRICS-BASED CHORUS DETECTION
// ============================================

/**
 * Normalize text for comparison (remove punctuation, lowercase, etc.)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ]/g, '') // Keep alphanumeric and Korean characters
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate text similarity using Jaccard index
 */
function textSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).split(' '));
  const words2 = new Set(normalizeText(text2).split(' '));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Detect chorus sections from lyrics segments
 * Chorus = repeated lyrics patterns
 */
function detectChorusSections(
  segments: LyricsSegment[],
  targetDuration: number
): ClimaxCandidate[] {
  const candidates: ClimaxCandidate[] = [];

  if (!segments || segments.length < 4) {
    return candidates;
  }

  // Group consecutive segments into potential sections (4-8 segments each)
  const sectionSize = Math.min(6, Math.max(3, Math.floor(segments.length / 6)));
  const sections: { segments: LyricsSegment[]; start: number; end: number; text: string }[] = [];

  for (let i = 0; i <= segments.length - sectionSize; i += sectionSize) {
    const sectionSegments = segments.slice(i, i + sectionSize);
    const combinedText = sectionSegments.map(s => s.text).join(' ');
    sections.push({
      segments: sectionSegments,
      start: sectionSegments[0].start,
      end: sectionSegments[sectionSegments.length - 1].end,
      text: combinedText
    });
  }

  // Find repeated sections (likely chorus)
  const chorusSections: typeof sections = [];

  for (let i = 0; i < sections.length; i++) {
    let repeatCount = 0;

    for (let j = 0; j < sections.length; j++) {
      if (i !== j) {
        const similarity = textSimilarity(sections[i].text, sections[j].text);
        if (similarity > 0.6) { // 60% similarity threshold
          repeatCount++;
        }
      }
    }

    // If this section repeats at least once, it's likely a chorus
    if (repeatCount >= 1) {
      // Check if not too close to already detected chorus
      const isTooClose = chorusSections.some(
        existing => Math.abs(existing.start - sections[i].start) < 15
      );

      if (!isTooClose) {
        chorusSections.push(sections[i]);
      }
    }
  }

  // Convert chorus sections to climax candidates
  for (const chorus of chorusSections) {
    // Calculate start time with buildup (start a bit before chorus)
    const buildupTime = Math.min(3, chorus.start);
    const startTime = Math.max(0, chorus.start - buildupTime);

    // Score based on how many times it repeats and position
    const baseScore = 0.7;
    const positionBonus = chorus.start > 30 ? 0.1 : 0; // Later choruses might be better

    candidates.push({
      start_time: startTime,
      drop_time: chorus.start, // Chorus start is the "drop"
      score: Math.min(1.0, baseScore + positionBonus),
      type: 'chorus'
    });
  }

  // Sort by score
  candidates.sort((a, b) => b.score - a.score);

  console.log('[Fast Cut AudioAnalyze] Detected chorus sections:', candidates.length);

  return candidates.slice(0, 3); // Return top 3 chorus candidates
}

/**
 * Extract lyrics from audio and detect chorus
 */
async function analyzeLyricsForChorus(
  s3Url: string,
  audioDuration: number,
  targetDuration: number
): Promise<{ candidates: ClimaxCandidate[]; lyricsData?: LyricsExtractorOutput }> {
  try {
    console.log('[Fast Cut AudioAnalyze] Starting lyrics extraction for chorus detection...');

    const lyricsExtractor = createLyricsExtractorAgent();
    const result = await lyricsExtractor.extractLyricsFromUrl(
      s3Url,
      { languageHint: 'auto', audioDuration },
      {
        workflow: {
          artistName: 'Unknown',
          language: 'ko',
          platform: 'tiktok',
          sessionId: `lyrics-${Date.now()}`,
        },
      }
    );

    if (!result.success || !result.data) {
      console.log('[Fast Cut AudioAnalyze] Lyrics extraction failed:', result.error);
      return { candidates: [] };
    }

    if (result.data.isInstrumental) {
      console.log('[Fast Cut AudioAnalyze] Audio is instrumental, no lyrics to analyze');
      return { candidates: [], lyricsData: result.data };
    }

    console.log('[Fast Cut AudioAnalyze] Lyrics extracted:', {
      segments: result.data.segments.length,
      language: result.data.language,
      confidence: result.data.confidence
    });

    // Detect chorus from lyrics segments
    const chorusCandidates = detectChorusSections(result.data.segments, targetDuration);

    return {
      candidates: chorusCandidates,
      lyricsData: result.data
    };
  } catch (error) {
    console.error('[Fast Cut AudioAnalyze] Lyrics analysis error:', error);
    return { candidates: [] };
  }
}

/**
 * Merge audio-based and lyrics-based climax candidates
 */
function mergeCandidates(
  audioCandidates: ClimaxCandidate[],
  lyricsCandidates: ClimaxCandidate[]
): ClimaxCandidate[] {
  const merged: ClimaxCandidate[] = [...audioCandidates];

  for (const lyricsCandidate of lyricsCandidates) {
    // Check if there's a similar audio candidate (within 5 seconds)
    const existingIndex = merged.findIndex(
      c => Math.abs(c.start_time - lyricsCandidate.start_time) < 5
    );

    if (existingIndex >= 0) {
      // Boost existing candidate's score if lyrics confirm it
      merged[existingIndex] = {
        ...merged[existingIndex],
        score: Math.min(1.0, merged[existingIndex].score + 0.2),
        type: merged[existingIndex].type === 'chorus' ? 'chorus' : `${merged[existingIndex].type}+chorus`
      };
    } else {
      // Add as new candidate
      merged.push(lyricsCandidate);
    }
  }

  // Re-sort by score
  merged.sort((a, b) => b.score - a.score);

  return merged;
}
