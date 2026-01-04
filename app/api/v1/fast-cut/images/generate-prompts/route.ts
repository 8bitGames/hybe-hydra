/**
 * Fast Cut AI Image Prompts Generation API
 * =========================================
 * Generates detailed image prompts for each scene/script line
 *
 * POST /api/v1/fast-cut/images/generate-prompts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createImagePromptGeneratorAgent } from '@/lib/agents/fast-cut/image-prompt-generator';
import type { AgentContext } from '@/lib/agents/types';

// Input types
interface ScriptLine {
  text: string;
  timing: number;
  duration: number;
  purpose?: 'hook' | 'setup' | 'build' | 'climax' | 'cta';
}

// Support both legacy format and new frontend format
interface GeneratePromptsRequest {
  // Legacy format fields
  userPrompt?: string;
  vibe?: 'Exciting' | 'Emotional' | 'Pop' | 'Minimal';
  scriptLines?: ScriptLine[];
  // New frontend format fields
  script?: {
    lines: ScriptLine[];
    totalDuration: number;
  };
  style?: 'photorealistic' | 'illustration' | 'cinematic' | 'artistic' | 'anime';
  // Common fields
  artistName?: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  imageStyle?: 'photorealistic' | 'illustration' | 'cinematic' | 'artistic' | 'anime';
  language?: 'ko' | 'en';
}

export async function POST(request: NextRequest) {
  try {
    
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body: GeneratePromptsRequest = await request.json();

    // Normalize input - support both legacy and new frontend formats
    const scriptLines = body.scriptLines || body.script?.lines || [];
    const imageStyle = body.imageStyle || body.style || 'cinematic';
    const aspectRatio = body.aspectRatio || '9:16';
    const language = body.language || 'ko';
    const artistName = body.artistName;

    // Derive vibe from style if not provided
    const styleToVibe: Record<string, 'Exciting' | 'Emotional' | 'Pop' | 'Minimal'> = {
      cinematic: 'Emotional',
      photorealistic: 'Minimal',
      illustration: 'Pop',
      artistic: 'Emotional',
      anime: 'Exciting',
    };
    const vibe = body.vibe || styleToVibe[imageStyle] || 'Emotional';

    // Derive userPrompt from script lines if not provided
    const userPrompt = body.userPrompt || scriptLines.map(l => l.text).join(' ');

    // Validate required fields
    if (!scriptLines || scriptLines.length === 0) {
      return NextResponse.json(
        { detail: 'Missing required fields: scriptLines or script.lines' },
        { status: 400 }
      );
    }

    // Validate vibe
    const validVibes = ['Exciting', 'Emotional', 'Pop', 'Minimal'];
    if (!validVibes.includes(vibe)) {
      return NextResponse.json(
        { detail: `Invalid vibe. Must be one of: ${validVibes.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[FastCut AI Images] Generating prompts for', scriptLines.length, 'scenes');
    console.log('[FastCut AI Images] Vibe:', vibe, '| Style:', imageStyle, '| Aspect:', aspectRatio);

    // Create agent and context
    const agent = createImagePromptGeneratorAgent();
    const agentContext: AgentContext = {
      workflow: {
        artistName: artistName || 'Content Creator',
        platform: 'tiktok',
        language,
        sessionId: `fastcut-prompts-${Date.now()}`,
      },
    };

    // Generate image prompts
    const result = await agent.execute(
      {
        userPrompt,
        vibe,
        scriptLines,
        artistName,
        aspectRatio,
        imageStyle,
        language,
      },
      agentContext
    );

    if (!result.success || !result.data) {
      console.error('[FastCut AI Images] Prompt generation failed:', result.error);
      return NextResponse.json(
        { detail: result.error || 'Failed to generate image prompts' },
        { status: 500 }
      );
    }

    const output = result.data;
    console.log('[FastCut AI Images] Generated', output.scenes.length, 'scene prompts');
    console.log('[FastCut AI Images] Global style:', output.globalStyle.artStyle);

    return NextResponse.json({
      success: true,
      globalStyle: output.globalStyle,
      scenes: output.scenes,
      styleGuide: output.styleGuide,
      sceneCount: output.scenes.length,
    });
  } catch (error) {
    console.error('[FastCut AI Images] Error:', error);
    return NextResponse.json(
      { detail: 'Failed to generate image prompts' },
      { status: 500 }
    );
  }
}
