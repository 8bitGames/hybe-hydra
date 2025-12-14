/**
 * Agent Prompts Seed API
 * ======================
 * Seeds the database with all hardcoded agent prompts
 *
 * POST /api/v1/admin/prompts/seed - Insert all agent prompts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Import all agent configs
// Analyzers
import { VisionAnalyzerConfig } from '@/lib/agents/analyzers/vision-analyzer';
import { TextPatternConfig } from '@/lib/agents/analyzers/text-pattern';
import { VisualTrendConfig } from '@/lib/agents/analyzers/visual-trend';
import { StrategySynthesizerConfig } from '@/lib/agents/analyzers/strategy-synthesizer';
import { KeywordInsightsConfig } from '@/lib/agents/analyzers/keyword-insights';
import { TikTokVisionConfig } from '@/lib/agents/analyzers/tiktok-vision';
import { Veo3PersonalizeConfig } from '@/lib/agents/analyzers/veo3-personalize';
import { ExpansionAnalyzerConfig } from '@/lib/agents/analyzers/expansion-analyzer';
import { TrendInsightConfig } from '@/lib/agents/analyzers/trend-insight-agent';
// Creators
import { CreativeDirectorConfig } from '@/lib/agents/creators/creative-director';
import { ScriptWriterConfig } from '@/lib/agents/creators/script-writer';
import { FastCutIdeaConfig } from '@/lib/agents/creators/fast-cut-idea-agent';
import { VideoRecreationIdeaConfig } from '@/lib/agents/creators/video-recreation-idea-agent';
// Transformers
import { PromptEngineerConfig } from '@/lib/agents/transformers/prompt-engineer';
import { I2VSpecialistConfig } from '@/lib/agents/transformers/i2v-specialist';
// Publishers
import { PublishOptimizerConfig } from '@/lib/agents/publishers/publish-optimizer';
import { CopywriterConfig } from '@/lib/agents/publishers/copywriter';
// Fast Cut agents
import { FastCutScriptGeneratorConfig } from '@/lib/agents/fast-cut/script-generator';
import { FastCutEffectAnalyzerConfig } from '@/lib/agents/fast-cut/effect-analyzer';
import { FastCutConductorConfig } from '@/lib/agents/fast-cut/conductor';
import { ImageKeywordGeneratorConfig } from '@/lib/agents/fast-cut/image-keyword-generator';
// Deep Analysis agents
import { VideoClassifierConfig } from '@/lib/agents/deep-analysis/video-classifier';
import { AccountMetricsConfig } from '@/lib/agents/deep-analysis/account-metrics';
import { ComparativeAnalysisConfig } from '@/lib/agents/deep-analysis/comparative-analysis';

// All agent configs to seed
const AGENT_CONFIGS = [
  // Analyzers (9)
  VisionAnalyzerConfig,
  TextPatternConfig,
  VisualTrendConfig,
  StrategySynthesizerConfig,
  KeywordInsightsConfig,
  TikTokVisionConfig,
  Veo3PersonalizeConfig,
  ExpansionAnalyzerConfig,
  TrendInsightConfig,
  // Creators (4)
  CreativeDirectorConfig,
  ScriptWriterConfig,
  FastCutIdeaConfig,
  VideoRecreationIdeaConfig,
  // Transformers (2)
  PromptEngineerConfig,
  I2VSpecialistConfig,
  // Publishers (2)
  PublishOptimizerConfig,
  CopywriterConfig,
  // Fast Cut (4)
  FastCutScriptGeneratorConfig,
  FastCutEffectAnalyzerConfig,
  FastCutConductorConfig,
  ImageKeywordGeneratorConfig,
  // Deep Analysis (3)
  VideoClassifierConfig,
  AccountMetricsConfig,
  ComparativeAnalysisConfig,
];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const results = {
      inserted: [] as string[],
      skipped: [] as string[],
      errors: [] as string[],
    };

    for (const config of AGENT_CONFIGS) {
      try {
        // Check if already exists
        const { data: existing } = await supabase
          .from('agent_prompts')
          .select('id')
          .eq('agent_id', config.id)
          .single();

        if (existing && !force) {
          results.skipped.push(config.id);
          continue;
        }

        // Delete existing if force mode
        if (existing && force) {
          await supabase
            .from('agent_prompts')
            .delete()
            .eq('agent_id', config.id);
        }

        // Insert new prompt
        const { error } = await supabase
          .from('agent_prompts')
          .insert({
            agent_id: config.id,
            name: config.name,
            description: config.description,
            category: config.category,
            system_prompt: config.prompts.system,
            templates: config.prompts.templates,
            model_provider: config.model.provider,
            model_name: config.model.name,
            model_options: config.model.options || {},
            is_active: true,
            version: 1,
          });

        if (error) {
          results.errors.push(`${config.id}: ${error.message}`);
        } else {
          results.inserted.push(config.id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${config.id}: ${message}`);
      }
    }

    return NextResponse.json({
      success: results.errors.length === 0,
      message: `Inserted: ${results.inserted.length}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`,
      results,
    });
  } catch (error) {
    console.error('[Prompts Seed] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
