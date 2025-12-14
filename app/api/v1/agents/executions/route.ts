/**
 * Agent Executions API
 * ====================
 * Endpoints for retrieving agent execution history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * GET /api/v1/agents/executions?agent_id=xxx&limit=20
 * Get execution history for an agent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!agentId) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    let query = supabase
      .from('agent_executions')
      .select('*, agent_feedback(overall_score, feedback_type)', { count: 'exact' })
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[API] Get executions error:', error);
      return NextResponse.json(
        { error: 'Failed to get executions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      executions: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[API] Get executions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
