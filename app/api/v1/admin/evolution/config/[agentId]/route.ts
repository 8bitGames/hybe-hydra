/**
 * Evolution Config API
 * ====================
 * Get and update evolution configuration for an agent
 *
 * GET /api/v1/admin/evolution/config/{agentId}
 * PUT /api/v1/admin/evolution/config/{agentId}
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

    return NextResponse.json({ config: status.config });
  } catch (error) {
    console.error('[Evolution Config API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const body = await request.json();

    // Validate updates
    const allowedUpdates = [
      'enabled',
      'minFeedbackCount',
      'minImprovementThreshold',
      'autoPromoteThreshold',
      'requireHumanApproval',
      'maxCandidatesPerCycle',
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    const evolutionService = createEvolutionService();
    const updatedConfig = await evolutionService.updateConfig(agentId, updates);

    if (!updatedConfig) {
      return NextResponse.json(
        { error: 'Failed to update config' },
        { status: 400 }
      );
    }

    return NextResponse.json({ config: updatedConfig });
  } catch (error) {
    console.error('[Evolution Config API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
