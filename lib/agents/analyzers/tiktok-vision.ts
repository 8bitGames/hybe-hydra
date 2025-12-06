/**
 * TikTok Vision Agent
 * ===================
 * Analyzes TikTok videos and images using Gemini Vision to extract style patterns
 *
 * Model: Gemini 2.0 Flash (Vision capable)
 * Category: Analyzer
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext, AgentResult } from '../types';

// ============================================================================
// Input/Output Schemas
// ============================================================================

export const TikTokVisionInputSchema = z.object({
  mediaType: z.enum(['video', 'image']),
  description: z.string(),
  hashtags: z.array(z.string()),
  musicTitle: z.string().optional(),
  isSlideshow: z.boolean().optional(),
});

export type TikTokVisionInput = z.infer<typeof TikTokVisionInputSchema>;

export const VideoStyleAnalysisSchema = z.object({
  visual_style: z.string(),
  color_palette: z.array(z.string()),
  lighting: z.string(),
  camera_movement: z.array(z.string()),
  transitions: z.array(z.string()),
  mood: z.string(),
  pace: z.string(),
  effects: z.array(z.string()),
});

export const VideoContentAnalysisSchema = z.object({
  main_subject: z.string(),
  actions: z.array(z.string()),
  setting: z.string(),
  props: z.array(z.string()),
  clothing_style: z.string(),
});

export const PromptElementsSchema = z.object({
  style_keywords: z.array(z.string()),
  mood_keywords: z.array(z.string()),
  action_keywords: z.array(z.string()),
  technical_suggestions: z.object({
    aspect_ratio: z.string(),
    duration: z.number(),
    camera_style: z.string(),
  }),
});

export const TikTokVisionOutputSchema = z.object({
  style_analysis: VideoStyleAnalysisSchema,
  content_analysis: VideoContentAnalysisSchema,
  suggested_prompt: z.string(),
  prompt_elements: PromptElementsSchema,
});

export type TikTokVisionOutput = z.infer<typeof TikTokVisionOutputSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

export const TikTokVisionConfig: AgentConfig<TikTokVisionInput, TikTokVisionOutput> = {
  id: 'tiktok-vision',
  name: 'TikTok Vision Agent',
  description: 'TikTok 비디오/이미지를 분석하여 스타일 패턴 추출',
  category: 'analyzer',

  model: {
    provider: 'gemini',
    name: 'gemini-2.0-flash',
    options: {
      temperature: 0.4,
      maxTokens: 4096,
    },
  },

  prompts: {
    system: `You are a video style analyst specializing in short-form social media content.
You analyze TikTok videos and images to extract detailed style patterns, visual elements, and mood.
Your analysis is used to recreate similar styles in AI-generated videos.
Always respond in valid JSON format with the exact structure requested.`,

    templates: {
      analyzeVideo: `Analyze this TikTok video and provide a detailed breakdown.

Context from the video:
- Original description: "{{description}}"
- Hashtags: {{hashtags}}
{{#musicTitle}}- Music: "{{musicTitle}}"{{/musicTitle}}

Analyze the video and respond in this exact JSON format:
{
  "style_analysis": {
    "visual_style": "describe the overall visual aesthetic (e.g., 'cinematic', 'lo-fi', 'high-fashion editorial', 'documentary')",
    "color_palette": ["list", "dominant", "colors"],
    "lighting": "describe lighting style (e.g., 'natural daylight', 'neon', 'golden hour', 'dramatic shadows')",
    "camera_movement": ["list camera techniques like 'slow zoom', 'tracking shot', 'handheld', 'static'"],
    "transitions": ["list transition styles like 'jump cut', 'smooth pan', 'fade', 'whip pan'"],
    "mood": "overall emotional tone (e.g., 'energetic', 'melancholic', 'dreamy', 'intense')",
    "pace": "editing pace (e.g., 'fast-paced', 'slow and contemplative', 'rhythmic')",
    "effects": ["list visual effects like 'blur', 'grain', 'speed ramp', 'color grading'"]
  },
  "content_analysis": {
    "main_subject": "describe the main subject/person in the video",
    "actions": ["list main actions/movements"],
    "setting": "describe the location/environment",
    "props": ["list notable props or objects"],
    "clothing_style": "describe fashion/clothing style"
  },
  "suggested_prompt": "Write a detailed Veo video generation prompt that would recreate this style. Be specific about visual elements, camera work, and mood. Do NOT include any real person names.",
  "prompt_elements": {
    "style_keywords": ["5-7 key style descriptors for the prompt"],
    "mood_keywords": ["3-5 mood/emotion keywords"],
    "action_keywords": ["3-5 action/movement keywords"],
    "technical_suggestions": {
      "aspect_ratio": "9:16 or 16:9 or 1:1 based on the video",
      "duration": 5 or 8 or 10 based on content pacing,
      "camera_style": "primary camera technique to use"
    }
  }
}`,

      analyzeImage: `Analyze this TikTok {{#isSlideshow}}slideshow/photo carousel{{/isSlideshow}}{{^isSlideshow}}image{{/isSlideshow}} and provide a detailed breakdown.

Context from the post:
- Original description: "{{description}}"
- Hashtags: {{hashtags}}
{{#musicTitle}}- Music: "{{musicTitle}}"{{/musicTitle}}

Analyze the image and respond in this exact JSON format:
{
  "style_analysis": {
    "visual_style": "describe the overall visual aesthetic (e.g., 'minimalist', 'vibrant pop', 'aesthetic', 'editorial')",
    "color_palette": ["list", "dominant", "colors"],
    "lighting": "describe lighting style (e.g., 'natural daylight', 'soft', 'dramatic', 'studio')",
    "camera_movement": ["suggest video camera techniques that would match this style"],
    "transitions": ["suggest transition styles for video version"],
    "mood": "overall emotional tone (e.g., 'calm', 'energetic', 'dreamy', 'bold')",
    "pace": "suggested editing pace for video (e.g., 'slow and contemplative', 'medium', 'fast-paced')",
    "effects": ["visual effects to apply like 'soft focus', 'grain', 'color grading'"]
  },
  "content_analysis": {
    "main_subject": "describe the main subject in the image",
    "actions": ["suggest actions/movements for video version"],
    "setting": "describe the location/environment",
    "props": ["list notable props or objects"],
    "clothing_style": "describe fashion/clothing style if applicable"
  },
  "suggested_prompt": "Write a detailed Veo video generation prompt that would create a video matching this image's style and mood. Be specific about visual elements, suggested camera work, and mood. Include motion and action suggestions. Do NOT include any real person names.",
  "prompt_elements": {
    "style_keywords": ["5-7 key style descriptors"],
    "mood_keywords": ["3-5 mood/emotion keywords"],
    "action_keywords": ["3-5 suggested action/movement keywords"],
    "technical_suggestions": {
      "aspect_ratio": "9:16 or 16:9 or 1:1 based on the image",
      "duration": 8,
      "camera_style": "suggested camera technique"
    }
  }
}`,
    },
  },

  inputSchema: TikTokVisionInputSchema,
  outputSchema: TikTokVisionOutputSchema,
};

// ============================================================================
// Agent Implementation
// ============================================================================

export class TikTokVisionAgent extends BaseAgent<TikTokVisionInput, TikTokVisionOutput> {
  constructor() {
    super(TikTokVisionConfig);
  }

  protected buildPrompt(input: TikTokVisionInput, _context: AgentContext): string {
    const templateName = input.mediaType === 'video' ? 'analyzeVideo' : 'analyzeImage';
    const template = this.getTemplate(templateName);

    // Format hashtags
    const hashtagsStr = input.hashtags.join(', ');

    // Simple template replacement
    let prompt = template
      .replace('{{description}}', input.description)
      .replace('{{hashtags}}', hashtagsStr);

    // Handle music title (optional)
    if (input.musicTitle) {
      prompt = prompt.replace('{{#musicTitle}}', '').replace('{{/musicTitle}}', '');
      prompt = prompt.replace('{{musicTitle}}', input.musicTitle);
    } else {
      // Remove the music line entirely
      prompt = prompt.replace(/{{#musicTitle}}.*?{{\/musicTitle}}\n?/gs, '');
    }

    // Handle slideshow for image analysis
    if (input.mediaType === 'image') {
      if (input.isSlideshow) {
        prompt = prompt.replace('{{#isSlideshow}}', '').replace('{{/isSlideshow}}', '');
        prompt = prompt.replace(/{{(\^)isSlideshow}}.*?{{\/isSlideshow}}/gs, '');
      } else {
        prompt = prompt.replace(/{{#isSlideshow}}.*?{{\/isSlideshow}}/gs, '');
        prompt = prompt.replace('{{^isSlideshow}}', '').replace('{{/isSlideshow}}', '');
      }
    }

    return prompt;
  }

  /**
   * Analyze video content
   */
  async analyzeVideo(
    videoBase64: string,
    mimeType: string,
    input: TikTokVisionInput,
    context: AgentContext
  ): Promise<AgentResult<TikTokVisionOutput>> {
    const images = [{ data: videoBase64, mimeType }];
    return this.executeWithImages(images, { ...input, mediaType: 'video' }, context);
  }

  /**
   * Analyze image content
   */
  async analyzeImage(
    imageBase64: string,
    mimeType: string,
    input: TikTokVisionInput,
    context: AgentContext
  ): Promise<AgentResult<TikTokVisionOutput>> {
    const images = [{ data: imageBase64, mimeType }];
    return this.executeWithImages(images, { ...input, mediaType: 'image' }, context);
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let tiktokVisionAgent: TikTokVisionAgent | null = null;

/**
 * Get or create the singleton TikTokVisionAgent instance
 */
export function getTikTokVisionAgent(): TikTokVisionAgent {
  if (!tiktokVisionAgent) {
    tiktokVisionAgent = new TikTokVisionAgent();
  }
  return tiktokVisionAgent;
}

/**
 * Factory function
 */
export function createTikTokVisionAgent(): TikTokVisionAgent {
  return new TikTokVisionAgent();
}
