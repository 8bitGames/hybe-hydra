/**
 * Agent Evaluation Service
 * =========================
 * LLM-as-Judge evaluation system for agent outputs
 *
 * Features:
 * - Automatic evaluation of agent outputs using LLM
 * - Multi-dimensional scoring (relevance, quality, creativity)
 * - Regression testing with golden test cases
 * - Metrics aggregation
 */

import { getServiceClient } from '@/lib/supabase/service';
import { GeminiClient } from '../models';

// Types
export interface ExecutionLog {
  id?: string;
  agent_id: string;
  session_id?: string;
  campaign_id?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  status: 'running' | 'success' | 'error';
  error_message?: string;
  prompt_version?: number;
}

export interface EvaluationResult {
  overall_score: number;
  relevance_score: number;
  quality_score: number;
  creativity_score: number;
  feedback_text: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface TestCase {
  id: string;
  agent_id: string;
  name: string;
  description?: string;
  input: Record<string, unknown>;
  expected_criteria: Record<string, unknown>;
  min_overall_score: number;
  min_relevance_score: number;
  min_quality_score: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
}

export interface TestRunResult {
  test_case_id: string;
  passed: boolean;
  actual_output: Record<string, unknown>;
  overall_score: number;
  relevance_score: number;
  quality_score: number;
  evaluation_notes: string;
  failures?: string[];
}

// LLM-as-Judge System Prompt
const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator for AI agent outputs. Your task is to evaluate the quality of an agent's output based on the given input and expected criteria.

Evaluate the output on these dimensions (1-5 scale):
1. **Relevance** (1-5): How well does the output address the input requirements?
2. **Quality** (1-5): How well-structured, coherent, and professional is the output?
3. **Creativity** (1-5): How creative and engaging is the output while staying on-topic?
4. **Overall** (1-5): Overall assessment considering all factors

Provide your evaluation in the following JSON format:
{
  "overall_score": <1-5>,
  "relevance_score": <1-5>,
  "quality_score": <1-5>,
  "creativity_score": <1-5>,
  "feedback_text": "<brief overall feedback>",
  "strengths": ["<strength1>", "<strength2>", ...],
  "weaknesses": ["<weakness1>", "<weakness2>", ...],
  "suggestions": ["<suggestion1>", "<suggestion2>", ...]
}

Be strict but fair. Consider the context and purpose of the agent.`;

/**
 * Agent Evaluation Service
 */
export class AgentEvaluationService {
  private judgeClient: GeminiClient;

  constructor() {
    // Use Gemini Flash for cost-effective evaluation
    this.judgeClient = new GeminiClient({
      model: 'gemini-2.5-flash',
      temperature: 0.3, // Lower temperature for consistent evaluation
      maxTokens: 2048,
    });
  }

  /**
   * Log an agent execution to database
   */
  async logExecution(log: ExecutionLog): Promise<string | null> {
    try {
      const supabase = getServiceClient();

      const { data, error } = await supabase
        .from('agent_executions')
        .insert({
          agent_id: log.agent_id,
          session_id: log.session_id,
          campaign_id: log.campaign_id,
          input: log.input,
          output: log.output,
          latency_ms: log.latency_ms,
          input_tokens: log.input_tokens,
          output_tokens: log.output_tokens,
          total_tokens: log.total_tokens,
          status: log.status,
          error_message: log.error_message,
          prompt_version: log.prompt_version,
          completed_at: log.status !== 'running' ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[EvaluationService] Failed to log execution:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('[EvaluationService] Error logging execution:', error);
      return null;
    }
  }

  /**
   * Update execution status
   */
  async updateExecution(
    executionId: string,
    updates: Partial<ExecutionLog>
  ): Promise<boolean> {
    try {
      const supabase = getServiceClient();

      const { error } = await supabase
        .from('agent_executions')
        .update({
          ...updates,
          completed_at: updates.status !== 'running' ? new Date().toISOString() : undefined,
        })
        .eq('id', executionId);

      if (error) {
        console.error('[EvaluationService] Failed to update execution:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[EvaluationService] Error updating execution:', error);
      return false;
    }
  }

  /**
   * Evaluate an agent output using LLM-as-Judge
   */
  async evaluateOutput(
    agentId: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    expectedCriteria?: Record<string, unknown>,
    executionId?: string
  ): Promise<EvaluationResult | null> {
    try {
      const userPrompt = this.buildEvaluationPrompt(input, output, expectedCriteria);

      const response = await this.judgeClient.generate({
        system: JUDGE_SYSTEM_PROMPT,
        user: userPrompt,
        responseFormat: 'json',
      });

      const evaluation = JSON.parse(response.content) as EvaluationResult;

      // Validate scores are in range
      const validateScore = (score: number) => Math.max(1, Math.min(5, Math.round(score)));
      evaluation.overall_score = validateScore(evaluation.overall_score);
      evaluation.relevance_score = validateScore(evaluation.relevance_score);
      evaluation.quality_score = validateScore(evaluation.quality_score);
      evaluation.creativity_score = validateScore(evaluation.creativity_score);

      // Save feedback to database
      if (executionId) {
        await this.saveFeedback(executionId, agentId, evaluation, 'llm_judge');
      }

      return evaluation;
    } catch (error) {
      console.error('[EvaluationService] Evaluation error:', error);
      return null;
    }
  }

  /**
   * Build evaluation prompt
   */
  private buildEvaluationPrompt(
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    expectedCriteria?: Record<string, unknown>
  ): string {
    let prompt = `## Agent Input
\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

## Agent Output
\`\`\`json
${JSON.stringify(output, null, 2)}
\`\`\``;

    if (expectedCriteria && Object.keys(expectedCriteria).length > 0) {
      prompt += `

## Expected Criteria
\`\`\`json
${JSON.stringify(expectedCriteria, null, 2)}
\`\`\``;
    }

    prompt += `

Please evaluate the agent's output based on the above information.`;

    return prompt;
  }

  /**
   * Save feedback to database
   */
  async saveFeedback(
    executionId: string,
    agentId: string,
    evaluation: EvaluationResult,
    feedbackType: 'user' | 'llm_judge' | 'automated'
  ): Promise<string | null> {
    try {
      const supabase = getServiceClient();

      const { data, error } = await supabase
        .from('agent_feedback')
        .insert({
          execution_id: executionId,
          agent_id: agentId,
          feedback_type: feedbackType,
          overall_score: evaluation.overall_score,
          relevance_score: evaluation.relevance_score,
          quality_score: evaluation.quality_score,
          creativity_score: evaluation.creativity_score,
          feedback_text: evaluation.feedback_text,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          suggestions: evaluation.suggestions,
          judge_model: feedbackType === 'llm_judge' ? 'gemini-2.5-flash' : null,
          raw_evaluation: evaluation,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[EvaluationService] Failed to save feedback:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('[EvaluationService] Error saving feedback:', error);
      return null;
    }
  }

  /**
   * Save user feedback
   */
  async saveUserFeedback(
    executionId: string,
    agentId: string,
    feedback: {
      overall_score: number;
      feedback_text?: string;
    }
  ): Promise<string | null> {
    try {
      const supabase = getServiceClient();

      const { data, error } = await supabase
        .from('agent_feedback')
        .insert({
          execution_id: executionId,
          agent_id: agentId,
          feedback_type: 'user',
          overall_score: feedback.overall_score,
          feedback_text: feedback.feedback_text,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[EvaluationService] Failed to save user feedback:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('[EvaluationService] Error saving user feedback:', error);
      return null;
    }
  }

  /**
   * Run regression tests for an agent
   */
  async runRegressionTests(
    agentId: string,
    promptVersion: number,
    executeAgent: (input: Record<string, unknown>) => Promise<Record<string, unknown>>
  ): Promise<{
    passed: number;
    failed: number;
    results: TestRunResult[];
  }> {
    const testCases = await this.getTestCases(agentId);
    const results: TestRunResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
      try {
        // Execute agent with test input
        const output = await executeAgent(testCase.input);

        // Evaluate the output
        const evaluation = await this.evaluateOutput(
          agentId,
          testCase.input,
          output,
          testCase.expected_criteria
        );

        if (!evaluation) {
          results.push({
            test_case_id: testCase.id,
            passed: false,
            actual_output: output,
            overall_score: 0,
            relevance_score: 0,
            quality_score: 0,
            evaluation_notes: 'Evaluation failed',
            failures: ['Failed to evaluate output'],
          });
          failed++;
          continue;
        }

        // Check if test passed
        const failures: string[] = [];
        if (evaluation.overall_score < testCase.min_overall_score) {
          failures.push(`Overall score ${evaluation.overall_score} < min ${testCase.min_overall_score}`);
        }
        if (evaluation.relevance_score < testCase.min_relevance_score) {
          failures.push(`Relevance score ${evaluation.relevance_score} < min ${testCase.min_relevance_score}`);
        }
        if (evaluation.quality_score < testCase.min_quality_score) {
          failures.push(`Quality score ${evaluation.quality_score} < min ${testCase.min_quality_score}`);
        }

        const testPassed = failures.length === 0;
        if (testPassed) passed++;
        else failed++;

        const result: TestRunResult = {
          test_case_id: testCase.id,
          passed: testPassed,
          actual_output: output,
          overall_score: evaluation.overall_score,
          relevance_score: evaluation.relevance_score,
          quality_score: evaluation.quality_score,
          evaluation_notes: evaluation.feedback_text,
          failures: failures.length > 0 ? failures : undefined,
        };

        results.push(result);

        // Save test run result
        await this.saveTestRun(result, agentId, promptVersion);

      } catch (error) {
        results.push({
          test_case_id: testCase.id,
          passed: false,
          actual_output: {},
          overall_score: 0,
          relevance_score: 0,
          quality_score: 0,
          evaluation_notes: `Execution error: ${error instanceof Error ? error.message : 'Unknown'}`,
          failures: ['Agent execution failed'],
        });
        failed++;
      }
    }

    return { passed, failed, results };
  }

  /**
   * Get test cases for an agent
   */
  async getTestCases(agentId: string): Promise<TestCase[]> {
    try {
      const supabase = getServiceClient();

      const { data, error } = await supabase
        .from('agent_test_cases')
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        console.error('[EvaluationService] Failed to get test cases:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[EvaluationService] Error getting test cases:', error);
      return [];
    }
  }

  /**
   * Save test run result
   */
  private async saveTestRun(
    result: TestRunResult,
    agentId: string,
    promptVersion: number
  ): Promise<void> {
    try {
      const supabase = getServiceClient();

      await supabase.from('agent_test_runs').insert({
        test_case_id: result.test_case_id,
        agent_id: agentId,
        prompt_version: promptVersion,
        passed: result.passed,
        actual_output: result.actual_output,
        overall_score: result.overall_score,
        relevance_score: result.relevance_score,
        quality_score: result.quality_score,
        evaluation_notes: result.evaluation_notes,
        failures: result.failures,
      });
    } catch (error) {
      console.error('[EvaluationService] Error saving test run:', error);
    }
  }

  /**
   * Get agent metrics for a date range
   */
  async getAgentMetrics(
    agentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total_executions: number;
    success_rate: number;
    avg_latency_ms: number;
    avg_overall_score: number;
    feedback_count: number;
  }> {
    try {
      const supabase = getServiceClient();

      // Get execution stats
      const { data: executions, error: execError } = await supabase
        .from('agent_executions')
        .select('status, latency_ms')
        .eq('agent_id', agentId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (execError) throw execError;

      // Get feedback stats
      const { data: feedback, error: fbError } = await supabase
        .from('agent_feedback')
        .select('overall_score')
        .eq('agent_id', agentId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (fbError) throw fbError;

      const total = executions?.length || 0;
      const successful = executions?.filter(e => e.status === 'success').length || 0;
      const latencies = executions?.map(e => e.latency_ms).filter(Boolean) || [];
      const scores = feedback?.map(f => f.overall_score).filter(Boolean) || [];

      return {
        total_executions: total,
        success_rate: total > 0 ? (successful / total) * 100 : 0,
        avg_latency_ms: latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
        avg_overall_score: scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0,
        feedback_count: feedback?.length || 0,
      };
    } catch (error) {
      console.error('[EvaluationService] Error getting metrics:', error);
      return {
        total_executions: 0,
        success_rate: 0,
        avg_latency_ms: 0,
        avg_overall_score: 0,
        feedback_count: 0,
      };
    }
  }

  /**
   * Create a test case
   */
  async createTestCase(testCase: Omit<TestCase, 'id'>): Promise<string | null> {
    try {
      const supabase = getServiceClient();

      const { data, error } = await supabase
        .from('agent_test_cases')
        .insert({
          agent_id: testCase.agent_id,
          name: testCase.name,
          description: testCase.description,
          input: testCase.input,
          expected_criteria: testCase.expected_criteria,
          min_overall_score: testCase.min_overall_score,
          min_relevance_score: testCase.min_relevance_score,
          min_quality_score: testCase.min_quality_score,
          priority: testCase.priority,
          tags: testCase.tags,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[EvaluationService] Failed to create test case:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('[EvaluationService] Error creating test case:', error);
      return null;
    }
  }
}

// Singleton instance
let evaluationService: AgentEvaluationService | null = null;

export function getEvaluationService(): AgentEvaluationService {
  if (!evaluationService) {
    evaluationService = new AgentEvaluationService();
  }
  return evaluationService;
}
