/**
 * Video-Audio Composer Service
 * Orchestrates the full flow of analyzing audio, analyzing video,
 * and composing them together with optimal sync
 */

import { analyzeAudio, AudioAnalysis, findOptimalAudioSegment } from "./audio-analyzer";
import { composeVideoWithAudio, getVideoDuration, ComposeResult } from "./ffmpeg";
import { uploadToS3, generateS3Key } from "./storage";
import fs from "fs/promises";

export interface CompositionOptions {
  videoUrl: string;
  audioUrl: string;
  campaignId: string;
  audioAnalysis?: AudioAnalysis;  // Pre-computed analysis (optional)
  maxAudioDuration?: number;      // Max audio duration to use (default: 15s)
  fadeIn?: number;                // Audio fade in duration
  fadeOut?: number;               // Audio fade out duration
  audioVolume?: number;           // Audio volume (0.0 - 1.0)
}

export interface CompositionResult {
  success: boolean;
  composedUrl?: string;           // URL of the composed video
  audioStartTime?: number;        // Start time in audio that was used
  audioDuration?: number;         // Duration of audio used
  audioAnalysis?: AudioAnalysis;  // Audio analysis data
  error?: string;
}

/**
 * Compose video with audio track
 * Automatically analyzes audio to find optimal segment and composes
 */
export async function composeWithOptimalAudio(
  options: CompositionOptions
): Promise<CompositionResult> {
  const {
    videoUrl,
    audioUrl,
    campaignId,
    maxAudioDuration = 15,
    fadeIn = 0.5,
    fadeOut = 1.0,
    audioVolume = 1.0,
  } = options;

  try {
    console.log("[Composer] Starting video-audio composition...");

    // Step 1: Analyze audio (or use pre-computed analysis)
    let audioAnalysis = options.audioAnalysis;
    if (!audioAnalysis) {
      console.log("[Composer] Analyzing audio...");
      audioAnalysis = await analyzeAudio(audioUrl);
    }

    // Step 2: Get video duration for sync calculation
    console.log("[Composer] Getting video duration...");
    // We need to download video temporarily to get duration
    const tempVideoPath = await downloadTempFile(videoUrl, "temp_video.mp4");
    const videoDuration = await getVideoDuration(tempVideoPath);
    await fs.unlink(tempVideoPath).catch(() => {});

    console.log(`[Composer] Video duration: ${videoDuration}s`);

    // Step 3: Find optimal audio segment
    // Determine video energy hint based on prompt or default to medium
    const videoEnergyHint: "low" | "medium" | "high" = "medium";

    const optimalSegment = findOptimalAudioSegment(
      audioAnalysis,
      videoDuration,
      videoEnergyHint
    );

    console.log(`[Composer] Optimal audio segment: start=${optimalSegment.start}s, duration=${optimalSegment.duration}s, energy=${optimalSegment.energy.toFixed(2)}`);

    // Step 4: Compose video with audio
    const actualAudioDuration = Math.min(maxAudioDuration, optimalSegment.duration, videoDuration);

    console.log("[Composer] Composing video with audio...");
    const composeResult = await composeVideoWithAudio({
      videoUrl,
      audioUrl,
      audioStartTime: optimalSegment.start,
      audioVolume,
      fadeIn,
      fadeOut,
      mixOriginalAudio: false, // Replace original audio entirely
    });

    if (!composeResult.success || !composeResult.outputPath) {
      return {
        success: false,
        error: composeResult.error || "Composition failed",
        audioAnalysis,
      };
    }

    // Step 5: Upload composed video to S3
    console.log("[Composer] Uploading composed video to S3...");
    const composedBuffer = await fs.readFile(composeResult.outputPath);
    const s3Key = generateS3Key(campaignId, "composed_video.mp4");
    const composedUrl = await uploadToS3(composedBuffer, s3Key, "video/mp4");

    // Clean up temp file
    await fs.unlink(composeResult.outputPath).catch(() => {});

    console.log(`[Composer] Composition complete: ${composedUrl}`);

    return {
      success: true,
      composedUrl,
      audioStartTime: optimalSegment.start,
      audioDuration: actualAudioDuration,
      audioAnalysis,
    };
  } catch (error) {
    console.error("[Composer] Composition error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download file to temp directory
 */
async function downloadTempFile(url: string, filename: string): Promise<string> {
  const os = await import("os");
  const path = await import("path");

  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, `${Date.now()}_${filename}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return filePath;
}

/**
 * Pre-analyze audio for caching/display
 * This can be called when audio is uploaded to store analysis in asset metadata
 */
export async function preAnalyzeAudio(audioUrl: string): Promise<AudioAnalysis> {
  return analyzeAudio(audioUrl);
}

/**
 * Simple composition without analysis (use full audio from start)
 * For cases where manual audio start time is specified
 */
export async function composeWithManualTiming(options: {
  videoUrl: string;
  audioUrl: string;
  campaignId: string;
  audioStartTime: number;
  audioDuration: number;
  fadeIn?: number;
  fadeOut?: number;
  audioVolume?: number;
}): Promise<CompositionResult> {
  const {
    videoUrl,
    audioUrl,
    campaignId,
    audioStartTime,
    audioDuration,
    fadeIn = 0.5,
    fadeOut = 1.0,
    audioVolume = 1.0,
  } = options;

  try {
    console.log("[Composer] Composing with manual timing...");

    const composeResult = await composeVideoWithAudio({
      videoUrl,
      audioUrl,
      audioStartTime,
      audioVolume,
      fadeIn,
      fadeOut,
      mixOriginalAudio: false,
    });

    if (!composeResult.success || !composeResult.outputPath) {
      return {
        success: false,
        error: composeResult.error || "Composition failed",
      };
    }

    // Upload to S3
    const composedBuffer = await fs.readFile(composeResult.outputPath);
    const s3Key = generateS3Key(campaignId, "composed_video.mp4");
    const composedUrl = await uploadToS3(composedBuffer, s3Key, "video/mp4");

    await fs.unlink(composeResult.outputPath).catch(() => {});

    return {
      success: true,
      composedUrl,
      audioStartTime,
      audioDuration,
    };
  } catch (error) {
    console.error("[Composer] Manual composition error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
