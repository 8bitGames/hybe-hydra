/**
 * Feedback Analyzer Service
 * =========================
 * Analyzes agent feedback data to identify improvement opportunities
 *
 * Features:
 * - Aggregates feedback from agent_feedback table
 * - Identifies weakness patterns using LLM
 * - Generates prioritized improvement recommendations
 */

import { getServiceClient } from '@/lib/supabase/service';
import { GeminiClient } from '@/lib/models';
import { GEMINI_FLASH } from '../constants';
import type {
  AgentFeedback,
  FeedbackAnalysis,
  FeedbackSummary,
  Weakness,
  WeaknessPattern,
  ImprovementPriority,
  ScoreDistribution,
} from './types';

const ANALYZER_SYSTEM_PROMPT = `You are an expert at analyzing AI agent performance feedback.
Your task is to identify patterns in feedback data and suggest actionable improvements.

Analyze the provided feedback data and identify:
1. Common weaknesses and their root causes
2. Patterns in low-scoring areas
3. Prioritized improvement recommendations

Be specific and actionable in your recommendations.
Focus on prompt improvements that can address the identified issues.

Respond in JSON format:
{
  "weaknesses": [
    {
      "dimension": "relevance|quality|creativity|overall",
      "description": "specific description of the weakness",
      "frequency": 0.0-1.0,
      "avgImpact": 0.0-5.0,
      "examples": ["example1", "example2"],
      "suggestedFix": "how to fix this in the prompt"
    }
  ],
  "priorities": [
    {
      "dimension": "relevance|quality|creativity|overall",
      "priority": 1-5,
      "currentScore": 0.0-5.0,
      "targetScore": 0.0-5.0,
      "suggestedActions": ["action1", "action2"]
    }
  ],
  "overallAssessment": "summary of the agent's performance"
}`;

export class FeedbackAnalyzer {
  private analyzerClient: GeminiClient;

  constructor() {
    this.analyzerClient = new GeminiClient({
      model: GEMINI_FLASH,
      temperature: 0.3,
      maxTokens: 4096,
    });
  }

  /**
   * Analyze feedback for a specific agent
   */
  async analyzeAgentFeedback(
    agentId: string,
    windowDays: number = 30
  ): Promise<FeedbackAnalysis> {
    // 1. Fetch feedback from database
    const feedback = await this.fetchFeedback(agentId, windowDays);

    if (feedback.length === 0) {
      return {
        summary: this.createEmptySummary(agentId),
        weaknesses: [],
        priorities: [],
        rawFeedback: [],
      };
    }

    // 2. Calculate summary statistics
    const summary = this.calculateSummary(agentId, feedback);

    // 3. If enough feedback, use LLM to identify patterns
    let weaknesses: Weakness[] = [];
    let priorities: ImprovementPriority[] = [];

    if (feedback.length >= 5) {
      const llmAnalysis = await this.analyzePatternsWithLLM(feedback, summary);
      weaknesses = llmAnalysis.weaknesses;
      priorities = llmAnalysis.priorities;
    } else {
      // Simple rule-based analysis for small feedback sets
      weaknesses = this.identifyWeaknessesSimple(feedback);
      priorities = this.generatePrioritiesSimple(summary);
    }

    return {
      summary,
      weaknesses,
      priorities,
      rawFeedback: feedback,
    };
  }

  /**
   * Fetch feedback from database
   */
  private async fetchFeedback(
    agentId: string,
    windowDays: number
  ): Promise<AgentFeedback[]> {
    try {
      const supabase = getServiceClient();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - windowDays);

      const { data, error } = await supabase
        .from('agent_feedback')
        .select('*')
        .eq('agent_id', agentId)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[FeedbackAnalyzer] Failed to fetch feedback:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        executionId: row.execution_id,
        agentId: row.agent_id,
        overallScore: row.overall_score,
        relevanceScore: row.relevance_score,
        qualityScore: row.quality_score,
        creativityScore: row.creativity_score,
        feedbackText: row.feedback_text,
        strengths: row.strengths,
        weaknesses: row.weaknesses,
        suggestions: row.suggestions,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('[FeedbackAnalyzer] Error fetching feedback:', error);
      return [];
    }
  }

  /**
   * Calculate summary statistics from feedback
   */
  private calculateSummary(
    agentId: string,
    feedback: AgentFeedback[]
  ): FeedbackSummary {
    const count = feedback.length;

    // Calculate averages
    const avgOverall = feedback.reduce((sum, f) => sum + f.overallScore, 0) / count;
    const avgRelevance = feedback.reduce((sum, f) => sum + f.relevanceScore, 0) / count;
    const avgQuality = feedback.reduce((sum, f) => sum + f.qualityScore, 0) / count;
    const avgCreativity = feedback.reduce((sum, f) => sum + f.creativityScore, 0) / count;

    // Calculate score distribution
    const distribution: ScoreDistribution = {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0,
      failing: 0,
    };

    feedback.forEach(f => {
      if (f.overallScore >= 4.5) distribution.excellent++;
      else if (f.overallScore >= 3.5) distribution.good++;
      else if (f.overallScore >= 2.5) distribution.average++;
      else if (f.overallScore >= 1.5) distribution.poor++;
      else distribution.failing++;
    });

    // Convert to percentages
    Object.keys(distribution).forEach(key => {
      distribution[key as keyof ScoreDistribution] /= count;
    });

    // Extract common weaknesses
    const weaknessMap = new Map<string, number>();
    feedback.forEach(f => {
      (f.weaknesses || []).forEach(w => {
        weaknessMap.set(w, (weaknessMap.get(w) || 0) + 1);
      });
    });

    const commonWeaknesses: WeaknessPattern[] = Array.from(weaknessMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([description, freq]) => ({
        category: this.categorizeWeakness(description),
        description,
        frequency: freq / count,
        severity: freq / count > 0.5 ? 'high' : freq / count > 0.25 ? 'medium' : 'low',
      }));

    // Extract common strengths
    const strengthMap = new Map<string, number>();
    feedback.forEach(f => {
      (f.strengths || []).forEach(s => {
        strengthMap.set(s, (strengthMap.get(s) || 0) + 1);
      });
    });

    const commonStrengths = Array.from(strengthMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s]) => s);

    // Determine trend (compare recent vs older feedback)
    const midpoint = Math.floor(count / 2);
    const recentAvg = feedback.slice(0, midpoint).reduce((sum, f) => sum + f.overallScore, 0) / midpoint || 0;
    const olderAvg = feedback.slice(midpoint).reduce((sum, f) => sum + f.overallScore, 0) / (count - midpoint) || 0;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentAvg - olderAvg > 0.2) trend = 'improving';
    else if (olderAvg - recentAvg > 0.2) trend = 'declining';

    return {
      agentId,
      feedbackCount: count,
      avgOverallScore: avgOverall,
      avgRelevanceScore: avgRelevance,
      avgQualityScore: avgQuality,
      avgCreativityScore: avgCreativity,
      scoreDistribution: distribution,
      commonWeaknesses,
      commonStrengths,
      recentTrend: trend,
    };
  }

  /**
   * Use LLM to analyze patterns in feedback
   */
  private async analyzePatternsWithLLM(
    feedback: AgentFeedback[],
    summary: FeedbackSummary
  ): Promise<{ weaknesses: Weakness[]; priorities: ImprovementPriority[] }> {
    try {
      // Prepare feedback data for LLM
      const feedbackForAnalysis = feedback.slice(0, 20).map(f => ({
        overallScore: f.overallScore,
        relevanceScore: f.relevanceScore,
        qualityScore: f.qualityScore,
        creativityScore: f.creativityScore,
        feedbackText: f.feedbackText,
        weaknesses: f.weaknesses,
        suggestions: f.suggestions,
      }));

      const prompt = `Analyze the following agent feedback data and identify patterns:

Summary:
- Average Overall Score: ${summary.avgOverallScore.toFixed(2)}
- Average Relevance: ${summary.avgRelevanceScore.toFixed(2)}
- Average Quality: ${summary.avgQualityScore.toFixed(2)}
- Average Creativity: ${summary.avgCreativityScore.toFixed(2)}
- Trend: ${summary.recentTrend}

Sample Feedback (${feedbackForAnalysis.length} samples):
${JSON.stringify(feedbackForAnalysis, null, 2)}

Common Weaknesses Mentioned:
${summary.commonWeaknesses.map(w => `- ${w.description} (${(w.frequency * 100).toFixed(0)}%)`).join('\n')}

Identify specific, actionable improvements for the agent's prompts.`;

      const response = await this.analyzerClient.generate({
        system: ANALYZER_SYSTEM_PROMPT,
        user: prompt,
      });

      // Parse LLM response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      const weaknesses: Weakness[] = (analysis.weaknesses || []).map((w: Record<string, unknown>, i: number) => ({
        id: `weakness-${i}`,
        dimension: w.dimension as 'relevance' | 'quality' | 'creativity' | 'overall',
        description: w.description as string,
        frequency: w.frequency as number,
        avgImpact: w.avgImpact as number,
        examples: (w.examples || []) as string[],
      }));

      const priorities: ImprovementPriority[] = (analysis.priorities || []).map((p: Record<string, unknown>) => ({
        dimension: p.dimension as 'relevance' | 'quality' | 'creativity' | 'overall',
        priority: p.priority as number,
        currentScore: p.currentScore as number,
        targetScore: p.targetScore as number,
        suggestedActions: (p.suggestedActions || []) as string[],
      }));

      return { weaknesses, priorities };
    } catch (error) {
      console.error('[FeedbackAnalyzer] LLM analysis failed:', error);
      // Fall back to simple analysis
      return {
        weaknesses: this.identifyWeaknessesSimple(feedback),
        priorities: this.generatePrioritiesSimple(summary),
      };
    }
  }

  /**
   * Simple rule-based weakness identification
   */
  private identifyWeaknessesSimple(feedback: AgentFeedback[]): Weakness[] {
    const weaknesses: Weakness[] = [];
    const count = feedback.length;

    // Check each dimension
    const dimensions: Array<{ key: keyof AgentFeedback; name: 'relevance' | 'quality' | 'creativity' | 'overall' }> = [
      { key: 'relevanceScore', name: 'relevance' },
      { key: 'qualityScore', name: 'quality' },
      { key: 'creativityScore', name: 'creativity' },
      { key: 'overallScore', name: 'overall' },
    ];

    dimensions.forEach(({ key, name }) => {
      const lowScores = feedback.filter(f => (f[key] as number) < 3);
      if (lowScores.length / count > 0.3) {
        weaknesses.push({
          id: `${name}-weakness`,
          dimension: name,
          description: `Low ${name} scores detected`,
          frequency: lowScores.length / count,
          avgImpact: 5 - (feedback.reduce((sum, f) => sum + (f[key] as number), 0) / count),
          examples: lowScores.slice(0, 3).map(f => f.feedbackText || 'No feedback text'),
        });
      }
    });

    return weaknesses;
  }

  /**
   * Simple rule-based priority generation
   */
  private generatePrioritiesSimple(summary: FeedbackSummary): ImprovementPriority[] {
    const priorities: ImprovementPriority[] = [];

    const dimensions: Array<{ name: 'relevance' | 'quality' | 'creativity' | 'overall'; score: number }> = [
      { name: 'relevance', score: summary.avgRelevanceScore },
      { name: 'quality', score: summary.avgQualityScore },
      { name: 'creativity', score: summary.avgCreativityScore },
      { name: 'overall', score: summary.avgOverallScore },
    ];

    // Sort by lowest score first
    dimensions.sort((a, b) => a.score - b.score);

    dimensions.forEach((dim, index) => {
      if (dim.score < 4.0) {
        priorities.push({
          dimension: dim.name,
          priority: 5 - index,
          currentScore: dim.score,
          targetScore: Math.min(5, dim.score + 0.5),
          suggestedActions: this.getDefaultActions(dim.name),
        });
      }
    });

    return priorities;
  }

  /**
   * Get default improvement actions for a dimension
   */
  private getDefaultActions(dimension: string): string[] {
    const actionMap: Record<string, string[]> = {
      relevance: [
        'Clarify the task requirements in the system prompt',
        'Add examples of good relevant outputs',
        'Specify what should NOT be included',
      ],
      quality: [
        'Add structure guidelines to the prompt',
        'Include quality criteria in the output format',
        'Add validation steps to the prompt',
      ],
      creativity: [
        'Encourage creative exploration in the prompt',
        'Add diverse examples',
        'Reduce constraints that limit creativity',
      ],
      overall: [
        'Review and improve all prompt sections',
        'Add more specific examples',
        'Clarify expected output format',
      ],
    };

    return actionMap[dimension] || actionMap.overall;
  }

  /**
   * Categorize a weakness description
   */
  private categorizeWeakness(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('relevance') || lower.includes('topic') || lower.includes('context')) {
      return 'relevance';
    }
    if (lower.includes('quality') || lower.includes('structure') || lower.includes('format')) {
      return 'quality';
    }
    if (lower.includes('creative') || lower.includes('original') || lower.includes('unique')) {
      return 'creativity';
    }
    return 'general';
  }

  /**
   * Create an empty summary for agents with no feedback
   */
  private createEmptySummary(agentId: string): FeedbackSummary {
    return {
      agentId,
      feedbackCount: 0,
      avgOverallScore: 0,
      avgRelevanceScore: 0,
      avgQualityScore: 0,
      avgCreativityScore: 0,
      scoreDistribution: {
        excellent: 0,
        good: 0,
        average: 0,
        poor: 0,
        failing: 0,
      },
      commonWeaknesses: [],
      commonStrengths: [],
      recentTrend: 'stable',
    };
  }

  /**
   * Check if an agent has enough feedback for evolution
   */
  async hasEnoughFeedback(agentId: string, minCount: number = 10): Promise<boolean> {
    try {
      const supabase = getServiceClient();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count, error } = await supabase
        .from('agent_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error) {
        console.error('[FeedbackAnalyzer] Error checking feedback count:', error);
        return false;
      }

      return (count || 0) >= minCount;
    } catch (error) {
      console.error('[FeedbackAnalyzer] Error checking feedback count:', error);
      return false;
    }
  }
}

// Factory function
export function createFeedbackAnalyzer(): FeedbackAnalyzer {
  return new FeedbackAnalyzer();
}
