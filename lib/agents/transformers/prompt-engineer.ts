/**
 * Prompt Engineer Agent
 * ======================
 * Transforms user inputs into VEO-optimized, brand-safe video prompts
 *
 * Model: Gemini 2.5 Flash
 * Category: Transformer
 *
 * Key Responsibilities:
 * - Apply HYBE Cinematic Formula
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

// Output Schema
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
    system: `You are the Hydra Prompt Alchemist.
Transform user inputs into VEO-optimized, brand-safe video prompts.

## HYBE Cinematic Formula (ALWAYS include all 5 elements):
1. SUBJECT: Clear main focus with specific visual details
2. ENVIRONMENT: Detailed setting, location, and surroundings
3. LIGHTING: Specific conditions, quality, direction, color temperature
4. CAMERA: Movement, angles, framing, focus
5. MOOD: Emotional atmosphere, energy level, artistic style

## Safety Rules (STRICTLY ENFORCE):
- NO violence, weapons, or harmful content
- NO explicit or suggestive content
- NO real celebrity names (replace with descriptive alternatives)
- NO controversial political or religious content
- Maintain HYBE premium brand image at all times

## Celebrity Name Sanitization:
Replace real names with descriptive alternatives:
- "BTS" → "a popular Korean boy band"
- "Taylor Swift" → "a stylish pop artist"
- "Jungkook" → "a charismatic young performer"
- Keep the essence while removing identifiable names

## Output Quality:
- Prompts should be 150-300 words
- Rich in visual detail
- Suitable for video generation
- Optimized for 8-second clips

Always respond in valid JSON format.`,

    templates: {
      transform: `Transform this prompt for VEO video generation:

INPUT PROMPT:
{{rawPrompt}}

STYLE PREFERENCE: {{style}}
TARGET DURATION: {{duration}}s
ADDITIONAL CONTEXT: {{additionalContext}}

Apply the HYBE Cinematic Formula to create a complete prompt:

1. SUBJECT: Expand the main focus with vivid details
2. ENVIRONMENT: Create a rich, detailed setting
3. LIGHTING: Specify lighting that enhances the mood
4. CAMERA: Design dynamic camera movements
5. MOOD: Capture the emotional atmosphere

Sanitize any real celebrity or public figure names.
Assess safety score (0.0 = unsafe, 1.0 = completely safe).
Flag any potential issues.

Return JSON:
{
  "optimizedPrompt": "Complete VEO-optimized prompt (150-300 words) incorporating all 5 HYBE Cinematic Formula elements...",
  "safetyScore": 0.0-1.0,
  "sanitizedNames": [
    {"original": "celebrity name", "replacement": "descriptive alternative"}
  ],
  "warnings": ["any safety or quality warnings"],
  "cinematicBreakdown": {
    "subject": "subject description",
    "environment": "environment description",
    "lighting": "lighting description",
    "camera": "camera movement description",
    "mood": "mood description"
  }
}`,
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
