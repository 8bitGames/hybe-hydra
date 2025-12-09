/**
 * Fast Cut Script Generation API
 * ==============================
 * 2-Stage Pipeline:
 * 1. FastCutScriptGeneratorAgent - Script + Vibe generation
 * 2. ImageKeywordGeneratorAgent - Vibe-based optimized keywords
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { createFastCutScriptGeneratorAgent } from '@/lib/agents/fast-cut';
import { createImageKeywordGeneratorAgent } from '@/lib/agents/fast-cut/image-keyword-generator';
import { generateTikTokSEO, TikTokSEO } from '@/lib/tiktok-seo';
import { AgentContext } from '@/lib/agents/types';

interface ScriptLine {
  text: string;
  timing: number;
  duration: number;
}

interface TrendContext {
  keyword: string;
  hashtags: string[];
  platform: string;
  rank?: number;
  relevanceScore?: number;
}

interface ScriptGenerationRequest {
  campaignId: string;
  artistName: string;
  artistContext?: string;
  trendKeywords: string[];
  trendContext?: TrendContext[];
  userPrompt: string;
  targetDuration: number;
  useGrounding?: boolean;
  language?: "ko" | "en";
}

interface KeywordCategories {
  subject: string[];
  scene: string[];
  moodVisual: string[];
  style: string[];
}

interface ScriptGenerationResponse {
  script: {
    lines: ScriptLine[];
    totalDuration: number;
  };
  vibe: string;
  vibeReason: string;
  suggestedBpmRange: { min: number; max: number };
  searchKeywords: string[];
  keywordCategories?: KeywordCategories;
  effectRecommendation: string;
  groundingInfo?: {
    sources: Array<{ title: string; url: string }>;
    summary?: string;
  };
  tiktokSEO?: TikTokSEO;
}

// Valid vibe types
const VALID_VIBES = ['Exciting', 'Emotional', 'Pop', 'Minimal'] as const;
type VibeType = typeof VALID_VIBES[number];

function isValidVibe(vibe: string): vibe is VibeType {
  return VALID_VIBES.includes(vibe as VibeType);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body: ScriptGenerationRequest = await request.json();
    const {
      artistName,
      artistContext,
      trendKeywords,
      trendContext,
      userPrompt,
      targetDuration: requestedDuration,
      useGrounding = true,
      language = "ko"
    } = body;

    // Auto-calculate duration if 0 is passed (default TikTok duration: 15 seconds)
    const targetDuration = requestedDuration > 0 ? requestedDuration : 15;

    // Build trend context string
    let trendContextStr = '';
    if (trendContext && trendContext.length > 0) {
      trendContextStr = trendContext.map(t => {
        const hashtags = t.hashtags?.length > 0 ? ` (${t.hashtags.join(', ')})` : '';
        return `- "${t.keyword}"${hashtags} [${t.platform}]`;
      }).join('\n');
    }

    // ================================================================
    // STAGE 1: Script Generation (Script + Vibe)
    // ================================================================
    console.log('[FastCut Pipeline] Stage 1: Script generation starting...');

    const scriptAgent = createFastCutScriptGeneratorAgent();
    const agentContext: AgentContext = {
      workflow: {
        artistName,
        platform: 'tiktok',
        language,
        sessionId: `script-${Date.now()}`,
      },
    };

    // Build additional context from artistContext and trends
    const additionalContext = [
      artistContext,
      trendContextStr ? `Current Trending Topics:\n${trendContextStr}` : '',
    ].filter(Boolean).join('\n\n');

    // Execute script agent
    const scriptResult = await scriptAgent.execute(
      {
        artistName,
        artistContext: additionalContext || undefined,
        userPrompt,
        targetDuration,
        trendKeywords: trendKeywords || [],
        trendContext: trendContext,
        useGrounding,
        language,
      },
      agentContext
    );

    // Check if script generation was successful
    if (!scriptResult.success || !scriptResult.data) {
      console.error('[FastCut Pipeline] Stage 1 failed:', scriptResult.error);
      return NextResponse.json(
        { detail: scriptResult.error || 'Failed to generate script' },
        { status: 500 }
      );
    }

    const scriptOutput = scriptResult.data;
    console.log('[FastCut Pipeline] Stage 1 complete. Vibe:', scriptOutput.vibe);

    // ================================================================
    // STAGE 2: Image Keyword Generation (Vibe-based)
    // ================================================================
    console.log('[FastCut Pipeline] Stage 2: Keyword generation starting...');

    const keywordAgent = createImageKeywordGeneratorAgent();
    const scriptLines = scriptOutput.script.lines.map(line => line.text);

    // Validate and normalize vibe
    const normalizedVibe = isValidVibe(scriptOutput.vibe)
      ? scriptOutput.vibe
      : 'Pop';

    const keywordResult = await keywordAgent.execute(
      {
        vibe: normalizedVibe,
        userPrompt,
        artistName,
        scriptLines,
        language,
      },
      agentContext
    );

    // Process keyword results
    let searchKeywords: string[] = [];
    let keywordCategories: KeywordCategories | undefined;

    if (keywordResult.success && keywordResult.data) {
      searchKeywords = keywordResult.data.searchKeywords;
      keywordCategories = keywordResult.data.keywordCategories;
      console.log('[FastCut Pipeline] Stage 2 complete. Keywords:', searchKeywords.length);
    } else {
      console.warn('[FastCut Pipeline] Stage 2 failed, using fallback keywords:', keywordResult.error);
      // Fallback to basic keywords
      searchKeywords = [
        'concert stage lights 4K',
        'performance crowd cheering HD',
        'music video aesthetic cinematic',
        'stage spotlight professional photo',
      ];
    }

    // Add user-provided trend keywords (highest priority)
    if (trendKeywords && trendKeywords.length > 0) {
      searchKeywords = [
        ...trendKeywords,
        ...searchKeywords.filter(kw =>
          !trendKeywords.some(tk => tk.toLowerCase() === kw.toLowerCase())
        ),
      ];
    }

    // ================================================================
    // Build Response
    // ================================================================
    const parsedResponse: ScriptGenerationResponse = {
      script: {
        lines: scriptOutput.script.lines.map(line => ({
          text: line.text,
          timing: line.timing,
          duration: line.duration,
        })),
        totalDuration: scriptOutput.script.totalDuration || scriptOutput.script.lines.reduce(
          (acc, line) => Math.max(acc, line.timing + line.duration),
          targetDuration
        ),
      },
      vibe: scriptOutput.vibe,
      vibeReason: scriptOutput.vibeReason || `${scriptOutput.vibe} mood for this content`,
      suggestedBpmRange: scriptOutput.suggestedBpmRange,
      searchKeywords,
      keywordCategories,
      effectRecommendation: scriptOutput.effectRecommendation || 'zoom_beat',
      groundingInfo: scriptOutput.groundingInfo,
    };

    // Ensure totalDuration is valid
    if (!parsedResponse.script.totalDuration || parsedResponse.script.totalDuration <= 0) {
      parsedResponse.script.totalDuration = targetDuration;
    }

    // Generate TikTok SEO metadata
    const scriptTexts = parsedResponse.script.lines.map(line => line.text);
    parsedResponse.tiktokSEO = generateTikTokSEO(
      artistName,
      userPrompt,
      parsedResponse.vibe,
      scriptTexts,
      trendKeywords,
      language
    );

    console.log('[FastCut Pipeline] Complete. Total keywords:', parsedResponse.searchKeywords.length);
    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error('Script generation error:', error);
    return NextResponse.json(
      { detail: 'Failed to generate script' },
      { status: 500 }
    );
  }
}
