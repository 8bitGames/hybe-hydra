/**
 * Insight Analyzer - LLM 기반 트렌드 인사이트 생성
 *
 * TrendInsightAgent를 사용하여 탐색 결과를 분석하고
 * 카테고리, 인사이트, 콘텐츠 추천, 성장 예측을 생성
 */

import {
  getTrendInsightAgent,
  type TrendInsightInput,
  type TrendInsightOutput,
} from '@/lib/agents/analyzers';
import type { AgentContext } from '@/lib/agents/types';
import type {
  ExplorationResult,
  Discovery,
  DiscoveredCreatorBrief,
  TrendInsights,
} from './types';
import { findHubNodes } from './network-builder';

// ============================================================================
// 메인 분석 함수
// ============================================================================

/**
 * 탐색 결과를 LLM으로 분석하여 인사이트 생성
 *
 * @param result - 탐색 결과
 * @returns TrendInsights 또는 null (실패 시)
 */
export async function analyzeTrendInsights(
  result: ExplorationResult
): Promise<TrendInsights | null> {
  try {
    console.log(`[INSIGHT-ANALYZER] Starting LLM analysis for: ${result.seedKeyword}`);

    // 1. 입력 데이터 준비
    const input = prepareInsightInput(result);

    // 2. Agent 컨텍스트 생성
    const context: AgentContext = {
      workflow: {
        artistName: 'TrendExplorer',
        language: 'ko',
        platform: 'tiktok',
      },
    };

    // 3. TrendInsightAgent 실행
    const agent = getTrendInsightAgent();
    const agentResult = await agent.analyze(input, context);

    if (!agentResult.success || !agentResult.data) {
      console.error(`[INSIGHT-ANALYZER] Agent failed:`, agentResult.error);
      return null;
    }

    console.log(`[INSIGHT-ANALYZER] Analysis complete. Tokens: ${agentResult.metadata.tokenUsage.total}`);

    // 4. 결과 변환
    return convertToTrendInsights(agentResult.data);
  } catch (error) {
    console.error(`[INSIGHT-ANALYZER] Error:`, error);
    return null;
  }
}

// ============================================================================
// 입력 데이터 준비
// ============================================================================

/**
 * ExplorationResult를 TrendInsightInput으로 변환
 */
function prepareInsightInput(result: ExplorationResult): TrendInsightInput {
  // 상위 20개 발견 키워드 선택
  const topDiscoveries = result.discoveries
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);

  // 발견 데이터 변환
  const discoveries = topDiscoveries.map((d) => ({
    keyword: d.keyword,
    noveltyScore: d.noveltyScore,
    popularityScore: d.popularityScore,
    avgEngagement: d.metadata.avgEngagement,
    avgViews: d.metadata.avgViews,
    discoveryPath: d.discoveryPath,
    isTrending: d.metadata.isTrending,
  }));

  // 상위 크리에이터 추출 (모든 발견에서)
  const creatorMap = new Map<string, DiscoveredCreatorBrief>();
  for (const discovery of result.discoveries) {
    for (const creator of discovery.relatedCreators) {
      const existing = creatorMap.get(creator.id);
      if (!existing || creator.avgEngagement > existing.avgEngagement) {
        creatorMap.set(creator.id, creator);
      }
    }
  }
  const topCreators = Array.from(creatorMap.values())
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 5)
    .map((c) => ({
      username: c.username,
      videoCount: c.videoCount,
      avgEngagement: c.avgEngagement,
    }));

  // 허브 키워드 찾기 (연결이 많은 노드)
  const hubNodes = findHubNodes(result.network, 5);
  const hubKeywords = hubNodes.map((n) => n.label);

  // 네트워크 요약
  const networkSummary = {
    totalNodes: result.network.nodes.length,
    totalEdges: result.network.edges.length,
    hubKeywords,
  };

  return {
    seedKeyword: result.seedKeyword,
    discoveries,
    topCreators,
    networkSummary,
    explorationDepth: result.depth,
    strategy: result.strategy,
  };
}

// ============================================================================
// 결과 변환
// ============================================================================

/**
 * TrendInsightOutput을 TrendInsights로 변환
 */
function convertToTrendInsights(output: TrendInsightOutput): TrendInsights {
  return {
    summary: output.summary,
    categories: output.categories.map((c) => ({
      name: c.name,
      keywords: c.keywords,
      description: c.description,
    })),
    insights: output.insights.map((i) => ({
      type: i.type,
      title: i.title,
      description: i.description,
      relatedKeywords: i.relatedKeywords,
    })),
    contentRecommendations: output.contentRecommendations.map((r) => ({
      title: r.title,
      description: r.description,
      suggestedKeywords: r.suggestedKeywords,
      targetAudience: r.targetAudience,
      difficulty: r.difficulty,
    })),
    predictions: output.predictions.map((p) => ({
      keyword: p.keyword,
      potential: p.potential,
      reason: p.reason,
    })),
  };
}
