/**
 * Agent Metrics API
 * =================
 * Endpoints for retrieving agent performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEvaluationService } from '@/lib/agents/evaluation-service';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/agents/metrics?agent_id=xxx&days=7
 * Get performance metrics for an agent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const days = parseInt(searchParams.get('days') || '7');

    if (!agentId) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      );
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const evaluationService = getEvaluationService();
    const metrics = await evaluationService.getAgentMetrics(agentId, startDate, endDate);

    // Get daily breakdown
    const supabase = await createClient();
    const { data: dailyData } = await supabase
      .from('agent_executions')
      .select('created_at, status, latency_ms')
      .eq('agent_id', agentId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    // Aggregate by day
    const dailyMetrics: Record<string, {
      date: string;
      executions: number;
      successes: number;
      failures: number;
      avg_latency: number;
    }> = {};

    if (dailyData) {
      for (const row of dailyData) {
        const date = new Date(row.created_at).toISOString().split('T')[0];
        if (!dailyMetrics[date]) {
          dailyMetrics[date] = {
            date,
            executions: 0,
            successes: 0,
            failures: 0,
            avg_latency: 0,
          };
        }
        dailyMetrics[date].executions++;
        if (row.status === 'success') dailyMetrics[date].successes++;
        else if (row.status === 'error') dailyMetrics[date].failures++;
        if (row.latency_ms) {
          dailyMetrics[date].avg_latency =
            (dailyMetrics[date].avg_latency * (dailyMetrics[date].executions - 1) + row.latency_ms)
            / dailyMetrics[date].executions;
        }
      }
    }

    // Get feedback score distribution
    const { data: feedbackData } = await supabase
      .from('agent_feedback')
      .select('overall_score, feedback_type')
      .eq('agent_id', agentId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const scoreDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const feedbackByType = { user: 0, llm_judge: 0, automated: 0 };

    if (feedbackData) {
      for (const fb of feedbackData) {
        if (fb.overall_score) {
          scoreDistribution[fb.overall_score as keyof typeof scoreDistribution]++;
        }
        if (fb.feedback_type) {
          feedbackByType[fb.feedback_type as keyof typeof feedbackByType]++;
        }
      }
    }

    return NextResponse.json({
      agent_id: agentId,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days,
      },
      summary: metrics,
      daily: Object.values(dailyMetrics).sort((a, b) => a.date.localeCompare(b.date)),
      feedback: {
        score_distribution: scoreDistribution,
        by_type: feedbackByType,
      },
    });
  } catch (error) {
    console.error('[API] Metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
