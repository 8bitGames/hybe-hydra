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

/**
 * Generate fallback keywords from user prompt when AI keyword generation fails
 * Extracts meaningful phrases and adds quality modifiers
 */
function generateFallbackKeywordsFromPrompt(prompt: string, vibe: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'and', 'or', 'but',
    'this', 'that', 'these', 'those', 'it', 'its', 'from', 'by', 'as',
    'their', 'they', 'them', 'her', 'his', 'him', 'she', 'he', 'we', 'our',
  ]);

  // Vibe-based quality modifiers
  const vibeModifiers: Record<string, string[]> = {
    'Exciting': ['dynamic', 'vibrant', '4K'],
    'Emotional': ['cinematic', 'aesthetic', 'HD'],
    'Pop': ['trendy', 'modern', '4K'],
    'Minimal': ['clean', 'minimal', 'aesthetic'],
  };

  const modifiers = vibeModifiers[vibe] || ['aesthetic', '4K'];

  // Extract meaningful words from prompt
  const words = prompt.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Remove duplicates while preserving order
  const uniqueWords = [...new Set(words)];

  // Build search-friendly keyword phrases (2-word combinations)
  const keywords: string[] = [];

  // Create 2-word phrases for better search results
  for (let i = 0; i < uniqueWords.length && keywords.length < 4; i++) {
    const word1 = uniqueWords[i];
    const word2 = uniqueWords[i + 1];

    if (word2) {
      keywords.push(`${word1} ${word2} ${modifiers[keywords.length % modifiers.length]}`);
      i++; // Skip the next word since we used it
    } else {
      keywords.push(`${word1} ${modifiers[0]} photography`);
    }
  }

  // Ensure at least 4 keywords
  if (keywords.length < 4 && uniqueWords.length > 0) {
    const remaining = 4 - keywords.length;
    for (let i = 0; i < remaining && i < uniqueWords.length; i++) {
      keywords.push(`${uniqueWords[i]} ${vibe.toLowerCase()} ${modifiers[i % modifiers.length]}`);
    }
  }

  console.log('[FastCut Pipeline] Generated fallback keywords from prompt:', keywords);
  return keywords.length > 0 ? keywords : [`${vibe.toLowerCase()} aesthetic 4K`, `${vibe.toLowerCase()} mood cinematic`];
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

    // Process keyword results with retry logic
    let searchKeywords: string[] = [];
    let keywordCategories: KeywordCategories | undefined;
    const MAX_KEYWORD_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_KEYWORD_RETRIES; attempt++) {
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

      if (keywordResult.success && keywordResult.data) {
        searchKeywords = keywordResult.data.searchKeywords;
        keywordCategories = keywordResult.data.keywordCategories;
        console.log(`[FastCut Pipeline] Stage 2 complete (attempt ${attempt}). Keywords:`, searchKeywords.length);
        break;
      } else {
        console.warn(`[FastCut Pipeline] Stage 2 attempt ${attempt}/${MAX_KEYWORD_RETRIES} failed:`, keywordResult.error);

        if (attempt === MAX_KEYWORD_RETRIES) {
          // All retries failed - generate fallback from user prompt
          console.warn('[FastCut Pipeline] All keyword generation attempts failed, generating from prompt');
          searchKeywords = generateFallbackKeywordsFromPrompt(userPrompt, normalizedVibe);
        }
      }
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
