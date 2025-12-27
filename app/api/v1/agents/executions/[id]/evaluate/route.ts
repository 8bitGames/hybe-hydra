/**
 * Deep Evaluate Execution API
 * ===========================
 * Trigger LLM-as-Judge evaluation for a specific execution
 *
 * POST /api/v1/agents/executions/[id]/evaluate
 * - Runs detailed AI analysis on the execution's input/output
 * - Returns strengths, weaknesses, and suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getEvaluationService } from '@/lib/agents/evaluation-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: executionId } = await params;
    const supabase = getServiceClient();

    // 1. Fetch the execution details
    const { data: execution, error: execError } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (execError || !execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    // 2. Check if execution has output to evaluate
    if (!execution.output || execution.status !== 'success') {
      return NextResponse.json(
        { error: 'Cannot evaluate: execution has no output or failed' },
        { status: 400 }
      );
    }

    // 3. Run LLM-as-Judge evaluation
    const evaluationService = getEvaluationService();
    const evaluation = await evaluationService.evaluateOutput(
      execution.agent_id,
      execution.input || {},
      execution.output,
      undefined, // no specific criteria
      executionId
    );

    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation failed' },
        { status: 500 }
      );
    }

    // 4. Return the detailed evaluation
    return NextResponse.json({
      success: true,
      executionId,
      evaluation: {
        overall_score: evaluation.overall_score,
        relevance_score: evaluation.relevance_score,
        quality_score: evaluation.quality_score,
        creativity_score: evaluation.creativity_score,
        feedback_text: evaluation.feedback_text,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        suggestions: evaluation.suggestions,
      },
    });
  } catch (error) {
    console.error('[Deep Evaluate API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Fetch existing evaluation for an execution
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: executionId } = await params;
    const supabase = getServiceClient();

    // Fetch the latest LLM judge evaluation for this execution
    const { data: feedback, error } = await supabase
      .from('agent_feedback')
      .select('*')
      .eq('execution_id', executionId)
      .eq('feedback_type', 'llm_judge')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !feedback) {
      return NextResponse.json({
        hasEvaluation: false,
        evaluation: null,
      });
    }

    return NextResponse.json({
      hasEvaluation: true,
      evaluation: {
        overall_score: feedback.overall_score,
        relevance_score: feedback.relevance_score,
        quality_score: feedback.quality_score,
        creativity_score: feedback.creativity_score,
        feedback_text: feedback.feedback_text,
        strengths: feedback.strengths || [],
        weaknesses: feedback.weaknesses || [],
        suggestions: feedback.suggestions || [],
        evaluated_at: feedback.created_at,
      },
    });
  } catch (error) {
    console.error('[Get Evaluation API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
