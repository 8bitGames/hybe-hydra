import { NextRequest, NextResponse } from 'next/server'
import { coOccurrenceAnalyzer } from '@/lib/expansion'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sourceKeyword = searchParams.get('sourceKeyword')
    const trackedKeywordsParam = searchParams.get('tracked')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!sourceKeyword) {
      return NextResponse.json(
        { error: 'sourceKeyword parameter required' },
        { status: 400 }
      )
    }

    const trackedKeywords = trackedKeywordsParam
      ? trackedKeywordsParam.split(',').filter(k => k.trim())
      : []

    const relatedHashtags = await coOccurrenceAnalyzer.getRelatedHashtags(
      sourceKeyword,
      trackedKeywords,
      limit
    )

    return NextResponse.json({
      success: true,
      sourceKeyword,
      relatedHashtags,
      count: relatedHashtags.length
    })
  } catch (error) {
    console.error('Keyword expansion error:', error)
    return NextResponse.json(
      { error: 'Failed to get keyword expansions' },
      { status: 500 }
    )
  }
}

// Get related hashtags for multiple keywords
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keywords, tracked = [], limit = 20 } = body

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'keywords array required in request body' },
        { status: 400 }
      )
    }

    const relatedHashtags = await coOccurrenceAnalyzer.getRelatedHashtagsMultiple(
      keywords,
      tracked,
      limit
    )

    return NextResponse.json({
      success: true,
      sourceKeywords: keywords,
      relatedHashtags,
      count: relatedHashtags.length
    })
  } catch (error) {
    console.error('Keyword expansion error:', error)
    return NextResponse.json(
      { error: 'Failed to get keyword expansions' },
      { status: 500 }
    )
  }
}
