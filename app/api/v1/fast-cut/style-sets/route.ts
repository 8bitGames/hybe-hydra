/**
 * Fast Cut Style Sets API
 * =======================
 * GET: List all available style sets
 * POST: AI-powered style set selection based on prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import {
  ALL_STYLE_SETS,
  selectStyleSet,
  selectStyleSetByKeywords,
  getStyleSetWithSelection,
} from '@/lib/fast-cut/style-sets';

/**
 * GET /api/v1/fast-cut/style-sets
 * Returns all available style sets
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    // Return all style sets with UI-friendly format
    const styleSets = ALL_STYLE_SETS.map(set => ({
      id: set.id,
      name: set.name,
      nameKo: set.nameKo,
      description: set.description,
      descriptionKo: set.descriptionKo,
      icon: set.icon,
      previewColor: set.previewColor,
      // Settings summary
      vibe: set.video.vibe,
      colorGrade: set.video.colorGrade,
      textStyle: set.text.style,
      intensity: set.audio.intensity,
      bpmRange: set.audio.bpmRange,
    }));

    return NextResponse.json({
      styleSets,
      total: styleSets.length,
    });
  } catch (error) {
    console.error('[Style Sets API] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/fast-cut/style-sets
 * AI-powered style set selection based on prompt
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, useAI = true } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { detail: 'prompt is required' },
        { status: 400 }
      );
    }

    // Select style set
    let selectionResult;

    if (useAI) {
      // AI-powered selection with fallback to keywords
      const context = {
        workflow: {
          campaignId: body.campaignId || undefined,
          artistName: 'Unknown',
          language: 'ko' as const,
          platform: 'tiktok' as const,
          sessionId: `style-select-${Date.now()}`,
          startedAt: new Date(),
        },
      };

      selectionResult = await selectStyleSet(prompt, context, { useAI: true });
    } else {
      // Fast keyword-based selection only
      selectionResult = selectStyleSetByKeywords(prompt);
    }

    // Get full style set details
    const { selected, alternatives, selection } = getStyleSetWithSelection(selectionResult);

    return NextResponse.json({
      selection: {
        styleSetId: selection.styleSetId,
        confidence: selection.confidence,
        reasoning: selection.reasoning,
      },
      selected: {
        id: selected.id,
        name: selected.name,
        nameKo: selected.nameKo,
        description: selected.description,
        descriptionKo: selected.descriptionKo,
        icon: selected.icon,
        previewColor: selected.previewColor,
        vibe: selected.video.vibe,
        colorGrade: selected.video.colorGrade,
        textStyle: selected.text.style,
        intensity: selected.audio.intensity,
      },
      alternatives: alternatives.map(alt => ({
        id: alt.id,
        name: alt.name,
        nameKo: alt.nameKo,
        icon: alt.icon,
        previewColor: alt.previewColor,
      })),
    });
  } catch (error) {
    console.error('[Style Sets API] Selection error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
