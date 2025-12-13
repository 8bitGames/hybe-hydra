import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import {
  composeVideoWithAudioModal,
  getMediaDurationFromModal,
  AudioComposeRequest,
} from "./compose/client";

// Environment flag to use Modal for FFmpeg operations
const USE_MODAL_FFMPEG = process.env.USE_MODAL_FFMPEG !== 'false'; // Default: true

export interface ComposeOptions {
  videoUrl: string;
  audioUrl: string;
  audioStartTime?: number; // Start time in audio file (seconds)
  audioVolume?: number; // 0.0 to 1.0
  fadeIn?: number; // Fade in duration (seconds)
  fadeOut?: number; // Fade out duration (seconds)
  mixOriginalAudio?: boolean; // Mix with original video audio
  originalAudioVolume?: number; // Original audio volume if mixing
  // Modal-specific options
  outputS3Bucket?: string; // S3 bucket for output (Modal mode)
  outputS3Key?: string; // S3 key for output (Modal mode)
}

export interface ComposeResult {
  success: boolean;
  outputPath?: string; // Local mode: local file path
  outputUrl?: string; // Modal mode: S3 URL
  duration?: number;
  error?: string;
}

/**
 * Download a file from URL to local temp directory
 */
async function downloadFile(url: string, filename: string): Promise<string> {
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, filename);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return filePath;
}

/**
 * Get video duration using ffprobe (local) or Modal
 * If a URL is provided, uses Modal. If a local path, uses local ffprobe.
 */
export async function getVideoDuration(videoPathOrUrl: string): Promise<number> {
  // Check if it's a URL (use Modal) or local path (use local ffprobe)
  if (videoPathOrUrl.startsWith('http://') || videoPathOrUrl.startsWith('https://')) {
    if (USE_MODAL_FFMPEG) {
      const result = await getMediaDurationFromModal(videoPathOrUrl, 'video');
      if (result.error) {
        throw new Error(result.error);
      }
      return result.duration;
    }
  }

  // Local ffprobe
  return getVideoDurationLocal(videoPathOrUrl);
}

/**
 * Get video duration using local ffprobe
 */
function getVideoDurationLocal(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Compose video with audio track
 * Uses Modal by default, falls back to local FFmpeg if USE_MODAL_FFMPEG=false
 */
export async function composeVideoWithAudio(
  options: ComposeOptions
): Promise<ComposeResult> {
  const {
    videoUrl,
    audioUrl,
    audioStartTime = 0,
    audioVolume = 1.0,
    fadeIn = 0,
    fadeOut = 0,
    mixOriginalAudio = false,
    originalAudioVolume = 0.3,
    outputS3Bucket,
    outputS3Key,
  } = options;

  // Use Modal for FFmpeg processing (production)
  if (USE_MODAL_FFMPEG) {
    return composeVideoWithAudioViaModal(options);
  }

  // Local FFmpeg processing (development fallback)
  return composeVideoWithAudioLocal(options);
}

/**
 * Compose video with audio using Modal (production)
 */
async function composeVideoWithAudioViaModal(
  options: ComposeOptions
): Promise<ComposeResult> {
  const {
    videoUrl,
    audioUrl,
    audioStartTime = 0,
    audioVolume = 1.0,
    fadeIn = 0,
    fadeOut = 0,
    mixOriginalAudio = false,
    originalAudioVolume = 0.3,
    outputS3Bucket = process.env.AWS_S3_BUCKET || 'hydra-assets-hybe',
    outputS3Key,
  } = options;

  const jobId = `compose-${uuidv4().slice(0, 8)}`;

  // Generate S3 key if not provided
  const s3Key = outputS3Key || `composed/${jobId}.mp4`;

  console.log(`[FFmpeg-Modal] Starting composition job: ${jobId}`);

  try {
    const request: AudioComposeRequest = {
      job_id: jobId,
      video_url: videoUrl,
      audio_url: audioUrl,
      audio_start_time: audioStartTime,
      audio_volume: audioVolume,
      fade_in: fadeIn,
      fade_out: fadeOut,
      mix_original_audio: mixOriginalAudio,
      original_audio_volume: originalAudioVolume,
      output_s3_bucket: outputS3Bucket,
      output_s3_key: s3Key,
    };

    const result = await composeVideoWithAudioModal({
      ...request,
      pollInterval: 2000,
      maxWaitTime: 300000, // 5 minutes
      onProgress: (status) => {
        console.log(`[FFmpeg-Modal] Job ${jobId}: ${status.status}`);
      },
    });

    if (result.status === 'completed' && result.output_url) {
      console.log(`[FFmpeg-Modal] Composition complete: ${result.output_url}`);
      return {
        success: true,
        outputUrl: result.output_url,
        duration: result.duration || undefined,
      };
    } else {
      console.error(`[FFmpeg-Modal] Composition failed: ${result.error}`);
      return {
        success: false,
        error: result.error || 'Composition failed',
      };
    }
  } catch (error) {
    console.error('[FFmpeg-Modal] Composition error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Compose video with audio using local FFmpeg (development fallback)
 */
async function composeVideoWithAudioLocal(
  options: ComposeOptions
): Promise<ComposeResult> {
  const {
    videoUrl,
    audioUrl,
    audioStartTime = 0,
    audioVolume = 1.0,
    fadeIn = 0,
    fadeOut = 0,
    mixOriginalAudio = false,
    originalAudioVolume = 0.3,
  } = options;

  const sessionId = uuidv4();
  const tempDir = os.tmpdir();

  try {
    // Download video and audio files
    console.log("Downloading video and audio files...");
    const videoPath = await downloadFile(videoUrl, `video_${sessionId}.mp4`);
    const audioPath = await downloadFile(audioUrl, `audio_${sessionId}.mp3`);
    const outputPath = path.join(tempDir, `output_${sessionId}.mp4`);

    // Get video duration for fade out calculation
    const videoDuration = await getVideoDurationLocal(videoPath);
    console.log(`Video duration: ${videoDuration}s`);

    return new Promise((resolve) => {
      let command = ffmpeg();

      // Add inputs
      command = command.input(videoPath).input(audioPath);

      // Build audio filter
      const audioFilters: string[] = [];

      // Trim audio if start time specified
      if (audioStartTime > 0) {
        audioFilters.push(`atrim=start=${audioStartTime}`);
        audioFilters.push("asetpts=PTS-STARTPTS");
      }

      // Apply volume
      if (audioVolume !== 1.0) {
        audioFilters.push(`volume=${audioVolume}`);
      }

      // Apply fade in
      if (fadeIn > 0) {
        audioFilters.push(`afade=t=in:st=0:d=${fadeIn}`);
      }

      // Apply fade out
      if (fadeOut > 0) {
        const fadeOutStart = videoDuration - fadeOut;
        audioFilters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOut}`);
      }

      // Trim audio to video duration
      audioFilters.push(`atrim=duration=${videoDuration}`);

      // Build complex filter for mixing or replacing audio
      let complexFilter: string;

      if (mixOriginalAudio) {
        // Mix original audio with new audio
        complexFilter = `[0:a]volume=${originalAudioVolume}[oa];[1:a]${audioFilters.join(",")}[na];[oa][na]amix=inputs=2:duration=first[aout]`;
      } else {
        // Replace original audio entirely
        complexFilter = `[1:a]${audioFilters.join(",")}[aout]`;
      }

      command
        .complexFilter(complexFilter)
        .outputOptions([
          "-map", "0:v", // Use video from first input
          "-map", "[aout]", // Use processed audio
          "-c:v", "copy", // Copy video codec (fast)
          "-c:a", "aac", // Encode audio as AAC
          "-b:a", "192k", // Audio bitrate
          "-shortest", // End when shortest stream ends
        ])
        .output(outputPath)
        .on("start", (cmd) => {
          console.log("FFmpeg command:", cmd);
        })
        .on("progress", (progress) => {
          console.log(`Processing: ${progress.percent?.toFixed(1)}%`);
        })
        .on("end", async () => {
          console.log("Composition complete!");

          // Clean up input files
          try {
            await fs.unlink(videoPath);
            await fs.unlink(audioPath);
          } catch (e) {
            console.warn("Failed to clean up temp files:", e);
          }

          resolve({
            success: true,
            outputPath,
            duration: videoDuration,
          });
        })
        .on("error", async (err) => {
          console.error("FFmpeg error:", err);

          // Clean up on error
          try {
            await fs.unlink(videoPath);
            await fs.unlink(audioPath);
            await fs.unlink(outputPath);
          } catch (e) {
            // Ignore cleanup errors
          }

          resolve({
            success: false,
            error: err.message,
          });
        })
        .run();
    });
  } catch (error) {
    console.error("Compose error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if FFmpeg is available
 */
export function checkFFmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err) => {
      if (err) {
        console.error("FFmpeg not available:", err);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Get audio duration using ffprobe (local) or Modal
 * If a URL is provided, uses Modal. If a local path, uses local ffprobe.
 */
export async function getAudioDuration(audioPathOrUrl: string): Promise<number> {
  // Check if it's a URL (use Modal) or local path (use local ffprobe)
  if (audioPathOrUrl.startsWith('http://') || audioPathOrUrl.startsWith('https://')) {
    if (USE_MODAL_FFMPEG) {
      const result = await getMediaDurationFromModal(audioPathOrUrl, 'audio');
      if (result.error) {
        throw new Error(result.error);
      }
      return result.duration;
    }
  }

  // Local ffprobe
  return getAudioDurationLocal(audioPathOrUrl);
}

/**
 * Get audio duration using local ffprobe
 */
function getAudioDurationLocal(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Extract audio from video
 */
export async function extractAudioFromVideo(
  videoUrl: string
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  const sessionId = uuidv4();
  const tempDir = os.tmpdir();

  try {
    const videoPath = await downloadFile(videoUrl, `video_${sessionId}.mp4`);
    const outputPath = path.join(tempDir, `audio_${sessionId}.mp3`);

    return new Promise((resolve) => {
      ffmpeg(videoPath)
        .outputOptions(["-vn", "-acodec", "libmp3lame", "-q:a", "2"])
        .output(outputPath)
        .on("end", async () => {
          try {
            await fs.unlink(videoPath);
          } catch (e) {
            // Ignore
          }
          resolve({ success: true, outputPath });
        })
        .on("error", async (err) => {
          try {
            await fs.unlink(videoPath);
          } catch (e) {
            // Ignore
          }
          resolve({ success: false, error: err.message });
        })
        .run();
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
