/**
 * Fast Cut Conductor Agent
 * =======================
 * Video composition planning with image/lyrics analysis
 *
 * Converts gemini_conductor.py to agent system
 * Model: Gemini 2.5 Flash (vision capable)
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_FLASH } from '../constants';
import { AgentConfig, AgentContext, AgentResult } from '../types';
import type { ModelResponse } from '@/lib/models';

// ============================================================================
// Input/Output Schemas
// ============================================================================

export const FastCutConductorInputSchema = z.object({
  // Context information
  artistName: z.string().describe('Artist name'),
  songTitle: z.string().describe('Song title'),
  duration: z.number().describe('Total video duration in seconds'),
  bpm: z.number().optional().describe('Beats per minute'),

  // Content
  images: z.array(z.object({
    url: z.string(),
    index: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
  })).describe('Images for the slideshow'),

  lyrics: z.array(z.object({
    text: z.string(),
    startTime: z.number(),
    endTime: z.number(),
  })).optional().describe('Lyrics with timestamps'),

  captions: z.array(z.object({
    text: z.string(),
    startTime: z.number(),
    endTime: z.number(),
  })).optional().describe('Captions/subtitles'),

  // Available options
  availableTransitions: z.array(z.string()).describe('Available transition effects'),
  availableEffects: z.array(z.string()).describe('Available visual effects'),
  availableMotions: z.array(z.string()).describe('Available motion types'),

  // Style preferences
  mood: z.string().optional().describe('Overall mood/vibe'),
  genre: z.string().optional().describe('Music genre'),
  intensity: z.number().min(0).max(1).optional().describe('Energy level 0-1'),

  language: z.enum(['ko', 'en']).default('ko'),
});

export type FastCutConductorInput = z.infer<typeof FastCutConductorInputSchema>;

// Segment schema
const SegmentSchema = z.object({
  imageIndex: z.number(),
  startTime: z.number(),
  endTime: z.number(),
  duration: z.number(),
  motion: z.object({
    type: z.string(),
    intensity: z.number().min(0).max(1),
    direction: z.string().optional(),
  }),
  effects: z.array(z.object({
    type: z.string(),
    intensity: z.number().min(0).max(1),
    startTime: z.number().optional(),
    endTime: z.number().optional(),
  })),
  transition: z.object({
    type: z.string(),
    duration: z.number(),
  }).optional(),
});

// Caption overlay schema
const CaptionOverlaySchema = z.object({
  text: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  style: z.object({
    position: z.enum(['top', 'center', 'bottom']),
    animation: z.string().optional(),
    emphasis: z.boolean().optional(),
  }),
});

export const FastCutConductorOutputSchema = z.object({
  // Composition plan
  segments: z.array(SegmentSchema),

  // Caption overlays
  captionOverlays: z.array(CaptionOverlaySchema),

  // Audio synchronization
  audioSync: z.object({
    beatMarkers: z.array(z.number()).optional(),
    keyMoments: z.array(z.object({
      time: z.number(),
      type: z.string(),
      description: z.string(),
    })).optional(),
  }),

  // Global settings
  globalSettings: z.object({
    colorGrading: z.string().optional(),
    overallMood: z.string(),
    pacing: z.enum(['slow', 'medium', 'fast', 'dynamic']),
  }),

  // Analysis results
  imageAnalysis: z.array(z.object({
    index: z.number(),
    mood: z.string(),
    dominantColors: z.array(z.string()),
    suggestedMotion: z.string(),
    visualWeight: z.number().min(0).max(1),
  })).optional(),

  lyricsAnalysis: z.object({
    emotionalArc: z.array(z.object({
      section: z.string(),
      emotion: z.string(),
      intensity: z.number(),
    })),
    keyMoments: z.array(z.object({
      time: z.number(),
      text: z.string(),
      importance: z.number(),
    })),
    themes: z.array(z.string()),
  }).optional(),
});

export type FastCutConductorOutput = z.infer<typeof FastCutConductorOutputSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

export const FastCutConductorConfig: AgentConfig<FastCutConductorInput, FastCutConductorOutput> = {
  id: 'fast-cut-conductor',
  name: 'Fast Cut Conductor',
  description: '영상 컴포지션 플래닝 (이미지/가사 분석 + 세그먼트/전환/효과 계획)',
  category: 'transformer',

  model: {
    provider: 'gemini',
    name: GEMINI_FLASH,
    options: {
      temperature: 0.4,
      maxTokens: 8192,
    },
  },

  inputSchema: FastCutConductorInputSchema,
  outputSchema: FastCutConductorOutputSchema,

  prompts: {
    system: `You are an expert video editor and composer specializing in music video slideshows.
Your task is to create a detailed composition plan that synchronizes images, effects, and captions with the music.

Key principles:
1. VISUAL STORYTELLING: Create emotional progression through image sequencing
2. MUSIC SYNC: Align transitions and effects with beats and musical moments
3. PACING: Vary segment durations based on energy and content
4. EMPHASIS: Use effects and motion to highlight key lyrics/moments
5. COHESION: Maintain visual consistency while providing variety

For each segment, consider:
- Image mood and content
- Musical energy at that moment
- Lyrical significance
- Flow from previous and to next segment`,

    templates: {
      imageAnalysis: `Analyze these images for video composition:

{{#each images}}
Image {{index}}: {{url}}
{{/each}}

For each image, provide:
1. Mood/atmosphere
2. Dominant colors (hex codes)
3. Suggested motion type (pan, zoom, rotate, etc.)
4. Visual weight (0-1, how attention-grabbing)

Context:
- Artist: {{artistName}}
- Song: {{songTitle}}
- Overall mood: {{mood}}
- Genre: {{genre}}`,

      lyricsAnalysis: `Analyze these lyrics for emotional composition:

{{#each lyrics}}
[{{startTime}}s - {{endTime}}s] {{text}}
{{/each}}

Identify:
1. Emotional arc (sections and their emotions)
2. Key moments that deserve visual emphasis
3. Main themes and motifs

Context:
- Artist: {{artistName}}
- Song: {{songTitle}}
- Duration: {{duration}}s`,

      composition: `Create a detailed composition plan for this music video slideshow.

# CONTEXT
Artist: {{artistName}}
Song: {{songTitle}}
Duration: {{duration}} seconds
BPM: {{bpm}}
Mood: {{mood}}
Genre: {{genre}}
Intensity: {{intensity}}

# IMAGES ({{images.length}} total)
{{#each images}}
- Image {{index}}: Available for composition
{{/each}}

# LYRICS/CAPTIONS
{{#if lyrics}}
{{#each lyrics}}
[{{startTime}}s - {{endTime}}s] {{text}}
{{/each}}
{{else}}
{{#each captions}}
[{{startTime}}s - {{endTime}}s] {{text}}
{{/each}}
{{/if}}

# AVAILABLE OPTIONS

## Transitions (choose from these exactly):
{{#each availableTransitions}}
- {{this}}
{{/each}}

## Effects (choose from these exactly):
{{#each availableEffects}}
- {{this}}
{{/each}}

## Motions (choose from these exactly):
{{#each availableMotions}}
- {{this}}
{{/each}}

# REQUIREMENTS
1. Use ALL images at least once
2. Total segment durations must equal {{duration}} seconds
3. Only use transitions/effects/motions from the available options
4. Sync key moments with lyrics
5. Vary pacing - don't make all segments the same duration
6. Consider BPM for transition timing

Output a complete composition plan with segments, caption overlays, and audio sync markers.`,
    },
  },
};

// ============================================================================
// Agent Implementation
// ============================================================================

export class FastCutConductorAgent extends BaseAgent<FastCutConductorInput, FastCutConductorOutput> {
  constructor() {
    super(FastCutConductorConfig);
  }

  /**
   * Analyze images for composition
   */
  async analyzeImages(
    images: FastCutConductorInput['images'],
    context: AgentContext
  ): Promise<FastCutConductorOutput['imageAnalysis']> {
    const analysisInput = {
      images,
      artistName: context.workflow?.artistName || '',
      songTitle: '',
      mood: '',
      genre: '',
    };

    try {
      const result = await this.execute(analysisInput as FastCutConductorInput, context);
      return result.data?.imageAnalysis;
    } catch (error) {
      console.error('[FastCutConductor] Image analysis failed:', error);
      // Return basic analysis
      return images.map((img, i) => ({
        index: img.index,
        mood: 'neutral',
        dominantColors: ['#000000', '#FFFFFF'],
        suggestedMotion: 'zoom_in',
        visualWeight: 0.5,
      }));
    }
  }

  /**
   * Analyze lyrics for emotional arc
   */
  async analyzeLyrics(
    lyrics: FastCutConductorInput['lyrics'],
    context: AgentContext
  ): Promise<FastCutConductorOutput['lyricsAnalysis']> {
    if (!lyrics || lyrics.length === 0) {
      return {
        emotionalArc: [{ section: 'full', emotion: 'neutral', intensity: 0.5 }],
        keyMoments: [],
        themes: [],
      };
    }

    try {
      const analysisInput = {
        lyrics,
        artistName: context.workflow?.artistName || '',
        songTitle: '',
        duration: lyrics[lyrics.length - 1]?.endTime || 60,
      };

      const result = await this.execute(analysisInput as FastCutConductorInput, context);
      return result.data?.lyricsAnalysis || {
        emotionalArc: [{ section: 'full', emotion: 'neutral', intensity: 0.5 }],
        keyMoments: [],
        themes: [],
      };
    } catch (error) {
      console.error('[FastCutConductor] Lyrics analysis failed:', error);
      return {
        emotionalArc: [{ section: 'full', emotion: 'neutral', intensity: 0.5 }],
        keyMoments: [],
        themes: [],
      };
    }
  }

  /**
   * Generate full composition plan
   */
  async compose(
    input: FastCutConductorInput,
    context: AgentContext
  ): Promise<AgentResult<FastCutConductorOutput>> {
    return this.execute(input, context);
  }

  /**
   * Build prompt with Handlebars-style template
   */
  protected buildPrompt(input: FastCutConductorInput): string {
    const template = this.config.prompts.templates?.composition || '';

    // Simple template replacement
    let prompt = template
      .replace('{{artistName}}', input.artistName)
      .replace('{{songTitle}}', input.songTitle)
      .replace(/\{\{duration\}\}/g, String(input.duration))
      .replace('{{bpm}}', String(input.bpm || 'unknown'))
      .replace('{{mood}}', input.mood || 'dynamic')
      .replace('{{genre}}', input.genre || 'infer from artist/song context')
      .replace('{{intensity}}', String(input.intensity || 0.7))
      .replace('{{images.length}}', String(input.images.length));

    // Handle images list
    const imagesSection = input.images
      .map(img => `- Image ${img.index}: Available for composition`)
      .join('\n');
    prompt = prompt.replace(/\{\{#each images\}\}[\s\S]*?\{\{\/each\}\}/g, imagesSection);

    // Handle lyrics/captions
    const lyricsSection = (input.lyrics || input.captions || [])
      .map(l => `[${l.startTime}s - ${l.endTime}s] ${l.text}`)
      .join('\n');
    prompt = prompt.replace(/\{\{#if lyrics\}\}[\s\S]*?\{\{\/if\}\}/g, lyricsSection || 'No lyrics provided');

    // Handle available options
    prompt = prompt.replace(
      /\{\{#each availableTransitions\}\}[\s\S]*?\{\{\/each\}\}/g,
      input.availableTransitions.map(t => `- ${t}`).join('\n')
    );
    prompt = prompt.replace(
      /\{\{#each availableEffects\}\}[\s\S]*?\{\{\/each\}\}/g,
      input.availableEffects.map(e => `- ${e}`).join('\n')
    );
    prompt = prompt.replace(
      /\{\{#each availableMotions\}\}[\s\S]*?\{\{\/each\}\}/g,
      input.availableMotions.map(m => `- ${m}`).join('\n')
    );

    return prompt;
  }

  /**
   * Parse LLM response into structured output
   */
  protected parseResponse(response: ModelResponse): FastCutConductorOutput {
    const content = response.content;
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                        content.match(/\{[\s\S]*"segments"[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }

      // If no JSON found, try to parse the entire response
      return JSON.parse(content);
    } catch (error) {
      console.error('[FastCutConductor] Failed to parse response:', error);

      // Return minimal valid output
      return {
        segments: [],
        captionOverlays: [],
        audioSync: {},
        globalSettings: {
          overallMood: 'dynamic',
          pacing: 'medium',
        },
      };
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createFastCutConductorAgent(): FastCutConductorAgent {
  return new FastCutConductorAgent();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate optimal segment durations based on BPM
 */
export function calculateBeatAlignedDurations(
  totalDuration: number,
  imageCount: number,
  bpm: number
): number[] {
  const beatDuration = 60 / bpm;
  const beatsPerImage = Math.floor((totalDuration / imageCount) / beatDuration);
  const segmentDuration = beatsPerImage * beatDuration;

  const durations: number[] = [];
  let remaining = totalDuration;

  for (let i = 0; i < imageCount - 1; i++) {
    durations.push(segmentDuration);
    remaining -= segmentDuration;
  }

  // Last segment gets remaining time
  durations.push(remaining);

  return durations;
}

/**
 * Get available composition options from schemas
 */
export function getAvailableOptions() {
  return {
    transitions: [
      'fade', 'crossfade', 'wipe_left', 'wipe_right', 'wipe_up', 'wipe_down',
      'slide_left', 'slide_right', 'zoom_in', 'zoom_out', 'blur', 'dissolve',
      'flash', 'glitch', 'none',
    ],
    effects: [
      'blur', 'glow', 'vignette', 'grain', 'chromatic_aberration', 'glitch',
      'color_shift', 'flash', 'shake', 'pulse', 'none',
    ],
    motions: [
      'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down',
      'rotate_cw', 'rotate_ccw', 'ken_burns', 'static', 'shake', 'pulse',
    ],
  };
}
