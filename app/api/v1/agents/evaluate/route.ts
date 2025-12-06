/**
 * Agent Evaluation API
 * ====================
 * Endpoints for running LLM-as-Judge evaluations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEvaluationService } from '@/lib/agents/evaluation-service';

/**
 * POST /api/v1/agents/evaluate
 * Run LLM-as-Judge evaluation on an agent output
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agent_id,
      execution_id,
      input,
      output,
      expected_criteria,
    } = body;

    if (!agent_id || !input || !output) {
      return NextResponse.json(
        { error: 'agent_id, input, and output are required' },
        { status: 400 }
      );
    }

    const evaluationService = getEvaluationService();
    const evaluation = await evaluationService.evaluateOutput(
      agent_id,
      input,
      output,
      expected_criteria,
      execution_id
    );

    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (error) {
    console.error('[API] Evaluate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
