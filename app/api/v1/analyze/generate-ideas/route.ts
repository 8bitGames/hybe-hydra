import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// Types
// ============================================================================

interface GenerateIdeasRequest {
  user_idea: string;
  keywords: string[];
  hashtags: string[];
  target_audience: string[];
  content_goals: string[];
  inspiration_count: number;
  performance_metrics?: {
    avgViews: number;
    avgEngagement: number;
    viralBenchmark: number;
  } | null;
}

interface ContentIdea {
  id: string;
  type: "ai_video" | "compose";
  title: string;
  hook: string;
  description: string;
  estimatedEngagement: "high" | "medium" | "low";
  optimizedPrompt: string;
  suggestedMusic?: {
    bpm: number;
    genre: string;
  };
  scriptOutline?: string[];
}

interface GenerateIdeasResponse {
  success: boolean;
  ideas: ContentIdea[];
  optimized_hashtags: string[];
  content_strategy: string;
}

// ============================================================================
// Gemini AI Configuration
// ============================================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateIdeasRequest = await request.json();

    const {
      user_idea,
      keywords,
      hashtags,
      target_audience,
      content_goals,
      inspiration_count,
      performance_metrics,
    } = body;

    // Build the prompt for Gemini
    const prompt = buildPrompt({
      user_idea,
      keywords,
      hashtags,
      target_audience,
      content_goals,
      inspiration_count,
      performance_metrics,
    });

    // Call Gemini API
    const tools = [{ googleSearch: {} }];
    const config = {
      tools,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH,
      },
    };

    const response = await ai.models.generateContentStream({
      model: "gemini-3-pro-preview",
      config,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    // Collect all chunks from the stream
    let responseText = "";
    for await (const chunk of response) {
      responseText += chunk.text || "";
    }
    const parsedResponse = parseGeminiResponse(responseText);

    return NextResponse.json({
      success: true,
      ideas: parsedResponse.ideas,
      optimized_hashtags: parsedResponse.optimizedHashtags,
      content_strategy: parsedResponse.contentStrategy,
    } as GenerateIdeasResponse);
  } catch (error) {
    console.error("Generate ideas error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate ideas",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildPrompt(params: GenerateIdeasRequest): string {
  const {
    user_idea,
    keywords,
    hashtags,
    target_audience,
    content_goals,
    inspiration_count,
    performance_metrics,
  } = params;

  let prompt = `You are a creative content strategist specializing in viral TikTok and short-form video content. Generate 3-4 unique content ideas based on the following inputs.

## User's Concept
${user_idea || "No specific idea provided - suggest trending content ideas"}

## Trend Context
- Keywords: ${keywords.length > 0 ? keywords.join(", ") : "None specified"}
- Selected Hashtags: ${hashtags.length > 0 ? hashtags.map((h) => h.startsWith("#") ? h : `#${h}`).join(" ") : "None specified"}
- Saved Inspiration Videos: ${inspiration_count} videos saved for reference

## Target Audience
${target_audience.length > 0 ? target_audience.join(", ") : "General audience"}

## Content Goals
${content_goals.length > 0 ? content_goals.join(", ") : "Engagement and awareness"}
`;

  if (performance_metrics) {
    prompt += `
## Performance Benchmarks (from trend analysis)
- Average Views: ${Math.round(performance_metrics.avgViews).toLocaleString()}
- Average Engagement Rate: ${performance_metrics.avgEngagement.toFixed(2)}%
- Viral Benchmark: ${Math.round(performance_metrics.viralBenchmark).toLocaleString()}+ views
`;
  }

  prompt += `
## Output Requirements
Generate your response in the following JSON format (return ONLY valid JSON, no markdown):

{
  "ideas": [
    {
      "type": "ai_video",
      "title": "Short catchy title (max 50 chars)",
      "hook": "Opening hook/caption that grabs attention (max 100 chars)",
      "description": "Brief description of the concept (2-3 sentences)",
      "estimatedEngagement": "high" or "medium" or "low",
      "optimizedPrompt": "Detailed VEO AI video generation prompt (cinematic, professional quality, specific visual details, 200+ words)",
      "suggestedMusic": {
        "bpm": number (80-140),
        "genre": "genre name"
      },
      "scriptOutline": ["Scene 1 description", "Scene 2 description", ...]
    }
  ],
  "optimizedHashtags": ["hashtag1", "hashtag2", ...],
  "contentStrategy": "Brief overall strategy recommendation (1-2 sentences)"
}

Guidelines:
1. ALL ideas must be "ai_video" type - focus on cinematic, visually stunning video concepts that AI can generate
2. The optimizedPrompt must be highly detailed and specific for VEO AI video generation (camera movements, lighting, style, mood, etc.)
3. Include trending elements from the keywords/hashtags
4. Consider the target audience in tone and style
5. Optimized hashtags should include a mix of popular and niche tags (without # prefix)
6. Return ONLY the JSON object, no other text`;

  return prompt;
}

function parseGeminiResponse(responseText: string): {
  ideas: ContentIdea[];
  optimizedHashtags: string[];
  contentStrategy: string;
} {
  try {
    // Try to extract JSON from the response
    let jsonStr = responseText;

    // Remove markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object in the text
    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      jsonStr = jsonObjectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    // Add IDs to ideas
    const ideas: ContentIdea[] = (parsed.ideas || []).map((idea: Omit<ContentIdea, "id">) => ({
      ...idea,
      id: uuidv4(),
    }));

    return {
      ideas,
      optimizedHashtags: parsed.optimizedHashtags || [],
      contentStrategy: parsed.contentStrategy || "",
    };
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    console.error("Response text:", responseText);

    // Return fallback ideas if parsing fails
    return {
      ideas: [
        {
          id: uuidv4(),
          type: "ai_video",
          title: "Trending Dance Challenge",
          hook: "POV: When the beat drops and you can't help but dance",
          description:
            "A high-energy dance video capturing trending choreography with dynamic camera movements and vibrant lighting.",
          estimatedEngagement: "high",
          optimizedPrompt:
            "A cinematic TikTok-style video of a young dancer performing trending choreography. The scene features dynamic camera movements, smooth transitions, and professional lighting. Shot in 9:16 vertical format, 60fps, with energetic and youthful atmosphere. The background is modern and clean, with subtle lighting effects that sync with the rhythm.",
          suggestedMusic: {
            bpm: 120,
            genre: "Pop/Dance",
          },
          scriptOutline: [
            "Opening: Quick transition into dance pose",
            "Main: Choreography sequence with dynamic angles",
            "Climax: Signature move with slow-motion effect",
            "Ending: Freeze frame with call-to-action",
          ],
        },
        {
          id: uuidv4(),
          type: "ai_video",
          title: "Cinematic Lifestyle Moment",
          hook: "This is what living your best life looks like...",
          description:
            "A visually stunning cinematic video showcasing aspirational lifestyle moments with dramatic lighting and smooth camera movements.",
          estimatedEngagement: "high",
          optimizedPrompt:
            "Cinematic lifestyle video with golden hour lighting, smooth dolly movements, and bokeh backgrounds. Professional color grading with warm tones. Shot in 9:16 vertical format at 24fps for film-like quality. Slow motion sequences highlighting key moments with dramatic depth of field.",
          suggestedMusic: {
            bpm: 100,
            genre: "Cinematic/Ambient",
          },
          scriptOutline: [
            "Opening: Dramatic establishing shot",
            "Build-up: Series of lifestyle moments",
            "Climax: Hero shot with slow motion",
            "Ending: Inspirational closing frame",
          ],
        },
      ],
      optimizedHashtags: ["fyp", "viral", "trending", "foryou"],
      contentStrategy:
        "Focus on creating visually stunning AI-generated video content that captures trending moments with cinematic quality.",
    };
  }
}
