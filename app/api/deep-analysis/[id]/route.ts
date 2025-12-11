import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/deep-analysis/[id]
 *
 * Get analysis results by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const analysis = await prisma.accountAnalysis.findUnique({
      where: { id },
      include: {
        videoClassifications: {
          orderBy: { playCount: 'desc' },
          take: 100,
        },
      },
    });

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Convert BigInt to number for JSON serialization
    const serializedAnalysis = {
      ...analysis,
      followers: Number(analysis.followers),
      totalLikes: Number(analysis.totalLikes),
      videoClassifications: analysis.videoClassifications.map((v) => ({
        ...v,
        playCount: Number(v.playCount),
      })),
    };

    return NextResponse.json({
      success: true,
      analysis: serializedAnalysis,
    });
  } catch (error) {
    console.error('[API] Get analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analysis',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/deep-analysis/[id]
 *
 * Delete an analysis and its video classifications
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.accountAnalysis.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Delete analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete analysis',
      },
      { status: 500 }
    );
  }
}
