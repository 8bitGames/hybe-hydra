import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/db/prisma';

/**
 * GET /api/deep-analysis/compare/list
 *
 * List all saved comparison reports
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    const [reports, total] = await Promise.all([
      withRetry(() =>
        prisma.comparisonReport.findMany({
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
          include: {
            accounts: {
              include: {
                analysis: {
                  select: {
                    uniqueId: true,
                    nickname: true,
                    avatarUrl: true,
                    verified: true,
                    followers: true,
                  },
                },
              },
            },
          },
        })
      ),
      withRetry(() => prisma.comparisonReport.count()),
    ]);

    return NextResponse.json({
      success: true,
      reports: reports.map(report => ({
        id: report.id,
        title: report.title,
        language: report.language,
        accountCount: report.accountCount,
        overallSummary: report.overallSummary,
        createdAt: report.createdAt,
        accounts: report.accounts.map(a => ({
          uniqueId: a.analysis.uniqueId,
          nickname: a.analysis.nickname,
          avatarUrl: a.analysis.avatarUrl,
          verified: a.analysis.verified,
          followers: Number(a.analysis.followers),
        })),
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[API] List comparison reports error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list reports',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/deep-analysis/compare/list?id={reportId}
 *
 * Delete a comparison report
 */
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reportId = searchParams.get('id');

  if (!reportId) {
    return NextResponse.json(
      { success: false, error: 'Report ID is required' },
      { status: 400 }
    );
  }

  try {
    await withRetry(() =>
      prisma.comparisonReport.delete({
        where: { id: reportId },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Delete comparison report error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete report',
      },
      { status: 500 }
    );
  }
}
