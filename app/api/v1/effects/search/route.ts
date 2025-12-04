/**
 * Effects Search API Route
 * Search effects by keyword
 */

import { NextRequest, NextResponse } from 'next/server';

const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || 'http://localhost:8000';

/**
 * GET /api/v1/effects/search?q=keyword&type=transition&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q');

    if (!q) {
      return NextResponse.json(
        { error: 'Search query (q) is required' },
        { status: 400 }
      );
    }

    const queryString = searchParams.toString();
    const url = `${COMPOSE_ENGINE_URL}/api/v1/effects/search?${queryString}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Effects search error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Compose engine error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Effects search error:', error);
    return NextResponse.json(
      { error: 'Failed to search effects' },
      { status: 500 }
    );
  }
}
