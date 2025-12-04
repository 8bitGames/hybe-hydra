/**
 * AI Effect Selection API Route
 * Main endpoint for AI-powered effect selection
 */

import { NextRequest, NextResponse } from 'next/server';

const COMPOSE_ENGINE_URL = process.env.COMPOSE_ENGINE_URL || 'http://localhost:8000';

export interface EffectSelectRequest {
  prompt: string;
  audio_bpm?: number;
  image_count?: number;
  duration?: number;
  preferences?: {
    intensity?: 'low' | 'medium' | 'high';
    sources?: ('gl-transitions' | 'ffmpeg-xfade')[];
    gpu_available?: boolean;
    num_transitions?: number;
    diversity?: number;
  };
}

/**
 * POST /api/v1/effects/select
 * AI-powered effect selection based on prompt analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body: EffectSelectRequest = await request.json();

    // Validate required fields
    if (!body.prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const url = `${COMPOSE_ENGINE_URL}/api/v1/effects/select`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Effect selection error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Compose engine error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Effect selection error:', error);
    return NextResponse.json(
      { error: 'Failed to select effects' },
      { status: 500 }
    );
  }
}
