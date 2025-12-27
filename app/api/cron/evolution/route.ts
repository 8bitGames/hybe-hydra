/**
 * Evolution Cron Job
 * ==================
 * Weekly automated evolution cycle for all eligible agents
 *
 * GET /api/cron/evolution
 *
 * Schedule: Every Sunday at 2 AM UTC (configured in vercel.json)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEvolutionService } from '@/lib/agents/evolution';

/**
 * Verify cron job authentication
 * Supports Vercel cron header and Bearer token fallback
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Check Vercel cron header (automatically added by Vercel)
  const isVercelCron = request.headers.get('x-vercel-cron') === 'true';
  if (isVercelCron) {
    return true;
  }

  // Fallback: Bearer token authentication
  if (cronSecret && authHeader) {
    const token = authHeader.replace('Bearer ', '');
    return token === cronSecret;
  }

  return false;
}

export async function GET(request: NextRequest) {
  // Verify authentication
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();

  try {
    console.log('[Evolution Cron] Starting weekly evolution cycle...');

    const evolutionService = createEvolutionService();
    const summary = await evolutionService.runAllEligibleAgents();

    const duration = Date.now() - startTime;

    console.log('[Evolution Cron] Completed:', {
      totalAgents: summary.totalAgentsProcessed,
      successful: summary.successfulEvolutions,
      failed: summary.failedEvolutions,
      candidatesGenerated: summary.candidatesGenerated,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      success: true,
      summary: {
        ...summary,
        executionTime: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('[Evolution Cron] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Evolution cycle failed',
        executionTime: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Vercel cron configuration
export const maxDuration = 300; // 5 minutes max for evolution cycles
export const dynamic = 'force-dynamic';
