/**
 * Agent Evolution API
 * ====================
 * API endpoints for managing automated agent evolution
 *
 * GET /api/v1/admin/evolution - List evolution cycles
 * GET /api/v1/admin/evolution?candidates=pending - List pending candidates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEvolutionService } from '@/lib/agents/evolution';

export async function GET(request: NextRequest) {
  try {
    const evolutionService = createEvolutionService();
    const { searchParams } = new URL(request.url);

    const candidates = searchParams.get('candidates');
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Return pending candidates if requested
    if (candidates === 'pending') {
      const pendingCandidates = await evolutionService.getPendingCandidates();
      return NextResponse.json({ candidates: pendingCandidates });
    }

    // Return cycles
    const cycles = await evolutionService.listCycles(agentId || undefined, limit);
    return NextResponse.json({ cycles });
  } catch (error) {
    console.error('[Evolution API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
