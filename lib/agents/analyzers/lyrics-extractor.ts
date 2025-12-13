/**
 * Lyrics Extractor Agent
 * =======================
 * Extracts lyrics from audio files using Gemini Audio Understanding
 * Returns timed lyrics segments for subtitle synchronization
 *
 * Model: Gemini 2.5 Flash (fast analysis, audio-capable)
 * Category: Analyzer
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

Guidelines:
- Listen to the audio and match it to the provided lyrics
- Find the precise START and END time for each line
- Keep the lyrics text EXACTLY as provided - do not modify spelling or words
- Handle gaps between vocal sections appropriately
- Confidence should reflect how well the audio matches the provided lyrics`;

const FORCED_ALIGNMENT_USER_PROMPT = `Align the following lyrics with this audio file.

IMPORTANT: Use these exact lyrics - DO NOT transcribe or modify the text.
Your job is ONLY to find the timestamp for each line.

PROVIDED LYRICS:
{{lyrics}}

Language: {{languageHint}}
{{#if audioDuration}}Audio Duration: {{audioDuration}} seconds{{/if}}

Listen to the audio and return the start/end time for each line.

Return JSON in this exact format:
{
  "language": "{{languageHint}}",
  "extractedAt": "ISO timestamp",
  "source": "forced-alignment",
  "confidence": 0.0-1.0,
  "isInstrumental": false,
  "fullText": "Complete lyrics text (copy from provided)",
  "segments": [
    { "text": "First line from provided lyrics", "start": 0.0, "end": 4.5 },
    { "text": "Second line from provided lyrics", "start": 4.5, "end": 8.2 },
    ...
  ]
}

Important:
- Times must be in SECONDS (decimal)
- Ensure segments don't overlap
- Use the EXACT text from the provided lyrics
- Confidence reflects how well audio matches the given lyrics`;

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
      // Build user prompt with provided lyrics
      let userPrompt = FORCED_ALIGNMENT_USER_PROMPT
        .replace('{{lyrics}}', lyrics)
        .replace(/\{\{languageHint\}\}/g, input.languageHint);

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
 * Convert LyricsExtractorOutput to LyricsData for storage
 */
export function toLyricsData(output: LyricsExtractorOutput): LyricsData {
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
