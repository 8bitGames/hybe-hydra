/**
 * Agent Prompt History API
 * ========================
 * View and restore prompt history
 *
 * GET /api/v1/admin/prompts/[agentId]/history - Get version history
 * POST /api/v1/admin/prompts/[agentId]/history/restore - Restore a version
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = await params;
    const supabase = await createClient();

    // First get the prompt ID
    const { data: prompt, error: promptError } = await supabase
      .from('agent_prompts')
      .select('id')
      .eq('agent_id', agentId)
      .single();

    if (promptError) {
      if (promptError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Prompt not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: promptError.message }, { status: 500 });
    }

    // Get history
    const { data: history, error } = await supabase
      .from('agent_prompt_history')
      .select('*')
      .eq('agent_prompt_id', prompt.id)
      .order('version', { ascending: false });

    if (error) {
      console.error('[Prompts API] Error fetching history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ history });
  } catch (error) {
    console.error('[Prompts API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { version, restored_by } = body;

    if (!version) {
      return NextResponse.json(
        { error: 'Version is required' },
        { status: 400 }
      );
    }

    // Get the prompt
    const { data: prompt, error: promptError } = await supabase
      .from('agent_prompts')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (promptError) {
      return NextResponse.json({ error: promptError.message }, { status: 500 });
    }

    // Get the history version to restore
    const { data: historyVersion, error: historyError } = await supabase
      .from('agent_prompt_history')
      .select('*')
      .eq('agent_prompt_id', prompt.id)
      .eq('version', version)
      .single();

    if (historyError) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    // Save current to history before restoring
    await supabase.from('agent_prompt_history').insert({
      agent_prompt_id: prompt.id,
      version: prompt.version,
      system_prompt: prompt.system_prompt,
      templates: prompt.templates,
      model_options: prompt.model_options,
      changed_by: restored_by,
      change_notes: `Before restoring to version ${version}`,
    });

    // Restore the version
    const { data, error } = await supabase
      .from('agent_prompts')
      .update({
        system_prompt: historyVersion.system_prompt,
        templates: historyVersion.templates,
        model_options: historyVersion.model_options,
        version: prompt.version + 1,
        updated_at: new Date().toISOString(),
        updated_by: restored_by,
      })
      .eq('agent_id', agentId)
      .select()
      .single();

    if (error) {
      console.error('[Prompts API] Error restoring version:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      prompt: data,
      message: `Restored to version ${version}`
    });
  } catch (error) {
    console.error('[Prompts API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
