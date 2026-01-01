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
import { GEMINI_FLASH } from '../constants';
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

// NEW: Scene breakdown for precise recreation
export const SceneBreakdownSchema = z.object({
  scene_number: z.number(),
  start_time: z.string(), // e.g., "0:00"
  end_time: z.string(),   // e.g., "0:03"
  shot_type: z.string(),  // e.g., "close-up", "medium shot", "wide shot"
  subject_position: z.string(), // e.g., "center frame", "left third", "right side"
  action_description: z.string(), // Detailed action with direction
  camera_movement: z.string(), // Specific camera movement for this scene
  background_visible: z.array(z.string()), // What's visible in background
});

export const SpatialCompositionSchema = z.object({
  frame_position: z.string(), // Where subject is positioned in frame
  background_layout: z.string(), // Spatial arrangement of background elements
  depth_layers: z.array(z.string()), // Foreground, midground, background elements
  camera_angle: z.string(), // e.g., "eye-level", "slightly low angle", "high angle"
  camera_distance: z.string(), // e.g., "intimate close-up", "arm's length", "full body visible"
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
  // NEW: Enhanced fields for precise video recreation
  scene_breakdown: z.array(SceneBreakdownSchema).optional(), // Scene-by-scene analysis
  spatial_composition: SpatialCompositionSchema.optional(), // Spatial layout details
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
    name: GEMINI_FLASH,
    options: {
      temperature: 0.4,
      maxTokens: 4096,
    },
  },

  prompts: {
    system: `You are an expert video analyst specializing in short-form social media content for TikTok.
Your job is to provide EXTREMELY DETAILED and SPECIFIC analysis of videos and images.
Your analysis will be used to recreate similar videos using AI video generation, so precision is critical.

IMPORTANT RULES:
1. Be SPECIFIC and DESCRIPTIVE - never use generic terms like "person" or "unspecified"
2. Describe exactly what you SEE in the video - physical appearance, clothing details, environment
3. Use vivid, concrete language that could be used as a video generation prompt
4. Always respond in valid JSON format with the exact structure requested
5. Do NOT include real person names - describe appearance instead`,

    templates: {
      analyzeVideo: `Watch this TikTok video carefully and provide an EXTREMELY DETAILED breakdown.
This analysis will be used to recreate EXACT CLONES of this video, so PRECISION IS CRITICAL.

Context from the video:
- Original description: "{{description}}"
- Hashtags: {{hashtags}}
{{#musicTitle}}- Music: "{{musicTitle}}"{{/musicTitle}}

IMPORTANT: Analyze what you ACTUALLY SEE in the video with FRAME-BY-FRAME precision.
Your goal is to capture enough detail that someone could recreate this video IDENTICALLY.

Respond in this exact JSON format:
{
  "style_analysis": {
    "visual_style": "describe the specific visual aesthetic in detail (e.g., 'warm vintage film look with soft vignette', 'clean modern minimalist with high contrast', 'raw authentic documentary style')",
    "color_palette": ["list 3-5 specific colors you see, e.g., 'warm golden yellow', 'deep forest green', 'soft cream white'"],
    "lighting": "describe the exact lighting setup (e.g., 'warm golden hour sunlight coming from the left side creating soft shadows', 'bright overhead ring light with no shadows', 'moody backlit silhouette with rim lighting')",
    "camera_movement": ["list specific camera techniques observed, e.g., 'slow push-in on face', 'handheld following subject', 'smooth dolly left to right'"],
    "transitions": ["list specific transition types, e.g., 'quick jump cuts on beat', 'smooth crossfade between scenes', 'whip pan to new angle'"],
    "mood": "describe the emotional atmosphere in detail (e.g., 'nostalgic and dreamy with a sense of longing', 'high-energy and exciting with playful vibes', 'intimate and personal like a confession')",
    "pace": "describe the editing rhythm (e.g., 'fast cuts every 0.5 seconds synced to music', 'slow contemplative pacing with long 3-4 second shots', 'mixed pace building from slow to fast')",
    "effects": ["list specific effects observed, e.g., 'film grain overlay', 'subtle slow motion at 0.8x', 'warm color grading with lifted blacks', 'gentle lens flare']"
  },
  "content_analysis": {
    "main_subject": "DETAILED description of who/what is in the video. For people: describe gender, approximate age, hair (color, length, style), facial features, body type, skin tone. For objects: describe size, shape, color, material. Example: 'Young woman in her early 20s with long wavy brown hair, light skin, wearing minimal makeup with pink lip gloss'",
    "actions": ["list SPECIFIC actions observed WITH DIRECTION AND TRAJECTORY, e.g., 'lip-syncing to lyrics while looking directly at camera lens', 'dancing with arms raised above head, swaying left to right', 'walking slowly FROM background TOWARDS camera with confident stride', 'turning head from left to right while laughing'"],
    "setting": "DETAILED description of the location/environment. Include: indoor/outdoor, specific location type, background elements, time of day, weather if visible. Example: 'Modern minimalist bedroom with white walls, large window on the left letting in natural light, small succulent plant on wooden nightstand, unmade bed with gray linen sheets visible in background'",
    "props": ["list ALL visible objects and items WITH THEIR POSITIONS, e.g., 'iPhone with pink case held at shoulder height', 'iced coffee in clear plastic cup on desk to the right', 'small gold hoop earrings', 'beige tote bag hanging on door behind'"],
    "clothing_style": "DETAILED description of outfit. Include: specific garment types, colors, patterns, brands if visible, accessories. Example: 'Oversized cream-colored knit sweater, high-waisted light blue mom jeans, white Nike Air Force 1 sneakers, delicate gold layered necklaces'"
  },
  "scene_breakdown": [
    {
      "scene_number": 1,
      "start_time": "0:00",
      "end_time": "0:03",
      "shot_type": "close-up / medium shot / wide shot / extreme close-up",
      "subject_position": "exactly where in frame - e.g., 'center frame', 'left third looking right', 'right side of frame', 'bottom center'",
      "action_description": "precise action WITH DIRECTION - e.g., 'subject tilts head slowly to the left while making eye contact with camera', 'hand reaches from bottom of frame upward toward face'",
      "camera_movement": "what camera does in THIS scene - e.g., 'static', 'slow push-in', 'slight pan right following subject'",
      "background_visible": ["list what background elements are visible in this specific shot"]
    }
  ],
  "spatial_composition": {
    "frame_position": "where subject is positioned - e.g., 'centered in frame', 'rule of thirds left', 'slightly off-center right', 'lower third of frame'",
    "background_layout": "spatial arrangement - e.g., 'wall directly behind subject 2 feet away, window to the left, door visible on right edge'",
    "depth_layers": ["foreground: subject's hands", "midground: subject's face and body", "background: bedroom wall and window"],
    "camera_angle": "e.g., 'eye-level direct', 'slightly low angle looking up', 'high angle looking down at 30 degrees'",
    "camera_distance": "e.g., 'intimate close-up showing only face and shoulders', 'medium shot from waist up', 'full body visible with 1 foot of headroom'"
  },
  "suggested_prompt": "Write a 2-3 sentence detailed Veo video generation prompt that captures the essence of this video. Include subject description, setting, actions, visual style, and mood. Do NOT use real names - describe appearance instead.",
  "prompt_elements": {
    "style_keywords": ["5-7 specific style descriptors, e.g., 'warm vintage aesthetic', 'soft natural lighting', 'intimate close-up framing'"],
    "mood_keywords": ["3-5 emotion/atmosphere words, e.g., 'nostalgic', 'playful', 'dreamy', 'confident'"],
    "action_keywords": ["3-5 specific movement descriptions WITH DIRECTION, e.g., 'lip-syncing facing camera', 'slow head tilt to the left', 'walking towards camera from background', 'hand gesture from right to left'"],
    "technical_suggestions": {
      "aspect_ratio": "9:16 for vertical, 16:9 for horizontal, 1:1 for square - based on the video",
      "duration": "5, 8, or 10 seconds based on content pacing",
      "camera_style": "primary camera technique to recreate, e.g., 'static close-up centered on face', 'slow handheld tracking left to right', 'smooth push-in from medium to close-up'"
    }
  }
}`,

      analyzeImage: `Examine this TikTok {{#isSlideshow}}slideshow/photo carousel{{/isSlideshow}}{{^isSlideshow}}image{{/isSlideshow}} carefully and provide an EXTREMELY DETAILED breakdown.

Context from the post:
- Original description: "{{description}}"
- Hashtags: {{hashtags}}
{{#musicTitle}}- Music: "{{musicTitle}}"{{/musicTitle}}

IMPORTANT: Analyze what you ACTUALLY SEE in the image. Be specific and detailed, not generic.

Respond in this exact JSON format:
{
  "style_analysis": {
    "visual_style": "describe the specific visual aesthetic in detail (e.g., 'clean minimalist with muted earth tones', 'vibrant maximalist with bold patterns', 'soft dreamy aesthetic with pastel colors')",
    "color_palette": ["list 3-5 specific colors you see, e.g., 'dusty rose pink', 'sage green', 'warm beige', 'soft white'"],
    "lighting": "describe the exact lighting (e.g., 'soft diffused natural light from a large window creating even illumination', 'harsh direct sunlight with strong shadows', 'warm artificial indoor lighting')",
    "camera_movement": ["suggest video camera techniques that would match this style, e.g., 'slow gentle zoom in', 'static establishing shot', 'smooth pan across scene'"],
    "transitions": ["suggest transition styles for video version, e.g., 'soft dissolve between frames', 'gentle fade to white', 'smooth morph transition'"],
    "mood": "describe the emotional atmosphere (e.g., 'calm and serene with a cozy intimate feeling', 'energetic and bold with confident vibes', 'melancholic and reflective')",
    "pace": "suggested editing pace for video (e.g., 'slow and contemplative with 3-4 second holds', 'medium paced rhythm', 'upbeat quick cuts')",
    "effects": ["visual effects to apply, e.g., 'subtle film grain', 'soft gaussian blur on background', 'warm color grading', 'light vignette'"]"
  },
  "content_analysis": {
    "main_subject": "DETAILED description of who/what is in the image. For people: describe gender, approximate age, hair (color, length, style), facial expression, body pose, skin tone. For objects: describe size, shape, color, material, condition. Example: 'Young woman in her mid-20s with shoulder-length blonde hair in loose waves, fair skin with freckles, smiling softly at camera, posed with chin resting on hand'",
    "actions": ["suggest SPECIFIC actions for video version based on the pose/composition, e.g., 'slowly turning head towards camera', 'gentle hair flip', 'reaching towards camera', 'soft breathing movement'"],
    "setting": "DETAILED description of the location/environment. Include: indoor/outdoor, specific location type, all visible background elements, lighting source, atmosphere. Example: 'Cozy coffee shop interior with exposed brick wall, wooden tables, hanging Edison bulb lights, large storefront window letting in afternoon sunlight, small potted plants on windowsill'",
    "props": ["list ALL visible objects and items with descriptions, e.g., 'white ceramic coffee mug with latte art', 'opened hardcover book with cream pages', 'brown leather crossbody bag', 'silver ring on right hand'"],
    "clothing_style": "DETAILED description of outfit. Include: all garment pieces, specific colors, textures, patterns, fit, accessories, jewelry. Example: 'Fitted black turtleneck sweater with ribbed texture, high-waisted camel wool trousers, thin gold chain necklace with small pendant, minimalist gold stud earrings'"
  },
  "suggested_prompt": "Write a 2-3 sentence detailed Veo video generation prompt that would bring this image to life as a video. Include subject description, setting, suggested motion, visual style, and mood. Do NOT use real names - describe appearance instead.",
  "prompt_elements": {
    "style_keywords": ["5-7 specific style descriptors, e.g., 'cozy cafe aesthetic', 'soft natural lighting', 'warm earth tones', 'intimate framing'"],
    "mood_keywords": ["3-5 emotion/atmosphere words, e.g., 'peaceful', 'content', 'cozy', 'reflective'"],
    "action_keywords": ["3-5 suggested movement descriptions, e.g., 'gentle sip of coffee', 'looking up from book', 'soft smile forming', 'hands wrapping around mug'"],
    "technical_suggestions": {
      "aspect_ratio": "9:16 for vertical, 16:9 for horizontal, 1:1 for square - based on the image",
      "duration": "8 seconds recommended for photo-to-video",
      "camera_style": "suggested camera technique to add motion, e.g., 'slow push in on face', 'gentle parallax effect', 'subtle dolly movement'"
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
      prompt = prompt.replace(/{{#musicTitle}}[\s\S]*?{{\/musicTitle}}\n?/g, '');
    }

    // Handle slideshow for image analysis
    if (input.mediaType === 'image') {
      if (input.isSlideshow) {
        prompt = prompt.replace('{{#isSlideshow}}', '').replace('{{/isSlideshow}}', '');
        prompt = prompt.replace(/{{(\^)isSlideshow}}[\s\S]*?{{\/isSlideshow}}/g, '');
      } else {
        prompt = prompt.replace(/{{#isSlideshow}}[\s\S]*?{{\/isSlideshow}}/g, '');
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
    // Support video MIME types for Gemini Vision
    const supportedVideoTypes = ['video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime'];
    const actualMimeType = supportedVideoTypes.includes(mimeType)
      ? mimeType as 'video/mp4' | 'video/mpeg' | 'video/webm' | 'video/quicktime'
      : 'video/mp4'; // Default to mp4 for TikTok videos

    const media = [{ data: videoBase64, mimeType: actualMimeType }];
    return this.executeWithImages({ ...input, mediaType: 'video' }, context, media);
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
    const supportedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const actualMimeType = supportedImageTypes.includes(mimeType)
      ? mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
      : 'image/jpeg'; // Default to jpeg

    const images = [{ data: imageBase64, mimeType: actualMimeType }];
    return this.executeWithImages({ ...input, mediaType: 'image' }, context, images);
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
