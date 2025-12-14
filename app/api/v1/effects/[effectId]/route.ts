/**
 * Single Effect API Route
 * Get effect by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getComposeEngineUrl } from '@/lib/compose/client';

interface RouteContext {
  params: Promise<{
    effectId: string;
  }>;
}

/**
 * GET /api/v1/effects/[effectId] - Get a specific effect by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { effectId } = await context.params;

    const url = `${getComposeEngineUrl()}/api/v1/effects/${effectId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: `Effect not found: ${effectId}` },
          { status: 404 }
        );
      }
      const errorText = await response.text();
      console.error(`Effect get error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Compose engine error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Effect get error:', error);
    return NextResponse.json(
      { error: 'Failed to get effect' },
      { status: 500 }
    );
  }
}
