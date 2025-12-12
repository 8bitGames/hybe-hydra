/**
 * Prompt Engineer Agent
 * ======================
 * Transforms user inputs into VEO-optimized, brand-safe video prompts
 *
 * Model: Gemini 2.5 Flash
 * Category: Transformer
 *
 * Key Responsibilities:
 * - Apply Cinematic Formula
 * - Sanitize celebrity names
 * - Ensure brand safety
 * - Optimize for VEO generation
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const PromptEngineerInputSchema = z.object({
  rawPrompt: z.string(),
  style: z.string().optional(),
  duration: z.number().min(5).max(60).default(10),
  additionalContext: z.string().optional(),
});

export type PromptEngineerInput = z.infer<typeof PromptEngineerInputSchema>;

// Output Schema - Enhanced for Veo 3
export const PromptEngineerOutputSchema = z.object({
  optimizedPrompt: z.string(),
  safetyScore: z.number().min(0).max(1),
  sanitizedNames: z.array(z.object({
    original: z.string(),
    replacement: z.string(),
  })),
  warnings: z.array(z.string()),
  cinematicBreakdown: z.object({
    subject: z.string(),
    environment: z.string(),
    lighting: z.string(),
    camera: z.string(),
    mood: z.string(),
  }),
  // Veo 3 Enhanced Fields
  negativePrompt: z.string().optional(), // What to exclude from video
  audioElements: z.object({
    ambientSound: z.string().optional(), // Background sounds
    music: z.string().optional(), // Music style/mood
    soundEffects: z.string().optional(), // Specific sound effects
  }).optional(),
  dialogueContent: z.object({
    text: z.string().optional(), // Spoken dialogue (6-12 words for 8s)
    speaker: z.string().optional(), // Who speaks
    tone: z.string().optional(), // Emotional tone
  }).optional(),
  characterConsistency: z.array(z.string()).optional(), // Identity cues to maintain
});

export type PromptEngineerOutput = z.infer<typeof PromptEngineerOutputSchema>;

// Agent Configuration
export const PromptEngineerConfig: AgentConfig<PromptEngineerInput, PromptEngineerOutput> = {
  id: 'prompt-engineer',
  name: 'Prompt Engineer Agent',
  description: 'VEO 최적화 프롬프트 변환 및 안전성 검증',
  category: 'transformer',

  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.5,
      maxTokens: 4096,
    },
  },

  prompts: {
    system: `You are the Hydra Prompt Alchemist - Expert in Veo 3 Video Generation.
Transform user inputs into VEO 3-optimized, brand-safe video prompts.

═══════════════════════════════════════════════════════════════════
VEO 3 PROMPTING FUNDAMENTALS (Google Official 2025 Guidelines)
═══════════════════════════════════════════════════════════════════

## GOLDEN RULE: Optimal Prompt Structure
- Length: 3-6 sentences, 100-150 words (Veo 3 sweet spot)
- Structure: Subject → Action → Setting → Style → Camera → Audio
- Write narrative prose, NOT keyword lists

## Cinematic Formula (ALWAYS include all 5 elements):
1. SUBJECT: Clear main focus with specific visual details
   - Include character consistency markers for recurring subjects
   - Describe distinguishing features, clothing, posture
2. ENVIRONMENT: Detailed setting, location, and surroundings
3. LIGHTING: Specific conditions, quality, direction, color temperature
4. CAMERA: Movement, angles, framing, focus
   - Use Veo 3 camera terminology: "slow dolly-in", "static on tripod",
     "handheld tracking shot", "smooth crane movement", "orbital pan"
5. MOOD: Emotional atmosphere, energy level, artistic style

## VEO 3 AUDIO ELEMENTS (New in Veo 3):
- Native audio generation supported
- Ambient sounds: "soft wind", "city traffic", "ocean waves"
- Music style: "upbeat electronic", "melancholic piano", "cinematic orchestral"
- Sound effects: "footsteps", "door opening", "glass clinking"

## VEO 3 DIALOGUE (Native Lip-Sync Support):
- Keep dialogue to 6-12 words for 8-second clips
- Specify speaker and emotional tone
- Example: 'She whispers softly, "This is just the beginning."'

## NEGATIVE PROMPTS (What to Exclude):
- Use to avoid unwanted elements
- Examples: "no text overlays, no subtitles, no watermarks, no crowds"

## CHARACTER CONSISTENCY (For Series/Recurring Content):
- Restate key identity cues in every prompt
- "The same young woman with auburn hair and green eyes..."
- Maintain clothing, accessories, distinctive features

## Safety Rules (STRICTLY ENFORCE):
- NO violence, weapons, or harmful content
- NO explicit or suggestive content
- NO real celebrity names (replace with descriptive alternatives)
- NO controversial political or religious content
- Maintain premium brand image at all times

## Celebrity Name Sanitization:
Replace real names with descriptive alternatives:
- "BTS" → "a popular Korean boy band"
- "Taylor Swift" → "a stylish pop artist"
- "Jungkook" → "a charismatic young performer"
- Keep the essence while removing identifiable names

Always respond in valid JSON format.`,

    templates: {
      transform: `Transform this prompt for VEO 3 video generation.

═══════════════════════════════════════════════════════════════════
INPUT CONTEXT
═══════════════════════════════════════════════════════════════════

INPUT PROMPT:
{{rawPrompt}}

STYLE PREFERENCE: {{style}}
TARGET DURATION: {{duration}}s
ADDITIONAL CONTEXT: {{additionalContext}}

═══════════════════════════════════════════════════════════════════
VEO 3 OPTIMIZATION REQUIREMENTS
═══════════════════════════════════════════════════════════════════

Apply the Cinematic Formula (ALL 5 elements required):

1. SUBJECT: Expand with vivid details + character consistency markers
2. ENVIRONMENT: Rich, detailed setting with atmospheric depth
3. LIGHTING: Specific setup (direction, quality, color temperature)
4. CAMERA: Use Veo 3 terminology:
   - "slow dolly-in" (intimate approach)
   - "static on tripod" (stable professional look)
   - "handheld tracking" (documentary feel)
   - "smooth crane up/down" (cinematic reveal)
   - "orbital pan" (product showcase)
5. MOOD: Emotional atmosphere with energy level

VEO 3 AUDIO DESIGN:
- Add ambient sounds that match the environment
- Suggest music style if appropriate
- Include relevant sound effects

VEO 3 DIALOGUE (if applicable):
- Keep to 6-12 words for 8-second clips
- Natural speech with emotional tone
- Ensure lip-sync compatibility

NEGATIVE PROMPT:
- Specify what to EXCLUDE (no watermarks, no text overlays, etc.)

CHARACTER CONSISTENCY:
- List visual markers that must persist (hair color, clothing, etc.)

Sanitize any real celebrity or public figure names.
Assess safety score (0.0 = unsafe, 1.0 = completely safe).

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT (Return valid JSON)
═══════════════════════════════════════════════════════════════════

{
  "optimizedPrompt": "Narrative prose (100-150 words, 3-6 sentences). Structure: Subject performing action in environment, with specific camera movement, lighting setup, and mood. End with audio cues if relevant.",
  "safetyScore": 0.0-1.0,
  "sanitizedNames": [
    {"original": "celebrity name", "replacement": "descriptive alternative"}
  ],
  "warnings": ["any safety or quality warnings"],
  "cinematicBreakdown": {
    "subject": "detailed subject with consistency markers",
    "environment": "setting with atmospheric details",
    "lighting": "specific lighting setup and direction",
    "camera": "Veo 3 camera movement (dolly/tracking/crane/static)",
    "mood": "emotional atmosphere and energy"
  },
  "negativePrompt": "no watermarks, no text overlays, no abrupt cuts",
  "audioElements": {
    "ambientSound": "environmental background audio",
    "music": "music style/mood if applicable",
    "soundEffects": "specific sound effects if needed"
  },
  "dialogueContent": {
    "text": "6-12 word dialogue if applicable",
    "speaker": "who speaks",
    "tone": "emotional delivery tone"
  },
  "characterConsistency": ["visual marker 1", "visual marker 2", "visual marker 3"]
}

QUALITY CHECKLIST:
☐ Prompt is 100-150 words (not longer)
☐ Uses Veo 3 camera terminology
☐ Includes audio elements
☐ Has negative prompt exclusions
☐ Character consistency markers present`,
    },
  },

  inputSchema: PromptEngineerInputSchema,
  outputSchema: PromptEngineerOutputSchema,
};

/**
 * Prompt Engineer Agent Implementation
 */
export class PromptEngineerAgent extends BaseAgent<PromptEngineerInput, PromptEngineerOutput> {
  constructor() {
    super(PromptEngineerConfig);
  }

  protected buildPrompt(input: PromptEngineerInput, context: AgentContext): string {
    const template = this.getTemplate('transform');

    // Get style from input or analyze context
    const style = input.style ||
      context.analyze?.selectedIdea?.optimizedPrompt?.split(',')[0] ||
      'cinematic, modern';

    return this.fillTemplate(template, {
      rawPrompt: input.rawPrompt,
      style,
      duration: input.duration,
      additionalContext: input.additionalContext || `Artist: ${context.workflow.artistName}, Platform: ${context.workflow.platform}`,
    });
  }

  /**
   * Transform raw prompt into VEO-optimized prompt
   */
  async transform(
    rawPrompt: string,
    context: AgentContext,
    options?: {
      style?: string;
      duration?: number;
    }
  ) {
    return this.execute(
      {
        rawPrompt,
        style: options?.style,
        duration: options?.duration || 10,
      },
      context
    );
  }

  /**
   * Batch transform multiple prompts
   */
  async transformBatch(
    prompts: string[],
    context: AgentContext,
    options?: {
      style?: string;
      duration?: number;
    }
  ) {
    const results = await Promise.all(
      prompts.map(prompt => this.transform(prompt, context, options))
    );
    return results;
  }
}

// Factory function
export function createPromptEngineerAgent(): PromptEngineerAgent {
  return new PromptEngineerAgent();
}
