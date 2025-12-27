/**
 * Approve Candidate API
 * =====================
 * Approve a candidate prompt for promotion to production
 *
 * POST /api/v1/admin/evolution/approve/{candidateId}
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEvolutionService } from '@/lib/agents/evolution';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const body = await request.json().catch(() => ({}));

    const userId = body.userId || 'admin';
    const notes = body.notes;

    const evolutionService = createEvolutionService();
    const success = await evolutionService.approveCandidate(candidateId, userId, notes);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to approve candidate' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Candidate ${candidateId} approved and promoted to production`,
    });
  } catch (error) {
    console.error('[Evolution Approve API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
