import { NextRequest, NextResponse } from 'next/server'
import { recommendationEngine } from '@/lib/expansion'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const trackedKeywordsParam = searchParams.get('tracked')
    const type = searchParams.get('type') as 'keyword' | 'account' | undefined

    // If no tracked keywords, return stored recommendations
    if (!trackedKeywordsParam) {
      const stored = await recommendationEngine.getStoredRecommendations(type)
      return NextResponse.json({
        success: true,
        recommendations: stored,
        source: 'stored'
      })
    }

    // Parse tracked keywords
    const trackedKeywords = trackedKeywordsParam
      .split(',')
      .filter(k => k.trim())

    if (trackedKeywords.length === 0) {
      return NextResponse.json(
        { error: 'At least one tracked keyword required' },
        { status: 400 }
      )
    }

    // Generate fresh recommendations
    const recommendations = await recommendationEngine.generateRecommendations(
      trackedKeywords
    )

    return NextResponse.json({
      success: true,
      ...recommendations,
      source: 'generated'
    })
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    )
  }
}

// Update recommendation status (accept/dismiss)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recommendationId, action } = body

    if (!recommendationId) {
      return NextResponse.json(
        { error: 'recommendationId required' },
        { status: 400 }
      )
    }

    if (!['accepted', 'dismissed'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "accepted" or "dismissed"' },
        { status: 400 }
      )
    }

    await recommendationEngine.updateRecommendationStatus(recommendationId, action)

    return NextResponse.json({
      success: true,
      message: `Recommendation ${action}`
    })
  } catch (error) {
    console.error('Recommendation update error:', error)
    return NextResponse.json(
      { error: 'Failed to update recommendation' },
      { status: 500 }
    )
  }
}

// Save generated recommendations for later
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { recommendations } = body

    if (!recommendations || !Array.isArray(recommendations)) {
      return NextResponse.json(
        { error: 'recommendations array required' },
        { status: 400 }
      )
    }

    await recommendationEngine.saveRecommendations(recommendations)

    return NextResponse.json({
      success: true,
      message: `Saved ${recommendations.length} recommendations`
    })
  } catch (error) {
    console.error('Recommendation save error:', error)
    return NextResponse.json(
      { error: 'Failed to save recommendations' },
      { status: 500 }
    )
  }
}
