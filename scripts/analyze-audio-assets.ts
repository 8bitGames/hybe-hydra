/**
 * Analyze all audio assets without metadata
 * Run with: npx tsx scripts/analyze-audio-assets.ts
 * Check mode: npx tsx scripts/analyze-audio-assets.ts --check
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

interface AudioAnalysisResult {
  bpm: number;
  duration: number;
  suggested_vibe?: string;
}

async function analyzeAudioFile(s3Url: string, jobId: string): Promise<AudioAnalysisResult | null> {
  const composeUrl = process.env.MODAL_COMPOSE_URL || process.env.LOCAL_COMPOSE_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${composeUrl}/audio/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: s3Url, job_id: jobId })
    });

    if (!response.ok) {
      console.error(`Analysis failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      bpm: data.bpm,
      duration: data.duration,
      suggested_vibe: data.suggested_vibe
    };
  } catch (error) {
    console.error('Analysis error:', error);
    return null;
  }
}

async function main() {
  const checkOnly = process.argv.includes('--check');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Find audio assets
    const audioAssets = await prisma.asset.findMany({
      where: {
        type: 'AUDIO'
      },
      select: {
        id: true,
        filename: true,
        originalFilename: true,
        s3Url: true,
        metadata: true
      }
    });

    console.log(`Found ${audioAssets.length} audio assets\n`);

    if (checkOnly) {
      // Just show current metadata
      for (const asset of audioAssets) {
        const metadata = asset.metadata as Record<string, unknown> | null;
        console.log(`${asset.originalFilename || asset.filename}`);
        if (metadata?.bpm) {
          console.log(`  BPM: ${metadata.bpm}, Duration: ${Math.round(metadata.duration as number || 0)}s, Vibe: ${metadata.vibe || 'N/A'}`);
        } else {
          console.log(`  No metadata`);
        }
      }
      return;
    }

    // Filter to only those without metadata
    const assetsToAnalyze = audioAssets.filter(asset => {
      const metadata = asset.metadata as Record<string, unknown> | null;
      return !metadata || !metadata.bpm;
    });

    console.log(`${assetsToAnalyze.length} assets need analysis`);

    let analyzed = 0;
    let failed = 0;

    for (const asset of assetsToAnalyze) {
      console.log(`\nAnalyzing: ${asset.originalFilename || asset.filename}`);

      const analysisResult = await analyzeAudioFile(asset.s3Url, `migrate-${asset.id}`);

      if (analysisResult) {
        const updatedMetadata = {
          ...(asset.metadata as Record<string, unknown> || {}),
          bpm: analysisResult.bpm,
          audioBpm: analysisResult.bpm,
          duration: analysisResult.duration,
          audioDurationSec: analysisResult.duration,
          vibe: analysisResult.suggested_vibe,
          audioVibe: analysisResult.suggested_vibe,
          analyzed: true,
          analyzedAt: new Date().toISOString()
        };

        await prisma.asset.update({
          where: { id: asset.id },
          data: { metadata: updatedMetadata }
        });

        console.log(`  ✓ BPM: ${analysisResult.bpm}, Duration: ${Math.round(analysisResult.duration)}s, Vibe: ${analysisResult.suggested_vibe}`);
        analyzed++;
      } else {
        console.log(`  ✗ Analysis failed`);
        failed++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total: ${assetsToAnalyze.length}`);
    console.log(`Analyzed: ${analyzed}`);
    console.log(`Failed: ${failed}`);

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
