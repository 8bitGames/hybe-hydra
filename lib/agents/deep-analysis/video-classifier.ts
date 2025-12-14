/**
 * Video Classifier Agent
 * =======================
 * Classifies TikTok videos into content categories using AI.
 * Analyzes video metadata, description, hashtags to determine content type.
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentContext } from '../types';

// =============================================================================
// Input/Output Schemas
// =============================================================================

export const VideoClassifierInputSchema = z.object({
  videos: z.array(z.object({
    id: z.string(),
    description: z.string(),
    hashtags: z.array(z.string()),
    musicTitle: z.string().optional(),
    duration: z.number().optional(),
    engagementRate: z.number(),
    playCount: z.number(),
    likeCount: z.number(),
    commentCount: z.number(),
    shareCount: z.number(),
  })),
  accountInfo: z.object({
    nickname: z.string(),
    uniqueId: z.string(),
    verified: z.boolean(),
    followers: z.number(),
  }),
  language: z.enum(['ko', 'en']).default('ko'),
});

// Lenient classification schema - AI may not return all fields consistently
const ClassificationItemSchema = z.object({
  videoId: z.string().optional().default(''),
  primaryCategory: z.string().optional().default('other'),
  secondaryCategories: z.array(z.string()).optional().default([]),
  contentType: z.enum(['performance', 'behind-the-scenes', 'promotional', 'trend', 'personal', 'collaboration', 'challenge', 'other']).optional().default('other'),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  reasoning: z.string().optional().default(''),
  engagementPotential: z.enum(['high', 'medium', 'low']).optional().default('medium'),
}).passthrough();

const DistributionItemSchema = z.object({
  category: z.string().optional().default(''),
  contentType: z.string().optional().default(''),
  count: z.number().optional().default(0),
  percentage: z.number().optional().default(0),
  avgEngagement: z.number().optional().default(0),
}).passthrough();

export const VideoClassifierOutputSchema = z.object({
  classifications: z.array(ClassificationItemSchema).optional().default([]),
  categoryDistribution: z.array(DistributionItemSchema).optional().default([]),
  contentTypeDistribution: z.array(DistributionItemSchema).optional().default([]),
  insights: z.object({
    dominantCategory: z.string().optional().default(''),
    dominantContentType: z.string().optional().default(''),
    contentDiversity: z.number().min(0).max(1).optional().default(0),
    recommendations: z.array(z.string()).optional().default([]),
  }).optional().default({
    dominantCategory: '',
    dominantContentType: '',
    contentDiversity: 0,
    recommendations: [],
  }),
}).passthrough();

export type VideoClassifierInput = z.infer<typeof VideoClassifierInputSchema>;
export type VideoClassifierOutput = z.infer<typeof VideoClassifierOutputSchema>;

// =============================================================================
// System Prompt
// =============================================================================

const SYSTEM_PROMPT = `You are an expert TikTok content analyst specializing in video classification.
Your task is to analyze video metadata and classify content into meaningful categories.

## Classification Guidelines

### Content Types (choose one primary):
- **performance**: Music performances, dance covers, live singing, instrument playing
- **behind-the-scenes**: Studio sessions, rehearsals, making-of content, daily life
- **promotional**: Album/single promotions, concert announcements, merchandise
- **trend**: Participating in TikTok trends, challenges, viral formats
- **personal**: Personal updates, Q&A, casual vlogs, fan interactions
- **collaboration**: Featuring other artists, duets, joint content
- **challenge**: Dance challenges, song challenges, branded challenges
- **other**: Content that doesn't fit other categories

### Category Determination:
Analyze the video's:
1. Description text and keywords
2. Hashtags used
3. Music choice (own music vs trending sounds)
4. Engagement patterns
5. Duration and format

### Quality Standards:
- Be consistent in categorization
- Consider context (artist account type)
- Weight engagement data in potential assessment
- Provide clear reasoning for each classification

### LANGUAGE REQUIREMENT:
- You MUST respond in the language specified in the prompt (Korean or English)
- ALL text fields (reasoning, recommendations, insights) MUST be in the specified language
- If language is "Korean", write reasoning and insights in Korean (한국어로 작성)
- If language is "English", write reasoning and insights in English

## CRITICAL: Response JSON Schema
You MUST return a valid JSON object matching this EXACT structure:

{
  "classifications": [
    {
      "videoId": "string (video ID)",
      "primaryCategory": "string (main category)",
      "secondaryCategories": ["array", "of", "strings"],
      "contentType": "performance|behind-the-scenes|promotional|trend|personal|collaboration|challenge|other",
      "confidence": 0.85,
      "reasoning": "string explanation",
      "engagementPotential": "high|medium|low"
    }
  ],
  "categoryDistribution": [
    {
      "category": "string (category name)",
      "count": 5,
      "percentage": 25.0,
      "avgEngagement": 3.5
    }
  ],
  "contentTypeDistribution": [
    {
      "contentType": "string (content type name)",
      "count": 3,
      "percentage": 15.0,
      "avgEngagement": 4.2
    }
  ],
  "insights": {
    "dominantCategory": "string (most common category)",
    "dominantContentType": "string (most common content type)",
    "contentDiversity": 0.65,
    "recommendations": ["array", "of", "recommendation", "strings"]
  }
}

IMPORTANT:
- categoryDistribution MUST be an ARRAY of objects, NOT an object with category keys
- contentTypeDistribution MUST be an ARRAY of objects, NOT an object with type keys
- insights MUST be an OBJECT with the exact fields shown, NOT a string
- Return ONLY valid JSON, no markdown code blocks or extra text
- ALWAYS complete the entire JSON structure - never truncate or cut off mid-response
- Keep reasoning strings SHORT (1-2 sentences max) to ensure full response completion
- If analyzing many videos, prioritize completing all classifications over detailed reasoning`;

// =============================================================================
// Agent Configuration (exported for seed API)
// =============================================================================

export const VideoClassifierConfig = {
  id: 'video-classifier',
  name: 'Video Classifier',
  description: 'TikTok 영상을 콘텐츠 유형별로 분류 및 분석',
  category: 'analyzer',
  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.3, // Low temperature for consistent classification
      maxTokens: 16384, // Increased to handle many video classifications
    },
  },
  prompts: {
    system: SYSTEM_PROMPT,
    templates: {
      classify: `Analyze and classify the following {{videoCount}} videos from @{{uniqueId}} ({{nickname}}).

## Account Context
- Verified: {{verified}}
- Followers: {{followers}}
- Language: {{language}}

## Videos to Classify
{{videos}}

Classify each video and provide overall category/content type distribution with insights.

**IMPORTANT: You MUST respond entirely in {{language}}.**
All text fields including reasoning, recommendations, and insights MUST be written in {{language}}.`,
    },
  },
  inputSchema: VideoClassifierInputSchema,
  outputSchema: VideoClassifierOutputSchema,
};

// =============================================================================
// Agent Implementation
// =============================================================================

export class VideoClassifierAgent extends BaseAgent<VideoClassifierInput, VideoClassifierOutput> {
  constructor() {
    super(VideoClassifierConfig as any);
  }

  protected buildPrompt(input: VideoClassifierInput, context: AgentContext): string {
    const videosJson = input.videos.map((v, i) => ({
      index: i + 1,
      id: v.id,
      description: v.description.slice(0, 300), // Truncate long descriptions
      hashtags: v.hashtags.slice(0, 10), // Limit hashtags
      music: v.musicTitle,
      duration: v.duration,
      engagement: {
        rate: v.engagementRate.toFixed(2) + '%',
        plays: v.playCount,
        likes: v.likeCount,
        comments: v.commentCount,
        shares: v.shareCount,
      },
    }));

    return this.fillTemplate(this.getTemplate('classify'), {
      videoCount: input.videos.length,
      uniqueId: input.accountInfo.uniqueId,
      nickname: input.accountInfo.nickname,
      verified: input.accountInfo.verified ? 'Yes' : 'No',
      followers: this.formatNumber(input.accountInfo.followers),
      language: input.language === 'ko' ? 'Korean' : 'English',
      videos: JSON.stringify(videosJson, null, 2),
    });
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createVideoClassifierAgent(): VideoClassifierAgent {
  return new VideoClassifierAgent();
}
