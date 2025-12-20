/**
 * Fast Cut Scene Analyzer Agent
 * ==============================
 * Analyzes TikTok videos scene-by-scene for Fast Cut workflow
 * Generates image search keywords for each scene
 *
 * Model: Gemini 2.5 Flash (Vision capable)
 * Category: Fast Cut / Analyzer
 *
 * @agent FastCutSceneAnalyzerAgent
 * @version 1
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { GEMINI_FLASH } from '../constants';
import type { AgentConfig, AgentContext, AgentResult } from '../types';

// ============================================================================
// Input/Output Schemas
// ============================================================================

export const FastCutSceneAnalyzerInputSchema = z.object({
  videoDescription: z.string(),
  hashtags: z.array(z.string()),
  musicTitle: z.string().optional(),
  musicAuthor: z.string().optional(),
  videoDuration: z.number().optional(), // in seconds
  thumbnailUrl: z.string().optional(),
  isPhotoPost: z.boolean().optional(),
  imageCount: z.number().optional(),
  language: z.enum(['ko', 'en']).default('ko'),
});

export type FastCutSceneAnalyzerInput = z.infer<typeof FastCutSceneAnalyzerInputSchema>;

// Scene schema
const SceneSchema = z.object({
  sceneNumber: z.number(),
  description: z.string(),
  visualElements: z.array(z.string()),
  mood: z.string(),
  imageKeywords: z.array(z.string()),
});

export const FastCutSceneAnalyzerOutputSchema = z.object({
  scenes: z.array(SceneSchema),
  overallStyle: z.object({
    colorPalette: z.array(z.string()),
    lighting: z.string(),
    mood: z.string(),
    vibe: z.enum(['Exciting', 'Emotional', 'Pop', 'Minimal']),
  }),
  totalSceneCount: z.number(),
  isSmooth: z.boolean(), // true if video has no distinct scene changes
  recommendedImageCount: z.number(),
  allImageKeywords: z.array(z.string()), // flattened list of all keywords
});

export type FastCutSceneAnalyzerOutput = z.infer<typeof FastCutSceneAnalyzerOutputSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

export const FastCutSceneAnalyzerConfig: AgentConfig<FastCutSceneAnalyzerInput, FastCutSceneAnalyzerOutput> = {
  id: 'fast-cut-scene-analyzer',
  name: 'Fast Cut Scene Analyzer',
  description: 'TikTok 영상을 씬 단위로 분석하여 이미지 검색 키워드 생성',
  category: 'analyzer',

  model: {
    provider: 'gemini',
    name: GEMINI_FLASH,
    options: {
      temperature: 0.4,
      maxTokens: 8192,
    },
  },

  prompts: {
    system: `You are an expert video analyst specializing in TikTok content analysis for Fast Cut video production.

Your job is to analyze TikTok video content and break it down into SCENES, then generate GOOGLE IMAGE SEARCH KEYWORDS for each scene.

## SCENE ANALYSIS GUIDELINES

1. **Scene Detection**: A scene is a distinct visual segment. Common indicators:
   - Different location or setting
   - Different subject or focus
   - Significant mood/atmosphere change
   - Camera angle or framing change

2. **Smooth Videos**: If the video flows continuously without distinct scene changes (e.g., a single continuous shot), treat it as ONE scene but with rich visual elements.

3. **Photo Posts/Slideshows**: If the video is a slideshow of images, each image = one scene.

## 🚨 CRITICAL: KEYWORD GENERATION RULES

For each scene, generate 3-5 SPECIFIC image search keywords that will find relevant images on Google.

### ❌ FORBIDDEN KEYWORDS (These are useless):
- "tiktok video", "viral content", "trending"
- "HD footage", "4K video", "cinematic"
- "aesthetic", "vibes", "mood board"
- Generic terms: "beautiful", "amazing", "cool"

### ✅ GOOD KEYWORDS (These find actual images):
- "vintage pickup truck dusty road sunset"
- "horse galloping open field silhouette"
- "white country church steeple green hills"
- "neon city street rain reflection night"
- "coffee steam morning window light"

### KEYWORD FORMAT:
- 3-5 descriptive words per keyword
- Focus on CONCRETE VISUAL SUBJECTS
- Include location/setting when relevant
- Add ONE atmosphere/lighting word if helpful

## VIBE CLASSIFICATION

Classify the overall vibe as ONE of:
- **Exciting**: High energy, dynamic, party, action, sports, dance
- **Emotional**: Nostalgic, melancholic, romantic, sentimental, slow
- **Pop**: Trendy, colorful, modern, urban, Instagram-style
- **Minimal**: Clean, simple, elegant, zen, aesthetic, quiet

## OUTPUT REQUIREMENTS

1. Analyze the video and identify distinct scenes (1-10 scenes typically)
2. For EACH scene, provide:
   - Scene number
   - Brief description (1-2 sentences)
   - Visual elements (list of what's visible)
   - Mood (atmosphere of that scene)
   - Image keywords (3-5 searchable keywords)
3. Provide overall style analysis
4. Recommend total image count (based on typical TikTok pacing: 1 image per 2-3 seconds)

Always respond in valid JSON format.`,

    templates: {
      analyzeVideo: `Analyze this TikTok video for Fast Cut production:

VIDEO DESCRIPTION:
{{description}}

HASHTAGS: {{hashtags}}

{{#if musicTitle}}
MUSIC: "{{musicTitle}}" by {{musicAuthor}}
{{/if}}

{{#if videoDuration}}
DURATION: {{videoDuration}} seconds
{{/if}}

{{#if isPhotoPost}}
NOTE: This is a photo post/slideshow with {{imageCount}} images.
{{/if}}

Based on the description, hashtags, and music context:
1. Break down the video into SCENES (or treat as single scene if smooth/continuous)
2. For EACH scene, generate 3-5 SPECIFIC Google Image search keywords
3. Classify the overall vibe and style
4. Recommend the number of images needed for a Fast Cut recreation

Return your analysis as JSON with this structure:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "description": "Brief description of what happens in this scene",
      "visualElements": ["element1", "element2"],
      "mood": "The mood/atmosphere",
      "imageKeywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "overallStyle": {
    "colorPalette": ["color1", "color2"],
    "lighting": "Description of lighting",
    "mood": "Overall mood",
    "vibe": "Exciting|Emotional|Pop|Minimal"
  },
  "totalSceneCount": 3,
  "isSmooth": false,
  "recommendedImageCount": 5,
  "allImageKeywords": ["all", "keywords", "flattened"]
}`,
    },
  },

  inputSchema: FastCutSceneAnalyzerInputSchema,
  outputSchema: FastCutSceneAnalyzerOutputSchema,
};

// ============================================================================
// Agent Implementation
// ============================================================================

export class FastCutSceneAnalyzerAgent extends BaseAgent<FastCutSceneAnalyzerInput, FastCutSceneAnalyzerOutput> {
  constructor() {
    super(FastCutSceneAnalyzerConfig);
  }

  protected buildPrompt(input: FastCutSceneAnalyzerInput, _context?: AgentContext): string {
    const template = this.config.prompts.templates?.analyzeVideo || '';

    return template
      .replace('{{description}}', input.videoDescription || 'No description provided')
      .replace('{{hashtags}}', input.hashtags?.join(', ') || 'None')
      .replace('{{#if musicTitle}}', input.musicTitle ? '' : '<!--')
      .replace('{{/if}}', input.musicTitle ? '' : '-->')
      .replace('{{musicTitle}}', input.musicTitle || '')
      .replace('{{musicAuthor}}', input.musicAuthor || 'Unknown')
      .replace('{{#if videoDuration}}', input.videoDuration ? '' : '<!--')
      .replace('{{/if}}', input.videoDuration ? '' : '-->')
      .replace('{{videoDuration}}', String(input.videoDuration || 0))
      .replace('{{#if isPhotoPost}}', input.isPhotoPost ? '' : '<!--')
      .replace('{{/if}}', input.isPhotoPost ? '' : '-->')
      .replace('{{imageCount}}', String(input.imageCount || 0));
  }

  async execute(input: FastCutSceneAnalyzerInput, context: AgentContext): Promise<AgentResult<FastCutSceneAnalyzerOutput>> {
    const startTime = Date.now();

    try {
      // Auto-initialize from database if not already done
      if (!this.isInitialized) {
        await this.initializeFromDatabase();
      }

      // Build the prompt
      const prompt = this.buildPrompt(input);

      // Generate response using base class model client
      const response = await this.modelClient.generate({
        system: this.config.prompts.system,
        user: prompt,
        responseFormat: 'json',
      });

      // Parse the response
      let parsedOutput: FastCutSceneAnalyzerOutput;

      try {
        // Extract JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }

        const rawOutput = JSON.parse(jsonMatch[0]);

        // Validate and normalize the output
        parsedOutput = this.normalizeOutput(rawOutput, input);

        // Validate against schema
        const validated = FastCutSceneAnalyzerOutputSchema.parse(parsedOutput);
        parsedOutput = validated;

      } catch (parseError) {
        console.error('[FastCutSceneAnalyzer] Parse error:', parseError);
        // Generate fallback output
        parsedOutput = this.generateFallbackOutput(input);
      }

      return {
        success: true,
        data: parsedOutput,
        metadata: {
          agentId: this.config.id,
          model: this.config.model.name as import('../types').ModelName,
          tokenUsage: response.usage,
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };

    } catch (error) {
      console.error('[FastCutSceneAnalyzer] Execution error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          agentId: this.config.id,
          model: this.config.model.name as import('../types').ModelName,
          tokenUsage: { input: 0, output: 0, total: 0 },
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Normalize and clean up the AI output
   */
  private normalizeOutput(raw: Record<string, unknown>, input: FastCutSceneAnalyzerInput): FastCutSceneAnalyzerOutput {
    const scenes = Array.isArray(raw.scenes) ? raw.scenes : [];
    const normalizedScenes = scenes.map((scene: Record<string, unknown>, idx: number) => ({
      sceneNumber: Number(scene.sceneNumber) || idx + 1,
      description: String(scene.description || 'Scene description'),
      visualElements: Array.isArray(scene.visualElements) ? scene.visualElements.map(String) : [],
      mood: String(scene.mood || 'neutral'),
      imageKeywords: Array.isArray(scene.imageKeywords) ? scene.imageKeywords.map(String) : [],
    }));

    // Flatten all keywords
    const allKeywords = normalizedScenes.flatMap(s => s.imageKeywords);

    // Normalize vibe
    const rawVibe = String((raw.overallStyle as Record<string, unknown>)?.vibe || 'Pop');
    const normalizedVibe = this.normalizeVibe(rawVibe);

    return {
      scenes: normalizedScenes,
      overallStyle: {
        colorPalette: Array.isArray((raw.overallStyle as Record<string, unknown>)?.colorPalette)
          ? ((raw.overallStyle as Record<string, unknown>).colorPalette as string[]).map(String)
          : ['neutral'],
        lighting: String((raw.overallStyle as Record<string, unknown>)?.lighting || 'natural'),
        mood: String((raw.overallStyle as Record<string, unknown>)?.mood || 'neutral'),
        vibe: normalizedVibe,
      },
      totalSceneCount: normalizedScenes.length,
      isSmooth: Boolean(raw.isSmooth),
      recommendedImageCount: Number(raw.recommendedImageCount) || Math.max(3, normalizedScenes.length),
      allImageKeywords: [...new Set(allKeywords)], // dedupe
    };
  }

  /**
   * Normalize vibe to valid enum value
   */
  private normalizeVibe(vibe: string): 'Exciting' | 'Emotional' | 'Pop' | 'Minimal' {
    const normalized = vibe.charAt(0).toUpperCase() + vibe.slice(1).toLowerCase();
    if (['Exciting', 'Emotional', 'Pop', 'Minimal'].includes(normalized)) {
      return normalized as 'Exciting' | 'Emotional' | 'Pop' | 'Minimal';
    }
    return 'Pop';
  }

  /**
   * Generate fallback output when parsing fails
   */
  private generateFallbackOutput(input: FastCutSceneAnalyzerInput): FastCutSceneAnalyzerOutput {
    // Extract keywords from description and hashtags
    const keywords = [
      ...input.hashtags.slice(0, 5).map(h => h.replace('#', '')),
      ...(input.videoDescription || '').split(/\s+/).slice(0, 5),
    ].filter(k => k.length > 2);

    return {
      scenes: [{
        sceneNumber: 1,
        description: input.videoDescription || 'Video content',
        visualElements: keywords.slice(0, 3),
        mood: 'neutral',
        imageKeywords: keywords.slice(0, 5),
      }],
      overallStyle: {
        colorPalette: ['neutral'],
        lighting: 'natural',
        mood: 'neutral',
        vibe: 'Pop',
      },
      totalSceneCount: 1,
      isSmooth: true,
      recommendedImageCount: input.imageCount || 5,
      allImageKeywords: keywords,
    };
  }
}

// Factory function
let agentInstance: FastCutSceneAnalyzerAgent | null = null;

export function getFastCutSceneAnalyzerAgent(): FastCutSceneAnalyzerAgent {
  if (!agentInstance) {
    agentInstance = new FastCutSceneAnalyzerAgent();
  }
  return agentInstance;
}

export default FastCutSceneAnalyzerAgent;
