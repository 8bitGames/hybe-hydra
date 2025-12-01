import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateTikTokSEO, TikTokSEO } from '@/lib/tiktok-seo';

const GOOGLE_API_KEY = process.env.GOOGLE_AI_API_KEY || '';

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
  trendContext?: TrendContext[];  // Current trending topics to incorporate
  userPrompt: string;
  targetDuration: number;
  useGrounding?: boolean;
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
      useGrounding = true
    } = body;

    // Auto-calculate duration if 0 is passed (default TikTok duration: 15 seconds)
    const targetDuration = requestedDuration > 0 ? requestedDuration : 15;

    // Build trend context string for prompt
    let trendContextStr = '';
    if (trendContext && trendContext.length > 0) {
      const trendInfo = trendContext.map(t => {
        const hashtags = t.hashtags?.length > 0 ? ` (${t.hashtags.join(', ')})` : '';
        return `- "${t.keyword}"${hashtags} [${t.platform}]`;
      }).join('\n');
      trendContextStr = `\n\nCurrent Trending Topics on TikTok/Social Media:\n${trendInfo}\nNaturally incorporate relevant trends into the script to maximize engagement and discoverability.`;
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

    let groundingInfo: ScriptGenerationResponse['groundingInfo'] = undefined;
    let additionalContext = '';

    // Step 1: If grounding enabled, get real-time info about the artist
    if (useGrounding && GOOGLE_API_KEY) {
      try {
        const groundingModel = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          tools: [
            // @ts-expect-error - google_search is the new API format
            { google_search: {} },
          ],
        });

        const groundingPrompt = `Search for the latest news and information about "${artistName}" (country music artist).

Find:
1. Recent activities, comebacks, or releases
2. Current trends or viral moments
3. Popular hashtags or fan terms
4. Recent photoshoots or appearances

Summarize in 2-3 sentences what's currently trending about this artist.`;

        const groundingResult = await groundingModel.generateContent(groundingPrompt);
        const groundingResponse = groundingResult.response;

        additionalContext = groundingResponse.text();

        // Extract grounding sources
        const groundingMetadata = groundingResponse.candidates?.[0]?.groundingMetadata;
        const groundingChunks = groundingMetadata?.groundingChunks || [];

        groundingInfo = {
          sources: groundingChunks.map((chunk: { web?: { uri?: string; title?: string } }) => ({
            title: chunk.web?.title || 'Source',
            url: chunk.web?.uri || '',
          })).filter((s: { url: string }) => s.url),
          summary: additionalContext,
        };
      } catch (groundingError) {
        console.warn('Grounding search failed, continuing without:', groundingError);
      }
    }

    // Step 2: Generate script with enhanced context
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    });

    const prompt = `You are a creative director for country music social media content. Generate a video script and mood analysis.

Artist: ${artistName}
${artistContext ? `Artist Context: ${artistContext}` : ''}
${additionalContext ? `\nRecent News & Trends:\n${additionalContext}` : ''}
${trendKeywords.length > 0 ? `Trend Keywords: ${trendKeywords.join(', ')}` : ''}${trendContextStr}
User Request: ${userPrompt}
Target Duration: ${targetDuration} seconds

Generate a JSON response with the following structure:
{
  "script": {
    "lines": [
      { "text": "HOOK TEXT", "timing": 0, "duration": 2 },
      { "text": "Setup line", "timing": 2, "duration": 2.5 },
      { "text": "Build up", "timing": 4.5, "duration": 2.5 },
      { "text": "Key point", "timing": 7, "duration": 2.5 },
      { "text": "Climax/Answer", "timing": 9.5, "duration": 2.5 },
      { "text": "Call to action", "timing": 12, "duration": 3 }
    ],
    "totalDuration": ${targetDuration}
  },
  "vibe": "One of: Exciting, Emotional, Pop, Minimal",
  "vibeReason": "Brief explanation of why this vibe fits",
  "suggestedBpmRange": { "min": 100, "max": 120 },
  "searchKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
  "effectRecommendation": "One of: zoom_beat, crossfade, bounce, minimal"
}

Rules:
1. CRITICAL - Script Line Count:
   - MINIMUM 5 script lines, MAXIMUM 8 lines
   - Follow this structure: Hook → Setup → Build → Climax → CTA (Call to Action)
   - Each line should have clear purpose in the narrative
2. IMPORTANT - TikTok Hook Strategy:
   - FIRST LINE MUST BE A HOOK TEXT (curiosity-inducing, 2-4 words)
   - Hook text examples: "Wait for it...", "This is insane", "Nobody expected this", "You won't believe", "The moment when...", "POV:", "When you realize..."
   - Hook text creates curiosity and makes viewers want to keep watching
   - Hook text appears during calm audio intro (first 2 seconds)
3. Script lines should be SHORT (3-8 words each) and impactful for TikTok-style videos
4. Total script lines should fit within ${targetDuration} seconds with proper spacing
5. Vibe should match the content mood:
   - Exciting: Fast, energetic content (120-140 BPM)
   - Emotional: Slow, heartfelt content (60-80 BPM)
   - Pop: Trendy, mainstream content (100-120 BPM)
   - Minimal: Clean, professional content (80-120 BPM)
5. Search keywords PRIORITY (CRITICAL - follow this order exactly):
   - FIRST: Include ALL user-provided trend keywords exactly as given: ${trendKeywords.length > 0 ? `[${trendKeywords.join(', ')}]` : '[none provided]'}
   - SECOND: Extract key visual concepts from the user prompt: "${userPrompt}"
   - THIRD: Include "${artistName}" combined with visual terms (HD photo, 4K, stage, concert, etc.)
   - AVOID: Generic tags, trending hashtags unrelated to the content, random celebrity names
6. Generate 8-10 unique search keywords for best image search results
   - User keywords MUST appear first in the array
   - Every keyword must be directly relevant to the video concept or artist
7. Return ONLY the JSON, no other text`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse the JSON response
    let parsedResponse: ScriptGenerationResponse;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = response;
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        // Try to find JSON object directly
        const startIdx = response.indexOf('{');
        const endIdx = response.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          jsonStr = response.substring(startIdx, endIdx + 1);
        }
      }
      parsedResponse = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', response);
      // Return a default response with TikTok Hook Strategy (5-6 lines)
      parsedResponse = {
        script: {
          lines: [
            { text: 'Wait for it...', timing: 0, duration: 2 },  // Hook text
            { text: `${artistName}`, timing: 2, duration: 2.5 },  // Setup
            { text: userPrompt.slice(0, 25) || 'Check this out', timing: 4.5, duration: 2.5 },  // Build
            { text: 'This is legendary', timing: 7, duration: 2.5 },  // Climax
            { text: 'You need to see this', timing: 9.5, duration: 2.5 },  // Peak
            { text: 'Follow for more!', timing: 12, duration: 3 }  // CTA
          ],
          totalDuration: targetDuration
        },
        vibe: 'Pop',
        vibeReason: 'Default vibe for country music content',
        suggestedBpmRange: { min: 100, max: 120 },
        searchKeywords: [
          `${artistName} HD photo`,
          `${artistName} 4K`,
          `${artistName} 2024`,
          `${artistName} concept photo`,
          `${artistName} photoshoot`,
          `${artistName} official`,
          `${artistName} stage`,
          `${artistName} visual`
        ],
        effectRecommendation: 'zoom_beat'
      };
    }

    // Add grounding info if available
    if (groundingInfo) {
      parsedResponse.groundingInfo = groundingInfo;
    }

    // Ensure totalDuration is valid (never 0)
    if (!parsedResponse.script.totalDuration || parsedResponse.script.totalDuration <= 0) {
      // Calculate from script lines if available
      if (parsedResponse.script.lines.length > 0) {
        const lastLine = parsedResponse.script.lines[parsedResponse.script.lines.length - 1];
        parsedResponse.script.totalDuration = lastLine.timing + lastLine.duration;
      } else {
        parsedResponse.script.totalDuration = targetDuration;
      }
    }

    // Ensure we have enough search keywords
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
      trendKeywords
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
