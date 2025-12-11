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

export const VideoClassifierOutputSchema = z.object({
  classifications: z.array(z.object({
    videoId: z.string(),
    primaryCategory: z.string(),
    secondaryCategories: z.array(z.string()),
    contentType: z.enum(['performance', 'behind-the-scenes', 'promotional', 'trend', 'personal', 'collaboration', 'challenge', 'other']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    engagementPotential: z.enum(['high', 'medium', 'low']),
  })),
  categoryDistribution: z.array(z.object({
    category: z.string(),
    count: z.number(),
    percentage: z.number(),
    avgEngagement: z.number(),
  })),
  contentTypeDistribution: z.array(z.object({
    contentType: z.string(),
    count: z.number(),
    percentage: z.number(),
    avgEngagement: z.number(),
  })),
  insights: z.object({
    dominantCategory: z.string(),
    dominantContentType: z.string(),
    contentDiversity: z.number().min(0).max(1),
    recommendations: z.array(z.string()),
  }),
});

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

## Response Format
Return a JSON object with:
- classifications: Array of per-video classifications
- categoryDistribution: Summary by category
- contentTypeDistribution: Summary by content type
- insights: Overall analysis and recommendations`;

// =============================================================================
// Agent Implementation
// =============================================================================

export class VideoClassifierAgent extends BaseAgent<VideoClassifierInput, VideoClassifierOutput> {
  constructor() {
    super({
      id: 'video-classifier',
      name: 'Video Classifier',
      description: 'Classifies TikTok videos into content categories',
      category: 'analyzer',
      model: {
        provider: 'gemini',
        name: 'gemini-2.5-flash',
        options: {
          temperature: 0.3, // Low temperature for consistent classification
          maxTokens: 8192,
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
Respond in {{language}} language for insights and recommendations.`,
        },
      },
      inputSchema: VideoClassifierInputSchema,
      outputSchema: VideoClassifierOutputSchema,
    });
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
