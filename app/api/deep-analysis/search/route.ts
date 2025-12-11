import { NextRequest, NextResponse } from 'next/server';
import { searchDeepAnalysisUsers } from '@/lib/deep-analysis';

/**
 * GET /api/deep-analysis/search
 *
 * Search for TikTok users for deep analysis
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const cursor = searchParams.get('cursor') || '0';
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!query) {
    return NextResponse.json(
      { success: false, error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  try {
    const result = await searchDeepAnalysisUsers(query, { cursor, limit });

    return NextResponse.json({
      success: result.success,
      users: result.users.map((user) => ({
        id: user.id,
        uniqueId: user.uniqueId,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        followers: user.followers,
        verified: user.verified,
        signature: user.signature,
        videos: user.videos,
      })),
      hasMore: result.hasMore,
      cursor: result.cursor,
      error: result.error,
    });
  } catch (error) {
    console.error('[API] Deep analysis search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      },
      { status: 500 }
    );
  }
}
