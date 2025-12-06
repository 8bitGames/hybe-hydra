/**
 * Compose Script Generation API
 * ==============================
 * Uses ComposeScriptGeneratorAgent for TikTok script creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { createComposeScriptGeneratorAgent } from '@/lib/agents/compose';
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

interface ScriptGenerationResponse {
  script: {
    lines: ScriptLine[];
    totalDuration: number;
  };
  vibe: string;
  vibeReason: string;
  suggestedBpmRange: { min: number; max: number };
  searchKeywords: string[];
  effectRecommendation: string;
  groundingInfo?: {
    sources: Array<{ title: string; url: string }>;
    summary?: string;
  };
  tiktokSEO?: TikTokSEO;
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

    // Create agent and context
    const scriptAgent = createComposeScriptGeneratorAgent();

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

    // Execute agent
    const agentResult = await scriptAgent.execute(
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

    // Check if agent execution was successful
    if (!agentResult.success || !agentResult.data) {
      console.error('Agent execution failed:', agentResult.error);
      return NextResponse.json(
        { detail: agentResult.error || 'Failed to generate script' },
        { status: 500 }
      );
    }

    const output = agentResult.data;

    // Transform agent output to API response format
    const parsedResponse: ScriptGenerationResponse = {
      script: {
        lines: output.script.lines.map(line => ({
          text: line.text,
          timing: line.timing,
          duration: line.duration,
        })),
        totalDuration: output.script.totalDuration || output.script.lines.reduce(
          (acc, line) => Math.max(acc, line.timing + line.duration),
          targetDuration
        ),
      },
      vibe: output.vibe,
      vibeReason: output.vibeReason || `${output.vibe} mood for ${artistName} content`,
      suggestedBpmRange: output.suggestedBpmRange,
      searchKeywords: output.searchKeywords,
      effectRecommendation: output.effectRecommendation || 'zoom_beat',
      groundingInfo: output.groundingInfo,
    };

    // Ensure totalDuration is valid
    if (!parsedResponse.script.totalDuration || parsedResponse.script.totalDuration <= 0) {
      parsedResponse.script.totalDuration = targetDuration;
    }

    // Ensure enough search keywords
    if (parsedResponse.searchKeywords.length < 4) {
      const defaultKeywords = [
        `${artistName} HD photo`,
        `${artistName} 4K`,
        `${artistName} 2024`,
        `${artistName} official photo`,
      ];
      parsedResponse.searchKeywords = [
        ...new Set([...parsedResponse.searchKeywords, ...defaultKeywords])
      ];
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

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error('Script generation error:', error);
    return NextResponse.json(
      { detail: 'Failed to generate script' },
      { status: 500 }
    );
  }
}
