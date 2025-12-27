/**
 * Evolution Status API
 * ====================
 * Get evolution status for a specific agent
 *
 * GET /api/v1/admin/evolution/status/{agentId}
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEvolutionService } from '@/lib/agents/evolution';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    const evolutionService = createEvolutionService();
    const status = await evolutionService.getEvolutionStatus(agentId);

    return NextResponse.json({ status });
  } catch (error) {
    console.error('[Evolution Status API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
