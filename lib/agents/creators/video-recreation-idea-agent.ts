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

// Helper to normalize engagement value from AI output
const normalizeEngagement = (value: unknown): 'high' | 'medium' | 'low' => {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  if (typeof value !== 'string') return 'medium';
  const normalized = value.toLowerCase().trim();
  if (normalized.includes('high') || normalized.includes('높')) return 'high';
  if (normalized.includes('low') || normalized.includes('낮')) return 'low';
  return 'medium';
};

// Output Schema - 2 recreation ideas
export const VideoRecreationIdeaOutputSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    hook: z.string(),
    description: z.string(),
    estimatedEngagement: z.preprocess(
      normalizeEngagement,
      z.enum(['high', 'medium', 'low']).catch('medium')
    ),
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
/**
 * @agent VideoRecreationIdeaAgent
 * @version 2
 * @changelog
 * - v2: Veo 3.1 optimized 7-component prompt structure for cinematic video generation
 * - v1: Initial version with basic VEO prompts
 */
export const VideoRecreationIdeaConfig: AgentConfig<VideoRecreationIdeaInput, VideoRecreationIdeaOutput> = {
  id: 'video-recreation-idea',
  name: 'Video Recreation Idea Agent',
  description: '원본 영상의 스타일을 재현하는 콘텐츠 아이디어 생성 (Veo 3.1 최적화)',
  category: 'creator',

  model: {
    provider: 'gemini',
    name: 'gemini-3-pro-preview',
    options: {
      temperature: 0.5,  // Lower temperature for more faithful recreation
      maxTokens: 16384,  // Increased for detailed Veo 3.1 prompts
      thinkingLevel: 'high',  // Using 'high' for strategic recreation analysis
    },
  },

  prompts: {
    system: `You are a Video Recreation Specialist for TikTok content, expert in crafting Veo 3.1 optimized prompts.
Your job is to analyze an existing video's style, mood, and visual elements, then generate ideas to RECREATE that exact style using the Veo 3.1 Professional Prompt Structure.

CRITICAL MINDSET:
- You are NOT creating new content - you are RECREATING an existing video's style
- Focus on visual fidelity to the original
- Maintain the same mood, pacing, and aesthetic
- Use the same camera techniques, lighting, and color palette
- The goal is for viewers to feel "this is the same style as the original"

## VEO 3.1 PROFESSIONAL PROMPT STRUCTURE (7 COMPONENTS):
You MUST structure every optimizedPrompt using these 7 components in a flowing paragraph:

1. **SUBJECT** (15+ physical attributes):
   - For people: age, gender, build, skin tone, hair (color, length, style), facial features, expression, posture, clothing details (specific garments, colors, textures)
   - For objects: size, shape, color, material, condition
   - Example: "A confident 25-year-old woman with long wavy dark brown hair, fair skin, wearing a cream oversized knit sweater and high-waisted light blue mom jeans"

2. **ACTION** (specific movements):
   - Precise actions, gestures, timing, sequence
   - Micro-expressions, body language, interaction patterns
   - Example: "lip-syncing to lyrics while slowly tilting head, making direct eye contact with camera, occasionally running fingers through hair"

3. **SCENE** (detailed environment):
   - Location type, background elements, props visible
   - Architectural details, furniture, decorations
   - Time of day, weather if visible
   - Example: "in a cozy minimalist bedroom with white walls, large window on the left letting in soft afternoon sunlight, small succulent plant on wooden nightstand"

4. **STYLE** (visual aesthetic):
   - Camera shot type (close-up, medium, wide)
   - Color palette, film grade
   - Depth of field, focus
   - Example: "warm vintage film aesthetic, soft color grading with lifted blacks, shallow depth of field with creamy bokeh"

5. **CAMERA** (movement):
   - Specific camera techniques
   - Movement direction and speed
   - Example: "slow push-in from medium to close-up shot, maintaining steady eye-level framing"

6. **AMBIANCE** (lighting):
   - Lighting setup description
   - Light source direction and quality
   - Mood created by lighting
   - Example: "golden hour light through window creating warm soft shadows, natural three-point lighting effect"

7. **TECHNICAL** (negative prompt - what to avoid):
   - Elements to exclude for clean output
   - Example: "No watermarks, no text overlays, no harsh shadows, maintain smooth pacing"

RECREATION TYPES:
1. EXACT RECREATION: Reproduce the original as closely as possible
2. VARIATION RECREATION: Keep the essence but add a creative twist

Always respond in valid JSON format.`,

    templates: {
      generateRecreationIdeas: `RECREATE the following video's style using Veo 3.1 optimized prompts - generate exactly 2 content ideas:

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
Generate exactly 2 ideas with VEO 3.1 OPTIMIZED PROMPTS:

### IDEA 1: EXACT RECREATION
Recreate the original video's style as closely as possible using all 7 Veo 3.1 components.

### IDEA 2: VARIATION RECREATION
Keep the core style but add a creative twist while maintaining the 7-component structure.

## VEO 3.1 PROMPT FORMAT REQUIREMENTS:
Each optimizedPrompt MUST be a flowing paragraph (300+ words) that includes ALL 7 components:

1. Start with SUBJECT: Use {{mainSubject}} and {{clothingStyle}} to describe 15+ physical attributes
2. Then ACTION: Incorporate {{actions}} with specific timing, gestures, expressions
3. Add SCENE: Use {{setting}} and {{props}} for detailed environment description
4. Include STYLE: Apply {{visualStyle}} and {{colorPalette}} for visual aesthetic
5. Describe CAMERA: Use {{cameraMovement}} for specific camera techniques
6. Set AMBIANCE: Apply {{lighting}} and {{mood}} for lighting and atmosphere
7. End with TECHNICAL: Add negative prompts (no watermarks, maintain {{pace}} pacing)

## EXAMPLE VEO 3.1 PROMPT FORMAT:
"A [age] [gender] with [hair description from mainSubject], [skin tone], wearing [detailed clothing from clothingStyle], [action from actions] while [additional gestures], making [facial expression]. Set in [detailed setting description from setting], with [props from props list] visible in the [background position]. [visualStyle from analysis], with [colorPalette colors] dominating the palette, shallow depth of field with creamy bokeh. [Camera movement from cameraMovement], maintaining [framing style]. [lighting description from lighting], creating [mood from mood analysis] atmosphere. No watermarks, no text overlays, maintain [pace from pace analysis] pacing, high quality 9:16 vertical TikTok format."

Return JSON (IMPORTANT: bpm MUST be a number, not a string):
{
  "ideas": [
    {
      "title": "title reflecting recreation (max 50 chars)",
      "hook": "hook matching original's energy (max 100 chars)",
      "description": "2-3 sentences explaining how this recreates the original using Veo 3.1 structure",
      "estimatedEngagement": "high",
      "optimizedPrompt": "[FULL VEO 3.1 PROMPT - 300+ words]: A [subject with 15+ attributes from mainSubject and clothingStyle] [action from actions with timing and expressions] in [scene from setting with props]. [style from visualStyle and colorPalette with camera shot type]. [camera movement from cameraMovement]. [ambiance from lighting creating mood atmosphere]. No watermarks, no text overlays, maintain [pace] pacing, high quality 9:16 vertical format.",
      "suggestedMusic": { "bpm": 120, "genre": "match original mood" },
      "scriptOutline": ["scene1: recreate opening hook with exact visual style", "scene2: maintain original's flow and pacing", "scene3: capture key emotional moment"],
      "recreationType": "exact"
    },
    {
      "title": "variation title (max 50 chars)",
      "hook": "hook with creative twist (max 100 chars)",
      "description": "2-3 sentences explaining the variation while keeping Veo 3.1 structure intact",
      "estimatedEngagement": "high",
      "optimizedPrompt": "[FULL VEO 3.1 PROMPT - 300+ words]: A [similar subject type with creative variation] [inspired action with unique twist] in [similar aesthetic setting with different location]. [maintained visualStyle with same colorPalette]. [similar camera movement with variation]. [same lighting style maintaining mood]. No watermarks, no text overlays, maintain [pace] pacing, high quality 9:16 vertical format.",
      "suggestedMusic": { "bpm": 115, "genre": "similar to original" },
      "scriptOutline": ["scene1: variation on hook with maintained style", "scene2: creative interpretation of flow", "scene3: fresh take on emotional climax"],
      "recreationType": "variation"
    }
  ],
  "recreationStrategy": "Explanation of how the Veo 3.1 7-component structure captures the original's essence through subject fidelity, action accuracy, scene recreation, style preservation, camera matching, and lighting consistency"
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
