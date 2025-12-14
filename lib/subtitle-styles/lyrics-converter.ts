/**
 * Lyrics to Subtitle Converter
 * =============================
 * Converts extracted lyrics to subtitle entries for video rendering
 */

import type {
  LyricsData,
  LyricsSegment,
  SubtitleEntry,
  SubtitleType,
  LyricsToSubtitleOptions,
  SubtitleStyleSet,
  SubtitleRenderSettings,
} from './types';
import { getSubtitleStyleById, getDefaultLyricsStyle } from './presets';
import { styleSetToRenderSettings } from './types';

/**
 * Convert lyrics data to subtitle entries
 * @param lyrics - Extracted lyrics with timing
 * @param options - Conversion options including time offset
 * @returns Array of subtitle entries ready for rendering
 */
export function lyricsToSubtitles(
  lyrics: LyricsData,
  options: LyricsToSubtitleOptions
): SubtitleEntry[] {
  const {
    audioStartTime = 0,
    videoDuration,
    styleId,
    maxLinesPerScreen = 2,
    maxDurationPerSubtitle = 4,
  } = options;

  // If instrumental, return empty array
  if (lyrics.isInstrumental || !lyrics.segments.length) {
    return [];
  }

  const subtitles: SubtitleEntry[] = [];
  const videoEnd = videoDuration;

  // Process each segment
  for (const segment of lyrics.segments) {
    // Calculate adjusted times with audio offset
    // Subtract audioStartTime because lyrics timestamps are relative to audio file start,
    // but video playback starts at audioStartTime into the audio
    // Example: audioStartTime=60, segment.start=65 → video time = 65-60 = 5
    const adjustedStart = segment.start - audioStartTime;
    const adjustedEnd = segment.end - audioStartTime;

    // Skip segments that start after video ends
    if (adjustedStart >= videoEnd) {
      continue;
    }

    // Skip segments that end before video starts
    if (adjustedEnd <= 0) {
      continue;
    }

    // Clamp times to video boundaries
    const clampedStart = Math.max(0, adjustedStart);
    const clampedEnd = Math.min(videoEnd, adjustedEnd);

    // Skip if duration is too short after clamping (< 0.3s)
    if (clampedEnd - clampedStart < 0.3) {
      continue;
    }

    // Detect subtitle type based on content
    const type = detectSubtitleType(segment.text);

    subtitles.push({
      text: segment.text,
      start: clampedStart,
      end: clampedEnd,
      type,
      styleId,
    });
  }

  // Split long subtitles if needed
  const processedSubtitles = splitLongSubtitles(
    subtitles,
    maxLinesPerScreen,
    maxDurationPerSubtitle
  );

  return processedSubtitles;
}

/**
 * Detect subtitle type based on content analysis
 */
function detectSubtitleType(text: string): SubtitleType {
  const lowerText = text.toLowerCase();
  const trimmedText = text.trim();

  // Check for hook indicators
  const hookPatterns = [
    /^(yeah|yo|hey|let's go|oh|ah|come on|alright)/i,
    /[!]{2,}/,
    /^[\u{1F525}\u{1F4A5}\u{1F64C}]/u, // Fire, explosion, hands up emojis
  ];
  if (hookPatterns.some(p => p.test(trimmedText))) {
    return 'hook';
  }

  // Check for chorus (repeated patterns, typically more emotional)
  const chorusPatterns = [
    /la la la/i,
    /na na na/i,
    /oh oh oh/i,
    /\(.*chorus.*\)/i,
  ];
  if (chorusPatterns.some(p => p.test(lowerText))) {
    return 'chorus';
  }

  // Check for verse markers
  const versePatterns = [
    /\(.*verse.*\)/i,
    /\[.*verse.*\]/i,
  ];
  if (versePatterns.some(p => p.test(lowerText))) {
    return 'verse';
  }

  // Check for CTA
  const ctaPatterns = [
    /subscribe/i,
    /follow/i,
    /like.*comment/i,
    /check.*out/i,
    /link.*bio/i,
  ];
  if (ctaPatterns.some(p => p.test(lowerText))) {
    return 'cta';
  }

  // Default to lyrics
  return 'lyrics';
}

/**
 * Split subtitles that are too long
 */
function splitLongSubtitles(
  subtitles: SubtitleEntry[],
  maxLines: number,
  maxDuration: number
): SubtitleEntry[] {
  const result: SubtitleEntry[] = [];

  for (const subtitle of subtitles) {
    const duration = subtitle.end - subtitle.start;
    const lines = subtitle.text.split('\n');

    // If within limits, keep as-is
    if (lines.length <= maxLines && duration <= maxDuration) {
      result.push(subtitle);
      continue;
    }

    // Split by lines first
    if (lines.length > maxLines) {
      const chunks: string[] = [];
      for (let i = 0; i < lines.length; i += maxLines) {
        chunks.push(lines.slice(i, i + maxLines).join('\n'));
      }

      const chunkDuration = duration / chunks.length;
      let currentStart = subtitle.start;

      for (const chunk of chunks) {
        result.push({
          ...subtitle,
          text: chunk,
          start: currentStart,
          end: Math.min(currentStart + chunkDuration, subtitle.end),
        });
        currentStart += chunkDuration;
      }
    }
    // Split by duration
    else if (duration > maxDuration) {
      const numParts = Math.ceil(duration / maxDuration);
      const partDuration = duration / numParts;
      const words = subtitle.text.split(/\s+/);
      const wordsPerPart = Math.ceil(words.length / numParts);

      let currentStart = subtitle.start;
      for (let i = 0; i < numParts; i++) {
        const partWords = words.slice(i * wordsPerPart, (i + 1) * wordsPerPart);
        if (partWords.length === 0) continue;

        result.push({
          ...subtitle,
          text: partWords.join(' '),
          start: currentStart,
          end: Math.min(currentStart + partDuration, subtitle.end),
        });
        currentStart += partDuration;
      }
    } else {
      result.push(subtitle);
    }
  }

  return result;
}

/**
 * Get render settings for a subtitle entry
 */
export function getSubtitleRenderSettings(
  entry: SubtitleEntry
): SubtitleRenderSettings {
  const styleId = entry.styleId;
  const style = styleId ? getSubtitleStyleById(styleId) : getDefaultLyricsStyle();

  if (!style) {
    // Fallback to default
    return styleSetToRenderSettings(getDefaultLyricsStyle());
  }

  return styleSetToRenderSettings(style);
}

/**
 * Generate ASS subtitle content for FFmpeg rendering
 */
export function generateASSContent(
  subtitles: SubtitleEntry[],
  videoWidth: number = 1080,
  videoHeight: number = 1920
): string {
  // ASS header
  const header = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;

  // Generate styles for each preset
  const styles: string[] = [];
  const styleMap = new Map<string, string>();

  // Default style
  const defaultStyleName = 'Default';
  styles.push(`Style: ${defaultStyleName},Pretendard,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,0,2,20,20,40,1`);
  styleMap.set('default', defaultStyleName);

  // Generate style for each used styleId
  const usedStyles = new Set(subtitles.map(s => s.styleId).filter(Boolean));

  for (const styleId of usedStyles) {
    if (!styleId) continue;
    const style = getSubtitleStyleById(styleId);
    if (!style) continue;

    const styleName = `Style_${styleId}`;
    const fontSize = style.text.fontSize === 'large' ? 84 : style.text.fontSize === 'medium' ? 72 : 60;
    const primaryColor = hexToASS(style.text.color);
    const outlineColor = hexToASS(style.text.strokeColor);
    const bold = style.text.fontStyle === 'bold' ? 1 : 0;
    const alignment = style.position.vertical === 'top' ? 8 : style.position.vertical === 'center' ? 5 : 2;
    const marginV = Math.round((style.position.bottomMargin / 100) * videoHeight);

    styles.push(`Style: ${styleName},Pretendard,${fontSize},${primaryColor},&H000000FF,${outlineColor},&H80000000,${bold},0,0,0,100,100,0,0,1,${style.text.strokeWidth},0,${alignment},20,20,${marginV},1`);
    styleMap.set(styleId, styleName);
  }

  // Events header
  const eventsHeader = `
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Generate dialogue lines
  const dialogues: string[] = [];

  for (const subtitle of subtitles) {
    const styleName = styleMap.get(subtitle.styleId || 'default') || defaultStyleName;
    const startTime = formatASSTime(subtitle.start);
    const endTime = formatASSTime(subtitle.end);

    // Escape special characters and add effects based on style
    let text = escapeASSText(subtitle.text);

    // Add animation effects based on style
    const style = subtitle.styleId ? getSubtitleStyleById(subtitle.styleId) : null;
    if (style) {
      text = applyASSAnimation(text, style);
    }

    dialogues.push(`Dialogue: 0,${startTime},${endTime},${styleName},,0,0,0,,${text}`);
  }

  return header + styles.join('\n') + eventsHeader + dialogues.join('\n');
}

/**
 * Convert hex color to ASS color format (&HAABBGGRR)
 */
function hexToASS(hex: string): string {
  // Remove # if present
  const clean = hex.replace('#', '');

  // Parse RGB
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  // Convert to ASS format (BBGGRR)
  const bb = b.toString(16).padStart(2, '0').toUpperCase();
  const gg = g.toString(16).padStart(2, '0').toUpperCase();
  const rr = r.toString(16).padStart(2, '0').toUpperCase();

  return `&H00${bb}${gg}${rr}`;
}

/**
 * Format time for ASS format (H:MM:SS.CC)
 */
function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);

  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/**
 * Escape special characters for ASS
 */
function escapeASSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\N');
}

/**
 * Apply ASS animation effects based on style
 */
function applyASSAnimation(text: string, style: SubtitleStyleSet): string {
  const { type, inDuration, outDuration } = style.animation;
  const inMs = Math.round(inDuration * 1000);
  const outMs = Math.round(outDuration * 1000);

  switch (type) {
    case 'fade':
      return `{\\fad(${inMs},${outMs})}${text}`;

    case 'scale_pop':
      // Scale from 0 to 100 with overshoot
      return `{\\fad(0,${outMs})\\t(0,${inMs},\\fscx110\\fscy110)\\t(${inMs},${inMs + 100},\\fscx100\\fscy100)}${text}`;

    case 'bounce':
      // Bounce effect using position animation
      return `{\\fad(0,${outMs})\\move(540,-50,540,0,0,${inMs})}${text}`;

    case 'typewriter':
      // Typewriter effect - reveal character by character
      // Note: True typewriter needs per-character timing which is complex in ASS
      return `{\\fad(${inMs},${outMs})}${text}`;

    case 'karaoke':
      // Karaoke fill effect
      return `{\\k${Math.round(inDuration * 100)}}${text}`;

    case 'slide_up':
      return `{\\fad(0,${outMs})\\move(540,100,540,0,0,${inMs})}${text}`;

    case 'slide_down':
      return `{\\fad(0,${outMs})\\move(540,-100,540,0,0,${inMs})}${text}`;

    default:
      return `{\\fad(${inMs},${outMs})}${text}`;
  }
}

/**
 * Merge overlapping subtitles
 */
export function mergeOverlappingSubtitles(subtitles: SubtitleEntry[]): SubtitleEntry[] {
  if (subtitles.length <= 1) return subtitles;

  // Sort by start time
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  const merged: SubtitleEntry[] = [];

  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if overlapping (with small tolerance)
    if (next.start < current.end + 0.1) {
      // Merge: combine text and extend end time
      current = {
        ...current,
        text: current.text + '\n' + next.text,
        end: Math.max(current.end, next.end),
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Script line format expected by the render engine
 */
export interface RenderScriptLine {
  text: string;
  timing: number;   // Start time in seconds
  duration: number; // Display duration in seconds
}

/**
 * Script data format expected by the render engine
 */
export interface RenderScriptData {
  lines: RenderScriptLine[];
}

/**
 * Options for converting lyrics to render script
 */
export interface LyricsToRenderScriptOptions {
  /** Audio start time offset in the video (default: 0) */
  audioStartTime?: number;
  /** Video duration to clamp subtitles (optional) */
  videoDuration?: number;
  /** Maximum duration per subtitle line (default: 4s) */
  maxDuration?: number;
  /** Minimum duration per subtitle line (default: 0.5s) */
  minDuration?: number;
}

/**
 * Convert LyricsData to render script format
 * This bridges the lyrics system to the compose engine's script format
 *
 * @param lyrics - Extracted lyrics with timing
 * @param options - Conversion options
 * @returns Script data ready for the render engine
 */
export function lyricsToRenderScript(
  lyrics: LyricsData,
  options: LyricsToRenderScriptOptions = {}
): RenderScriptData {
  const {
    audioStartTime = 0,
    videoDuration,
    maxDuration = 4,
    minDuration = 0.5,
  } = options;

  // If instrumental or no segments, return empty script
  if (lyrics.isInstrumental || !lyrics.segments.length) {
    return { lines: [] };
  }

  const lines: RenderScriptLine[] = [];

  for (const segment of lyrics.segments) {
    // Calculate adjusted times with audio offset
    // Subtract audioStartTime because lyrics timestamps are relative to audio file start,
    // but video playback starts at audioStartTime into the audio
    // Example: audioStartTime=60, segment.start=65 → video time = 65-60 = 5
    const adjustedStart = segment.start - audioStartTime;
    const adjustedEnd = segment.end - audioStartTime;

    // Skip segments that start after video ends (if videoDuration provided)
    if (videoDuration && adjustedStart >= videoDuration) {
      continue;
    }

    // Skip segments that end before video starts
    if (adjustedEnd <= 0) {
      continue;
    }

    // Clamp times to video boundaries
    const clampedStart = Math.max(0, adjustedStart);
    const clampedEnd = videoDuration
      ? Math.min(videoDuration, adjustedEnd)
      : adjustedEnd;

    // Calculate duration
    let duration = clampedEnd - clampedStart;

    // Skip if duration is too short
    if (duration < minDuration) {
      continue;
    }

    // Cap duration if too long
    if (duration > maxDuration) {
      duration = maxDuration;
    }

    lines.push({
      text: segment.text.trim(),
      timing: clampedStart,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
    });
  }

  return { lines };
}

/**
 * Fetch lyrics from an audio asset and convert to render script
 * Convenience function for use in render APIs
 *
 * @param assetMetadata - Asset metadata containing lyrics
 * @param options - Conversion options
 * @returns Script data or null if no lyrics
 */
export function getScriptFromAssetLyrics(
  assetMetadata: Record<string, unknown> | null,
  options: LyricsToRenderScriptOptions = {}
): RenderScriptData | null {
  if (!assetMetadata) {
    return null;
  }

  const lyrics = assetMetadata.lyrics as LyricsData | undefined;
  if (!lyrics || lyrics.isInstrumental || !lyrics.segments?.length) {
    return null;
  }

  return lyricsToRenderScript(lyrics, options);
}
