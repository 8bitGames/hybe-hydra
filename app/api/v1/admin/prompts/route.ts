/**
 * Agent Prompts API
 * =================
 * CRUD operations for managing AI agent prompts
 *
 * GET /api/v1/admin/prompts - List all prompts
 * POST /api/v1/admin/prompts - Create new prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const activeOnly = searchParams.get('active') !== 'false';

    let query = supabase
      .from('agent_prompts')
      .select('*')
      .order('category')
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Prompts API] Error fetching prompts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prompts: data });
  } catch (error) {
    console.error('[Prompts API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      agent_id,
      name,
      description,
      category,
      system_prompt,
      templates,
      model_provider,
      model_name,
      model_options,
    } = body;

    // Validation
    if (!agent_id || !name || !category || !system_prompt || !model_provider || !model_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const validCategories = ['analyzer', 'creator', 'transformer', 'publisher'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('agent_prompts')
      .insert({
        agent_id,
        name,
        description,
        category,
        system_prompt,
        templates: templates || {},
        model_provider,
        model_name,
        model_options: model_options || {},
        is_active: true,
        version: 1,
      })
      .select()
      .single();

    if (error) {
      console.error('[Prompts API] Error creating prompt:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prompt: data }, { status: 201 });
  } catch (error) {
    console.error('[Prompts API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
