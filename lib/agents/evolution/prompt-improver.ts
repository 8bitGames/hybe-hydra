/**
 * Prompt Improver Service
 * =======================
 * Uses LLM to generate improved prompt candidates based on feedback analysis
 *
 * Features:
 * - Generates multiple candidate prompts
 * - Preserves schema compatibility
 * - Documents rationale for changes
 */

import { GeminiClient } from '@/lib/models';
import { GEMINI_FLASH } from '../constants';
import { DatabasePrompt } from '../prompt-loader';
import type {
  FeedbackAnalysis,
  PromptCandidate,
  CandidateGenerationResult,
  ValidationResult,
} from './types';

const IMPROVER_SYSTEM_PROMPT = `You are an expert prompt engineer specializing in improving AI agent prompts.

Your task is to generate improved versions of agent prompts based on feedback analysis.

CRITICAL RULES:
1. NEVER change JSON field names in output schemas - they are bound to Zod validation schemas
2. System prompt should remain short and role-focused
3. Templates contain detailed task instructions
4. Maintain the original output structure exactly
5. Focus improvements on:
   - Clarity of instructions
   - Better examples
   - More specific guidelines
   - Addressing identified weaknesses

For each candidate, provide:
- The improved system prompt
- Improved templates
- A detailed rationale explaining what was changed and why

Respond in JSON format:
{
  "candidates": [
    {
      "systemPrompt": "improved system prompt",
      "templates": {
        "templateName": "improved template content"
      },
      "rationale": "detailed explanation of changes and expected improvements"
    }
  ],
  "improvementTargets": ["what aspects were targeted for improvement"]
}`;

export class PromptImprover {
  private improverClient: GeminiClient;

  constructor() {
    this.improverClient = new GeminiClient({
      model: GEMINI_FLASH,
      temperature: 0.7, // Higher temperature for creative improvements
      maxTokens: 8192,
    });
  }

  /**
   * Generate improved prompt candidates
   */
  async generateCandidates(
    currentPrompt: DatabasePrompt,
    feedbackAnalysis: FeedbackAnalysis,
    count: number = 3
  ): Promise<CandidateGenerationResult> {
    const prompt = this.buildImprovementPrompt(currentPrompt, feedbackAnalysis, count);

    try {
      const response = await this.improverClient.generate({
        system: IMPROVER_SYSTEM_PROMPT,
        user: prompt,
      });

      // Parse response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]);

      // Convert to PromptCandidate format
      const candidates: PromptCandidate[] = (result.candidates || []).map(
        (c: Record<string, unknown>, index: number) => ({
          id: '', // Will be assigned by DB
          cycleId: '', // Will be assigned later
          agentId: currentPrompt.agent_id,
          candidateVersion: currentPrompt.version + index + 1,
          systemPrompt: c.systemPrompt as string,
          templates: c.templates as Record<string, string>,
          modelOptions: currentPrompt.model_options,
          generationRationale: c.rationale as string,
          status: 'pending' as const,
          createdAt: new Date(),
        })
      );

      // Validate each candidate
      const validatedCandidates = await Promise.all(
        candidates.map(async (candidate) => {
          const validation = await this.validateCandidate(candidate, currentPrompt);
          if (!validation.valid) {
            console.warn(
              `[PromptImprover] Candidate validation failed:`,
              validation.errors
            );
            return null;
          }
          return candidate;
        })
      );

      return {
        candidates: validatedCandidates.filter((c): c is PromptCandidate => c !== null),
        generationRationale: `Generated ${count} candidates based on feedback analysis. Focused on: ${result.improvementTargets?.join(', ') || 'general improvements'}`,
        improvementTargets: result.improvementTargets || [],
      };
    } catch (error) {
      console.error('[PromptImprover] Failed to generate candidates:', error);
      return {
        candidates: [],
        generationRationale: `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        improvementTargets: [],
      };
    }
  }

  /**
   * Build the prompt for improvement generation
   */
  private buildImprovementPrompt(
    currentPrompt: DatabasePrompt,
    analysis: FeedbackAnalysis,
    count: number
  ): string {
    return `Generate ${count} improved versions of this agent prompt.

CURRENT AGENT: ${currentPrompt.name}
CATEGORY: ${currentPrompt.category}
DESCRIPTION: ${currentPrompt.description}

CURRENT SYSTEM PROMPT:
${currentPrompt.system_prompt}

CURRENT TEMPLATES:
${JSON.stringify(currentPrompt.templates, null, 2)}

FEEDBACK ANALYSIS:
- Overall Score: ${analysis.summary.avgOverallScore.toFixed(2)}/5
- Relevance Score: ${analysis.summary.avgRelevanceScore.toFixed(2)}/5
- Quality Score: ${analysis.summary.avgQualityScore.toFixed(2)}/5
- Creativity Score: ${analysis.summary.avgCreativityScore.toFixed(2)}/5
- Trend: ${analysis.summary.recentTrend}

IDENTIFIED WEAKNESSES:
${analysis.weaknesses.map(w => `- ${w.dimension}: ${w.description} (impact: ${w.avgImpact.toFixed(1)})`).join('\n')}

IMPROVEMENT PRIORITIES:
${analysis.priorities.map(p => `- ${p.dimension} (priority ${p.priority}): ${p.suggestedActions.join('; ')}`).join('\n')}

COMMON FEEDBACK:
${analysis.summary.commonWeaknesses.map(w => `- ${w.description} (${(w.frequency * 100).toFixed(0)}% frequency)`).join('\n')}

REQUIREMENTS:
1. Keep the same output structure (JSON field names cannot change)
2. Address the identified weaknesses
3. Follow the improvement priorities
4. Maintain or improve on strengths
5. Each candidate should try a different improvement approach

Generate ${count} distinct improved versions, each with a different strategy.`;
  }

  /**
   * Validate a candidate prompt
   */
  async validateCandidate(
    candidate: PromptCandidate,
    originalPrompt: DatabasePrompt
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check system prompt exists and is reasonable length
    if (!candidate.systemPrompt || candidate.systemPrompt.length < 50) {
      errors.push('System prompt is too short or missing');
    }

    if (candidate.systemPrompt.length > 5000) {
      warnings.push('System prompt is quite long, consider condensing');
    }

    // Check templates exist
    if (!candidate.templates || Object.keys(candidate.templates).length === 0) {
      errors.push('Templates are missing');
    }

    // Check template keys match original
    const originalKeys = Object.keys(originalPrompt.templates).sort();
    const candidateKeys = Object.keys(candidate.templates).sort();

    if (JSON.stringify(originalKeys) !== JSON.stringify(candidateKeys)) {
      errors.push(
        `Template keys don't match original. Expected: ${originalKeys.join(', ')}, Got: ${candidateKeys.join(', ')}`
      );
    }

    // Check rationale exists
    if (!candidate.generationRationale || candidate.generationRationale.length < 20) {
      warnings.push('Generation rationale is missing or too brief');
    }

    // Check for potential JSON schema field name changes (basic check)
    const originalFields = new Set<string>();
    const candidateFields = new Set<string>();

    Object.values(originalPrompt.templates).forEach(template => {
      const regex = /"(\w+)":/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(template)) !== null) {
        originalFields.add(match[1]);
      }
    });

    Object.values(candidate.templates).forEach(template => {
      const regex = /"(\w+)":/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(template)) !== null) {
        candidateFields.add(match[1]);
      }
    });

    // Check if any fields were removed
    originalFields.forEach(field => {
      if (!candidateFields.has(field)) {
        warnings.push(`JSON field "${field}" may have been removed - verify schema compatibility`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate a single focused improvement
   */
  async generateFocusedImprovement(
    currentPrompt: DatabasePrompt,
    focusDimension: 'relevance' | 'quality' | 'creativity',
    specificIssue: string
  ): Promise<PromptCandidate | null> {
    const prompt = `Generate a single improved prompt focusing specifically on ${focusDimension}.

CURRENT AGENT: ${currentPrompt.name}

CURRENT SYSTEM PROMPT:
${currentPrompt.system_prompt}

CURRENT TEMPLATES:
${JSON.stringify(currentPrompt.templates, null, 2)}

SPECIFIC ISSUE TO ADDRESS:
${specificIssue}

FOCUS: Improve ${focusDimension} while maintaining other aspects.

Generate ONE improved version that specifically addresses this issue.`;

    try {
      const response = await this.improverClient.generate({
        system: IMPROVER_SYSTEM_PROMPT,
        user: prompt,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]);
      const candidate = result.candidates?.[0];

      if (!candidate) {
        return null;
      }

      const promptCandidate: PromptCandidate = {
        id: '',
        cycleId: '',
        agentId: currentPrompt.agent_id,
        candidateVersion: currentPrompt.version + 1,
        systemPrompt: candidate.systemPrompt,
        templates: candidate.templates,
        modelOptions: currentPrompt.model_options,
        generationRationale: candidate.rationale || `Focused improvement on ${focusDimension}: ${specificIssue}`,
        status: 'pending',
        createdAt: new Date(),
      };

      const validation = await this.validateCandidate(promptCandidate, currentPrompt);
      if (!validation.valid) {
        console.warn('[PromptImprover] Focused improvement validation failed:', validation.errors);
        return null;
      }

      return promptCandidate;
    } catch (error) {
      console.error('[PromptImprover] Failed to generate focused improvement:', error);
      return null;
    }
  }

  /**
   * Extract JSON fields from template string
   */
  private extractJsonFields(template: string): Set<string> {
    const fields = new Set<string>();
    const regex = /"(\w+)":/g;
    let match;
    while ((match = regex.exec(template)) !== null) {
      fields.add(match[1]);
    }
    return fields;
  }
}

// Factory function
export function createPromptImprover(): PromptImprover {
  return new PromptImprover();
}
