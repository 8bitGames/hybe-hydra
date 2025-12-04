import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeader } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

interface PublishContextMetadata {
  // From Discover stage
  trendKeywords?: string[];
  hashtags?: string[];
  performanceMetrics?: {
    avgViews: number;
    avgEngagement: number;
  };

  // From Analyze stage
  campaignName?: string;
  artistName?: string;
  userIdea?: string;
  targetAudience?: string[];
  contentGoals?: string[];
  selectedIdea?: {
    title: string;
    hook: string;
    description: string;
  };

  // From Create stage
  prompt?: string;
  generationType?: "AI" | "COMPOSE";

  // Video metadata
  duration?: number;
  aspectRatio?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const {
      context,
      platform = "tiktok",
      language = "en",
    }: {
      context: PublishContextMetadata;
      platform?: "tiktok" | "instagram" | "youtube";
      language?: "en" | "ko";
    } = body;

    // Build context prompt
    const contextParts: string[] = [];

    if (context.campaignName) {
      contextParts.push(`Campaign: ${context.campaignName}`);
    }
    if (context.artistName) {
      contextParts.push(`Artist: ${context.artistName}`);
    }
    if (context.userIdea) {
      contextParts.push(`Original Idea: ${context.userIdea}`);
    }
    if (context.targetAudience?.length) {
      contextParts.push(`Target Audience: ${context.targetAudience.join(", ")}`);
    }
    if (context.contentGoals?.length) {
      contextParts.push(`Content Goals: ${context.contentGoals.join(", ")}`);
    }
    if (context.selectedIdea) {
      contextParts.push(`Selected Concept: ${context.selectedIdea.title} - ${context.selectedIdea.hook}`);
      contextParts.push(`Description: ${context.selectedIdea.description}`);
    }
    if (context.trendKeywords?.length) {
      contextParts.push(`Trending Keywords: ${context.trendKeywords.join(", ")}`);
    }
    if (context.hashtags?.length) {
      contextParts.push(`Reference Hashtags: ${context.hashtags.join(", ")}`);
    }
    if (context.prompt) {
      contextParts.push(`Video Prompt: ${context.prompt}`);
    }
    if (context.generationType) {
      contextParts.push(`Generation Type: ${context.generationType}`);
    }
    if (context.duration) {
      contextParts.push(`Video Duration: ${context.duration}s`);
    }

    const platformCharLimits: Record<string, number> = {
      tiktok: 2200,
      instagram: 2200,
      youtube: 500,
    };

    const platformHashtagLimits: Record<string, number> = {
      tiktok: 8,
      instagram: 30,
      youtube: 15,
    };

    const systemPrompt = `You are a social media content expert specializing in ${platform.toUpperCase()} short-form video content.
Generate engaging captions and optimized hashtags for maximum discoverability and engagement.

Guidelines:
- Caption should be ${language === "ko" ? "in Korean" : "in English"}
- Caption must be under ${platformCharLimits[platform]} characters
- Include a hook in the first line to capture attention
- Use emojis strategically but not excessively
- End with a call-to-action or question for engagement
- Generate exactly ${platformHashtagLimits[platform]} relevant hashtags
- Mix popular hashtags with niche-specific ones
- Hashtags should be relevant to the content and trending

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "caption": "Your engaging caption here with hook and CTA",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", ...],
  "reasoning": "Brief explanation of your choices"
}`;

    const userPrompt = `Generate an optimized ${platform} caption and hashtags based on this video content context:

${contextParts.join("\n")}

Remember to respond ONLY with valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt + "\n\n" + userPrompt }],
        },
      ],
    });

    const text = response.text || "";

    // Extract JSON from response
    let result: { caption: string; hashtags: string[]; reasoning?: string };

    try {
      // Try to parse the entire response as JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      console.log("Raw response:", text);

      // Fallback response
      result = {
        caption: context.selectedIdea?.hook || context.userIdea || "Check out this video!",
        hashtags: context.hashtags?.slice(0, platformHashtagLimits[platform]) || ["fyp", "viral", "trending"],
        reasoning: "Fallback response due to parsing error",
      };
    }

    // Clean up hashtags (remove # if present)
    const cleanedHashtags = result.hashtags.map((h) => h.replace(/^#/, "").toLowerCase());

    return NextResponse.json({
      success: true,
      caption: result.caption,
      hashtags: cleanedHashtags,
      reasoning: result.reasoning,
      platform,
      language,
    });
  } catch (error) {
    console.error("AI suggest publish content error:", error);
    return NextResponse.json(
      {
        detail: "Failed to generate suggestions",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
