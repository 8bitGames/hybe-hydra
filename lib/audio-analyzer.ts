/**
 * Audio Analysis Service
 * Analyzes audio tracks to extract BPM, energy curves, and optimal segments
 * for syncing with generated videos
 */

import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { v4 as uuidv4 } from "uuid";

export interface AudioSegment {
  start: number;      // Start time in seconds
  end: number;        // End time in seconds
  energy: number;     // Average energy level (0-1)
  type: "intro" | "verse" | "chorus" | "bridge" | "outro" | "unknown";
}

export interface AudioAnalysis {
  duration: number;           // Total duration in seconds
  bpm: number;                // Estimated BPM
  energy_curve: number[];     // Energy values at each second
  peak_energy: number;        // Maximum energy value
  avg_energy: number;         // Average energy value
  segments: AudioSegment[];   // Detected segments
  best_15s_start: number;     // Recommended start time for 15s clip
  best_15s_energy: number;    // Energy of the recommended clip
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
 * Get audio metadata using ffprobe
 */
export function getAudioMetadata(audioPath: string): Promise<{
  duration: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const audioStream = metadata.streams.find(s => s.codec_type === "audio");

      resolve({
        duration: metadata.format.duration || 0,
        sampleRate: audioStream?.sample_rate ? parseInt(String(audioStream.sample_rate)) : 44100,
        channels: audioStream?.channels || 2,
        bitrate: metadata.format.bit_rate ? parseInt(String(metadata.format.bit_rate)) : 128000,
      });
    });
  });
}

/**
 * Extract energy levels from audio using ffmpeg's volumedetect and astats
 * This provides a simplified but effective energy curve analysis
 */
async function extractEnergyLevels(audioPath: string, duration: number): Promise<number[]> {
  const energyLevels: number[] = [];
  const segmentDuration = 1; // Analyze every 1 second

  for (let startTime = 0; startTime < duration; startTime += segmentDuration) {
    try {
      const energy = await getSegmentEnergy(audioPath, startTime, Math.min(segmentDuration, duration - startTime));
      energyLevels.push(energy);
    } catch {
      energyLevels.push(0);
    }
  }

  return energyLevels;
}

/**
 * Get energy level for a specific segment of audio
 */
function getSegmentEnergy(audioPath: string, startTime: number, duration: number): Promise<number> {
  return new Promise((resolve) => {
    let meanVolume = -60; // Default very quiet

    ffmpeg(audioPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .audioFilters("volumedetect")
      .format("null")
      .output("-")
      .on("stderr", (line: string) => {
        // Parse mean_volume from ffmpeg output
        const match = line.match(/mean_volume:\s*([-\d.]+)\s*dB/);
        if (match) {
          meanVolume = parseFloat(match[1]);
        }
      })
      .on("end", () => {
        // Convert dB to normalized 0-1 scale
        // Typical range: -60dB (silence) to 0dB (max)
        const normalized = Math.max(0, Math.min(1, (meanVolume + 60) / 60));
        resolve(normalized);
      })
      .on("error", () => {
        resolve(0);
      })
      .run();
  });
}

/**
 * Estimate BPM from audio using beat detection heuristics
 * This is a simplified approach - for production, consider using a dedicated beat detection library
 */
async function estimateBPM(audioPath: string, duration: number): Promise<number> {
  // For now, use a simple approach based on energy fluctuations
  // In production, we'd want to use a proper beat detection algorithm

  // Analyze the first 30 seconds for BPM estimation
  const analysisLength = Math.min(30, duration);
  const sampleRate = 10; // Samples per second
  const energyValues: number[] = [];

  for (let t = 0; t < analysisLength; t += 1/sampleRate) {
    try {
      const energy = await getSegmentEnergy(audioPath, t, 0.1);
      energyValues.push(energy);
    } catch {
      energyValues.push(0);
    }
  }

  // Count peaks (simplified beat detection)
  let peakCount = 0;
  const threshold = energyValues.reduce((a, b) => a + b, 0) / energyValues.length * 1.2;

  for (let i = 1; i < energyValues.length - 1; i++) {
    if (energyValues[i] > threshold &&
        energyValues[i] > energyValues[i-1] &&
        energyValues[i] > energyValues[i+1]) {
      peakCount++;
    }
  }

  // Calculate BPM from peak count
  const bpm = (peakCount / analysisLength) * 60;

  // Clamp to reasonable BPM range and round to common values
  const clampedBpm = Math.max(60, Math.min(200, bpm));
  return Math.round(clampedBpm);
}

/**
 * Detect audio segments based on energy changes
 */
function detectSegments(energyCurve: number[], duration: number): AudioSegment[] {
  const segments: AudioSegment[] = [];
  const windowSize = 4; // 4 second windows for segment detection

  let currentSegmentStart = 0;
  let currentEnergy = 0;
  let sampleCount = 0;

  for (let i = 0; i < energyCurve.length; i++) {
    currentEnergy += energyCurve[i];
    sampleCount++;

    if (sampleCount >= windowSize || i === energyCurve.length - 1) {
      const avgEnergy = currentEnergy / sampleCount;
      const segmentEnd = Math.min(i + 1, duration);

      // Classify segment type based on energy level
      let type: AudioSegment["type"] = "unknown";
      if (currentSegmentStart === 0 && avgEnergy < 0.4) {
        type = "intro";
      } else if (segmentEnd >= duration - 4 && avgEnergy < 0.4) {
        type = "outro";
      } else if (avgEnergy > 0.7) {
        type = "chorus";
      } else if (avgEnergy > 0.4) {
        type = "verse";
      } else {
        type = "bridge";
      }

      segments.push({
        start: currentSegmentStart,
        end: segmentEnd,
        energy: avgEnergy,
        type,
      });

      currentSegmentStart = segmentEnd;
      currentEnergy = 0;
      sampleCount = 0;
    }
  }

  return segments;
}

/**
 * Find the best 15-second segment for video overlay
 * Prioritizes high-energy sections (chorus/drop areas)
 */
function findBest15SecondSegment(
  energyCurve: number[],
  duration: number,
  targetDuration: number = 15
): { start: number; energy: number } {
  if (duration <= targetDuration) {
    // Audio is shorter than target, use from beginning
    const avgEnergy = energyCurve.reduce((a, b) => a + b, 0) / energyCurve.length;
    return { start: 0, energy: avgEnergy };
  }

  let bestStart = 0;
  let bestEnergy = 0;

  // Slide through audio to find highest energy 15-second window
  for (let start = 0; start <= duration - targetDuration; start++) {
    const endIdx = Math.min(start + targetDuration, energyCurve.length);
    const windowEnergy = energyCurve.slice(start, endIdx);
    const avgEnergy = windowEnergy.reduce((a, b) => a + b, 0) / windowEnergy.length;

    if (avgEnergy > bestEnergy) {
      bestEnergy = avgEnergy;
      bestStart = start;
    }
  }

  return { start: bestStart, energy: bestEnergy };
}

/**
 * Analyze an audio file and return comprehensive analysis
 */
export async function analyzeAudio(audioUrl: string): Promise<AudioAnalysis> {
  const sessionId = uuidv4();
  const tempAudioPath = await downloadFile(audioUrl, `audio_${sessionId}.mp3`);

  try {
    console.log("[AudioAnalyzer] Getting audio metadata...");
    const metadata = await getAudioMetadata(tempAudioPath);
    const duration = metadata.duration;

    console.log(`[AudioAnalyzer] Duration: ${duration}s, extracting energy levels...`);
    const energyCurve = await extractEnergyLevels(tempAudioPath, duration);

    console.log("[AudioAnalyzer] Estimating BPM...");
    const bpm = await estimateBPM(tempAudioPath, duration);

    console.log("[AudioAnalyzer] Detecting segments...");
    const segments = detectSegments(energyCurve, duration);

    console.log("[AudioAnalyzer] Finding best 15-second segment...");
    const best15s = findBest15SecondSegment(energyCurve, duration, 15);

    const peakEnergy = Math.max(...energyCurve);
    const avgEnergy = energyCurve.reduce((a, b) => a + b, 0) / energyCurve.length;

    const analysis: AudioAnalysis = {
      duration,
      bpm,
      energy_curve: energyCurve,
      peak_energy: peakEnergy,
      avg_energy: avgEnergy,
      segments,
      best_15s_start: best15s.start,
      best_15s_energy: best15s.energy,
    };

    console.log("[AudioAnalyzer] Analysis complete:", {
      duration,
      bpm,
      segments: segments.length,
      best_15s_start: best15s.start,
    });

    return analysis;
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempAudioPath);
    } catch (e) {
      console.warn("[AudioAnalyzer] Failed to clean up temp file:", e);
    }
  }
}

/**
 * Find optimal audio segment based on video characteristics
 * This matches video energy/pace with audio energy
 */
export function findOptimalAudioSegment(
  audioAnalysis: AudioAnalysis,
  videoDuration: number,
  videoEnergyHint?: "low" | "medium" | "high"
): { start: number; duration: number; energy: number } {
  const targetDuration = Math.min(15, videoDuration, audioAnalysis.duration);

  if (audioAnalysis.duration <= targetDuration) {
    return {
      start: 0,
      duration: audioAnalysis.duration,
      energy: audioAnalysis.avg_energy,
    };
  }

  // If video energy hint is provided, try to match
  if (videoEnergyHint) {
    const targetEnergyRange = {
      low: [0, 0.4],
      medium: [0.3, 0.7],
      high: [0.6, 1.0],
    }[videoEnergyHint];

    // Find segments matching the energy hint
    const matchingSegments = audioAnalysis.segments.filter(
      seg => seg.energy >= targetEnergyRange[0] && seg.energy <= targetEnergyRange[1]
    );

    if (matchingSegments.length > 0) {
      // Find the best matching segment that's long enough
      const bestSegment = matchingSegments.reduce((best, seg) =>
        (seg.end - seg.start) > (best.end - best.start) ? seg : best
      );

      return {
        start: bestSegment.start,
        duration: Math.min(targetDuration, bestSegment.end - bestSegment.start),
        energy: bestSegment.energy,
      };
    }
  }

  // Default: use the pre-computed best 15-second segment
  return {
    start: audioAnalysis.best_15s_start,
    duration: targetDuration,
    energy: audioAnalysis.best_15s_energy,
  };
}
