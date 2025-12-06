/**
 * Agent Test Cases API
 * ====================
 * Endpoints for managing golden test cases
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEvaluationService } from '@/lib/agents/evaluation-service';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/v1/agents/test-cases
 * Create a new test case
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agent_id,
      name,
      description,
      input,
      expected_criteria,
      min_overall_score = 3,
      min_relevance_score = 3,
      min_quality_score = 3,
      priority = 'medium',
      tags,
    } = body;

    if (!agent_id || !name || !input || !expected_criteria) {
      return NextResponse.json(
        { error: 'agent_id, name, input, and expected_criteria are required' },
        { status: 400 }
      );
    }

    const evaluationService = getEvaluationService();
    const testCaseId = await evaluationService.createTestCase({
      agent_id,
      name,
      description,
      input,
      expected_criteria,
      min_overall_score,
      min_relevance_score,
      min_quality_score,
      priority,
      tags,
    });

    if (!testCaseId) {
      return NextResponse.json(
        { error: 'Failed to create test case' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      test_case_id: testCaseId,
    });
  } catch (error) {
    console.error('[API] Create test case error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/agents/test-cases?agent_id=xxx
 * Get test cases for an agent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    if (!agentId) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from('agent_test_cases')
      .select('*')
      .eq('agent_id', agentId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API] Get test cases error:', error);
      return NextResponse.json(
        { error: 'Failed to get test cases' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      test_cases: data || [],
    });
  } catch (error) {
    console.error('[API] Get test cases error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/agents/test-cases?id=xxx
 * Deactivate a test case
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testCaseId = searchParams.get('id');

    if (!testCaseId) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('agent_test_cases')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', testCaseId);

    if (error) {
      console.error('[API] Delete test case error:', error);
      return NextResponse.json(
        { error: 'Failed to delete test case' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Delete test case error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
