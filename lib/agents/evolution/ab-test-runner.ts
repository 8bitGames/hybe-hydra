/**
 * A/B Test Runner Service
 * =======================
 * Runs comparative tests between baseline and candidate prompts
 *
 * Features:
 * - Executes test cases with both prompts
 * - Compares performance metrics
 * - Determines statistical significance
 * - Generates promotion recommendations
 */

import { getServiceClient } from '@/lib/supabase/service';
import { GeminiClient } from '@/lib/models';
import { GEMINI_FLASH } from '../constants';
import { DatabasePrompt } from '../prompt-loader';
import { AgentEvaluationService, TestCase, EvaluationResult } from '../evaluation-service';
import type {
  PromptCandidate,
  ABTestResult,
  TestRunSummary,
  TestComparison,
  RegressionDetail,
  TestEvaluation,
  QualityGates,
  QualityGateResult,
  DEFAULT_QUALITY_GATES,
} from './types';

interface TestCaseResult {
  testCaseId: string;
  testCaseName: string;
  input: Record<string, unknown>;
  baselineOutput: Record<string, unknown> | null;
  candidateOutput: Record<string, unknown> | null;
  baselineEvaluation: EvaluationResult | null;
  candidateEvaluation: EvaluationResult | null;
  baselinePassed: boolean;
  candidatePassed: boolean;
}

export class ABTestRunner {
  private evaluationService: AgentEvaluationService;
  private testClient: GeminiClient;

  constructor() {
    this.evaluationService = new AgentEvaluationService();
    this.testClient = new GeminiClient({
      model: GEMINI_FLASH,
      temperature: 0.3,
      maxTokens: 4096,
    });
  }

  /**
   * Run A/B comparison between baseline and candidate
   */
  async runComparison(
    agentId: string,
    baselinePrompt: DatabasePrompt,
    candidate: PromptCandidate,
    testCases?: TestCase[]
  ): Promise<ABTestResult> {
    // 1. Get test cases if not provided
    const cases = testCases || await this.fetchTestCases(agentId);

    if (cases.length === 0) {
      return this.createEmptyResult('No test cases available');
    }

    // 2. Run tests with both prompts
    const results: TestCaseResult[] = [];
    const startTime = Date.now();

    for (const testCase of cases) {
      const result = await this.runSingleTest(testCase, baselinePrompt, candidate);
      results.push(result);
    }

    const totalTimeMs = Date.now() - startTime;

    // 3. Calculate summaries
    const baselineResults = this.calculateSummary(results, 'baseline', totalTimeMs);
    const candidateResults = this.calculateSummary(results, 'candidate', totalTimeMs);

    // 4. Compare results
    const comparison = this.compareResults(results, baselineResults, candidateResults);

    // 5. Determine statistical significance (simple threshold for now)
    const statisticalSignificance = this.checkSignificance(results);

    // 6. Generate recommendation
    const recommendation = this.generateRecommendation(
      comparison,
      baselineResults,
      candidateResults,
      statisticalSignificance
    );

    return {
      testCaseCount: cases.length,
      baselineResults,
      candidateResults,
      comparison,
      statisticalSignificance,
      recommendation,
    };
  }

  /**
   * Fetch test cases for an agent
   */
  private async fetchTestCases(agentId: string): Promise<TestCase[]> {
    try {
      const supabase = getServiceClient();

      const { data, error } = await supabase
        .from('agent_test_cases')
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        console.error('[ABTestRunner] Failed to fetch test cases:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        agent_id: row.agent_id,
        name: row.name,
        description: row.description,
        input: row.input,
        expected_criteria: row.expected_criteria,
        min_overall_score: row.min_overall_score,
        min_relevance_score: row.min_relevance_score,
        min_quality_score: row.min_quality_score,
        priority: row.priority,
        tags: row.tags,
      }));
    } catch (error) {
      console.error('[ABTestRunner] Error fetching test cases:', error);
      return [];
    }
  }

  /**
   * Run a single test case with both prompts
   */
  private async runSingleTest(
    testCase: TestCase,
    baselinePrompt: DatabasePrompt,
    candidate: PromptCandidate
  ): Promise<TestCaseResult> {
    const result: TestCaseResult = {
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      input: testCase.input,
      baselineOutput: null,
      candidateOutput: null,
      baselineEvaluation: null,
      candidateEvaluation: null,
      baselinePassed: false,
      candidatePassed: false,
    };

    try {
      // Run baseline
      const baselineOutput = await this.executeWithPrompt(
        baselinePrompt.system_prompt,
        baselinePrompt.templates,
        testCase.input
      );
      result.baselineOutput = baselineOutput;

      if (baselineOutput) {
        const baselineEval = await this.evaluationService.evaluateOutput(
          testCase.agent_id,
          testCase.input,
          baselineOutput,
          testCase.expected_criteria
        );
        result.baselineEvaluation = baselineEval;
        if (baselineEval) {
          result.baselinePassed = this.checkTestPassed(baselineEval, testCase);
        }
      }
    } catch (error) {
      console.error('[ABTestRunner] Baseline execution failed:', error);
    }

    try {
      // Run candidate
      const candidateOutput = await this.executeWithPrompt(
        candidate.systemPrompt,
        candidate.templates,
        testCase.input
      );
      result.candidateOutput = candidateOutput;

      if (candidateOutput) {
        const candidateEval = await this.evaluationService.evaluateOutput(
          testCase.agent_id,
          testCase.input,
          candidateOutput,
          testCase.expected_criteria
        );
        result.candidateEvaluation = candidateEval;
        if (candidateEval) {
          result.candidatePassed = this.checkTestPassed(candidateEval, testCase);
        }
      }
    } catch (error) {
      console.error('[ABTestRunner] Candidate execution failed:', error);
    }

    return result;
  }

  /**
   * Execute agent with specific prompt
   */
  private async executeWithPrompt(
    systemPrompt: string,
    templates: Record<string, string>,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    try {
      // Build user prompt from template
      const templateKey = Object.keys(templates)[0] || 'default';
      let userPrompt = templates[templateKey] || '';

      // Replace template variables
      Object.entries(input).forEach(([key, value]) => {
        userPrompt = userPrompt.replace(
          new RegExp(`{{${key}}}`, 'g'),
          String(value)
        );
      });

      const response = await this.testClient.generate({
        system: systemPrompt,
        user: userPrompt,
      });

      // Try to parse as JSON
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { raw_output: response.content };
    } catch (error) {
      console.error('[ABTestRunner] Execution failed:', error);
      return null;
    }
  }

  /**
   * Check if evaluation passes test case thresholds
   */
  private checkTestPassed(evaluation: EvaluationResult, testCase: TestCase): boolean {
    return (
      evaluation.overall_score >= testCase.min_overall_score &&
      evaluation.relevance_score >= testCase.min_relevance_score &&
      evaluation.quality_score >= testCase.min_quality_score
    );
  }

  /**
   * Calculate summary statistics for test results
   */
  private calculateSummary(
    results: TestCaseResult[],
    variant: 'baseline' | 'candidate',
    totalTimeMs: number
  ): TestRunSummary {
    const evaluations = results
      .map(r => variant === 'baseline' ? r.baselineEvaluation : r.candidateEvaluation)
      .filter((e): e is EvaluationResult => e !== null);

    const passed = results.filter(r =>
      variant === 'baseline' ? r.baselinePassed : r.candidatePassed
    ).length;

    const count = evaluations.length;

    return {
      totalTests: results.length,
      passed,
      failed: results.length - passed,
      passRate: count > 0 ? passed / results.length : 0,
      avgOverallScore: count > 0
        ? evaluations.reduce((sum, e) => sum + e.overall_score, 0) / count
        : 0,
      avgRelevanceScore: count > 0
        ? evaluations.reduce((sum, e) => sum + e.relevance_score, 0) / count
        : 0,
      avgQualityScore: count > 0
        ? evaluations.reduce((sum, e) => sum + e.quality_score, 0) / count
        : 0,
      avgCreativityScore: count > 0
        ? evaluations.reduce((sum, e) => sum + e.creativity_score, 0) / count
        : 0,
      executionTimeMs: totalTimeMs,
    };
  }

  /**
   * Compare baseline and candidate results
   */
  private compareResults(
    results: TestCaseResult[],
    baseline: TestRunSummary,
    candidate: TestRunSummary
  ): TestComparison {
    // Find regressions
    const regressions: RegressionDetail[] = [];

    results.forEach(r => {
      if (r.baselineEvaluation && r.candidateEvaluation) {
        const dimensions: Array<{
          name: 'relevance' | 'quality' | 'creativity' | 'overall';
          baselineKey: keyof EvaluationResult;
          candidateKey: keyof EvaluationResult;
        }> = [
          { name: 'overall', baselineKey: 'overall_score', candidateKey: 'overall_score' },
          { name: 'relevance', baselineKey: 'relevance_score', candidateKey: 'relevance_score' },
          { name: 'quality', baselineKey: 'quality_score', candidateKey: 'quality_score' },
          { name: 'creativity', baselineKey: 'creativity_score', candidateKey: 'creativity_score' },
        ];

        dimensions.forEach(dim => {
          const baselineScore = r.baselineEvaluation![dim.baselineKey] as number;
          const candidateScore = r.candidateEvaluation![dim.candidateKey] as number;
          const regression = baselineScore - candidateScore;

          if (regression > 0.5) { // Significant regression threshold
            regressions.push({
              testCaseId: r.testCaseId,
              testCaseName: r.testCaseName,
              dimension: dim.name,
              baselineScore,
              candidateScore,
              regressionAmount: regression,
            });
          }
        });
      }
    });

    return {
      overallImprovement: candidate.avgOverallScore - baseline.avgOverallScore,
      relevanceImprovement: candidate.avgRelevanceScore - baseline.avgRelevanceScore,
      qualityImprovement: candidate.avgQualityScore - baseline.avgQualityScore,
      creativityImprovement: candidate.avgCreativityScore - baseline.avgCreativityScore,
      passRateChange: candidate.passRate - baseline.passRate,
      regressions,
    };
  }

  /**
   * Check statistical significance (simplified)
   */
  private checkSignificance(results: TestCaseResult[]): boolean {
    // Simple significance check: at least 5 test cases with consistent improvement
    if (results.length < 5) return false;

    let improvements = 0;
    let regressions = 0;

    results.forEach(r => {
      if (r.baselineEvaluation && r.candidateEvaluation) {
        if (r.candidateEvaluation.overall_score > r.baselineEvaluation.overall_score) {
          improvements++;
        } else if (r.candidateEvaluation.overall_score < r.baselineEvaluation.overall_score) {
          regressions++;
        }
      }
    });

    // Significant if improvements outweigh regressions by 2:1
    return improvements >= regressions * 2 && improvements >= 3;
  }

  /**
   * Generate promotion recommendation
   */
  private generateRecommendation(
    comparison: TestComparison,
    baseline: TestRunSummary,
    candidate: TestRunSummary,
    significant: boolean
  ): 'promote' | 'reject' | 'more_testing' | 'review' {
    // Reject if significant regressions
    if (comparison.regressions.length > 2) {
      return 'reject';
    }

    // Reject if pass rate dropped significantly
    if (comparison.passRateChange < -0.1) {
      return 'reject';
    }

    // Promote if clear improvement
    if (
      significant &&
      comparison.overallImprovement >= 0.2 &&
      comparison.regressions.length === 0 &&
      candidate.passRate >= 0.8
    ) {
      return 'promote';
    }

    // Need more testing if not enough data
    if (baseline.totalTests < 5) {
      return 'more_testing';
    }

    // Review for marginal improvements
    if (comparison.overallImprovement > 0 && comparison.regressions.length <= 1) {
      return 'review';
    }

    return 'reject';
  }

  /**
   * Evaluate test results against quality gates
   */
  evaluateResults(
    results: ABTestResult,
    qualityGates: QualityGates = {
      minFeedbackCount: 10,
      minImprovementThreshold: 0.1,
      maxRegressionAllowed: 0.05,
      minTestPassRate: 0.8,
      requireHumanApproval: true,
    }
  ): TestEvaluation {
    const gateResults: QualityGateResult[] = [];

    // Check improvement threshold
    gateResults.push({
      gate: 'minImprovementThreshold',
      required: qualityGates.minImprovementThreshold,
      actual: results.comparison.overallImprovement,
      passed: results.comparison.overallImprovement >= qualityGates.minImprovementThreshold,
    });

    // Check max regression
    const maxRegression = Math.max(
      0,
      ...results.comparison.regressions.map(r => r.regressionAmount)
    );
    gateResults.push({
      gate: 'maxRegressionAllowed',
      required: qualityGates.maxRegressionAllowed,
      actual: maxRegression,
      passed: maxRegression <= qualityGates.maxRegressionAllowed,
    });

    // Check pass rate
    gateResults.push({
      gate: 'minTestPassRate',
      required: qualityGates.minTestPassRate,
      actual: results.candidateResults.passRate,
      passed: results.candidateResults.passRate >= qualityGates.minTestPassRate,
    });

    const meetsQualityGates = gateResults.every(g => g.passed);
    const confidence = this.calculateConfidence(results, gateResults);

    let recommendation = results.recommendation;
    if (!meetsQualityGates && recommendation === 'promote') {
      recommendation = 'review';
    }

    const reasoning = this.buildReasoning(results, gateResults, meetsQualityGates);

    return {
      passed: meetsQualityGates && results.recommendation !== 'reject',
      recommendation,
      confidence,
      reasoning,
      meetsQualityGates,
      gateResults,
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    results: ABTestResult,
    gateResults: QualityGateResult[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Add confidence for passing gates
    const passedGates = gateResults.filter(g => g.passed).length;
    confidence += (passedGates / gateResults.length) * 0.2;

    // Add confidence for statistical significance
    if (results.statisticalSignificance) {
      confidence += 0.15;
    }

    // Add confidence for no regressions
    if (results.comparison.regressions.length === 0) {
      confidence += 0.1;
    }

    // Add confidence for good pass rate
    if (results.candidateResults.passRate >= 0.9) {
      confidence += 0.05;
    }

    return Math.min(1, confidence);
  }

  /**
   * Build reasoning string
   */
  private buildReasoning(
    results: ABTestResult,
    gateResults: QualityGateResult[],
    meetsGates: boolean
  ): string {
    const parts: string[] = [];

    parts.push(`Tested ${results.testCaseCount} cases.`);
    parts.push(
      `Overall improvement: ${(results.comparison.overallImprovement * 100).toFixed(1)}%.`
    );
    parts.push(
      `Pass rate: ${(results.candidateResults.passRate * 100).toFixed(0)}% (was ${(results.baselineResults.passRate * 100).toFixed(0)}%).`
    );

    if (results.comparison.regressions.length > 0) {
      parts.push(`Found ${results.comparison.regressions.length} regression(s).`);
    }

    if (!meetsGates) {
      const failedGates = gateResults.filter(g => !g.passed).map(g => g.gate);
      parts.push(`Failed gates: ${failedGates.join(', ')}.`);
    }

    if (results.statisticalSignificance) {
      parts.push('Results are statistically significant.');
    }

    return parts.join(' ');
  }

  /**
   * Create empty result for error cases
   */
  private createEmptyResult(reason: string): ABTestResult {
    const emptySummary: TestRunSummary = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      passRate: 0,
      avgOverallScore: 0,
      avgRelevanceScore: 0,
      avgQualityScore: 0,
      avgCreativityScore: 0,
      executionTimeMs: 0,
    };

    return {
      testCaseCount: 0,
      baselineResults: emptySummary,
      candidateResults: emptySummary,
      comparison: {
        overallImprovement: 0,
        relevanceImprovement: 0,
        qualityImprovement: 0,
        creativityImprovement: 0,
        passRateChange: 0,
        regressions: [],
      },
      statisticalSignificance: false,
      recommendation: 'more_testing',
    };
  }
}

// Factory function
export function createABTestRunner(): ABTestRunner {
  return new ABTestRunner();
}
