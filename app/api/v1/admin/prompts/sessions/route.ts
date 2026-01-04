/**
 * Prompt Refine Sessions API
 * ==========================
 * CRUD operations for chat session persistence
 *
 * GET  /api/v1/admin/prompts/sessions - List sessions (with optional filters)
 * POST /api/v1/admin/prompts/sessions - Create new session
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface CreateSessionRequest {
  agentId: string;
  title?: string;
  messages?: ChatMessage[];
  initialPrompt: {
    systemPrompt: string;
    templates: Record<string, string>;
    name: string;
    description?: string;
  };
  tags?: string[];
}

// GET - List sessions with optional filters
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const favorite = searchParams.get('favorite');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};

    if (agentId) {
      where.agentId = agentId;
    }

    if (favorite === 'true') {
      where.isFavorite = true;
    }

    // Query sessions
    const [sessions, total] = await Promise.all([
      withRetry(() =>
        prisma.promptRefineSession.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            agentId: true,
            title: true,
            messageCount: true,
            improvementsCount: true,
            isFavorite: true,
            tags: true,
            lastMessageAt: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      ),
      withRetry(() => prisma.promptRefineSession.count({ where })),
    ]);

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        agentId: s.agentId,
        title: s.title,
        messageCount: s.messageCount,
        improvementsCount: s.improvementsCount,
        isFavorite: s.isFavorite,
        tags: s.tags,
        lastMessageAt: s.lastMessageAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Sessions API] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

// POST - Create new session
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateSessionRequest = await request.json();
    const { agentId, title, messages = [], initialPrompt, tags = [] } = body;

    if (!agentId || !initialPrompt) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, initialPrompt' },
        { status: 400 }
      );
    }

    // Generate title from first message if not provided
    const autoTitle =
      title ||
      (messages.length > 0
        ? messages[0].content.substring(0, 50) + '...'
        : `${initialPrompt.name} - ${new Date().toLocaleDateString('ko-KR')}`);

    const session = await withRetry(() =>
      prisma.promptRefineSession.create({
        data: {
          agentId,
          title: autoTitle,
          messages: messages as unknown as never,
          initialPrompt: initialPrompt as unknown as never,
          messageCount: messages.length,
          lastMessageAt: messages.length > 0 ? new Date() : null,
          tags,
          createdBy: user.id,
        },
      })
    );

    return NextResponse.json({
      id: session.id,
      agentId: session.agentId,
      title: session.title,
      messageCount: session.messageCount,
      createdAt: session.createdAt,
    });
  } catch (error) {
    console.error('[Sessions API] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
