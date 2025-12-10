/**
 * Individual Prompt Refine Session API
 * =====================================
 * Operations on a specific session
 *
 * GET    /api/v1/admin/prompts/sessions/[sessionId] - Get session details
 * PUT    /api/v1/admin/prompts/sessions/[sessionId] - Update session
 * DELETE /api/v1/admin/prompts/sessions/[sessionId] - Delete session
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface UpdateSessionRequest {
  title?: string;
  messages?: ChatMessage[];
  appliedImprovements?: {
    systemPrompt?: string;
    templates?: Record<string, string>;
    appliedAt: string;
  }[];
  isFavorite?: boolean;
  tags?: string[];
}

// GET - Get session details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    const session = await prisma.promptRefineSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      agentId: session.agentId,
      title: session.title,
      messages: session.messages,
      initialPrompt: session.initialPrompt,
      appliedImprovements: session.appliedImprovements,
      improvementsCount: session.improvementsCount,
      messageCount: session.messageCount,
      lastMessageAt: session.lastMessageAt,
      isFavorite: session.isFavorite,
      tags: session.tags,
      createdBy: session.createdBy,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error('[Session API] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

// PUT - Update session
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body: UpdateSessionRequest = await request.json();

    const existingSession = await prisma.promptRefineSession.findUnique({
      where: { id: sessionId },
    });

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    if (body.messages !== undefined) {
      updateData.messages = body.messages as unknown as never;
      updateData.messageCount = body.messages.length;
      updateData.lastMessageAt = new Date();
    }

    if (body.appliedImprovements !== undefined) {
      updateData.appliedImprovements =
        body.appliedImprovements as unknown as never;
      updateData.improvementsCount = body.appliedImprovements.length;
    }

    if (body.isFavorite !== undefined) {
      updateData.isFavorite = body.isFavorite;
    }

    if (body.tags !== undefined) {
      updateData.tags = body.tags;
    }

    const session = await prisma.promptRefineSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json({
      id: session.id,
      agentId: session.agentId,
      title: session.title,
      messageCount: session.messageCount,
      improvementsCount: session.improvementsCount,
      isFavorite: session.isFavorite,
      tags: session.tags,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error('[Session API] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// DELETE - Delete session
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    const existingSession = await prisma.promptRefineSession.findUnique({
      where: { id: sessionId },
    });

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await prisma.promptRefineSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Session API] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
