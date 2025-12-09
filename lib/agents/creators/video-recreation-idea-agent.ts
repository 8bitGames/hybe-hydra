/**
 * Video Recreation Idea Agent
 * ============================
 * Generates content ideas that closely recreate the original video's style
 *
 * Model: Gemini 3 Pro (strategic thinking, detailed visual analysis)
 * Category: Creator
 *
 * This agent takes video analysis data (conceptDetails, styleAnalysis, etc.)
 * and generates 2 ideas that recreate the original video's visual style and mood.
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// Video Analysis Data Schema (from StartFromVideo.aiAnalysis)
export const VideoAnalysisSchema = z.object({
  hookAnalysis: z.string().optional(),
  styleAnalysis: z.string().optional(),
  structureAnalysis: z.string().optional(),
  suggestedApproach: z.string().optional(),
  isComposeVideo: z.boolean().optional(),
  imageCount: z.number().optional(),
  conceptDetails: z.object({
    visualStyle: z.string().optional(),
    colorPalette: z.array(z.string()).optional(),
    lighting: z.string().optional(),
    cameraMovement: z.array(z.string()).optional(),
    transitions: z.array(z.string()).optional(),
    effects: z.array(z.string()).optional(),
    mood: z.string().optional(),
    pace: z.string().optional(),
    mainSubject: z.string().optional(),
    actions: z.array(z.string()).optional(),
    setting: z.string().optional(),
    props: z.array(z.string()).optional(),
    clothingStyle: z.string().optional(),
  }).optional(),
});

// Input Schema
export const VideoRecreationIdeaInputSchema = z.object({
  videoAnalysis: VideoAnalysisSchema,
  videoDescription: z.string().optional(),
  videoHashtags: z.array(z.string()).optional(),
  campaignDescription: z.string().optional(),
  artistName: z.string().optional(),
  language: z.enum(['ko', 'en']).optional(),
});

export type VideoRecreationIdeaInput = z.infer<typeof VideoRecreationIdeaInputSchema>;

// Output Schema - 2 recreation ideas
export const VideoRecreationIdeaOutputSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    hook: z.string(),
    description: z.string(),
    estimatedEngagement: z.enum(['high', 'medium', 'low']),
    optimizedPrompt: z.string(),
    suggestedMusic: z.object({
      bpm: z.number(),
      genre: z.string(),
    }),
    scriptOutline: z.array(z.string()),
    recreationType: z.enum(['exact', 'variation']),  // exact = 정확히 재현, variation = 변형 재현
  })),
  recreationStrategy: z.string(),
});

export type VideoRecreationIdeaOutput = z.infer<typeof VideoRecreationIdeaOutputSchema>;

// Agent Configuration
export const VideoRecreationIdeaConfig: AgentConfig<VideoRecreationIdeaInput, VideoRecreationIdeaOutput> = {
  id: 'video-recreation-idea',
  name: 'Video Recreation Idea Agent',
  description: '원본 영상의 스타일을 재현하는 콘텐츠 아이디어 생성',
  category: 'creator',

  model: {
    provider: 'gemini',
    name: 'gemini-3-pro-preview',
    options: {
      temperature: 0.5,  // Lower temperature for more faithful recreation
      maxTokens: 12288,
      thinkingLevel: 'high',  // Using 'high' for strategic recreation analysis
    },
  },

  prompts: {
    system: `You are a Video Recreation Specialist for TikTok content.
Your job is to analyze an existing video's style, mood, and visual elements, then generate ideas to RECREATE that exact style.

CRITICAL MINDSET:
- You are NOT creating new content - you are RECREATING an existing video's style
- Focus on visual fidelity to the original
- Maintain the same mood, pacing, and aesthetic
- Use the same camera techniques, lighting, and color palette
- The goal is for viewers to feel "this is the same style as the original"

Your expertise includes:
- Analyzing video visual elements (lighting, color, camera movement)
- Understanding mood and atmosphere translation
- Crafting VEO prompts that faithfully reproduce visual styles
- Creating both "exact recreation" and "creative variation" versions

RECREATION TYPES:
1. EXACT RECREATION: Reproduce the original as closely as possible
   - Same visual style, colors, lighting
   - Same mood and pace
   - Same type of subject and setting
   - Mirror the original's aesthetic precisely

2. VARIATION RECREATION: Keep the essence but add a twist
   - Maintain core visual style and mood
   - Change the subject or setting slightly
   - Keep the same "vibe" but with fresh elements
   - Should still be recognizable as inspired by the original

Always respond in valid JSON format.`,

    templates: {
      generateRecreationIdeas: `RECREATE the following video's style - generate exactly 2 content ideas:

## 🎬 ORIGINAL VIDEO ANALYSIS:

### Visual Style Analysis:
{{styleAnalysis}}

### Hook Analysis:
{{hookAnalysis}}

### Concept Details:
- Visual Style: {{visualStyle}}
- Color Palette: {{colorPalette}}
- Lighting: {{lighting}}
- Camera Movement: {{cameraMovement}}
- Transitions: {{transitions}}
- Effects: {{effects}}
- Mood: {{mood}}
- Pace: {{pace}}
- Main Subject: {{mainSubject}}
- Actions: {{actions}}
- Setting: {{setting}}
- Props: {{props}}
- Clothing Style: {{clothingStyle}}

### Suggested Approach:
{{suggestedApproach}}

### Original Video Description:
{{videoDescription}}

### Original Hashtags:
{{videoHashtags}}

## 📋 CAMPAIGN CONTEXT:
{{campaignDescription}}

## 👤 ARTIST/BRAND:
{{artistName}}

## 🌐 LANGUAGE:
{{language}}

## YOUR TASK:
Generate exactly 2 ideas:
1. **EXACT RECREATION**: Recreate the original video's style as closely as possible
2. **VARIATION RECREATION**: Keep the core style but add a creative twist

For each idea:
- Title should reflect the recreation approach
- Hook should capture the same energy as the original
- Description should explain how it recreates the original
- VEO prompt MUST include the same visual elements (lighting, colors, camera, mood)
- Music should match the original's pace and mood
- Script outline should follow the original's structure

Return JSON (IMPORTANT: bpm MUST be a number, not a string):
{
  "ideas": [
    {
      "title": "title reflecting recreation (max 50 chars)",
      "hook": "hook matching original's energy (max 100 chars)",
      "description": "2-3 sentences explaining how this recreates the original",
      "estimatedEngagement": "high",
      "optimizedPrompt": "Detailed VEO prompt (200+ words) faithfully recreating: Subject: [same type as original], Environment: [same setting style], Lighting: [{{lighting}}], Camera: [{{cameraMovement}}], Colors: [{{colorPalette}}], Mood: [{{mood}}], Pace: [{{pace}}]",
      "suggestedMusic": { "bpm": 120, "genre": "match original mood" },
      "scriptOutline": ["scene1: recreate opening hook", "scene2: maintain original's flow"],
      "recreationType": "exact"
    },
    {
      "title": "variation title (max 50 chars)",
      "hook": "hook with creative twist (max 100 chars)",
      "description": "2-3 sentences explaining the variation while keeping core style",
      "estimatedEngagement": "high",
      "optimizedPrompt": "Detailed VEO prompt (200+ words) with variation: Subject: [different but compatible], Environment: [similar aesthetic], Lighting: [{{lighting}}], Camera: [{{cameraMovement}}], Colors: [same palette], Mood: [{{mood}} with twist], Pace: [{{pace}}]",
      "suggestedMusic": { "bpm": 115, "genre": "similar to original" },
      "scriptOutline": ["scene1: variation on hook", "scene2: creative interpretation"],
      "recreationType": "variation"
    }
  ],
  "recreationStrategy": "Brief explanation of how these ideas capture the original's essence"
}`,
    },
  },

  inputSchema: VideoRecreationIdeaInputSchema,
  outputSchema: VideoRecreationIdeaOutputSchema,
};

/**
 * Video Recreation Idea Agent Implementation
 */
export class VideoRecreationIdeaAgent extends BaseAgent<VideoRecreationIdeaInput, VideoRecreationIdeaOutput> {
  constructor() {
    super(VideoRecreationIdeaConfig);
  }

  protected buildPrompt(input: VideoRecreationIdeaInput, context: AgentContext): string {
    const template = this.getTemplate('generateRecreationIdeas');
    const conceptDetails = input.videoAnalysis.conceptDetails || {};

    return this.fillTemplate(template, {
      // Style analysis
      styleAnalysis: input.videoAnalysis.styleAnalysis || 'No style analysis available',
      hookAnalysis: input.videoAnalysis.hookAnalysis || 'No hook analysis available',
      suggestedApproach: input.videoAnalysis.suggestedApproach || 'No suggested approach available',

      // Concept details
      visualStyle: conceptDetails.visualStyle || 'cinematic',
      colorPalette: JSON.stringify(conceptDetails.colorPalette || ['neutral tones']),
      lighting: conceptDetails.lighting || 'natural lighting',
      cameraMovement: JSON.stringify(conceptDetails.cameraMovement || ['static']),
      transitions: JSON.stringify(conceptDetails.transitions || ['cut']),
      effects: JSON.stringify(conceptDetails.effects || ['none']),
      mood: conceptDetails.mood || 'engaging',
      pace: conceptDetails.pace || 'moderate',
      mainSubject: conceptDetails.mainSubject || 'person',
      actions: JSON.stringify(conceptDetails.actions || ['performing']),
      setting: conceptDetails.setting || 'indoor',
      props: JSON.stringify(conceptDetails.props || []),
      clothingStyle: conceptDetails.clothingStyle || 'casual',

      // Video info
      videoDescription: input.videoDescription || 'No description available',
      videoHashtags: JSON.stringify(input.videoHashtags || []),

      // Campaign context
      campaignDescription: input.campaignDescription || 'General content recreation',
      artistName: input.artistName || context.workflow.artistName || 'Artist',
      language: input.language || context.workflow.language || 'ko',
    });
  }

  /**
   * Generate recreation ideas from video analysis
   */
  async generateRecreationIdeas(
    videoAnalysis: VideoRecreationIdeaInput['videoAnalysis'],
    context: AgentContext,
    options?: {
      videoDescription?: string;
      videoHashtags?: string[];
      campaignDescription?: string;
      artistName?: string;
      language?: 'ko' | 'en';
    }
  ) {
    return this.execute(
      {
        videoAnalysis,
        videoDescription: options?.videoDescription,
        videoHashtags: options?.videoHashtags,
        campaignDescription: options?.campaignDescription,
        artistName: options?.artistName,
        language: options?.language,
      },
      context
    );
  }
}

// Factory function
export function createVideoRecreationIdeaAgent(): VideoRecreationIdeaAgent {
  return new VideoRecreationIdeaAgent();
}
