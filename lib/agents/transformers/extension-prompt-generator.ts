/**
 * Extension Prompt Generator Agent
 * =================================
 * Generates rich, contextual prompts for video extensions by combining
 * the original video's prompt context with user's extension idea.
 *
 * Model: Gemini 2.5 Flash
 * Category: Transformer
 *
 * Key Responsibilities:
 * - Analyze original video prompt context
 * - Enhance user's simple extension idea
 * - Create seamless continuation prompts
 * - Maintain visual consistency with source video
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_FLASH } from '../constants';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const ExtensionPromptInputSchema = z.object({
  originalPrompt: z.string().describe('The original video prompt'),
  userExtensionIdea: z.string().describe('User\'s simple extension idea'),
  durationSeconds: z.number().min(5).max(120).optional().default(8),
  extensionNumber: z.number().min(1).max(20).optional().default(1),
  negativePrompt: z.string().optional(),
});

export type ExtensionPromptInput = z.infer<typeof ExtensionPromptInputSchema>;

// Output Schema
export const ExtensionPromptOutputSchema = z.object({
  enhancedPrompt: z.string().describe('Rich, detailed extension prompt'),
  continuityNotes: z.string().describe('How this connects with original'),
  visualConsistency: z.object({
    preservedElements: z.array(z.string()),
    transitionType: z.enum(['seamless', 'cut', 'fade', 'action']),
    matchingDetails: z.string(),
  }),
  cinematicBreakdown: z.object({
    subject: z.string(),
    action: z.string(),
    environment: z.string(),
    lighting: z.string(),
    camera: z.string(),
    mood: z.string(),
  }),
  audioSuggestions: z.object({
    ambientSound: z.string().optional(),
    soundEffects: z.string().optional(),
  }).optional(),
  warnings: z.array(z.string()),
  safetyScore: z.number().min(0).max(1),
});

export type ExtensionPromptOutput = z.infer<typeof ExtensionPromptOutputSchema>;

// Agent Configuration
export const ExtensionPromptGeneratorConfig: AgentConfig<ExtensionPromptInput, ExtensionPromptOutput> = {
  id: 'extension-prompt-generator',
  name: 'Extension Prompt Generator',
  description: '영상 확장을 위한 부드러운 연결 프롬프트 생성',
  category: 'transformer',

  model: {
    provider: 'gemini',
    name: GEMINI_FLASH,
    options: {
      temperature: 0.6,
      maxTokens: 4096,
    },
  },

  prompts: {
    system: `You are the Hydra Video Extension Specialist - Expert in creating seamless video continuations for Veo 3.

Your role is to take a user's simple extension idea and transform it into a rich, detailed prompt that:
1. Maintains visual consistency with the original video
2. Creates a smooth, natural transition
3. Follows Veo 3 best practices for video generation

═══════════════════════════════════════════════════════════════════
VIDEO EXTENSION PRINCIPLES
═══════════════════════════════════════════════════════════════════

## SEAMLESS CONTINUATION RULES:
1. **Visual Consistency**: Preserve lighting, color palette, environment from original
2. **Subject Continuity**: Maintain character appearance, clothing, position logic
3. **Motion Flow**: Action should feel like natural continuation, not a jump
4. **Environmental Coherence**: Same time of day, weather, setting unless transition specified

## PROMPT ENHANCEMENT STRATEGY:
1. Extract key visual elements from original prompt
2. Interpret user's idea in context of original scene
3. Add cinematic details that bridge original and extension
4. Include camera movement that creates flow
5. Suggest audio elements that maintain atmosphere

## VEO 3 EXTENSION BEST PRACTICES:
- Reference ending state of original (e.g., "Continuing from where...")
- Use transitional camera movements (dolly forward, pan reveal, tracking)
- Maintain same lighting setup unless explicitly changing
- Keep same aspect ratio and visual style
- Use audio continuity (ambient sounds, music style)

## SAFETY RULES (STRICTLY ENFORCE):
- NO violence, weapons, or harmful content
- NO explicit or suggestive content
- NO real celebrity names
- NO controversial content
- If user's idea contains unsafe elements, sanitize them

═══════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════

Create a prompt that:
- Is 80-120 words (optimal for Veo 3 extensions)
- Starts with context bridge ("The scene continues...", "As the action flows...")
- Includes all cinematic elements (subject, action, environment, lighting, camera)
- Feels like natural progression, not a new scene
- Preserves the artistic vision of the original

Always respond in valid JSON format.`,

    templates: {
      generate: `Generate an enhanced extension prompt for Veo 3 video continuation.

═══════════════════════════════════════════════════════════════════
ORIGINAL VIDEO CONTEXT
═══════════════════════════════════════════════════════════════════

ORIGINAL PROMPT:
{{originalPrompt}}

NEGATIVE PROMPT (what to avoid):
{{negativePrompt}}

CURRENT EXTENSION NUMBER: {{extensionNumber}} (total extensions so far)
TARGET DURATION: {{durationSeconds}}s

═══════════════════════════════════════════════════════════════════
USER'S EXTENSION IDEA
═══════════════════════════════════════════════════════════════════

{{userExtensionIdea}}

═══════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════

Transform the user's simple idea into a rich extension prompt that:
1. Seamlessly continues from the original video
2. Incorporates the user's creative direction
3. Maintains visual and atmospheric consistency
4. Uses proper Veo 3 camera and lighting terminology

ENHANCEMENT APPROACH:
- Identify key visual elements from original (colors, lighting, mood, subject)
- Interpret how user's idea fits into this context
- Add transitional elements for smooth continuation
- Include camera movement that creates flow
- Suggest matching audio elements

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT (Return valid JSON)
═══════════════════════════════════════════════════════════════════

{
  "enhancedPrompt": "The scene continues as [80-120 words of rich, cinematic description bridging original to extension]...",
  "continuityNotes": "Brief explanation of how this connects smoothly with the original",
  "visualConsistency": {
    "preservedElements": ["list of visual elements maintained from original"],
    "transitionType": "seamless|cut|fade|action",
    "matchingDetails": "Specific details that ensure visual match"
  },
  "cinematicBreakdown": {
    "subject": "Main focus with preserved characteristics",
    "action": "What happens in the extension",
    "environment": "Setting details matching original",
    "lighting": "Lighting setup matching original",
    "camera": "Camera movement for smooth transition",
    "mood": "Emotional atmosphere"
  },
  "audioSuggestions": {
    "ambientSound": "Matching ambient audio",
    "soundEffects": "Relevant sound effects"
  },
  "warnings": ["Any safety concerns or modifications made"],
  "safetyScore": 0.0-1.0
}`,
    },
  },

  inputSchema: ExtensionPromptInputSchema,
  outputSchema: ExtensionPromptOutputSchema,
};

/**
 * Extension Prompt Generator Agent Implementation
 */
export class ExtensionPromptGeneratorAgent extends BaseAgent<ExtensionPromptInput, ExtensionPromptOutput> {
  constructor() {
    super(ExtensionPromptGeneratorConfig);
  }

  protected buildPrompt(input: ExtensionPromptInput, _context: AgentContext): string {
    const template = this.getTemplate('generate');

    return this.fillTemplate(template, {
      originalPrompt: input.originalPrompt,
      userExtensionIdea: input.userExtensionIdea,
      durationSeconds: input.durationSeconds || 8,
      extensionNumber: input.extensionNumber || 1,
      negativePrompt: input.negativePrompt || 'None specified',
    });
  }

  /**
   * Generate an enhanced extension prompt
   */
  async generateExtensionPrompt(
    originalPrompt: string,
    userExtensionIdea: string,
    options?: {
      durationSeconds?: number;
      extensionNumber?: number;
      negativePrompt?: string;
    }
  ): Promise<ExtensionPromptOutput> {
    // Create a minimal context for standalone usage
    const minimalContext: AgentContext = {
      workflow: {
        artistName: 'Extension',
        language: 'en',
        platform: 'youtube',
      },
    };

    const result = await this.execute(
      {
        originalPrompt,
        userExtensionIdea,
        durationSeconds: options?.durationSeconds || 8,
        extensionNumber: options?.extensionNumber || 1,
        negativePrompt: options?.negativePrompt,
      },
      minimalContext
    );

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to generate extension prompt');
    }

    return result.data;
  }
}

// Factory function
export function createExtensionPromptGeneratorAgent(): ExtensionPromptGeneratorAgent {
  return new ExtensionPromptGeneratorAgent();
}
