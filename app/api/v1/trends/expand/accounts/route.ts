import { NextRequest, NextResponse } from 'next/server'
import { accountDiscoveryService } from '@/lib/expansion'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sourceKeyword = searchParams.get('sourceKeyword') || undefined
    const minRelevance = parseInt(searchParams.get('minRelevance') || '30')
    const limit = parseInt(searchParams.get('limit') || '20')

    const accounts = await accountDiscoveryService.getDiscoveredAccounts(
      sourceKeyword,
      minRelevance,
      limit
    )

    return NextResponse.json({
      success: true,
      accounts,
      count: accounts.length
    })
  } catch (error) {
    console.error('Account discovery error:', error)
    return NextResponse.json(
      { error: 'Failed to get discovered accounts' },
      { status: 500 }
    )
  }
}

// Get accounts by multiple keywords
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keywords, minRelevance = 30, limit = 20 } = body

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'keywords array required in request body' },
        { status: 400 }
      )
    }

    const accounts = await accountDiscoveryService.getAccountsByKeywords(
      keywords,
      minRelevance,
      limit
    )

    return NextResponse.json({
      success: true,
      sourceKeywords: keywords,
      accounts,
      count: accounts.length
    })
  } catch (error) {
    console.error('Account discovery error:', error)
    return NextResponse.json(
      { error: 'Failed to get discovered accounts' },
      { status: 500 }
    )
  }
}
