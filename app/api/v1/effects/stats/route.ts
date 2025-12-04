/**
 * Effects Stats API Route
 * Returns registry statistics
 */

import { NextResponse } from 'next/server';

const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || 'http://localhost:8000';

/**
 * GET /api/v1/effects/stats - Get registry statistics
 */
export async function GET() {
  try {
    const url = `${COMPOSE_ENGINE_URL}/api/v1/effects/stats`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Effects stats error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Compose engine error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Effects stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch effects stats' },
      { status: 500 }
    );
  }
}
