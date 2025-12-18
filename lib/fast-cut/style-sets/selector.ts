/**
 * Fast Cut Style Set Selector
 * ===========================
 * AI-powered and keyword-based style set selection
 */

import { z } from 'zod';
import { BaseAgent } from '@/lib/agents/base-agent';
import type { AgentConfig, AgentContext } from '@/lib/agents/types';
import type { FastCutStyleSet, StyleSetSelectionResult } from './types';
import { ALL_STYLE_SETS, STYLE_SETS_BY_ID, getDefaultStyleSet } from './presets';

// ============================================
// AI-Based Selector Agent
// ============================================

const StyleSetSelectorInputSchema = z.object({
  prompt: z.string(),
  language: z.enum(['ko', 'en']).optional(),
});

type StyleSetSelectorInput = z.infer<typeof StyleSetSelectorInputSchema>;

const StyleSetSelectorOutputSchema = z.object({
  styleSetId: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  alternativeIds: z.array(z.string()).optional(),
  // Duration recommendation (15-25 seconds)
  recommendedDuration: z.number().min(15).max(25).optional(),
  durationReasoning: z.string().optional(),
});

type StyleSetSelectorOutput = z.infer<typeof StyleSetSelectorOutputSchema>;

// Build style set descriptions for AI prompt
const STYLE_SET_DESCRIPTIONS = ALL_STYLE_SETS.map(s =>
  `- ${s.id}: ${s.nameKo} (${s.name}) - ${s.descriptionKo}`
).join('\n');

const StyleSetSelectorConfig: AgentConfig<StyleSetSelectorInput, StyleSetSelectorOutput> = {
  id: 'fast-cut-style-selector',
  name: 'Fast Cut Style Selector',
  description: '프롬프트 분석을 통한 최적 스타일 세트 선택',
  category: 'fast-cut',

  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.2,
      maxTokens: 4096, // Increased for thinking model
    },
  },

  prompts: {
    system: `You are a video style and duration expert. Analyze user prompts and select the most appropriate style set AND recommend optimal video duration.

Available Style Sets:
${STYLE_SET_DESCRIPTIONS}

Duration Guidelines (15-25 seconds):
- 15-17초: 간단한 제품 소개, 한 줄 메시지, 임팩트 강조
- 18-20초: 일반적인 콘텐츠, 2-3개 포인트 전달, 짧은 스토리
- 21-23초: 상세 설명, 비교/리뷰, 감성적 스토리텔링
- 24-25초: 복잡한 내용, 튜토리얼, 다단계 정보 전달

Rules:
1. Analyze the prompt's mood, purpose, and target audience
2. Select ONE style set that best matches
3. Recommend optimal duration (15-25 seconds) based on content complexity
4. Provide confidence score (0.0-1.0)
5. Suggest 1-2 alternatives if confidence is below 0.8
6. Respond in JSON format only`,

    templates: {
      select: `Analyze this video concept and select the best style set with optimal duration:

"{{prompt}}"

Respond with JSON:
{
  "styleSetId": "selected_id",
  "confidence": 0.85,
  "reasoning": "Brief style explanation",
  "alternativeIds": ["alt1", "alt2"],
  "recommendedDuration": 20,
  "durationReasoning": "Brief duration explanation"
}`,
    },
  },

  inputSchema: StyleSetSelectorInputSchema,
  outputSchema: StyleSetSelectorOutputSchema,
};

/**
 * AI-based Style Set Selector Agent
 */
export class StyleSetSelectorAgent extends BaseAgent<StyleSetSelectorInput, StyleSetSelectorOutput> {
  constructor() {
    super(StyleSetSelectorConfig);
  }

  protected buildPrompt(input: StyleSetSelectorInput): string {
    const template = this.getTemplate('select');
    return this.fillTemplate(template, { prompt: input.prompt });
  }

  /**
   * Select best style set using AI
   */
  async selectStyleSet(
    prompt: string,
    context: AgentContext
  ): Promise<StyleSetSelectionResult> {
    try {
      const result = await this.execute({ prompt }, context);

      if (result.success && result.data) {
        // Validate the returned ID exists
        if (STYLE_SETS_BY_ID[result.data.styleSetId]) {
          // Clamp duration to valid range
          const recommendedDuration = result.data.recommendedDuration
            ? Math.max(15, Math.min(25, result.data.recommendedDuration))
            : 20;

          console.log(`[StyleSetSelector] AI selected: ${result.data.styleSetId} (confidence: ${result.data.confidence}, duration: ${recommendedDuration}s)`);
          return {
            styleSetId: result.data.styleSetId,
            confidence: result.data.confidence,
            reasoning: result.data.reasoning,
            alternativeIds: result.data.alternativeIds?.filter(id => STYLE_SETS_BY_ID[id]),
            recommendedDuration,
            durationReasoning: result.data.durationReasoning,
          };
        } else {
          console.warn(`[StyleSetSelector] AI returned invalid styleSetId: ${result.data.styleSetId}, falling back to keywords`);
        }
      } else {
        console.warn(`[StyleSetSelector] AI execution failed: ${result.error || 'Unknown error'}, falling back to keywords`);
      }
    } catch (error) {
      console.error(`[StyleSetSelector] AI selection threw error:`, error);
    }

    // Fallback to keyword-based selection
    console.log(`[StyleSetSelector] Using keyword fallback for prompt: "${prompt.substring(0, 50)}..."`);
    return selectStyleSetByKeywords(prompt);
  }
}

// ============================================
// Keyword-Based Selector (Fast Fallback)
// ============================================

/**
 * Select style set using keyword matching
 * Fast fallback when AI is unavailable or fails
 */
export function selectStyleSetByKeywords(prompt: string): StyleSetSelectionResult {
  const promptLower = prompt.toLowerCase();
  const scores: Array<{ set: FastCutStyleSet; score: number }> = [];

  for (const styleSet of ALL_STYLE_SETS) {
    let score = 0;

    // Check Korean keywords
    for (const keyword of styleSet.matchKeywords.ko) {
      if (promptLower.includes(keyword.toLowerCase())) {
        score += 2; // Korean match gets higher weight for Korean prompts
      }
    }

    // Check English keywords
    for (const keyword of styleSet.matchKeywords.en) {
      if (promptLower.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    scores.push({ set: styleSet, score });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  const second = scores[1];

  // Calculate confidence based on score difference
  let confidence = 0.5;
  if (best.score > 0) {
    confidence = Math.min(0.95, 0.5 + (best.score * 0.1));
    if (second && best.score > second.score * 1.5) {
      confidence = Math.min(0.95, confidence + 0.1);
    }
  }

  // Get alternatives (top 2 after best, if they have scores)
  const alternativeIds = scores
    .slice(1, 3)
    .filter(s => s.score > 0)
    .map(s => s.set.id);

  // If no matches, return default
  if (best.score === 0) {
    return {
      styleSetId: getDefaultStyleSet().id,
      confidence: 0.3,
      reasoning: 'No keyword matches found, using default viral_tiktok style',
      alternativeIds: ['cinematic_mood', 'clean_minimal'],
      recommendedDuration: 20,
      durationReasoning: '기본 권장 길이',
    };
  }

  // Estimate duration based on style intensity
  const estimatedDuration = best.set.audio.intensity === 'high' ? 17
    : best.set.audio.intensity === 'low' ? 23
    : 20;

  return {
    styleSetId: best.set.id,
    confidence,
    reasoning: `Matched ${best.score} keywords for ${best.set.nameKo} style`,
    alternativeIds: alternativeIds.length > 0 ? alternativeIds : undefined,
    recommendedDuration: estimatedDuration,
    durationReasoning: `${best.set.nameKo} 스타일에 적합한 길이`,
  };
}

// ============================================
// Combined Selector API
// ============================================

let selectorAgentInstance: StyleSetSelectorAgent | null = null;

function getStyleSetSelectorAgent(): StyleSetSelectorAgent {
  if (!selectorAgentInstance) {
    selectorAgentInstance = new StyleSetSelectorAgent();
  }
  return selectorAgentInstance;
}

/**
 * Select the best style set for a prompt
 * Uses AI when available, falls back to keyword matching
 */
export async function selectStyleSet(
  prompt: string,
  context: AgentContext,
  options?: {
    useAI?: boolean;
  }
): Promise<StyleSetSelectionResult> {
  const useAI = options?.useAI ?? true;

  if (useAI) {
    try {
      const agent = getStyleSetSelectorAgent();
      return await agent.selectStyleSet(prompt, context);
    } catch (error) {
      console.warn('[StyleSetSelector] AI selection failed, using keyword fallback:', error);
      return selectStyleSetByKeywords(prompt);
    }
  }

  return selectStyleSetByKeywords(prompt);
}

/**
 * Get style set with full details
 */
export function getStyleSetWithSelection(
  result: StyleSetSelectionResult
): {
  selected: FastCutStyleSet;
  alternatives: FastCutStyleSet[];
  selection: StyleSetSelectionResult;
} {
  const selected = STYLE_SETS_BY_ID[result.styleSetId] ?? getDefaultStyleSet();
  const alternatives = (result.alternativeIds ?? [])
    .map(id => STYLE_SETS_BY_ID[id])
    .filter((s): s is FastCutStyleSet => s !== undefined);

  return {
    selected,
    alternatives,
    selection: result,
  };
}

// Factory function
export function createStyleSetSelectorAgent(): StyleSetSelectorAgent {
  return new StyleSetSelectorAgent();
}
