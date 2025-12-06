/**
 * Prompt Loader Service
 * ====================
 * Loads agent prompts from database with caching and fallback support
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
