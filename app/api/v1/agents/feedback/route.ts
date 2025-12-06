/**
 * Agent Feedback API
 * ==================
 * Endpoints for submitting and retrieving agent feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEvaluationService } from '@/lib/agents/evaluation-service';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/v1/agents/feedback
 * Submit feedback for an agent execution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { execution_id, agent_id, overall_score, feedback_text } = body;

    if (!execution_id || !agent_id) {
      return NextResponse.json(
        { error: 'execution_id and agent_id are required' },
        { status: 400 }
      );
    }

    if (!overall_score || overall_score < 1 || overall_score > 5) {
      return NextResponse.json(
        { error: 'overall_score must be between 1 and 5' },
        { status: 400 }
      );
    }

    const evaluationService = getEvaluationService();
    const feedbackId = await evaluationService.saveUserFeedback(
      execution_id,
      agent_id,
      {
        overall_score,
        feedback_text,
      }
    );

    if (!feedbackId) {
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedback_id: feedbackId,
    });
  } catch (error) {
    console.error('[API] Feedback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/agents/feedback?agent_id=xxx&limit=10
 * Get feedback for an agent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!agentId) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error, count } = await supabase
      .from('agent_feedback')
      .select('*, agent_executions(input, output)', { count: 'exact' })
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[API] Get feedback error:', error);
      return NextResponse.json(
        { error: 'Failed to get feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      feedback: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[API] Get feedback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
