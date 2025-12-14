/**
 * POST /api/v1/trends/explore
 *
 * 트렌드 탐색 API
 * 시드 키워드에서 자동으로 새로운 트렌드 키워드를 발견
 *
 * Request Body:
 * {
 *   "seedKeyword": "kpop",         // 시작 키워드
 *   "depth": 3,                    // 탐색 깊이 (1-3, 기본값 3)
 *   "strategy": "balanced",        // novelty | popularity | balanced
 *   "includeInsights": true        // LLM 인사이트 포함 여부 (기본값 false)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "explorationId": "exp_xxx",
 *   "seedKeyword": "kpop",
 *   "discoveries": [...],          // 발견된 키워드들
 *   "network": { nodes: [], edges: [] },
 *   "stats": {...},
 *   "insights": {...}              // includeInsights=true인 경우
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromHeader } from '@/lib/auth'
import {
  exploreTrends,
  toVisualizationFormat,
  calculateNetworkStats,
  analyzeTrendInsights,
  type ExplorationRequest,
  type ExplorationStrategy,
} from '@/lib/exploration'

// 유효한 전략 타입
const VALID_STRATEGIES: ExplorationStrategy[] = ['novelty', 'popularity', 'balanced']

// 요청 검증
function validateRequest(body: any): { valid: boolean; error?: string; request?: ExplorationRequest } {
  if (!body.seedKeyword || typeof body.seedKeyword !== 'string') {
    return { valid: false, error: 'seedKeyword is required and must be a string' }
  }

  const seedKeyword = body.seedKeyword.trim()
  if (seedKeyword.length < 2) {
    return { valid: false, error: 'seedKeyword must be at least 2 characters' }
  }

  if (seedKeyword.length > 50) {
    return { valid: false, error: 'seedKeyword must be less than 50 characters' }
  }

  // depth 검증
  let depth = 3
  if (body.depth !== undefined) {
    depth = parseInt(body.depth, 10)
    if (isNaN(depth) || depth < 1 || depth > 3) {
      return { valid: false, error: 'depth must be between 1 and 3' }
    }
  }

  // strategy 검증
  let strategy: ExplorationStrategy = 'balanced'
  if (body.strategy) {
    if (!VALID_STRATEGIES.includes(body.strategy)) {
      return { valid: false, error: `strategy must be one of: ${VALID_STRATEGIES.join(', ')}` }
    }
    strategy = body.strategy
  }

  return {
    valid: true,
    request: {
      seedKeyword,
      depth,
      strategy,
      excludeKnown: body.excludeKnown ?? true,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization')
    const user = await getUserFromHeader(authHeader)

    if (!user) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      )
    }

    // 요청 파싱
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { detail: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // 요청 검증
    const validation = validateRequest(body)
    if (!validation.valid) {
      return NextResponse.json(
        { detail: validation.error },
        { status: 400 }
      )
    }

    const explorationRequest = validation.request!
    explorationRequest.userId = user.id

    const includeInsights = body.includeInsights === true

    console.log(`[EXPLORE-API] Starting exploration: ${explorationRequest.seedKeyword}, depth: ${explorationRequest.depth}, strategy: ${explorationRequest.strategy}, includeInsights: ${includeInsights}`)

    // 탐색 실행
    const result = await exploreTrends(explorationRequest)

    // 시각화 데이터 변환
    const visualizationData = toVisualizationFormat(result.network)
    const networkStats = calculateNetworkStats(result.network)

    console.log(`[EXPLORE-API] Exploration complete: ${result.discoveries.length} discoveries`)

    // LLM 인사이트 생성 (옵션)
    let insights = null
    if (includeInsights && result.discoveries.length > 0) {
      console.log(`[EXPLORE-API] Generating LLM insights...`)
      insights = await analyzeTrendInsights(result)
      if (insights) {
        console.log(`[EXPLORE-API] Insights generated: ${insights.categories.length} categories, ${insights.insights.length} insights`)
      } else {
        console.warn(`[EXPLORE-API] Failed to generate insights`)
      }
    }

    return NextResponse.json({
      success: true,
      explorationId: result.explorationId,
      seedKeyword: result.seedKeyword,
      depth: result.depth,
      strategy: result.strategy,
      discoveries: result.discoveries.slice(0, 50), // 상위 50개만 반환
      network: result.network,
      visualization: visualizationData,
      networkStats,
      stats: result.stats,
      completedAt: result.completedAt,
      ...(insights && { insights }), // 인사이트가 있으면 포함
    })
  } catch (error) {
    console.error('[EXPLORE-API] Error:', error)
    return NextResponse.json(
      {
        detail: 'Failed to explore trends',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/trends/explore?seed=kpop&depth=2
 *
 * 빠른 탐색 (간단한 GET 요청용)
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization')
    const user = await getUserFromHeader(authHeader)

    if (!user) {
      return NextResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const seedKeyword = searchParams.get('seed')
    const depth = parseInt(searchParams.get('depth') || '2', 10)
    const strategy = (searchParams.get('strategy') || 'balanced') as ExplorationStrategy
    const includeInsights = searchParams.get('insights') === 'true'

    if (!seedKeyword) {
      return NextResponse.json(
        { detail: 'seed parameter is required' },
        { status: 400 }
      )
    }

    if (depth < 1 || depth > 3) {
      return NextResponse.json(
        { detail: 'depth must be between 1 and 3' },
        { status: 400 }
      )
    }

    console.log(`[EXPLORE-API-GET] Quick exploration: ${seedKeyword}, depth: ${depth}, insights: ${includeInsights}`)

    const result = await exploreTrends({
      seedKeyword,
      depth,
      strategy,
      userId: user.id,
    })

    const visualizationData = toVisualizationFormat(result.network)
    const networkStats = calculateNetworkStats(result.network)

    // LLM 인사이트 생성 (옵션)
    let insights = null
    if (includeInsights && result.discoveries.length > 0) {
      console.log(`[EXPLORE-API-GET] Generating LLM insights...`)
      insights = await analyzeTrendInsights(result)
    }

    return NextResponse.json({
      success: true,
      explorationId: result.explorationId,
      seedKeyword: result.seedKeyword,
      depth: result.depth,
      strategy: result.strategy,
      discoveries: result.discoveries.slice(0, 30), // GET은 30개
      network: result.network,
      visualization: visualizationData,
      networkStats,
      stats: result.stats,
      completedAt: result.completedAt,
      ...(insights && { insights }),
    })
  } catch (error) {
    console.error('[EXPLORE-API-GET] Error:', error)
    return NextResponse.json(
      {
        detail: 'Failed to explore trends',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
