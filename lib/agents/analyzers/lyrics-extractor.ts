/**
 * Lyrics Extractor Agent
 * =======================
 * Extracts lyrics from audio files using Gemini Audio Understanding
 * Returns timed lyrics segments for subtitle synchronization
 *
 * Model: Gemini 2.5 Flash (fast analysis, audio-capable)
 * Category: Analyzer
 * @version 2
 *
 * Changelog:
 * - v2: 프롬프트 강화 - 전체 오디오 청취 강조, 15초 이상 갭 방지, 세그먼트 수 검증
 * - v1: Initial version - 기본 가사 추출 및 forced alignment
 */

import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import type { AgentContext, AgentResult, AgentMetadata, TokenUsage } from '../types';
import type { LyricsData, LyricsSegment } from '@/lib/subtitle-styles';

// Input Schema
export const LyricsExtractorInputSchema = z.object({
  // Language hint for better extraction
  languageHint: z.enum(['ko', 'en', 'ja', 'auto']).default('auto'),
  // Audio duration for segment estimation
  audioDuration: z.number().optional(),
});

export type LyricsExtractorInput = z.infer<typeof LyricsExtractorInputSchema>;

// Output Schema - matches LyricsData structure
export const LyricsExtractorOutputSchema = z.object({
  language: z.enum(['ko', 'en', 'ja', 'mixed', 'auto']),
  extractedAt: z.string(),
  source: z.enum(['gemini', 'forced-alignment', 'manual']),
  confidence: z.number().min(0).max(1),
  isInstrumental: z.boolean(),
  fullText: z.string(),
  segments: z.array(z.object({
    text: z.string(),
    start: z.number(),
    end: z.number(),
  })),
});

export type LyricsExtractorOutput = z.infer<typeof LyricsExtractorOutputSchema>;

// Audio MIME types supported by Gemini
export type AudioMimeType =
  | 'audio/mp3'
  | 'audio/mpeg'
  | 'audio/wav'
  | 'audio/ogg'
  | 'audio/flac'
  | 'audio/aac'
  | 'audio/mp4'
  | 'audio/webm';

// System prompt for lyrics extraction
const SYSTEM_PROMPT = `You are an expert audio analyst and lyrics transcriber specializing in music content.
Your task is to extract lyrics with precise timing from audio files.

Guidelines:
- Listen carefully to identify vocal parts vs instrumental sections
- Extract lyrics with segment-level timestamps (MM:SS format in response, converted to seconds)
- Detect the primary language of the lyrics
- Mark instrumental sections appropriately
- Handle multiple languages if the song switches between them
- Confidence should reflect how clear/audible the lyrics are

For timing:
- Each segment should be 2-6 seconds typically
- Group related phrases together
- Mark the START time when vocals begin for that segment
- Mark the END time when that vocal phrase ends

If the audio is purely instrumental or has no clear vocals:
- Set isInstrumental to true
- Set fullText to empty string
- Set segments to empty array
- Set confidence based on how certain you are it's instrumental`;

// User prompt template for full extraction
const USER_PROMPT = `Analyze this audio file and extract the lyrics with precise timing.

Language Hint: {{languageHint}} (use 'auto' to detect automatically)
{{#if audioDuration}}Audio Duration: {{audioDuration}} seconds{{/if}}

Extract:
1. Full lyrics text
2. Timed segments with start/end times in SECONDS
3. Language detection
4. Confidence score (0-1) based on audio clarity

Return JSON in this exact format:
{
  "language": "ko" | "en" | "ja" | "mixed" | "auto",
  "extractedAt": "ISO timestamp",
  "source": "gemini",
  "confidence": 0.0-1.0,
  "isInstrumental": false,
  "fullText": "Complete lyrics text here",
  "segments": [
    { "text": "First line", "start": 0.0, "end": 4.5 },
    { "text": "Second line", "start": 4.5, "end": 8.2 },
    ...
  ]
}

Important:
- Times must be in SECONDS (decimal), not MM:SS format
- Ensure segments don't overlap
- Keep segment duration between 2-6 seconds when possible
- If instrumental, return empty segments array`;

// Forced Alignment prompt - sync provided lyrics with audio timing
const FORCED_ALIGNMENT_SYSTEM_PROMPT = `You are an expert audio analyst specializing in lyrics synchronization.
Your task is to align provided lyrics text with audio timing - DO NOT transcribe, use the given lyrics exactly.

🚨 ABSOLUTE REQUIREMENT - LISTEN TO THE ENTIRE SONG:
You MUST listen to the COMPLETE audio from start to finish. Do NOT skip any section.
Every vocal line in the song must be captured with its timestamp.

CRITICAL RULES:
1. Listen to 100% of the audio - from 0:00 to the very end
2. Capture EVERY vocal line - missing lines means you skipped parts of the song
3. Vocals typically start within 5-20 seconds after intro
4. Most songs have vocals throughout - gaps longer than 15 seconds are RARE

⚠️ COMMON AI MISTAKE TO AVOID:
- AI often only processes the first 1-2 minutes and skips the rest
- If you have 30 lyrics lines but only output 10, YOU ARE SKIPPING PARTS
- ALL provided lyrics lines MUST have timestamps

TIMING DISTRIBUTION RULES:
- Lyrics should be EVENLY distributed across the song duration
- If song is 3:30 (210 seconds) with 25 lines → expect ~8 seconds per line average
- Maximum gap between ANY two consecutive lines: 15 seconds
- If you find a gap > 15 seconds, you likely MISSED vocals in that section

SONG STRUCTURE (typical):
- Intro: 5-15 seconds (no vocals)
- Verse 1: 20-40 seconds of continuous vocals
- Chorus: 15-30 seconds of continuous vocals
- Verse 2: 20-40 seconds of continuous vocals
- Chorus: 15-30 seconds of continuous vocals
- Bridge: 10-20 seconds (may have vocals)
- Final Chorus: 15-30 seconds of continuous vocals
- Outro: 5-15 seconds

VALIDATION CHECKLIST:
✓ First lyrics start within 5-30 seconds
✓ Last lyrics end within 30 seconds of song end
✓ No gaps longer than 15 seconds between lines
✓ ALL provided lyrics lines have timestamps
✓ Total segment count matches provided lyrics line count`;

const FORCED_ALIGNMENT_USER_PROMPT = `Align the following lyrics with this audio file.

🚨 CRITICAL: You MUST output EXACTLY {{lyricsLineCount}} segments - one for each lyrics line below.

PROVIDED LYRICS ({{lyricsLineCount}} lines total):
{{lyrics}}

Language: {{languageHint}}
{{#if audioDuration}}Audio Duration: {{audioDuration}} seconds

📊 TIMING MATH (use this as your guide):
- Total lines: {{lyricsLineCount}}
- Song length: {{audioDuration}} seconds
- Expected average per line: ~{{avgSecondsPerLine}} seconds
- First line: should start around 5-20 seconds
- Last line: should end around {{expectedEndTime}} seconds
{{/if}}

🎯 YOUR TASK:
1. Listen to the ENTIRE audio from 0:00 to the end
2. Find where EACH of the {{lyricsLineCount}} lyrics lines is sung
3. Output EXACTLY {{lyricsLineCount}} segments with timestamps

Return JSON in this exact format:
{
  "language": "{{languageHint}}",
  "extractedAt": "ISO timestamp",
  "source": "forced-alignment",
  "confidence": 0.0-1.0,
  "isInstrumental": false,
  "fullText": "Complete lyrics text (copy from provided)",
  "segments": [
    { "text": "Line 1 text", "start": 5.0, "end": 9.5 },
    { "text": "Line 2 text", "start": 9.5, "end": 14.2 },
    ... (continue for ALL {{lyricsLineCount}} lines)
  ]
}

⚠️ VALIDATION REQUIREMENTS:
- segments array MUST have EXACTLY {{lyricsLineCount}} items
- Times in SECONDS (decimal format)
- First segment starts between 5-30 seconds
- Maximum gap between consecutive segments: 15 seconds
- Segments must NOT overlap
- Use EXACT text from provided lyrics

❌ FAILURE CONDITIONS (your output will be rejected if):
- segments.length !== {{lyricsLineCount}}
- Any gap > 15 seconds between consecutive lines
- Missing lyrics lines from the middle of the song
- First segment starts after 45 seconds`;

/**
 * Lyrics Extractor Agent
 * Uses Gemini Audio Understanding directly (not via BaseAgent due to audio-specific handling)
 */
export class LyricsExtractorAgent {
  private ai: GoogleGenAI;
  private modelId = 'gemini-2.5-flash';

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is required');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Extract lyrics from audio data
   * @param audioData - Base64 encoded audio data
   * @param mimeType - Audio MIME type
   * @param input - Extraction configuration
   * @param context - Agent context
   */
  async extractLyrics(
    audioData: string,
    mimeType: AudioMimeType,
    input: LyricsExtractorInput,
    context: AgentContext
  ): Promise<AgentResult<LyricsExtractorOutput>> {
    const startTime = Date.now();

    try {
      // Build user prompt
      let userPrompt = USER_PROMPT.replace('{{languageHint}}', input.languageHint);
      if (input.audioDuration) {
        userPrompt = userPrompt.replace(
          '{{#if audioDuration}}Audio Duration: {{audioDuration}} seconds{{/if}}',
          `Audio Duration: ${input.audioDuration} seconds`
        );
      } else {
        userPrompt = userPrompt.replace(
          '{{#if audioDuration}}Audio Duration: {{audioDuration}} seconds{{/if}}',
          ''
        );
      }

      // Generate with audio input
      const response = await this.ai.models.generateContent({
        model: this.modelId,
        config: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          topP: 0.95,
          responseMimeType: 'application/json',
          systemInstruction: SYSTEM_PROMPT,
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioData,
                },
              },
              { text: userPrompt },
            ],
          },
        ],
      });

      const text = response.text || '';

      // Parse JSON response
      let parsed: LyricsExtractorOutput;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error('Failed to parse lyrics extraction response as JSON');
        }
      }

      // Validate output
      const validated = LyricsExtractorOutputSchema.parse(parsed);

      // Ensure extractedAt is set
      if (!validated.extractedAt) {
        validated.extractedAt = new Date().toISOString();
      }

      // Calculate token usage
      const usage: TokenUsage = {
        input: response.usageMetadata?.promptTokenCount || 0,
        output: response.usageMetadata?.candidatesTokenCount || 0,
        total: response.usageMetadata?.totalTokenCount || 0,
      };

      const metadata: AgentMetadata = {
        agentId: 'lyrics-extractor',
        model: 'gemini-2.5-flash',
        tokenUsage: usage,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: validated,
        metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LyricsExtractor] Extraction error:', errorMessage);

      const metadata: AgentMetadata = {
        agentId: 'lyrics-extractor',
        model: 'gemini-2.5-flash',
        tokenUsage: { input: 0, output: 0, total: 0 },
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      return {
        success: false,
        error: errorMessage,
        metadata,
      };
    }
  }

  /**
   * Extract lyrics from audio URL
   * Downloads the audio and processes it
   */
  async extractLyricsFromUrl(
    audioUrl: string,
    input: LyricsExtractorInput,
    context: AgentContext
  ): Promise<AgentResult<LyricsExtractorOutput>> {
    const startTime = Date.now();

    try {
      // Fetch the audio file
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }

      // Get content type
      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      const mimeType = contentType.split(';')[0].trim() as AudioMimeType;

      // Convert to base64
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      // Extract lyrics
      return this.extractLyrics(base64, mimeType, input, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LyricsExtractor] URL extraction error:', errorMessage);

      const metadata: AgentMetadata = {
        agentId: 'lyrics-extractor',
        model: 'gemini-2.5-flash',
        tokenUsage: { input: 0, output: 0, total: 0 },
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      return {
        success: false,
        error: errorMessage,
        metadata,
      };
    }
  }

  /**
   * Forced Alignment: Sync provided lyrics with audio timing
   * @param audioData - Base64 encoded audio data
   * @param mimeType - Audio MIME type
   * @param lyrics - The lyrics text to align (one line per segment)
   * @param input - Extraction configuration
   * @param context - Agent context
   */
  async alignLyrics(
    audioData: string,
    mimeType: AudioMimeType,
    lyrics: string,
    input: LyricsExtractorInput,
    context: AgentContext
  ): Promise<AgentResult<LyricsExtractorOutput>> {
    const startTime = Date.now();

    try {
      // Calculate lyrics line count for better timing hints
      const lyricsLines = lyrics.split('\n').filter(line => line.trim().length > 0);
      const lyricsLineCount = lyricsLines.length;

      // Build user prompt with provided lyrics
      let userPrompt = FORCED_ALIGNMENT_USER_PROMPT
        .replace('{{lyrics}}', lyrics)
        .replace(/\{\{languageHint\}\}/g, input.languageHint)
        .replace(/\{\{lyricsLineCount\}\}/g, lyricsLineCount.toString());

      if (input.audioDuration) {
        const avgSecondsPerLine = (input.audioDuration / lyricsLineCount).toFixed(1);
        const expectedEndTime = Math.floor(input.audioDuration - 15); // Leave ~15s for outro

        userPrompt = userPrompt
          .replace(
            /\{\{#if audioDuration\}\}([\s\S]*?)\{\{\/if\}\}/,
            `Audio Duration: ${input.audioDuration} seconds

TIMING CHECK: With ${lyricsLineCount} lines over ${input.audioDuration} seconds:
- Expected average: ~${avgSecondsPerLine} seconds per line
- First line should start around 5-20 seconds (after intro)
- Last line should end around ${expectedEndTime} seconds`
          )
          .replace('{{avgSecondsPerLine}}', avgSecondsPerLine)
          .replace('{{expectedEndTime}}', expectedEndTime.toString());
      } else {
        userPrompt = userPrompt.replace(
          /\{\{#if audioDuration\}\}[\s\S]*?\{\{\/if\}\}/,
          ''
        );
      }

      // Generate with audio input
      const response = await this.ai.models.generateContent({
        model: this.modelId,
        config: {
          temperature: 0.2, // Lower temperature for more precise alignment
          maxOutputTokens: 8192,
          topP: 0.95,
          responseMimeType: 'application/json',
          systemInstruction: FORCED_ALIGNMENT_SYSTEM_PROMPT,
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioData,
                },
              },
              { text: userPrompt },
            ],
          },
        ],
      });

      const text = response.text || '';

      // Parse JSON response
      let parsed: LyricsExtractorOutput;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error('Failed to parse forced alignment response as JSON');
        }
      }

      // Override source to indicate forced alignment
      parsed.source = 'forced-alignment';
      parsed.extractedAt = new Date().toISOString();
      parsed.fullText = lyrics; // Ensure we keep original lyrics

      // Validate output
      const validated = LyricsExtractorOutputSchema.parse(parsed);

      // Calculate token usage
      const usage: TokenUsage = {
        input: response.usageMetadata?.promptTokenCount || 0,
        output: response.usageMetadata?.candidatesTokenCount || 0,
        total: response.usageMetadata?.totalTokenCount || 0,
      };

      const metadata: AgentMetadata = {
        agentId: 'lyrics-extractor',
        model: 'gemini-2.5-flash',
        tokenUsage: usage,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: validated,
        metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LyricsExtractor] Forced alignment error:', errorMessage);

      const metadata: AgentMetadata = {
        agentId: 'lyrics-extractor',
        model: 'gemini-2.5-flash',
        tokenUsage: { input: 0, output: 0, total: 0 },
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      return {
        success: false,
        error: errorMessage,
        metadata,
      };
    }
  }

  /**
   * Forced Alignment from URL: Sync provided lyrics with audio from URL
   */
  async alignLyricsFromUrl(
    audioUrl: string,
    lyrics: string,
    input: LyricsExtractorInput,
    context: AgentContext
  ): Promise<AgentResult<LyricsExtractorOutput>> {
    const startTime = Date.now();

    try {
      // Fetch the audio file
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }

      // Get content type
      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      const mimeType = contentType.split(';')[0].trim() as AudioMimeType;

      // Convert to base64
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      // Align lyrics
      return this.alignLyrics(base64, mimeType, lyrics, input, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LyricsExtractor] URL forced alignment error:', errorMessage);

      const metadata: AgentMetadata = {
        agentId: 'lyrics-extractor',
        model: 'gemini-2.5-flash',
        tokenUsage: { input: 0, output: 0, total: 0 },
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      return {
        success: false,
        error: errorMessage,
        metadata,
      };
    }
  }
}

// Factory function
export function createLyricsExtractorAgent(): LyricsExtractorAgent {
  return new LyricsExtractorAgent();
}

/**
 * Validate and warn about suspicious gaps in lyrics timing
 * Returns warnings if any gaps are unusually long or timing seems off
 */
function validateLyricsGaps(segments: LyricsSegment[], expectedLineCount?: number): string[] {
  const warnings: string[] = [];
  const MAX_REASONABLE_GAP = 15; // seconds - tightened from 20
  const MAX_FIRST_SEGMENT_START = 30; // First lyrics should start within 30 seconds

  if (segments.length === 0) {
    return warnings;
  }

  // Check if segment count matches expected
  if (expectedLineCount && segments.length !== expectedLineCount) {
    warnings.push(
      `⚠️ SEGMENT COUNT MISMATCH: Expected ${expectedLineCount} lines but got ${segments.length}. Some lyrics may be missing timestamps.`
    );
  }

  // Check if first segment starts too late
  const firstSegmentStart = segments[0].start;
  if (firstSegmentStart > MAX_FIRST_SEGMENT_START) {
    warnings.push(
      `⚠️ LATE START: First lyrics at ${firstSegmentStart.toFixed(1)}s - most songs start vocals within 5-20 seconds.`
    );
  }

  // Check gaps between segments
  for (let i = 1; i < segments.length; i++) {
    const prevEnd = segments[i - 1].end;
    const currentStart = segments[i].start;
    const gap = currentStart - prevEnd;

    if (gap > MAX_REASONABLE_GAP) {
      warnings.push(
        `⚠️ LARGE GAP: ${gap.toFixed(1)}s gap between line ${i} and ${i + 1} (${prevEnd.toFixed(1)}s → ${currentStart.toFixed(1)}s). Likely missing vocals in this section.`
      );
    }
  }

  return warnings;
}

/**
 * Convert LyricsExtractorOutput to LyricsData for storage
 */
export function toLyricsData(output: LyricsExtractorOutput): LyricsData {
  // Validate gaps and log warnings
  const warnings = validateLyricsGaps(output.segments);
  if (warnings.length > 0) {
    console.warn('[LyricsExtractor] Suspicious gaps detected in lyrics timing:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  return {
    language: output.language,
    extractedAt: output.extractedAt,
    source: 'gemini',
    confidence: output.confidence,
    isInstrumental: output.isInstrumental,
    fullText: output.fullText,
    segments: output.segments,
  };
}

// ============================================================================
// Agent Configuration (for DB registration)
// ============================================================================

/**
 * Lyrics Extractor Config
 * Used for registering prompts in the database via seed API
 */
export const LyricsExtractorConfig = {
  id: 'lyrics-extractor',
  name: 'Lyrics Extractor Agent',
  description: '오디오 파일에서 가사를 추출하고 타임스탬프를 부여하는 에이전트. Forced Alignment 지원.',
  category: 'analyzer' as const,

  model: {
    provider: 'gemini' as const,
    name: 'gemini-2.5-flash',
    options: {
      temperature: 0.3,
      maxTokens: 8192,
    },
  },

  prompts: {
    system: SYSTEM_PROMPT,
    templates: {
      extract: USER_PROMPT,
      forced_alignment_system: FORCED_ALIGNMENT_SYSTEM_PROMPT,
      forced_alignment: FORCED_ALIGNMENT_USER_PROMPT,
    },
  },
};
