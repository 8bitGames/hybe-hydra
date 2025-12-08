/**
 * Prompt Loader Service
 * ====================
 * Loads agent prompts from database with caching and fallback support
 *
 * History Management:
 * - Tracks version history of prompt changes
 * - Supports rollback to previous versions
 * - Records change metadata (who, when, why)
 */

import { createClient } from '@/lib/supabase/server';

export interface DatabasePrompt {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  category: 'analyzer' | 'creator' | 'transformer' | 'publisher' | 'compose';
  system_prompt: string;
  templates: Record<string, string>;
  model_provider: 'gemini' | 'openai';
  model_name: string;
  model_options: Record<string, unknown>;
  is_active: boolean;
  version: number;
}

export interface PromptHistoryRecord {
  id: string;
  agent_prompt_id: string;
  version: number;
  system_prompt: string;
  templates: Record<string, string>;
  model_options: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
  change_notes: string | null;
}

// In-memory cache for prompts
const promptCache = new Map<string, { prompt: DatabasePrompt; loadedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load a prompt from the database by agent ID
 */
export async function loadPromptFromDatabase(
  agentId: string
): Promise<DatabasePrompt | null> {
  try {
    // Check cache first
    const cached = promptCache.get(agentId);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached.prompt;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('agent_prompts')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.warn(`[PromptLoader] Failed to load prompt for ${agentId}:`, error.message);
      return null;
    }

    // Update cache
    promptCache.set(agentId, { prompt: data, loadedAt: Date.now() });

    return data;
  } catch (error) {
    console.warn(`[PromptLoader] Error loading prompt for ${agentId}:`, error);
    return null;
  }
}

/**
 * Load all prompts for a category
 */
export async function loadPromptsByCategory(
  category: 'analyzer' | 'creator' | 'transformer' | 'publisher' | 'compose'
): Promise<DatabasePrompt[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('agent_prompts')
      .select('*')
      .eq('category', category)
      .eq('is_active', true);

    if (error) {
      console.warn(`[PromptLoader] Failed to load prompts for category ${category}:`, error.message);
      return [];
    }

    // Update cache for each prompt
    for (const prompt of data || []) {
      promptCache.set(prompt.agent_id, { prompt, loadedAt: Date.now() });
    }

    return data || [];
  } catch (error) {
    console.warn(`[PromptLoader] Error loading prompts for category ${category}:`, error);
    return [];
  }
}

/**
 * Clear cache for a specific agent or all agents
 */
export function clearPromptCache(agentId?: string): void {
  if (agentId) {
    promptCache.delete(agentId);
  } else {
    promptCache.clear();
  }
}

/**
 * Preload all active prompts into cache
 */
export async function preloadAllPrompts(): Promise<void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('agent_prompts')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.warn('[PromptLoader] Failed to preload prompts:', error.message);
      return;
    }

    const now = Date.now();
    for (const prompt of data || []) {
      promptCache.set(prompt.agent_id, { prompt, loadedAt: now });
    }

    console.log(`[PromptLoader] Preloaded ${data?.length || 0} prompts into cache`);
  } catch (error) {
    console.warn('[PromptLoader] Error preloading prompts:', error);
  }
}

// ============================================================================
// Prompt History Management
// ============================================================================

/**
 * Save a snapshot of the current prompt to history before updating
 * Call this BEFORE making changes to preserve the current state
 */
export async function savePromptHistory(
  agentPromptId: string,
  options?: {
    changedBy?: string;
    changeNotes?: string;
  }
): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Get the current prompt state
    const { data: currentPrompt, error: fetchError } = await supabase
      .from('agent_prompts')
      .select('id, version, system_prompt, templates, model_options')
      .eq('id', agentPromptId)
      .single();

    if (fetchError || !currentPrompt) {
      console.warn(`[PromptLoader] Failed to fetch prompt for history:`, fetchError?.message);
      return false;
    }

    // Save to history table
    const { error: insertError } = await supabase
      .from('agent_prompt_history')
      .insert({
        agent_prompt_id: agentPromptId,
        version: currentPrompt.version,
        system_prompt: currentPrompt.system_prompt,
        templates: currentPrompt.templates,
        model_options: currentPrompt.model_options,
        changed_by: options?.changedBy || null,
        change_notes: options?.changeNotes || null,
      });

    if (insertError) {
      console.warn(`[PromptLoader] Failed to save prompt history:`, insertError.message);
      return false;
    }

    console.log(`[PromptLoader] Saved history for prompt ${agentPromptId} v${currentPrompt.version}`);
    return true;
  } catch (error) {
    console.warn(`[PromptLoader] Error saving prompt history:`, error);
    return false;
  }
}

/**
 * Get the version history for an agent prompt
 */
export async function getPromptHistory(
  agentPromptId: string,
  limit: number = 10
): Promise<PromptHistoryRecord[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agent_prompt_history')
      .select('*')
      .eq('agent_prompt_id', agentPromptId)
      .order('version', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn(`[PromptLoader] Failed to get prompt history:`, error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.warn(`[PromptLoader] Error getting prompt history:`, error);
    return [];
  }
}

/**
 * Get a specific version from history
 */
export async function getPromptHistoryVersion(
  agentPromptId: string,
  version: number
): Promise<PromptHistoryRecord | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agent_prompt_history')
      .select('*')
      .eq('agent_prompt_id', agentPromptId)
      .eq('version', version)
      .single();

    if (error) {
      console.warn(`[PromptLoader] Failed to get history version:`, error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.warn(`[PromptLoader] Error getting history version:`, error);
    return null;
  }
}

/**
 * Rollback a prompt to a previous version
 * This saves the current state to history before rolling back
 */
export async function rollbackToVersion(
  agentPromptId: string,
  targetVersion: number,
  options?: {
    changedBy?: string;
    changeNotes?: string;
  }
): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Get the target version from history
    const targetState = await getPromptHistoryVersion(agentPromptId, targetVersion);
    if (!targetState) {
      console.warn(`[PromptLoader] Version ${targetVersion} not found in history`);
      return false;
    }

    // Save current state to history before rollback
    const savedHistory = await savePromptHistory(agentPromptId, {
      changedBy: options?.changedBy,
      changeNotes: options?.changeNotes || `Rollback to version ${targetVersion}`,
    });

    if (!savedHistory) {
      console.warn(`[PromptLoader] Failed to save current state before rollback`);
      return false;
    }

    // Get current version number to increment
    const { data: currentPrompt, error: fetchError } = await supabase
      .from('agent_prompts')
      .select('version')
      .eq('id', agentPromptId)
      .single();

    if (fetchError || !currentPrompt) {
      console.warn(`[PromptLoader] Failed to get current version:`, fetchError?.message);
      return false;
    }

    // Update the prompt with the target version's content
    const { error: updateError } = await supabase
      .from('agent_prompts')
      .update({
        system_prompt: targetState.system_prompt,
        templates: targetState.templates,
        model_options: targetState.model_options,
        version: currentPrompt.version + 1,
        updated_at: new Date().toISOString(),
        updated_by: options?.changedBy || null,
      })
      .eq('id', agentPromptId);

    if (updateError) {
      console.warn(`[PromptLoader] Failed to rollback prompt:`, updateError.message);
      return false;
    }

    // Clear cache for this agent
    const { data: agentData } = await supabase
      .from('agent_prompts')
      .select('agent_id')
      .eq('id', agentPromptId)
      .single();

    if (agentData?.agent_id) {
      clearPromptCache(agentData.agent_id);
    }

    console.log(`[PromptLoader] Rolled back ${agentPromptId} to version ${targetVersion}`);
    return true;
  } catch (error) {
    console.warn(`[PromptLoader] Error rolling back prompt:`, error);
    return false;
  }
}

/**
 * Update a prompt with automatic history tracking
 * Convenience function that saves history and updates the prompt
 */
export async function updatePromptWithHistory(
  agentPromptId: string,
  updates: {
    system_prompt?: string;
    templates?: Record<string, string>;
    model_options?: Record<string, unknown>;
  },
  options?: {
    changedBy?: string;
    changeNotes?: string;
  }
): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Save current state to history
    const savedHistory = await savePromptHistory(agentPromptId, options);
    if (!savedHistory) {
      console.warn(`[PromptLoader] Failed to save history before update`);
      // Continue with update even if history save fails
    }

    // Get current version
    const { data: currentPrompt, error: fetchError } = await supabase
      .from('agent_prompts')
      .select('version, agent_id')
      .eq('id', agentPromptId)
      .single();

    if (fetchError || !currentPrompt) {
      console.warn(`[PromptLoader] Failed to get current prompt:`, fetchError?.message);
      return false;
    }

    // Update the prompt
    const { error: updateError } = await supabase
      .from('agent_prompts')
      .update({
        ...updates,
        version: currentPrompt.version + 1,
        updated_at: new Date().toISOString(),
        updated_by: options?.changedBy || null,
      })
      .eq('id', agentPromptId);

    if (updateError) {
      console.warn(`[PromptLoader] Failed to update prompt:`, updateError.message);
      return false;
    }

    // Clear cache
    clearPromptCache(currentPrompt.agent_id);

    console.log(`[PromptLoader] Updated prompt ${agentPromptId} to v${currentPrompt.version + 1}`);
    return true;
  } catch (error) {
    console.warn(`[PromptLoader] Error updating prompt:`, error);
    return false;
  }
}
