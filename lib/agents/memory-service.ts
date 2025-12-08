/**
 * Agent Memory Service
 * ====================
 * Provides persistent memory for agents across sessions
 *
 * Features:
 * - Store and retrieve agent memories
 * - Memory importance scoring
 * - TTL-based expiration
 * - Memory consolidation and cleanup
 */

import { createClient } from '@/lib/supabase/server';
import type { AgentMemory, MemoryType, MemoryQuery, MemoryUpdate } from './types';

// ============================================================================
// Types
// ============================================================================

export interface MemoryRecord {
  id: string;
  agent_id: string;
  campaign_id: string | null;
  artist_name: string | null;
  memory_type: MemoryType;
  key: string;
  value: Record<string, unknown>;
  importance: number;
  access_count: number;
  last_accessed_at: string;
  created_at: string;
  expires_at: string | null;
}

// ============================================================================
// Memory Service
// ============================================================================

/**
 * Store a memory for an agent
 */
export async function storeMemory(
  agentId: string,
  memory: MemoryUpdate,
  options?: {
    campaignId?: string;
    artistName?: string;
  }
): Promise<string | null> {
  try {
    const supabase = await createClient();

    // Check if memory already exists
    const existingQuery = supabase
      .from('agent_memories')
      .select('id, access_count')
      .eq('agent_id', agentId)
      .eq('key', memory.key);

    if (options?.campaignId) {
      existingQuery.eq('campaign_id', options.campaignId);
    } else {
      existingQuery.is('campaign_id', null);
    }

    const { data: existing } = await existingQuery.single();

    if (existing) {
      // Update existing memory
      const { error } = await supabase
        .from('agent_memories')
        .update({
          value: memory.value,
          importance: memory.importance ?? 0.5,
          memory_type: memory.memoryType,
          last_accessed_at: new Date().toISOString(),
          access_count: existing.access_count + 1,
          expires_at: memory.ttlSeconds
            ? new Date(Date.now() + memory.ttlSeconds * 1000).toISOString()
            : null,
        })
        .eq('id', existing.id);

      if (error) {
        console.warn(`[MemoryService] Failed to update memory:`, error.message);
        return null;
      }

      return existing.id;
    }

    // Insert new memory
    const { data, error } = await supabase
      .from('agent_memories')
      .insert({
        agent_id: agentId,
        campaign_id: options?.campaignId || null,
        artist_name: options?.artistName || null,
        memory_type: memory.memoryType,
        key: memory.key,
        value: memory.value,
        importance: memory.importance ?? 0.5,
        expires_at: memory.ttlSeconds
          ? new Date(Date.now() + memory.ttlSeconds * 1000).toISOString()
          : null,
      })
      .select('id')
      .single();

    if (error) {
      console.warn(`[MemoryService] Failed to store memory:`, error.message);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.warn(`[MemoryService] Error storing memory:`, error);
    return null;
  }
}

/**
 * Retrieve memories for an agent
 */
export async function retrieveMemories(
  query: MemoryQuery
): Promise<AgentMemory[]> {
  try {
    const supabase = await createClient();

    let dbQuery = supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', query.agentId);

    // Apply filters
    if (query.campaignId) {
      dbQuery = dbQuery.eq('campaign_id', query.campaignId);
    }

    if (query.artistName) {
      dbQuery = dbQuery.eq('artist_name', query.artistName);
    }

    if (query.memoryTypes && query.memoryTypes.length > 0) {
      dbQuery = dbQuery.in('memory_type', query.memoryTypes);
    }

    if (query.keys && query.keys.length > 0) {
      dbQuery = dbQuery.in('key', query.keys);
    }

    if (query.minImportance !== undefined) {
      dbQuery = dbQuery.gte('importance', query.minImportance);
    }

    // Filter out expired memories
    dbQuery = dbQuery.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    // Order by importance and recency
    dbQuery = dbQuery
      .order('importance', { ascending: false })
      .order('last_accessed_at', { ascending: false });

    if (query.limit) {
      dbQuery = dbQuery.limit(query.limit);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.warn(`[MemoryService] Failed to retrieve memories:`, error.message);
      return [];
    }

    // Update access count for retrieved memories
    if (data && data.length > 0) {
      const memoryIds = data.map((m) => m.id);
      await updateAccessCount(memoryIds);
    }

    // Map to AgentMemory type
    return (data || []).map((record) => ({
      id: record.id,
      agentId: record.agent_id,
      campaignId: record.campaign_id,
      artistName: record.artist_name,
      memoryType: record.memory_type as MemoryType,
      key: record.key,
      value: record.value,
      importance: record.importance,
      accessCount: record.access_count,
      lastAccessedAt: new Date(record.last_accessed_at),
      createdAt: new Date(record.created_at),
      expiresAt: record.expires_at ? new Date(record.expires_at) : undefined,
    }));
  } catch (error) {
    console.warn(`[MemoryService] Error retrieving memories:`, error);
    return [];
  }
}

/**
 * Get a specific memory by key
 */
export async function getMemory(
  agentId: string,
  key: string,
  campaignId?: string
): Promise<AgentMemory | null> {
  const memories = await retrieveMemories({
    agentId,
    campaignId,
    keys: [key],
    limit: 1,
  });

  return memories[0] || null;
}

/**
 * Delete a memory
 */
export async function deleteMemory(
  agentId: string,
  key: string,
  campaignId?: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('agent_memories')
      .delete()
      .eq('agent_id', agentId)
      .eq('key', key);

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    } else {
      query = query.is('campaign_id', null);
    }

    const { error } = await query;

    if (error) {
      console.warn(`[MemoryService] Failed to delete memory:`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`[MemoryService] Error deleting memory:`, error);
    return false;
  }
}

/**
 * Delete all memories for an agent
 */
export async function clearAgentMemories(
  agentId: string,
  campaignId?: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('agent_memories')
      .delete()
      .eq('agent_id', agentId);

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { error } = await query;

    if (error) {
      console.warn(`[MemoryService] Failed to clear memories:`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`[MemoryService] Error clearing memories:`, error);
    return false;
  }
}

/**
 * Update importance of a memory
 */
export async function updateImportance(
  memoryId: string,
  importance: number
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('agent_memories')
      .update({ importance: Math.max(0, Math.min(1, importance)) })
      .eq('id', memoryId);

    if (error) {
      console.warn(`[MemoryService] Failed to update importance:`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`[MemoryService] Error updating importance:`, error);
    return false;
  }
}

/**
 * Consolidate similar memories (reduce duplicates)
 */
export async function consolidateMemories(
  agentId: string,
  memoryType: MemoryType,
  maxMemories: number = 100
): Promise<number> {
  try {
    const supabase = await createClient();

    // Get memories sorted by importance and recency
    const { data: memories, error } = await supabase
      .from('agent_memories')
      .select('id')
      .eq('agent_id', agentId)
      .eq('memory_type', memoryType)
      .order('importance', { ascending: true })
      .order('last_accessed_at', { ascending: true });

    if (error || !memories) {
      console.warn(`[MemoryService] Failed to get memories for consolidation:`, error?.message);
      return 0;
    }

    // If under limit, no consolidation needed
    if (memories.length <= maxMemories) {
      return 0;
    }

    // Delete oldest/least important memories
    const toDelete = memories.slice(0, memories.length - maxMemories);
    const deleteIds = toDelete.map((m) => m.id);

    const { error: deleteError } = await supabase
      .from('agent_memories')
      .delete()
      .in('id', deleteIds);

    if (deleteError) {
      console.warn(`[MemoryService] Failed to delete old memories:`, deleteError.message);
      return 0;
    }

    console.log(`[MemoryService] Consolidated ${deleteIds.length} memories for ${agentId}`);
    return deleteIds.length;
  } catch (error) {
    console.warn(`[MemoryService] Error consolidating memories:`, error);
    return 0;
  }
}

/**
 * Clean up expired memories
 */
export async function cleanupExpiredMemories(): Promise<number> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agent_memories')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .not('expires_at', 'is', null)
      .select('id');

    if (error) {
      console.warn(`[MemoryService] Failed to cleanup expired memories:`, error.message);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`[MemoryService] Cleaned up ${count} expired memories`);
    }

    return count;
  } catch (error) {
    console.warn(`[MemoryService] Error cleaning up memories:`, error);
    return 0;
  }
}

/**
 * Get memory statistics for an agent
 */
export async function getMemoryStats(
  agentId: string
): Promise<{
  total: number;
  byType: Record<MemoryType, number>;
  avgImportance: number;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agent_memories')
      .select('memory_type, importance')
      .eq('agent_id', agentId);

    if (error || !data) {
      return { total: 0, byType: {} as Record<MemoryType, number>, avgImportance: 0 };
    }

    const byType: Record<string, number> = {};
    let totalImportance = 0;

    for (const record of data) {
      byType[record.memory_type] = (byType[record.memory_type] || 0) + 1;
      totalImportance += record.importance;
    }

    return {
      total: data.length,
      byType: byType as Record<MemoryType, number>,
      avgImportance: data.length > 0 ? totalImportance / data.length : 0,
    };
  } catch (error) {
    console.warn(`[MemoryService] Error getting memory stats:`, error);
    return { total: 0, byType: {} as Record<MemoryType, number>, avgImportance: 0 };
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Update access count for multiple memories
 */
async function updateAccessCount(memoryIds: string[]): Promise<void> {
  try {
    const supabase = await createClient();

    // Use raw SQL for batch increment
    for (const id of memoryIds) {
      await supabase
        .from('agent_memories')
        .update({
          access_count: supabase.rpc('increment_access_count', { row_id: id }),
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', id);
    }
  } catch {
    // Silent fail - access count is not critical
  }
}

// ============================================================================
// Memory Context Builder
// ============================================================================

/**
 * Build a memory context string for agent prompts
 * Retrieves relevant memories and formats them for inclusion in prompts
 */
export async function buildMemoryContext(
  agentId: string,
  options?: {
    campaignId?: string;
    artistName?: string;
    memoryTypes?: MemoryType[];
    limit?: number;
  }
): Promise<string> {
  const memories = await retrieveMemories({
    agentId,
    campaignId: options?.campaignId,
    artistName: options?.artistName,
    memoryTypes: options?.memoryTypes,
    minImportance: 0.3, // Only include moderately important memories
    limit: options?.limit || 10,
  });

  if (memories.length === 0) {
    return '';
  }

  const contextParts: string[] = ['## Agent Memory Context'];

  // Group by type
  const grouped: Record<string, AgentMemory[]> = {};
  for (const memory of memories) {
    if (!grouped[memory.memoryType]) {
      grouped[memory.memoryType] = [];
    }
    grouped[memory.memoryType].push(memory);
  }

  for (const [type, typeMemories] of Object.entries(grouped)) {
    contextParts.push(`\n### ${type.charAt(0).toUpperCase() + type.slice(1)} Memories`);
    for (const memory of typeMemories) {
      contextParts.push(`- **${memory.key}**: ${JSON.stringify(memory.value)}`);
    }
  }

  return contextParts.join('\n');
}
