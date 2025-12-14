/**
 * Network Builder - 탐색 네트워크 그래프 생성
 *
 * 목적: 탐색 경로와 발견된 키워드를 시각화할 수 있는 네트워크 데이터 생성
 *
 * 노드 타입:
 * - seed: 시드 키워드 (탐색 시작점)
 * - discovered: 새로 발견된 키워드 (noveltyScore >= 50)
 * - intermediate: 탐색 경로의 중간 노드
 *
 * 엣지:
 * - source → target: 탐색 순서
 * - weight: 연결 강도 (co-occurrence count 기반)
 * - isDiscoveryPath: 발견 경로에 포함되는지
 */

import type {
  ExplorationNetwork,
  NetworkNode,
  NetworkEdge,
  Discovery,
  ExplorationContext,
} from './types'
import { normalizeKeyword } from './novelty-scorer'

// ============================================================================
// 네트워크 빌더
// ============================================================================

/**
 * 탐색 컨텍스트에서 네트워크 그래프 생성
 */
export function buildNetworkFromContext(context: ExplorationContext): ExplorationNetwork {
  const nodes: NetworkNode[] = []
  const edges: NetworkEdge[] = []

  // 컨텍스트의 노드 맵을 배열로 변환
  for (const node of context.nodes.values()) {
    nodes.push(node)
  }

  // 컨텍스트의 엣지 복사
  edges.push(...context.edges)

  // 발견 경로 하이라이트
  highlightDiscoveryPaths(edges, context.discoveries)

  return { nodes, edges }
}

/**
 * 시드 노드 생성
 */
export function createSeedNode(keyword: string): NetworkNode {
  return {
    id: normalizeKeyword(keyword),
    label: keyword,
    type: 'seed',
    weight: 100, // 시드는 가장 큰 가중치
    depth: 0,
  }
}

/**
 * 발견 노드 생성
 */
export function createDiscoveredNode(
  keyword: string,
  depth: number,
  noveltyScore: number,
  popularityScore: number
): NetworkNode {
  return {
    id: normalizeKeyword(keyword),
    label: keyword.startsWith('#') ? keyword : `#${keyword}`,
    type: 'discovered',
    weight: Math.round((noveltyScore + popularityScore) / 2),
    depth,
    noveltyScore,
    popularityScore,
  }
}

/**
 * 중간 노드 생성 (탐색 경로에 있지만 발견으로 분류되지 않은 것)
 */
export function createIntermediateNode(
  keyword: string,
  depth: number,
  score: number
): NetworkNode {
  return {
    id: normalizeKeyword(keyword),
    label: keyword.startsWith('#') ? keyword : `#${keyword}`,
    type: 'intermediate',
    weight: score,
    depth,
  }
}

/**
 * 엣지 생성
 */
export function createEdge(
  source: string,
  target: string,
  weight: number = 1
): NetworkEdge {
  return {
    source: normalizeKeyword(source),
    target: normalizeKeyword(target),
    weight,
    isDiscoveryPath: false,
  }
}

// ============================================================================
// 네트워크 조작
// ============================================================================

/**
 * 컨텍스트에 노드 추가
 */
export function addNodeToContext(
  context: ExplorationContext,
  node: NetworkNode
): void {
  const id = normalizeKeyword(node.id)
  if (!context.nodes.has(id)) {
    context.nodes.set(id, node)
  }
}

/**
 * 컨텍스트에 엣지 추가
 */
export function addEdgeToContext(
  context: ExplorationContext,
  source: string,
  target: string,
  weight: number = 1
): void {
  const normalizedSource = normalizeKeyword(source)
  const normalizedTarget = normalizeKeyword(target)

  // 중복 체크
  const exists = context.edges.some(
    e => e.source === normalizedSource && e.target === normalizedTarget
  )

  if (!exists) {
    context.edges.push({
      source: normalizedSource,
      target: normalizedTarget,
      weight,
      isDiscoveryPath: false,
    })
  }
}

/**
 * 발견 경로 하이라이트
 */
export function highlightDiscoveryPaths(
  edges: NetworkEdge[],
  discoveries: Discovery[]
): void {
  // 발견 경로에 포함된 모든 엣지 쌍 수집
  const pathEdges = new Set<string>()

  for (const discovery of discoveries) {
    const path = discovery.discoveryPath
    for (let i = 0; i < path.length - 1; i++) {
      const source = normalizeKeyword(path[i])
      const target = normalizeKeyword(path[i + 1])
      pathEdges.add(`${source}|${target}`)
    }
  }

  // 엣지에 isDiscoveryPath 표시
  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}`
    if (pathEdges.has(key)) {
      edge.isDiscoveryPath = true
    }
  }
}

// ============================================================================
// 네트워크 분석
// ============================================================================

/**
 * 네트워크 통계 계산
 */
export function calculateNetworkStats(network: ExplorationNetwork): {
  totalNodes: number
  seedNodes: number
  discoveredNodes: number
  intermediateNodes: number
  totalEdges: number
  discoveryPathEdges: number
  avgDepth: number
  maxDepth: number
} {
  const seedNodes = network.nodes.filter(n => n.type === 'seed').length
  const discoveredNodes = network.nodes.filter(n => n.type === 'discovered').length
  const intermediateNodes = network.nodes.filter(n => n.type === 'intermediate').length
  const discoveryPathEdges = network.edges.filter(e => e.isDiscoveryPath).length

  const depths = network.nodes.map(n => n.depth)
  const avgDepth = depths.length > 0
    ? depths.reduce((a, b) => a + b, 0) / depths.length
    : 0
  const maxDepth = depths.length > 0 ? Math.max(...depths) : 0

  return {
    totalNodes: network.nodes.length,
    seedNodes,
    discoveredNodes,
    intermediateNodes,
    totalEdges: network.edges.length,
    discoveryPathEdges,
    avgDepth: Math.round(avgDepth * 10) / 10,
    maxDepth,
  }
}

/**
 * 가장 연결이 많은 노드 찾기 (허브)
 */
export function findHubNodes(
  network: ExplorationNetwork,
  limit: number = 5
): NetworkNode[] {
  const connectionCount = new Map<string, number>()

  // 각 노드의 연결 수 계산
  for (const edge of network.edges) {
    connectionCount.set(edge.source, (connectionCount.get(edge.source) || 0) + 1)
    connectionCount.set(edge.target, (connectionCount.get(edge.target) || 0) + 1)
  }

  // 노드에 연결 수 추가하고 정렬
  return network.nodes
    .map(node => ({
      ...node,
      connections: connectionCount.get(node.id) || 0,
    }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, limit)
}

/**
 * 발견 경로 추출
 */
export function extractDiscoveryPaths(
  discoveries: Discovery[]
): Array<{ keyword: string; path: string[]; depth: number }> {
  return discoveries.map(d => ({
    keyword: d.keyword,
    path: d.discoveryPath,
    depth: d.depth,
  }))
}

// ============================================================================
// 시각화 데이터 변환
// ============================================================================

/**
 * D3.js / vis-network 호환 포맷으로 변환
 */
export function toVisualizationFormat(network: ExplorationNetwork): {
  nodes: Array<{
    id: string
    label: string
    group: string
    size: number
    color?: string
    x?: number
    y?: number
  }>
  edges: Array<{
    from: string
    to: string
    width: number
    color?: string
    dashes?: boolean
  }>
} {
  // 노드 색상 매핑
  const nodeColors: Record<string, string> = {
    seed: '#ef4444',      // 빨강
    discovered: '#22c55e', // 초록
    intermediate: '#6b7280', // 회색
  }

  const nodes = network.nodes.map(node => ({
    id: node.id,
    label: node.label,
    group: node.type,
    size: Math.max(10, Math.min(50, node.weight / 2)),
    color: nodeColors[node.type],
  }))

  const edges = network.edges.map(edge => ({
    from: edge.source,
    to: edge.target,
    width: Math.max(1, Math.min(5, edge.weight / 10)),
    color: edge.isDiscoveryPath ? '#f59e0b' : '#d1d5db',
    dashes: !edge.isDiscoveryPath,
  }))

  return { nodes, edges }
}

/**
 * 레이어드 레이아웃 계산 (깊이 기반)
 */
export function calculateLayeredLayout(
  network: ExplorationNetwork,
  width: number = 800,
  height: number = 600
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  // 깊이별로 노드 그룹화
  const nodesByDepth = new Map<number, NetworkNode[]>()
  for (const node of network.nodes) {
    const depth = node.depth
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, [])
    }
    nodesByDepth.get(depth)!.push(node)
  }

  // 각 깊이 레벨에 대해 위치 계산
  const maxDepth = Math.max(...nodesByDepth.keys())
  const layerHeight = height / (maxDepth + 2)

  for (const [depth, nodes] of nodesByDepth) {
    const layerWidth = width / (nodes.length + 1)
    const y = (depth + 1) * layerHeight

    nodes.forEach((node, index) => {
      const x = (index + 1) * layerWidth
      positions.set(node.id, { x, y })
    })
  }

  return positions
}

// ============================================================================
// JSON 직렬화
// ============================================================================

/**
 * 네트워크를 JSON으로 직렬화
 */
export function serializeNetwork(network: ExplorationNetwork): string {
  return JSON.stringify(network)
}

/**
 * JSON에서 네트워크 역직렬화
 */
export function deserializeNetwork(json: string): ExplorationNetwork {
  return JSON.parse(json) as ExplorationNetwork
}
