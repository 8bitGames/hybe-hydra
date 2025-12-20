/**
 * Lyrics Extractor Agent
 * =======================
 * Extracts lyrics from audio files using Gemini Audio Understanding
 * Returns timed lyrics segments for subtitle synchronization
 *
 * Model: Gemini 2.5 Flash (fast analysis, audio-capable)
 * Category: Analyzer
 * @version 3
 *
 * Changelog:
 * - v3: 간주(Instrumental Break) 인식 개선 - 15초 갭 제한 제거, 실제 보컬 타이밍에 맞춘 가사 배치
 * - v2: 프롬프트 강화 - 전체 오디오 청취 강조, 15초 이상 갭 방지, 세그먼트 수 검증
 * - v1: Initial version - 기본 가사 추출 및 forced alignment
 */

import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_PRO } from '../constants';
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
4. ALL provided lyrics lines MUST have timestamps

🎸 INSTRUMENTAL BREAKS (간주) - VERY IMPORTANT:
Many songs have INSTRUMENTAL BREAKS (간주) where there are NO vocals for 15-60+ seconds.
This is NORMAL and you MUST respect these breaks:
- If you hear NO vocals during a section, DO NOT place lyrics there
- Common locations: between verse and chorus, after 2nd chorus, before final chorus
- Instrumental breaks can be 15-60 seconds or even longer
- Guitar solos, piano interludes, beat drops are all instrumental breaks
- WAIT for the vocals to actually resume before placing the next lyrics line

⚠️ COMMON AI MISTAKES TO AVOID:
- Placing lyrics during instrumental breaks when no vocals are heard
- Compressing all lyrics into the first half of the song
- Ignoring instrumental sections and making timing too tight
- If you have 30 lyrics lines but only output 10, YOU ARE SKIPPING PARTS

🎯 TIMING ALIGNMENT RULES:
- Place lyrics ONLY when you HEAR the vocals singing that line
- Each segment duration should be 2-6 seconds (how long it takes to SING that line)
- The END time is when the singer FINISHES singing that line, NOT when the next line starts
- GAPS go BETWEEN segments: [Line 1 end] → GAP → [Line 2 start]
- DO NOT extend segment duration to fill gaps - keep segment duration short (2-6 sec)

⚠️ CRITICAL - SEGMENT DURATION vs GAP:
- SEGMENT DURATION = how long the singer takes to sing ONE line (typically 2-6 seconds)
- GAP = silence/instrumental between end of one line and start of next line
- Example: Line sung from 10.0s to 13.5s → segment is {start: 10.0, end: 13.5} (3.5 sec duration)
- If next line starts at 45.0s → that's a 31.5 second GAP, NOT a 35 second segment!

SONG STRUCTURE (typical with instrumental breaks):
- Intro: 5-20 seconds (no vocals)
- Verse 1: 20-40 seconds of vocals
- Pre-chorus/Chorus: 15-30 seconds of vocals
- Verse 2: 20-40 seconds of vocals
- Chorus: 15-30 seconds of vocals
- 🎸 INSTRUMENTAL BREAK: 15-45 seconds (NO vocals - guitar solo, bridge music, etc.)
- Bridge/Final Verse: 10-30 seconds of vocals
- Final Chorus: 15-30 seconds of vocals
- Outro: 5-20 seconds (may or may not have vocals)

VALIDATION CHECKLIST:
✓ First lyrics start when you HEAR the first vocal line
✓ Last lyrics end when you HEAR the last vocal line
✓ Gaps match ACTUAL instrumental sections in the audio
✓ ALL provided lyrics lines have timestamps
✓ Total segment count matches provided lyrics line count
✓ Lyrics timing matches when vocals are ACTUALLY heard`;

const FORCED_ALIGNMENT_USER_PROMPT = `Align the following lyrics with this audio file.

🚨 CRITICAL: You MUST output EXACTLY {{lyricsLineCount}} segments - one for each lyrics line below.

PROVIDED LYRICS ({{lyricsLineCount}} lines total):
{{lyrics}}

Language: {{languageHint}}
{{#if audioDuration}}Audio Duration: {{audioDuration}} seconds

📊 TIMING REFERENCE:
- Total lines: {{lyricsLineCount}}
- Song length: {{audioDuration}} seconds
- Note: Timing should match ACTUAL vocal positions, not evenly distributed
{{/if}}

🎯 YOUR TASK:
1. Listen to the ENTIRE audio from 0:00 to the end
2. Identify INSTRUMENTAL BREAKS (간주) where no vocals are present
3. Find where EACH of the {{lyricsLineCount}} lyrics lines is ACTUALLY sung
4. Output EXACTLY {{lyricsLineCount}} segments with timestamps matching real vocal timing

🎸 INSTRUMENTAL BREAK HANDLING:
- If there's a guitar solo, piano interlude, or any section WITHOUT vocals → leave a GAP between segments
- GAP = time between one segment's END and next segment's START
- Example: Line 20 ends at 120.5s, guitar solo plays, Line 21 starts at 150.0s → GAP is 29.5 seconds

⚠️ SEGMENT DURATION RULES (VERY IMPORTANT):
- Each segment should be 2-6 seconds long (how long it takes to SING that one line)
- The END time = when singer FINISHES that line (NOT when next line starts)
- WRONG: {start: 59.5, end: 142.0} ← 82 second segment is WAY too long!
- RIGHT: {start: 59.5, end: 63.0} ← 3.5 second segment, then GAP until next line

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
- Segments must NOT overlap
- Use EXACT text from provided lyrics
- Each segment duration MUST be 2-8 seconds (end - start)
- Gaps between segments are OK for instrumental breaks
- Place lyrics ONLY when you HEAR the vocals

❌ FAILURE CONDITIONS (your output will be rejected if):
- segments.length !== {{lyricsLineCount}}
- Any segment duration > 10 seconds (this means END time is wrong)
- Missing lyrics lines from the output
- Timing doesn't match actual vocal positions in the audio`;

/**
 * Lyrics Extractor Agent
 * Uses Gemini Audio Understanding directly (not via BaseAgent due to audio-specific handling)
 */
export class LyricsExtractorAgent {
  private ai: GoogleGenAI;
  private modelId = GEMINI_PRO;

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
        model: GEMINI_PRO,
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
        model: GEMINI_PRO,
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
        model: GEMINI_PRO,
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
        // Replace the conditional block with actual duration info
        // Note: We emphasize actual vocal timing, not even distribution
        userPrompt = userPrompt
          .replace(
            /\{\{#if audioDuration\}\}([\s\S]*?)\{\{\/if\}\}/,
            `Audio Duration: ${input.audioDuration} seconds

📊 TIMING REFERENCE:
- Total lines: ${lyricsLineCount}
- Song length: ${input.audioDuration} seconds
- IMPORTANT: Match lyrics to ACTUAL vocal timing, NOT even distribution
- If there are instrumental breaks, leave appropriate gaps`
          )
          .replace(/\{\{audioDuration\}\}/g, input.audioDuration.toString());
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
          maxOutputTokens: 16384, // Increased for full lyrics output
          topP: 0.95,
          // Note: responseMimeType removed - gemini-3-flash-preview may not support it properly
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

      // Log raw response for debugging
      console.log('[LyricsExtractor] Raw response length:', text.length);
      if (text.length < 100) {
        console.log('[LyricsExtractor] Short response:', text);
      }

      // Parse JSON response
      let parsed: LyricsExtractorOutput;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        console.log('[LyricsExtractor] Direct JSON parse failed, trying alternatives...');
        console.log('[LyricsExtractor] Response preview:', text.substring(0, 500));

        // Try to extract JSON from markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[1].trim());
          } catch {
            console.error('[LyricsExtractor] Failed to parse extracted JSON from code block');
            throw new Error(`Failed to parse forced alignment response as JSON. Response preview: ${text.substring(0, 200)}`);
          }
        } else {
          // Try to find JSON object pattern
          const jsonObjectMatch = text.match(/\{[\s\S]*"segments"[\s\S]*\}/);
          if (jsonObjectMatch) {
            try {
              parsed = JSON.parse(jsonObjectMatch[0]);
            } catch {
              console.error('[LyricsExtractor] Failed to parse JSON object pattern');
              throw new Error(`Failed to parse forced alignment response as JSON. Response preview: ${text.substring(0, 200)}`);
            }
          } else {
            console.error('[LyricsExtractor] No JSON pattern found in response');
            throw new Error(`Failed to parse forced alignment response as JSON. Response preview: ${text.substring(0, 200)}`);
          }
        }
      }

      // Override source to indicate forced alignment
      parsed.source = 'forced-alignment';
      parsed.extractedAt = new Date().toISOString();
      parsed.fullText = lyrics; // Ensure we keep original lyrics

      // Validate and fix segment durations
      if (parsed.segments && parsed.segments.length > 0) {
        const MAX_SEGMENT_DURATION = 10; // seconds
        let fixedCount = 0;

        for (let i = 0; i < parsed.segments.length; i++) {
          const segment = parsed.segments[i];
          const duration = segment.end - segment.start;

          if (duration > MAX_SEGMENT_DURATION) {
            console.warn(`[LyricsExtractor] Segment ${i + 1} has abnormal duration: ${duration.toFixed(1)}s - fixing to ${MAX_SEGMENT_DURATION}s`);
            // Fix by setting end time to start + reasonable duration
            segment.end = segment.start + Math.min(duration, 5); // Default to 5 seconds
            fixedCount++;
          }
        }

        if (fixedCount > 0) {
          console.warn(`[LyricsExtractor] Fixed ${fixedCount} segments with abnormal durations`);
        }
      }

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
        model: GEMINI_PRO,
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
        model: GEMINI_PRO,
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
        model: GEMINI_PRO,
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
 * Note: Gaps up to 60 seconds can be legitimate instrumental breaks (간주)
 */
function validateLyricsGaps(segments: LyricsSegment[], expectedLineCount?: number): string[] {
  const warnings: string[] = [];
  const MAX_INSTRUMENTAL_BREAK = 90; // seconds - instrumental breaks can be up to 90 seconds
  const MAX_FIRST_SEGMENT_START = 45; // First lyrics can start later if there's a long intro

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
      `ℹ️ LATE START: First lyrics at ${firstSegmentStart.toFixed(1)}s - this may be correct if the song has a long intro.`
    );
  }

  // Check gaps between segments - only warn for extremely long gaps
  let largeGapCount = 0;
  for (let i = 1; i < segments.length; i++) {
    const prevEnd = segments[i - 1].end;
    const currentStart = segments[i].start;
    const gap = currentStart - prevEnd;

    if (gap > MAX_INSTRUMENTAL_BREAK) {
      warnings.push(
        `⚠️ VERY LARGE GAP: ${gap.toFixed(1)}s gap between line ${i} and ${i + 1} (${prevEnd.toFixed(1)}s → ${currentStart.toFixed(1)}s). This seems unusually long even for an instrumental break.`
      );
    } else if (gap > 30) {
      // Just informational for gaps 30-90 seconds (likely instrumental breaks)
      largeGapCount++;
    }
  }

  // Info about instrumental breaks detected
  if (largeGapCount > 0) {
    console.log(`[LyricsExtractor] Detected ${largeGapCount} potential instrumental break(s) (gaps > 30s)`);
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
    name: GEMINI_PRO,
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
