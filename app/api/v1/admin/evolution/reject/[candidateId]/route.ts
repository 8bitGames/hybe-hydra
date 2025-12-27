/**
 * Reject Candidate API
 * ====================
 * Reject a candidate prompt
 *
 * POST /api/v1/admin/evolution/reject/{candidateId}
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEvolutionService } from '@/lib/agents/evolution';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const body = await request.json();

    const userId = body.userId || 'admin';
    const reason = body.reason;

    if (!reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    const evolutionService = createEvolutionService();
    const success = await evolutionService.rejectCandidate(candidateId, userId, reason);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to reject candidate' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Candidate ${candidateId} rejected`,
    });
  } catch (error) {
    console.error('[Evolution Reject API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
