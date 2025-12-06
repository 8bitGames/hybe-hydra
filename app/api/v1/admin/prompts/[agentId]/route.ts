/**
 * Agent Prompt Detail API
 * =======================
 * Operations for individual agent prompts
 *
 * GET /api/v1/admin/prompts/[agentId] - Get prompt by agent ID
 * PUT /api/v1/admin/prompts/[agentId] - Update prompt
 * DELETE /api/v1/admin/prompts/[agentId] - Delete prompt
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

    const { data, error } = await supabase
      .from('agent_prompts')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Prompt not found' },
          { status: 404 }
        );
      }
      console.error('[Prompts API] Error fetching prompt:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prompt: data });
  } catch (error) {
    console.error('[Prompts API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    // Get current prompt for history
    const { data: currentPrompt, error: fetchError } = await supabase
      .from('agent_prompts')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Prompt not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Save to history before updating
    await supabase.from('agent_prompt_history').insert({
      agent_prompt_id: currentPrompt.id,
      version: currentPrompt.version,
      system_prompt: currentPrompt.system_prompt,
      templates: currentPrompt.templates,
      model_options: currentPrompt.model_options,
      changed_by: body.updated_by,
      change_notes: body.change_notes,
    });

    // Update prompt
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      version: currentPrompt.version + 1,
    };

    // Only update fields that are provided
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.system_prompt !== undefined) updateData.system_prompt = body.system_prompt;
    if (body.templates !== undefined) updateData.templates = body.templates;
    if (body.model_provider !== undefined) updateData.model_provider = body.model_provider;
    if (body.model_name !== undefined) updateData.model_name = body.model_name;
    if (body.model_options !== undefined) updateData.model_options = body.model_options;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.updated_by !== undefined) updateData.updated_by = body.updated_by;

    const { data, error } = await supabase
      .from('agent_prompts')
      .update(updateData)
      .eq('agent_id', agentId)
      .select()
      .single();

    if (error) {
      console.error('[Prompts API] Error updating prompt:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prompt: data });
  } catch (error) {
    console.error('[Prompts API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('agent_prompts')
      .delete()
      .eq('agent_id', agentId);

    if (error) {
      console.error('[Prompts API] Error deleting prompt:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Prompts API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
