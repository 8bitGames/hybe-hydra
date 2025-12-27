/**
 * Trigger Evolution API
 * =====================
 * Manually trigger evolution cycle for a specific agent
 *
 * POST /api/v1/admin/evolution/trigger/{agentId}
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEvolutionService } from '@/lib/agents/evolution';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const body = await request.json().catch(() => ({}));
    const forceRun = body.forceRun === true;

    const evolutionService = createEvolutionService();
    const result = await evolutionService.runEvolutionCycle(agentId, forceRun);

    if (result.status === 'failed') {
      return NextResponse.json(
        { error: result.error, result },
        { status: 400 }
      );
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error('[Evolution Trigger API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
