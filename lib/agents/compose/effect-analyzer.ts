/**
 * Compose Effect Analyzer Agent
 * ==============================
 * Analyzes prompts to extract mood, genre, and keywords for video effects
 *
 * Model: Gemini 2.5 Flash
 * Category: Compose
 */

import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import type { AgentConfig, AgentContext } from '../types';

// Input Schema
export const ComposeEffectAnalyzerInputSchema = z.object({
  prompt: z.string(),
  bpm: z.number().optional(),
  existingVibe: z.enum(['Exciting', 'Emotional', 'Pop', 'Minimal']).optional(),
});

export type ComposeEffectAnalyzerInput = z.infer<typeof ComposeEffectAnalyzerInputSchema>;

// Available options
const AVAILABLE_MOODS = [
  'energetic', 'calm', 'dramatic', 'playful', 'elegant',
  'romantic', 'dark', 'bright', 'mysterious', 'modern',
  'nostalgic', 'powerful', 'dreamy', 'edgy', 'warm',
] as const;

const AVAILABLE_GENRES = [
  'kpop', 'hiphop', 'emotional', 'corporate', 'tiktok',
  'cinematic', 'vlog', 'documentary', 'edm', 'indie',
  'ballad', 'dance', 'rock', 'jazz', 'classical',
] as const;

const AVAILABLE_INTENSITIES = ['low', 'medium', 'high'] as const;

// Output Schema
export const ComposeEffectAnalyzerOutputSchema = z.object({
  moods: z.array(z.enum(AVAILABLE_MOODS)).min(1).max(4),
  genres: z.array(z.enum(AVAILABLE_GENRES)).min(1).max(3),
  keywords: z.array(z.string()).min(1).max(10),
  intensity: z.enum(AVAILABLE_INTENSITIES),
  reasoning: z.string(),
  language: z.enum(['ko', 'en']),
  suggestedEffects: z.array(z.string()).optional(),
  suggestedTransitions: z.array(z.string()).optional(),
  suggestedColorGrade: z.string().optional(),
});

export type ComposeEffectAnalyzerOutput = z.infer<typeof ComposeEffectAnalyzerOutputSchema>;

// Agent Configuration
export const ComposeEffectAnalyzerConfig: AgentConfig<ComposeEffectAnalyzerInput, ComposeEffectAnalyzerOutput> = {
  id: 'compose-effect-analyzer',
  name: 'Compose Effect Analyzer',
  description: '영상 프롬프트 분석 및 효과/무드/장르 추출',
  category: 'compose',

  model: {
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.3,
      maxTokens: 1024,
    },
  },

  prompts: {
    system: `You are a video production expert who analyzes user prompts to determine the best video style.

Your task is to analyze the given prompt and extract:
1. **Moods**: The emotional atmosphere of the video
2. **Genres**: The video style category
3. **Keywords**: Key descriptive words from the prompt
4. **Intensity**: How dynamic/energetic the video should be

Available Moods: ${AVAILABLE_MOODS.join(', ')}
Available Genres: ${AVAILABLE_GENRES.join(', ')}
Intensity Options: low, medium, high

Rules:
- Select 2-4 moods that best match the prompt
- Select 1-3 genres that best match the prompt
- Extract 5-10 keywords from the prompt that describe the desired style
- Determine intensity based on keywords like:
  - HIGH: "빠른/fast", "신나는/energetic", "강렬/intense", "powerful"
  - LOW: "차분한/calm", "부드러운/soft", "느린/slow", "peaceful"
  - MEDIUM: default for balanced content
- Provide brief reasoning for your choices

Always respond in valid JSON format.`,

    templates: {
      analyze: `Analyze this video concept prompt:

"{{prompt}}"

{{bpmContext}}
{{vibeContext}}

Respond with JSON:
{
  "moods": ["mood1", "mood2"],
  "genres": ["genre1", "genre2"],
  "keywords": ["keyword1", "keyword2", ...],
  "intensity": "low|medium|high",
  "reasoning": "Brief explanation of why these were chosen",
  "language": "ko|en",
  "suggestedEffects": ["effect1", "effect2"],
  "suggestedTransitions": ["transition1", "transition2"],
  "suggestedColorGrade": "color_grade_name"
}

Suggested Effects Options: zoom_in, zoom_out, shake, pulse, glitch, blur, flash, parallax
Suggested Transitions: fade, wipe, slide, zoom, dissolve, glitch, pixelate, cube
Suggested Color Grades: natural, vibrant, cinematic, moody, bright, warm, cool, vintage, neon, dramatic`,
    },
  },

  inputSchema: ComposeEffectAnalyzerInputSchema,
  outputSchema: ComposeEffectAnalyzerOutputSchema,
};

/**
 * Compose Effect Analyzer Agent Implementation
 */
export class ComposeEffectAnalyzerAgent extends BaseAgent<ComposeEffectAnalyzerInput, ComposeEffectAnalyzerOutput> {
  constructor() {
    super(ComposeEffectAnalyzerConfig);
  }

  protected buildPrompt(input: ComposeEffectAnalyzerInput, context: AgentContext): string {
    const template = this.getTemplate('analyze');

    // Build BPM context
    let bpmContext = '';
    if (input.bpm) {
      bpmContext = `Audio BPM: ${input.bpm}`;
      if (input.bpm >= 140) {
        bpmContext += ' (fast tempo, suggesting high energy)';
      } else if (input.bpm >= 100) {
        bpmContext += ' (moderate tempo)';
      } else {
        bpmContext += ' (slow tempo, suggesting calm energy)';
      }
    }

    // Build vibe context
    let vibeContext = '';
    if (input.existingVibe) {
      vibeContext = `Pre-selected Vibe: ${input.existingVibe}`;
    }

    return this.fillTemplate(template, {
      prompt: input.prompt,
      bpmContext,
      vibeContext,
    });
  }

  /**
   * Analyze prompt for effect selection
   */
  async analyzePrompt(
    prompt: string,
    context: AgentContext,
    options?: {
      bpm?: number;
      existingVibe?: ComposeEffectAnalyzerInput['existingVibe'];
    }
  ) {
    return this.execute(
      {
        prompt,
        bpm: options?.bpm,
        existingVibe: options?.existingVibe,
      },
      context
    );
  }

  /**
   * Fallback analysis when AI fails
   * Uses keyword matching to determine characteristics
   */
  fallbackAnalysis(prompt: string): ComposeEffectAnalyzerOutput {
    const promptLower = prompt.toLowerCase();

    // Mood detection
    const moodKeywords: Record<string, string[]> = {
      energetic: ['신나', '에너지', '활발', 'energy', 'dynamic', 'active', 'exciting'],
      calm: ['차분', '평온', '조용', 'calm', 'peaceful', 'relaxing', 'gentle'],
      dramatic: ['극적', '드라마', 'dramatic', 'intense', 'powerful', 'epic'],
      playful: ['장난', '재미', 'fun', 'playful', 'cheerful', 'happy'],
      elegant: ['우아', '세련', 'elegant', 'classy', 'sophisticated'],
      romantic: ['로맨틱', '감성', 'romantic', 'love', 'emotional', 'sentimental'],
      dark: ['어두', '무거', 'dark', 'moody', 'serious'],
      bright: ['밝은', '경쾌', 'bright', 'light', 'fresh'],
      mysterious: ['신비', '몽환', 'mysterious', 'dreamy', 'ethereal'],
      modern: ['현대', '트렌디', 'modern', 'trendy', 'contemporary'],
    };

    const moods: Array<typeof AVAILABLE_MOODS[number]> = [];
    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some(kw => promptLower.includes(kw))) {
        moods.push(mood as typeof AVAILABLE_MOODS[number]);
      }
    }
    if (moods.length === 0) moods.push('modern');

    // Genre detection
    const genreKeywords: Record<string, string[]> = {
      kpop: ['k-pop', 'kpop', '케이팝', '아이돌', '댄스', 'idol'],
      hiphop: ['힙합', '랩', 'hiphop', 'hip-hop', 'rap'],
      emotional: ['감성', '발라드', 'ballad', 'emotional', '느낌'],
      corporate: ['기업', '비즈니스', 'corporate', 'business', 'professional'],
      tiktok: ['틱톡', 'tiktok', '숏폼', 'short', 'viral', '트렌드'],
      cinematic: ['시네마', '영화', 'cinematic', 'movie', 'film'],
      vlog: ['브이로그', '일상', 'vlog', 'daily', 'lifestyle'],
      edm: ['edm', '일렉트로', 'electro', 'electronic', '클럽'],
    };

    const genres: Array<typeof AVAILABLE_GENRES[number]> = [];
    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some(kw => promptLower.includes(kw))) {
        genres.push(genre as typeof AVAILABLE_GENRES[number]);
      }
    }
    if (genres.length === 0) genres.push('tiktok');

    // Intensity detection
    let intensity: typeof AVAILABLE_INTENSITIES[number] = 'medium';
    const highKeywords = ['빠른', '신나는', '강렬', 'fast', 'quick', 'energetic', 'intense', 'powerful'];
    const lowKeywords = ['느린', '차분', '부드러운', 'slow', 'calm', 'soft', 'gentle', 'peaceful'];

    if (highKeywords.some(kw => promptLower.includes(kw))) {
      intensity = 'high';
    } else if (lowKeywords.some(kw => promptLower.includes(kw))) {
      intensity = 'low';
    }

    // Extract keywords
    const commonWords = new Set(['the', 'a', 'an', 'is', 'are', '을', '를', '이', '가', '의', '에', '로', '으로', '한', '하는']);
    const words = prompt.replace(/[,.]/g, ' ').split(/\s+/);
    const keywords = words.filter(w => w.length > 1 && !commonWords.has(w.toLowerCase())).slice(0, 10);

    // Detect language
    const hasKorean = prompt.split('').some(c => c.charCodeAt(0) >= 0xAC00 && c.charCodeAt(0) <= 0xD7A3);

    return {
      moods: moods.slice(0, 4) as [typeof AVAILABLE_MOODS[number], ...typeof AVAILABLE_MOODS[number][]],
      genres: genres.slice(0, 3) as [typeof AVAILABLE_GENRES[number], ...typeof AVAILABLE_GENRES[number][]],
      keywords,
      intensity,
      reasoning: 'Fallback analysis using keyword matching',
      language: hasKorean ? 'ko' : 'en',
      suggestedEffects: intensity === 'high' ? ['shake', 'zoom_in', 'flash'] : ['parallax', 'blur'],
      suggestedTransitions: ['fade', 'dissolve'],
      suggestedColorGrade: moods.includes('dark') ? 'moody' : 'natural',
    };
  }
}

// Factory function
export function createComposeEffectAnalyzerAgent(): ComposeEffectAnalyzerAgent {
  return new ComposeEffectAnalyzerAgent();
}
