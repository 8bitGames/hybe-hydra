/**
 * Effects API Routes
 * Proxy to compose-engine for effect listing and AI selection
 */

import { NextRequest, NextResponse } from 'next/server';

// Compose engine URL (Modal or local)
const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || 'http://localhost:8000';

/**
 * GET /api/v1/effects - List effects with filtering
 * Query params: type, source, mood, genre, intensity, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();

    const url = `${COMPOSE_ENGINE_URL}/api/v1/effects${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Effects API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Compose engine error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Effects API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch effects' },
      { status: 500 }
    );
  }
}
