/**
 * Agent Prompts Sync API
 * ======================
 * Synchronizes code prompts with database
 *
 * GET /api/v1/admin/prompts/sync - Scan for changes (dry-run)
 * POST /api/v1/admin/prompts/sync - Apply sync
 *
 * Query params:
 * - agent: specific agent ID to sync (optional)
 * - mode: 'scan' | 'sync' (default: 'scan' for GET, 'sync' for POST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

// Import all agent configs (same as seed)
import { VisionAnalyzerConfig } from '@/lib/agents/analyzers/vision-analyzer';
import { TextPatternConfig } from '@/lib/agents/analyzers/text-pattern';
import { VisualTrendConfig } from '@/lib/agents/analyzers/visual-trend';
import { StrategySynthesizerConfig } from '@/lib/agents/analyzers/strategy-synthesizer';
import { KeywordInsightsConfig } from '@/lib/agents/analyzers/keyword-insights';
import { TikTokVisionConfig } from '@/lib/agents/analyzers/tiktok-vision';
import { Veo3PersonalizeConfig } from '@/lib/agents/analyzers/veo3-personalize';
import { ExpansionAnalyzerConfig } from '@/lib/agents/analyzers/expansion-analyzer';
import { TrendInsightConfig } from '@/lib/agents/analyzers/trend-insight-agent';
import { LyricsExtractorConfig } from '@/lib/agents/analyzers/lyrics-extractor';
import { CreativeDirectorConfig } from '@/lib/agents/creators/creative-director';
import { ScriptWriterConfig } from '@/lib/agents/creators/script-writer';
import { FastCutIdeaConfig } from '@/lib/agents/creators/fast-cut-idea-agent';
import { VideoRecreationIdeaConfig } from '@/lib/agents/creators/video-recreation-idea-agent';
import { PromptEngineerConfig } from '@/lib/agents/transformers/prompt-engineer';
import { I2VSpecialistConfig } from '@/lib/agents/transformers/i2v-specialist';
import { PublishOptimizerConfig } from '@/lib/agents/publishers/publish-optimizer';
import { CopywriterConfig } from '@/lib/agents/publishers/copywriter';
import { FastCutScriptGeneratorConfig } from '@/lib/agents/fast-cut/script-generator';
import { FastCutEffectAnalyzerConfig } from '@/lib/agents/fast-cut/effect-analyzer';
import { FastCutConductorConfig } from '@/lib/agents/fast-cut/conductor';
import { ImageKeywordGeneratorConfig } from '@/lib/agents/fast-cut/image-keyword-generator';
import { VideoClassifierConfig } from '@/lib/agents/deep-analysis/video-classifier';
import { AccountMetricsConfig } from '@/lib/agents/deep-analysis/account-metrics';
import { ComparativeAnalysisConfig } from '@/lib/agents/deep-analysis/comparative-analysis';

// All agent configs
const AGENT_CONFIGS = [
  VisionAnalyzerConfig,
  TextPatternConfig,
  VisualTrendConfig,
  StrategySynthesizerConfig,
  KeywordInsightsConfig,
  TikTokVisionConfig,
  Veo3PersonalizeConfig,
  ExpansionAnalyzerConfig,
  TrendInsightConfig,
  LyricsExtractorConfig,
  CreativeDirectorConfig,
  ScriptWriterConfig,
  FastCutIdeaConfig,
  VideoRecreationIdeaConfig,
  PromptEngineerConfig,
  I2VSpecialistConfig,
  PublishOptimizerConfig,
  CopywriterConfig,
  FastCutScriptGeneratorConfig,
  FastCutEffectAnalyzerConfig,
  FastCutConductorConfig,
  ImageKeywordGeneratorConfig,
  VideoClassifierConfig,
  AccountMetricsConfig,
  ComparativeAnalysisConfig,
];

interface SyncResult {
  agentId: string;
  name: string;
  status: 'unchanged' | 'updated' | 'created' | 'error';
  changes?: {
    system_prompt: boolean;
    templates: boolean;
    model_options: boolean;
  };
  oldVersion?: number;
  newVersion?: number;
  error?: string;
}

/**
 * Generate hash for prompt comparison
 */
function hashPrompt(systemPrompt: string, templates: Record<string, string>): string {
  const content = JSON.stringify({ systemPrompt, templates });
  return createHash('md5').update(content).digest('hex');
}

/**
 * Compare code config with DB prompt
 */
function comparePrompts(
  codeConfig: typeof AGENT_CONFIGS[0],
  dbPrompt: {
    system_prompt: string;
    templates: Record<string, string>;
    model_options: Record<string, unknown>;
  } | null
): { hasChanges: boolean; changes: SyncResult['changes'] } {
  if (!dbPrompt) {
    return {
      hasChanges: true,
      changes: { system_prompt: true, templates: true, model_options: true },
    };
  }

  const codeHash = hashPrompt(codeConfig.prompts.system, codeConfig.prompts.templates);
  const dbHash = hashPrompt(dbPrompt.system_prompt, dbPrompt.templates);

  const systemChanged = codeConfig.prompts.system !== dbPrompt.system_prompt;
  const templatesChanged = JSON.stringify(codeConfig.prompts.templates) !== JSON.stringify(dbPrompt.templates);
  const optionsChanged = JSON.stringify(codeConfig.model.options || {}) !== JSON.stringify(dbPrompt.model_options || {});

  return {
    hasChanges: codeHash !== dbHash || optionsChanged,
    changes: {
      system_prompt: systemChanged,
      templates: templatesChanged,
      model_options: optionsChanged,
    },
  };
}

/**
 * GET - Scan for changes (dry-run)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const targetAgent = searchParams.get('agent');

    const configs = targetAgent
      ? AGENT_CONFIGS.filter(c => c.id === targetAgent)
      : AGENT_CONFIGS;

    if (targetAgent && configs.length === 0) {
      return NextResponse.json({ error: `Agent '${targetAgent}' not found` }, { status: 404 });
    }

    const results: SyncResult[] = [];
    let changedCount = 0;
    let newCount = 0;

    for (const config of configs) {
      // Get DB prompt
      const { data: dbPrompt } = await supabase
        .from('agent_prompts')
        .select('id, system_prompt, templates, model_options, version')
        .eq('agent_id', config.id)
        .single();

      const { hasChanges, changes } = comparePrompts(config, dbPrompt);

      if (!dbPrompt) {
        newCount++;
        results.push({
          agentId: config.id,
          name: config.name,
          status: 'created',
          changes,
        });
      } else if (hasChanges) {
        changedCount++;
        results.push({
          agentId: config.id,
          name: config.name,
          status: 'updated',
          changes,
          oldVersion: dbPrompt.version,
          newVersion: dbPrompt.version + 1,
        });
      } else {
        results.push({
          agentId: config.id,
          name: config.name,
          status: 'unchanged',
          oldVersion: dbPrompt.version,
        });
      }
    }

    return NextResponse.json({
      mode: 'scan',
      summary: {
        total: configs.length,
        unchanged: configs.length - changedCount - newCount,
        changed: changedCount,
        new: newCount,
      },
      results,
    });
  } catch (error) {
    console.error('[Prompts Sync] Scan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Apply sync
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const targetAgent = searchParams.get('agent');
    const mode = searchParams.get('mode') || 'sync';

    // If mode=scan, redirect to GET behavior
    if (mode === 'scan') {
      return GET(request);
    }

    const configs = targetAgent
      ? AGENT_CONFIGS.filter(c => c.id === targetAgent)
      : AGENT_CONFIGS;

    if (targetAgent && configs.length === 0) {
      return NextResponse.json({ error: `Agent '${targetAgent}' not found` }, { status: 404 });
    }

    const results: SyncResult[] = [];

    for (const config of configs) {
      try {
        // Get existing DB prompt
        const { data: dbPrompt } = await supabase
          .from('agent_prompts')
          .select('id, system_prompt, templates, model_options, version')
          .eq('agent_id', config.id)
          .single();

        const { hasChanges, changes } = comparePrompts(config, dbPrompt);

        if (!dbPrompt) {
          // Create new prompt
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
            results.push({
              agentId: config.id,
              name: config.name,
              status: 'error',
              error: error.message,
            });
          } else {
            results.push({
              agentId: config.id,
              name: config.name,
              status: 'created',
              changes,
              newVersion: 1,
            });
          }
        } else if (hasChanges) {
          // Save to history first
          await supabase.from('agent_prompt_history').insert({
            agent_prompt_id: dbPrompt.id,
            version: dbPrompt.version,
            system_prompt: dbPrompt.system_prompt,
            templates: dbPrompt.templates,
            model_options: dbPrompt.model_options,
            changed_by: 'sync-api',
            change_notes: 'Auto-sync from code',
          });

          // Update prompt
          const { error } = await supabase
            .from('agent_prompts')
            .update({
              system_prompt: config.prompts.system,
              templates: config.prompts.templates,
              model_options: config.model.options || {},
              version: dbPrompt.version + 1,
              updated_at: new Date().toISOString(),
              updated_by: 'sync-api',
            })
            .eq('id', dbPrompt.id);

          if (error) {
            results.push({
              agentId: config.id,
              name: config.name,
              status: 'error',
              error: error.message,
            });
          } else {
            results.push({
              agentId: config.id,
              name: config.name,
              status: 'updated',
              changes,
              oldVersion: dbPrompt.version,
              newVersion: dbPrompt.version + 1,
            });
          }
        } else {
          results.push({
            agentId: config.id,
            name: config.name,
            status: 'unchanged',
            oldVersion: dbPrompt.version,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          agentId: config.id,
          name: config.name,
          status: 'error',
          error: message,
        });
      }
    }

    const summary = {
      total: results.length,
      unchanged: results.filter(r => r.status === 'unchanged').length,
      updated: results.filter(r => r.status === 'updated').length,
      created: results.filter(r => r.status === 'created').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    return NextResponse.json({
      mode: 'sync',
      success: summary.errors === 0,
      summary,
      results,
    });
  } catch (error) {
    console.error('[Prompts Sync] Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
