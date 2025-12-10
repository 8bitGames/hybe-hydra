# TikTok Deep Analysis Feature - Implementation Plan

## Executive Summary

`/deep-analysis` 페이지는 음악 아티스트 TikTok 계정을 위한 전문 분석 플랫폼입니다. 기존 트렌드 대시보드의 강화판으로, 다음 핵심 기능을 제공합니다:

1. **계정별 상세 분석**: 50-100개 영상을 분석하여 종합 성과 지표 제공
2. **영상 유형 분류**: AI 자동 분류 + 사전 정의 카테고리 + 커스텀 태그
3. **다중 계정 비교**: 2-5개 계정을 병렬 비교하여 유의미한 차이점 식별
4. **음악 아티스트 특화**: 음악 관련 KPI 및 팬 참여도 분석

---

## 1. Requirements Summary

### 1.1 User Answers Recap

| 항목 | 답변 |
|------|------|
| 분석 대상 | 아티스트/셀럽 공식 계정 |
| 비교 계정 수 | 2-5개 |
| 분석 영상 수 | 50-100개 (상세 분석) |
| 영상 분류 | AI 자동 + 사전 정의 + 커스텀 태그 (모두) |
| 특화 지표 | 음악 아티스트 특화 KPI |
| 시각화 | 레이더/바/테이블 모두 |
| 비교 기준 | 상대 비교 우선 + 업계 벤치마크 참고 |
| URL | `/deep-analysis` |
| 데이터 저장 | 분석 결과 저장 (시간별 추이 없음) |
| 언어 | 사용자 선택 (ko/en) |

### 1.2 Music Artist Specific Requirements

음악 아티스트 TikTok 분석에 필요한 특화 지표:

| 카테고리 | 지표 | 설명 |
|---------|------|------|
| **팬 참여도** | Fan Engagement Rate | 팬 반응 비율 (좋아요+댓글+공유/조회수) |
| | Comment Sentiment | 댓글 긍정/부정 비율 |
| | Save Rate | 저장 비율 (팬덤 지표) |
| **음악 성과** | Sound Usage | 본인 음악 사용 비디오 수 |
| | Music Viral Score | 음악 바이럴 점수 |
| | Audio Trend Correlation | 트렌드 음원과의 연관성 |
| **콘텐츠 다양성** | Content Mix Ratio | 음악/댄스/비하인드/팬서비스 비율 |
| | Format Performance | 포맷별 성과 비교 |
| | Posting Consistency | 게시 일관성 점수 |
| **성장 지표** | Follower-to-Engagement | 팔로워 대비 참여율 |
| | View Velocity | 조회수 증가 속도 |
| | Viral Hit Rate | 바이럴 영상 비율 |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         /deep-analysis PAGE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────┐  ┌────────────────────────────────────────────────┐ │
│  │ Account Search    │  │              Analysis Dashboard                 │ │
│  │ Panel (Left)      │  │                                                 │ │
│  │                   │  │  ┌─────────────────────────────────────────┐   │ │
│  │ - Search TikTok   │  │  │ Single Account Analysis View            │   │ │
│  │ - Recent accounts │  │  │ - Overview Metrics                      │   │ │
│  │ - Saved analyses  │  │  │ - Video Type Breakdown                  │   │ │
│  │                   │  │  │ - Performance Charts                    │   │ │
│  │ Selected (2-5):   │  │  │ - AI Insights                          │   │ │
│  │ ┌─────────────┐   │  │  └─────────────────────────────────────────┘   │ │
│  │ │ @account1   │   │  │                                                 │ │
│  │ │ @account2   │   │  │  ┌─────────────────────────────────────────┐   │ │
│  │ │ + Add       │   │  │  │ Multi-Account Comparison View          │   │ │
│  │ └─────────────┘   │  │  │ - Radar Chart Comparison               │   │ │
│  │                   │  │  │ - Bar Chart Rankings                   │   │ │
│  │ [Compare →]       │  │  │ - Detailed Metrics Table               │   │ │
│  │ [Analyze →]       │  │  │ - Significant Differences              │   │ │
│  └───────────────────┘  │  └─────────────────────────────────────────┘   │ │
│                         │                                                 │ │
│                         │  ┌─────────────────────────────────────────┐   │ │
│                         │  │ AI Analysis Report                      │   │ │
│                         │  │ - Strategic Recommendations             │   │ │
│                         │  │ - Content Strategy                      │   │ │
│                         │  │ - Benchmark Comparison                  │   │ │
│                         │  └─────────────────────────────────────────┘   │ │
│                         └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INPUT                                         │
│                    (TikTok Username / Account URL)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA COLLECTION LAYER                                │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐  │
│  │ TikTok RapidAPI     │  │ Playwright Scraper  │  │ Cache Layer        │  │
│  │ - getUserInfo()     │  │ - Video thumbnails  │  │ - Redis/Memory     │  │
│  │ - getUserPosts()    │  │ - Additional data   │  │ - 24hr TTL         │  │
│  │ (50-100 videos)     │  │ - Rate limit bypass │  │                    │  │
│  └─────────────────────┘  └─────────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI ANALYSIS LAYER (Sequential)                       │
│                                                                             │
│  Step 1: Video Classification Agent                                         │
│  ├─ AI Auto Classification (Dance, Lipsync, BTS, Fan Service, etc.)        │
│  ├─ Predefined Category Mapping                                             │
│  └─ Custom Tag Assignment                                                   │
│                                                                             │
│  Step 2: Metrics Calculation Agent                                          │
│  ├─ Basic Metrics (Views, Likes, Comments, Shares)                         │
│  ├─ Engagement Rates                                                        │
│  └─ Music-Specific Metrics                                                  │
│                                                                             │
│  Step 3: Pattern Analysis Agent                                             │
│  ├─ Content Pattern Detection                                               │
│  ├─ Posting Schedule Analysis                                               │
│  └─ Viral Content Identification                                            │
│                                                                             │
│  Step 4: Comparative Analysis Agent (if 2+ accounts)                        │
│  ├─ Relative Performance Scoring                                            │
│  ├─ Benchmark Comparison                                                    │
│  └─ Significant Difference Detection                                        │
│                                                                             │
│  Step 5: Strategic Insights Agent                                           │
│  ├─ Content Recommendations                                                 │
│  ├─ Growth Opportunities                                                    │
│  └─ Actionable Insights                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORAGE LAYER                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐  │
│  │ account_analyses    │  │ video_classifications│ │ comparison_reports │  │
│  │ (Analysis Results)  │  │ (Per-video tags)    │  │ (Multi-account)    │  │
│  └─────────────────────┘  └─────────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐  │
│  │ Single Account View │  │ Comparison View     │  │ Export/Share       │  │
│  │ - Metrics Dashboard │  │ - Radar Chart       │  │ - PDF Report       │  │
│  │ - Video Grid        │  │ - Bar Rankings      │  │ - JSON Export      │  │
│  │ - AI Insights       │  │ - Diff Highlights   │  │ - Shareable Link   │  │
│  └─────────────────────┘  └─────────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 Core Tables

```prisma
// 계정 분석 결과 저장
model AccountAnalysis {
  id                String   @id @default(uuid())

  // TikTok Account Info
  tiktokUserId      String   @map("tiktok_user_id")
  uniqueId          String   @map("unique_id")  // @username
  nickname          String
  avatarUrl         String?  @map("avatar_url")
  verified          Boolean  @default(false)

  // Account Stats at Analysis Time
  followers         BigInt
  following         Int
  totalLikes        BigInt   @map("total_likes")
  totalVideos       Int      @map("total_videos")

  // Analysis Parameters
  videosAnalyzed    Int      @map("videos_analyzed")  // 50-100
  analysisLanguage  String   @default("ko") @map("analysis_language")

  // Calculated Metrics (JSON for flexibility)
  basicMetrics      Json     @map("basic_metrics")      // avg views, likes, etc.
  engagementMetrics Json     @map("engagement_metrics") // rates, ratios
  musicMetrics      Json?    @map("music_metrics")      // music-specific
  contentMixMetrics Json     @map("content_mix_metrics")// category breakdown

  // AI Analysis Results (JSON)
  aiInsights        Json?    @map("ai_insights")
  recommendations   Json?    @map("recommendations")

  // Video Classifications
  videoClassifications VideoClassification[]

  // Comparison References
  comparisonReports ComparisonReportAccount[]

  // Metadata
  analyzedBy        String?  @map("analyzed_by")  // user who ran analysis
  createdAt         DateTime @default(now()) @map("created_at")
  expiresAt         DateTime @map("expires_at")   // 24hr or 7 days

  @@unique([uniqueId, createdAt])
  @@index([uniqueId])
  @@index([createdAt])
  @@map("account_analyses")
}

// 개별 영상 분류 결과
model VideoClassification {
  id              String   @id @default(uuid())
  analysisId      String   @map("analysis_id")
  analysis        AccountAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)

  // Video Reference
  tiktokVideoId   String   @map("tiktok_video_id")
  videoUrl        String   @map("video_url")
  thumbnailUrl    String?  @map("thumbnail_url")
  description     String?

  // Video Stats
  playCount       BigInt   @map("play_count")
  likeCount       Int      @map("like_count")
  commentCount    Int      @map("comment_count")
  shareCount      Int      @map("share_count")

  // Calculated
  engagementRate  Float    @map("engagement_rate")

  // Classifications
  aiCategory      String   @map("ai_category")        // AI 자동 분류
  predefinedCategory String @map("predefined_category") // 사전 정의 카테고리
  customTags      String[] @map("custom_tags")        // 커스텀 태그

  // Music Info
  musicTitle      String?  @map("music_title")
  musicId         String?  @map("music_id")
  isOwnMusic      Boolean  @default(false) @map("is_own_music")

  // Publishing Info
  publishedAt     DateTime @map("published_at")
  duration        Int?     // seconds

  // AI Analysis for this video
  contentAnalysis Json?    @map("content_analysis")

  @@index([analysisId])
  @@index([aiCategory])
  @@map("video_classifications")
}

// 다중 계정 비교 리포트
model ComparisonReport {
  id              String   @id @default(uuid())

  // Report Info
  title           String?
  language        String   @default("ko")

  // Accounts in Comparison
  accounts        ComparisonReportAccount[]

  // Comparison Results (JSON)
  radarChartData  Json     @map("radar_chart_data")
  barChartData    Json     @map("bar_chart_data")
  rankingTable    Json     @map("ranking_table")

  // Significant Differences
  significantDiffs Json    @map("significant_diffs")
  benchmarkComparison Json? @map("benchmark_comparison")

  // AI Comparative Analysis
  aiComparison    Json?    @map("ai_comparison")

  // Metadata
  createdBy       String?  @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@map("comparison_reports")
}

// 비교 리포트와 분석의 연결 테이블
model ComparisonReportAccount {
  id              String   @id @default(uuid())
  reportId        String   @map("report_id")
  report          ComparisonReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  analysisId      String   @map("analysis_id")
  analysis        AccountAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)

  // Order in comparison (1st, 2nd, etc.)
  sortOrder       Int      @default(0) @map("sort_order")

  @@unique([reportId, analysisId])
  @@map("comparison_report_accounts")
}

// 사전 정의 카테고리
model PredefinedCategory {
  id              String   @id @default(uuid())

  name            String   @unique
  nameKo          String   @map("name_ko")
  nameEn          String   @map("name_en")
  description     String?

  // For AI classification prompt
  keywords        String[]

  // Display
  icon            String?
  color           String?
  sortOrder       Int      @default(0) @map("sort_order")

  isActive        Boolean  @default(true) @map("is_active")

  @@map("predefined_categories")
}

// 커스텀 태그 (사용자/프로젝트별)
model CustomTag {
  id              String   @id @default(uuid())

  name            String
  createdBy       String?  @map("created_by")

  usageCount      Int      @default(0) @map("usage_count")

  createdAt       DateTime @default(now()) @map("created_at")

  @@unique([name, createdBy])
  @@map("custom_tags")
}
```

### 3.2 Video Classification Approach

사전 정의된 카테고리 대신 AI가 영상을 분석하여 자동으로 분류합니다:

```typescript
// AI 자동 분류 - 영상 내용 기반 동적 카테고리 생성
// Agent가 영상의 description, hashtags, music, visual content를 분석하여
// 해당 계정에 맞는 카테고리를 자동으로 생성합니다.

interface VideoClassification {
  videoId: string;
  // AI가 분석하여 생성한 카테고리 (동적)
  aiCategories: string[];       // e.g., ['dance', 'music_video', 'challenge']
  aiConfidence: number;         // 0-1
  // 사용자가 추가한 커스텀 태그
  customTags: string[];
  // AI 분석 근거
  reasoning: string;
}

// 분류 예시:
// - 댄스/퍼포먼스 영상 → ['dance', 'performance', 'choreography']
// - 일상 콘텐츠 → ['vlog', 'daily', 'behind_scenes']
// - 음악 홍보 → ['music', 'promotion', 'new_release']
// - 챌린지 참여 → ['challenge', 'trend', 'viral']
```

---

## 4. AI Agent System

### 4.1 Agent Architecture

기존 Agent 시스템을 확장하여 Deep Analysis를 위한 전문 Agent들을 추가합니다.

```
lib/agents/
├── analyzers/
│   ├── tiktok-vision.ts          # 기존 - 영상 시각 분석
│   ├── text-pattern.ts           # 기존 - 텍스트 패턴
│   ├── visual-trend.ts           # 기존 - 시각적 트렌드
│   ├── keyword-insights.ts       # 기존 - 키워드 인사이트
│   │
│   ├── video-classifier.ts       # NEW - 영상 유형 분류
│   ├── account-metrics.ts        # NEW - 계정 지표 계산
│   ├── account-patterns.ts       # NEW - 패턴 분석
│   ├── comparative-analysis.ts   # NEW - 비교 분석
│   └── strategic-insights.ts     # NEW - 전략적 인사이트
│
└── deep-analysis/
    └── orchestrator.ts           # NEW - Deep Analysis 오케스트레이터
```

### 4.2 Video Classifier Agent

```typescript
// lib/agents/analyzers/video-classifier.ts

import { BaseAgent } from '@/lib/agents/base-agent';
import { z } from 'zod';
import type { AgentContext } from '@/lib/agents/types';

// Input Schema
export const VideoClassifierInputSchema = z.object({
  videos: z.array(z.object({
    id: z.string(),
    description: z.string(),
    thumbnailUrl: z.string().optional(),
    musicTitle: z.string().optional(),
    hashtags: z.array(z.string()),
    duration: z.number().optional(),
  })),
  predefinedCategories: z.array(z.object({
    name: z.string(),
    keywords: z.array(z.string()),
  })),
  customTags: z.array(z.string()).optional(),
  language: z.enum(['ko', 'en']),
});

// Output Schema
export const VideoClassifierOutputSchema = z.object({
  classifications: z.array(z.object({
    videoId: z.string(),
    aiCategory: z.string(),
    aiConfidence: z.number(),
    predefinedCategory: z.string(),
    suggestedCustomTags: z.array(z.string()),
    reasoning: z.string(),
  })),
  categoryDistribution: z.record(z.string(), z.number()),
  dominantCategories: z.array(z.string()),
});

export type VideoClassifierInput = z.infer<typeof VideoClassifierInputSchema>;
export type VideoClassifierOutput = z.infer<typeof VideoClassifierOutputSchema>;

export class VideoClassifierAgent extends BaseAgent<VideoClassifierInput, VideoClassifierOutput> {
  constructor() {
    super({
      id: 'video-classifier',
      name: 'Video Classifier Agent',
      description: 'Classifies TikTok videos into categories using AI',
      category: 'analyzer',
      model: {
        provider: 'gemini',
        name: 'gemini-2.5-flash',
        options: { temperature: 0.3 }  // Low temp for consistent classification
      },
      prompts: {
        system: `You are a TikTok video content classifier specialized in music artist content.
Your task is to analyze video metadata and classify each video into the most appropriate category.

Categories for music artists:
- performance: Stage performances, concerts, music show appearances
- music_promotion: New song/album promotion, MV teasers
- dance_challenge: Viral dance challenges, trend participation
- behind_the_scenes: Making-of content, practice sessions
- fan_service: Fan messages, greetings, Q&A
- daily_vlog: Daily life content
- lipsync: Lip sync videos
- collaboration: Content with other artists/creators
- tutorial: How-to content, teaching
- other: Anything that doesn't fit above

Consider:
1. Video description/caption keywords
2. Hashtags used
3. Music title (if their own song = likely promotion)
4. Video duration (short = challenge, long = vlog/bts)

Return classification with confidence score (0-1).`,
        templates: {}
      },
      inputSchema: VideoClassifierInputSchema,
      outputSchema: VideoClassifierOutputSchema,
    });
  }

  protected buildPrompt(input: VideoClassifierInput, context: AgentContext): string {
    const lang = input.language === 'ko' ? '한국어로' : 'in English';

    return `Classify the following ${input.videos.length} TikTok videos ${lang}.

Available predefined categories:
${input.predefinedCategories.map(c => `- ${c.name}: keywords [${c.keywords.join(', ')}]`).join('\n')}

${input.customTags?.length ? `Custom tags available: ${input.customTags.join(', ')}` : ''}

Videos to classify:
${input.videos.map((v, i) => `
Video ${i + 1} (ID: ${v.id}):
- Description: ${v.description || 'N/A'}
- Hashtags: ${v.hashtags.join(', ') || 'None'}
- Music: ${v.musicTitle || 'Unknown'}
- Duration: ${v.duration ? `${v.duration}s` : 'Unknown'}
`).join('\n')}

For each video, provide:
1. AI category (your best guess)
2. Confidence score (0-1)
3. Predefined category match
4. Suggested custom tags (if applicable)
5. Brief reasoning

Return as JSON matching the output schema.`;
  }
}

export function createVideoClassifierAgent(): VideoClassifierAgent {
  return new VideoClassifierAgent();
}
```

### 4.3 Account Metrics Agent

```typescript
// lib/agents/analyzers/account-metrics.ts

export const AccountMetricsInputSchema = z.object({
  account: z.object({
    uniqueId: z.string(),
    followers: z.number(),
    totalVideos: z.number(),
  }),
  videos: z.array(z.object({
    playCount: z.number(),
    likeCount: z.number(),
    commentCount: z.number(),
    shareCount: z.number(),
    publishedAt: z.string(),
    duration: z.number().optional(),
    isOwnMusic: z.boolean().optional(),
  })),
  language: z.enum(['ko', 'en']),
});

export const AccountMetricsOutputSchema = z.object({
  basicMetrics: z.object({
    totalViews: z.number(),
    avgViews: z.number(),
    medianViews: z.number(),
    maxViews: z.number(),
    minViews: z.number(),
    totalLikes: z.number(),
    avgLikes: z.number(),
    totalComments: z.number(),
    avgComments: z.number(),
    totalShares: z.number(),
    avgShares: z.number(),
  }),
  engagementMetrics: z.object({
    overallEngagementRate: z.number(),  // (likes+comments+shares)/views * 100
    likeRate: z.number(),
    commentRate: z.number(),
    shareRate: z.number(),
    engagementPerFollower: z.number(),  // engagement/followers
  }),
  musicMetrics: z.object({
    ownMusicUsageRate: z.number(),
    ownMusicAvgEngagement: z.number(),
    externalMusicAvgEngagement: z.number(),
  }),
  performanceMetrics: z.object({
    viralVideoCount: z.number(),        // engagement > 10%
    highPerformingCount: z.number(),    // engagement 6-10%
    averagePerformingCount: z.number(), // engagement 3-6%
    lowPerformingCount: z.number(),     // engagement < 3%
    viralRate: z.number(),
  }),
  postingMetrics: z.object({
    avgPostsPerWeek: z.number(),
    postingConsistencyScore: z.number(),
    avgDaysBetweenPosts: z.number(),
  }),
  benchmarkComparison: z.object({
    industryAvgEngagement: z.number(),   // 5.96% for TikTok
    performanceVsBenchmark: z.enum(['above', 'at', 'below']),
    percentilRank: z.number(),
  }),
});

// Agent implementation similar to VideoClassifierAgent...
```

### 4.4 Comparative Analysis Agent

```typescript
// lib/agents/analyzers/comparative-analysis.ts

export const ComparativeAnalysisInputSchema = z.object({
  accounts: z.array(z.object({
    uniqueId: z.string(),
    nickname: z.string(),
    metrics: z.any(),  // AccountMetricsOutput
  })),
  language: z.enum(['ko', 'en']),
});

export const ComparativeAnalysisOutputSchema = z.object({
  radarChartData: z.object({
    dimensions: z.array(z.string()),
    accounts: z.array(z.object({
      uniqueId: z.string(),
      values: z.array(z.number()),  // Normalized 0-100
    })),
  }),
  barChartData: z.array(z.object({
    metric: z.string(),
    metricLabel: z.string(),
    values: z.array(z.object({
      uniqueId: z.string(),
      value: z.number(),
      rank: z.number(),
    })),
  })),
  significantDifferences: z.array(z.object({
    metric: z.string(),
    leader: z.string(),
    laggard: z.string(),
    difference: z.number(),
    differencePercent: z.number(),
    significance: z.enum(['high', 'medium', 'low']),
    interpretation: z.string(),
  })),
  overallRanking: z.array(z.object({
    rank: z.number(),
    uniqueId: z.string(),
    overallScore: z.number(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  })),
});
```

### 4.5 Strategic Insights Agent

```typescript
// lib/agents/analyzers/strategic-insights.ts

export const StrategicInsightsInputSchema = z.object({
  account: z.object({
    uniqueId: z.string(),
    nickname: z.string(),
  }),
  metrics: z.any(),         // AccountMetricsOutput
  classifications: z.any(), // VideoClassifierOutput
  comparison: z.any().optional(), // ComparativeAnalysisOutput
  language: z.enum(['ko', 'en']),
});

export const StrategicInsightsOutputSchema = z.object({
  summary: z.object({
    headline: z.string(),
    overallAssessment: z.string(),
    keyStrengths: z.array(z.string()),
    keyWeaknesses: z.array(z.string()),
  }),
  contentStrategy: z.object({
    currentMix: z.string(),
    recommendedMix: z.string(),
    categoryRecommendations: z.array(z.object({
      category: z.string(),
      currentShare: z.number(),
      recommendedShare: z.number(),
      reason: z.string(),
    })),
  }),
  engagementStrategy: z.object({
    bestPerformingFormat: z.string(),
    optimalPostingTime: z.string(),
    hashtagRecommendations: z.array(z.string()),
    captionTips: z.array(z.string()),
  }),
  growthOpportunities: z.array(z.object({
    opportunity: z.string(),
    potentialImpact: z.enum(['high', 'medium', 'low']),
    implementationDifficulty: z.enum(['easy', 'medium', 'hard']),
    actionableSteps: z.array(z.string()),
  })),
  competitiveInsights: z.array(z.object({
    insight: z.string(),
    learnFrom: z.string(),  // account username
    action: z.string(),
  })).optional(),
});
```

### 4.6 Deep Analysis Orchestrator

```typescript
// lib/agents/deep-analysis/orchestrator.ts

import { createVideoClassifierAgent } from '../analyzers/video-classifier';
import { createAccountMetricsAgent } from '../analyzers/account-metrics';
import { createAccountPatternsAgent } from '../analyzers/account-patterns';
import { createComparativeAnalysisAgent } from '../analyzers/comparative-analysis';
import { createStrategicInsightsAgent } from '../analyzers/strategic-insights';

interface DeepAnalysisConfig {
  language: 'ko' | 'en';
  videoLimit: number;  // 50-100
}

interface DeepAnalysisResult {
  success: boolean;
  accountAnalyses: AccountAnalysisResult[];
  comparisonReport?: ComparisonReportResult;
  error?: string;
}

export class DeepAnalysisOrchestrator {
  private config: DeepAnalysisConfig;

  constructor(config: DeepAnalysisConfig) {
    this.config = config;
  }

  async analyzeAccounts(usernames: string[]): Promise<DeepAnalysisResult> {
    const accountAnalyses: AccountAnalysisResult[] = [];

    // Step 1: Fetch data for all accounts in parallel
    console.log('[DeepAnalysis] Step 1: Fetching account data...');
    const accountDataPromises = usernames.map(u => this.fetchAccountData(u));
    const accountsData = await Promise.all(accountDataPromises);

    // Step 2: Classify videos for each account (sequential to manage API limits)
    console.log('[DeepAnalysis] Step 2: Classifying videos...');
    const classifierAgent = createVideoClassifierAgent();
    const classifications = [];

    for (const accountData of accountsData) {
      const result = await classifierAgent.execute({
        videos: accountData.videos,
        predefinedCategories: MUSIC_ARTIST_CATEGORIES,
        language: this.config.language,
      }, this.getContext());
      classifications.push(result);
    }

    // Step 3: Calculate metrics for each account
    console.log('[DeepAnalysis] Step 3: Calculating metrics...');
    const metricsAgent = createAccountMetricsAgent();
    const metrics = [];

    for (let i = 0; i < accountsData.length; i++) {
      const result = await metricsAgent.execute({
        account: accountsData[i].account,
        videos: accountsData[i].videos,
        language: this.config.language,
      }, this.getContext());
      metrics.push(result);
    }

    // Step 4: Pattern analysis
    console.log('[DeepAnalysis] Step 4: Analyzing patterns...');
    const patternsAgent = createAccountPatternsAgent();
    const patterns = [];

    for (let i = 0; i < accountsData.length; i++) {
      const result = await patternsAgent.execute({
        videos: accountsData[i].videos,
        classifications: classifications[i],
        language: this.config.language,
      }, this.getContext());
      patterns.push(result);
    }

    // Step 5: Comparative analysis (if 2+ accounts)
    let comparisonReport = null;
    if (usernames.length >= 2) {
      console.log('[DeepAnalysis] Step 5: Comparative analysis...');
      const comparativeAgent = createComparativeAnalysisAgent();
      comparisonReport = await comparativeAgent.execute({
        accounts: accountsData.map((d, i) => ({
          uniqueId: d.account.uniqueId,
          nickname: d.account.nickname,
          metrics: metrics[i],
        })),
        language: this.config.language,
      }, this.getContext());
    }

    // Step 6: Strategic insights for each account
    console.log('[DeepAnalysis] Step 6: Generating strategic insights...');
    const insightsAgent = createStrategicInsightsAgent();

    for (let i = 0; i < accountsData.length; i++) {
      const insights = await insightsAgent.execute({
        account: accountsData[i].account,
        metrics: metrics[i],
        classifications: classifications[i],
        comparison: comparisonReport,
        language: this.config.language,
      }, this.getContext());

      accountAnalyses.push({
        account: accountsData[i].account,
        videos: accountsData[i].videos,
        classifications: classifications[i],
        metrics: metrics[i],
        patterns: patterns[i],
        insights: insights,
      });
    }

    return {
      success: true,
      accountAnalyses,
      comparisonReport,
    };
  }

  private async fetchAccountData(username: string) {
    // Implementation using TikTok MCP API
    // getUserInfo + getUserPosts with pagination
  }

  private getContext() {
    return {
      workflow: {
        artistName: 'Deep Analysis',
        platform: 'tiktok' as const,
        language: this.config.language,
        sessionId: crypto.randomUUID(),
      }
    };
  }
}
```

---

## 5. API Endpoints

### 5.1 Account Analysis API

```typescript
// app/api/v1/deep-analysis/analyze/route.ts

// POST /api/v1/deep-analysis/analyze
// Start analysis for one or more accounts
interface AnalyzeRequest {
  usernames: string[];           // 1-5 accounts
  videoLimit?: number;           // 50-100, default 50
  language?: 'ko' | 'en';        // default 'ko'
  includeComparison?: boolean;   // default true if 2+ accounts
}

interface AnalyzeResponse {
  success: boolean;
  jobId: string;                 // For polling status
  estimatedTime: number;         // seconds
  error?: string;
}

// GET /api/v1/deep-analysis/status/:jobId
// Check analysis status
interface StatusResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    currentStep: string;
  };
  result?: DeepAnalysisResult;
  error?: string;
}
```

### 5.2 Analysis Results API

```typescript
// GET /api/v1/deep-analysis/results/:analysisId
// Get saved analysis result
interface AnalysisResultResponse {
  success: boolean;
  analysis: AccountAnalysis & {
    videoClassifications: VideoClassification[];
  };
}

// GET /api/v1/deep-analysis/comparison/:comparisonId
// Get comparison report
interface ComparisonResultResponse {
  success: boolean;
  report: ComparisonReport & {
    accounts: (ComparisonReportAccount & {
      analysis: AccountAnalysis;
    })[];
  };
}
```

### 5.3 Search & History API

```typescript
// GET /api/v1/deep-analysis/search?q=username
// Search TikTok accounts
interface SearchResponse {
  success: boolean;
  users: TikTokUser[];
}

// GET /api/v1/deep-analysis/history
// Get user's analysis history
interface HistoryResponse {
  success: boolean;
  analyses: AccountAnalysis[];
  comparisons: ComparisonReport[];
  totalCount: number;
}
```

---

## 6. UI Components

### 6.1 Component Architecture

```
app/(dashboard)/deep-analysis/
└── page.tsx                    # Main page

components/features/deep-analysis/
├── DeepAnalysisPage.tsx        # Main page component
│
├── search/
│   ├── AccountSearchPanel.tsx  # Left panel - search & select
│   ├── AccountSearchInput.tsx  # Search input with autocomplete
│   ├── AccountCard.tsx         # Selected account card
│   └── RecentAnalysesList.tsx  # Recent/saved analyses
│
├── analysis/
│   ├── SingleAccountView.tsx   # Single account analysis view
│   ├── AccountOverview.tsx     # Account summary header
│   ├── MetricsGrid.tsx         # Key metrics cards
│   ├── ContentMixChart.tsx     # Category distribution
│   ├── VideoGrid.tsx           # Video list with classifications
│   ├── VideoCard.tsx           # Individual video with tags
│   ├── PerformanceChart.tsx    # Performance over time
│   └── AIInsightsPanel.tsx     # Strategic insights
│
├── comparison/
│   ├── ComparisonView.tsx      # Multi-account comparison
│   ├── RadarChartComparison.tsx
│   ├── BarChartRanking.tsx
│   ├── MetricsTable.tsx        # Detailed comparison table
│   └── SignificantDiffs.tsx    # Highlighted differences
│
├── charts/
│   ├── RadarChart.tsx          # Recharts radar
│   ├── BarChart.tsx            # Recharts bar
│   ├── DonutChart.tsx          # Category distribution
│   └── LineChart.tsx           # Performance trend
│
├── shared/
│   ├── LanguageToggle.tsx      # ko/en switch
│   ├── AnalysisProgress.tsx    # Loading/progress indicator
│   ├── MetricCard.tsx          # Individual metric display
│   ├── CategoryBadge.tsx       # Video category badge
│   └── BenchmarkIndicator.tsx  # vs benchmark display
│
└── export/
    ├── ExportButton.tsx        # Export options
    └── PDFReportGenerator.tsx  # PDF generation
```

### 6.2 Key Component Implementations

#### AccountSearchPanel

```tsx
// components/features/deep-analysis/search/AccountSearchPanel.tsx

interface AccountSearchPanelProps {
  selectedAccounts: TikTokUser[];
  onAddAccount: (user: TikTokUser) => void;
  onRemoveAccount: (uniqueId: string) => void;
  onStartAnalysis: () => void;
  onStartComparison: () => void;
  maxAccounts?: number;  // default 5
}

export function AccountSearchPanel({
  selectedAccounts,
  onAddAccount,
  onRemoveAccount,
  onStartAnalysis,
  onStartComparison,
  maxAccounts = 5,
}: AccountSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TikTokUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    const results = await searchTikTokUsers(query);
    setSearchResults(results);
    setIsSearching(false);
  }, 300);

  return (
    <div className="w-80 border-r border-gray-200 dark:border-gray-800 p-4 flex flex-col h-full">
      {/* Search Input */}
      <div className="mb-4">
        <AccountSearchInput
          value={searchQuery}
          onChange={(v) => {
            setSearchQuery(v);
            debouncedSearch(v);
          }}
          isLoading={isSearching}
          placeholder="TikTok @username 검색..."
        />
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-4 max-h-48 overflow-y-auto">
          {searchResults.map((user) => (
            <button
              key={user.id}
              onClick={() => onAddAccount(user)}
              disabled={selectedAccounts.length >= maxAccounts}
              className="w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-2"
            >
              <img src={user.avatarUrl} className="w-8 h-8 rounded-full" />
              <div className="text-left">
                <div className="font-medium">@{user.uniqueId}</div>
                <div className="text-xs text-gray-500">{formatNumber(user.followers)} followers</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected Accounts */}
      <div className="flex-1">
        <h3 className="font-medium mb-2">선택된 계정 ({selectedAccounts.length}/{maxAccounts})</h3>
        <div className="space-y-2">
          {selectedAccounts.map((account) => (
            <AccountCard
              key={account.uniqueId}
              account={account}
              onRemove={() => onRemoveAccount(account.uniqueId)}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 space-y-2">
        <Button
          onClick={onStartAnalysis}
          disabled={selectedAccounts.length === 0}
          className="w-full"
        >
          분석 시작
        </Button>
        {selectedAccounts.length >= 2 && (
          <Button
            onClick={onStartComparison}
            variant="outline"
            className="w-full"
          >
            비교 분석
          </Button>
        )}
      </div>

      {/* Recent Analyses */}
      <RecentAnalysesList className="mt-4" />
    </div>
  );
}
```

#### RadarChartComparison

```tsx
// components/features/deep-analysis/charts/RadarChartComparison.tsx

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

interface RadarChartComparisonProps {
  data: {
    dimensions: string[];
    accounts: {
      uniqueId: string;
      values: number[];  // 0-100 normalized
      color: string;
    }[];
  };
  language: 'ko' | 'en';
}

const DIMENSION_LABELS = {
  ko: {
    engagement: '참여율',
    viralRate: '바이럴율',
    consistency: '일관성',
    contentMix: '콘텐츠 다양성',
    growthRate: '성장률',
    musicUsage: '음악 활용',
  },
  en: {
    engagement: 'Engagement',
    viralRate: 'Viral Rate',
    consistency: 'Consistency',
    contentMix: 'Content Diversity',
    growthRate: 'Growth Rate',
    musicUsage: 'Music Usage',
  },
};

export function RadarChartComparison({ data, language }: RadarChartComparisonProps) {
  // Transform data for Recharts
  const chartData = data.dimensions.map((dim, idx) => {
    const point: Record<string, unknown> = {
      dimension: DIMENSION_LABELS[language][dim] || dim,
    };
    data.accounts.forEach((account) => {
      point[account.uniqueId] = account.values[idx];
    });
    return point;
  });

  return (
    <div className="w-full h-96">
      <ResponsiveContainer>
        <RadarChart data={chartData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="dimension" />
          <PolarRadiusAxis angle={30} domain={[0, 100]} />
          {data.accounts.map((account) => (
            <Radar
              key={account.uniqueId}
              name={`@${account.uniqueId}`}
              dataKey={account.uniqueId}
              stroke={account.color}
              fill={account.color}
              fillOpacity={0.2}
            />
          ))}
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

#### MetricsTable (Comparison)

```tsx
// components/features/deep-analysis/comparison/MetricsTable.tsx

interface MetricsTableProps {
  accounts: {
    uniqueId: string;
    nickname: string;
    metrics: AccountMetricsOutput;
  }[];
  significantDiffs: SignificantDifference[];
  language: 'ko' | 'en';
}

export function MetricsTable({ accounts, significantDiffs, language }: MetricsTableProps) {
  const metrics = [
    { key: 'avgViews', label: language === 'ko' ? '평균 조회수' : 'Avg Views', format: formatNumber },
    { key: 'engagementRate', label: language === 'ko' ? '참여율' : 'Engagement Rate', format: formatPercent },
    { key: 'viralRate', label: language === 'ko' ? '바이럴율' : 'Viral Rate', format: formatPercent },
    { key: 'avgPostsPerWeek', label: language === 'ko' ? '주간 게시물' : 'Posts/Week', format: (n) => n.toFixed(1) },
    // ... more metrics
  ];

  // Find significant diffs for highlighting
  const isSignificant = (metricKey: string, accountId: string) => {
    const diff = significantDiffs.find(d => d.metric === metricKey);
    if (!diff) return null;
    if (diff.leader === accountId) return 'leader';
    if (diff.laggard === accountId) return 'laggard';
    return null;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left p-2">지표</th>
            {accounts.map((a) => (
              <th key={a.uniqueId} className="text-right p-2">@{a.uniqueId}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.key} className="border-t">
              <td className="p-2 font-medium">{metric.label}</td>
              {accounts.map((a) => {
                const status = isSignificant(metric.key, a.uniqueId);
                return (
                  <td
                    key={a.uniqueId}
                    className={cn(
                      'p-2 text-right',
                      status === 'leader' && 'bg-green-50 text-green-700 font-bold',
                      status === 'laggard' && 'bg-red-50 text-red-700'
                    )}
                  >
                    {metric.format(getMetricValue(a.metrics, metric.key))}
                    {status === 'leader' && ' ↑'}
                    {status === 'laggard' && ' ↓'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 7. Implementation Phases

### Phase 1: Foundation (3-4 days)

**Goals**: 기본 인프라 및 데이터 레이어 구축

**Tasks**:
1. Database schema migration
   - `account_analyses` 테이블
   - `video_classifications` 테이블
   - `comparison_reports` 테이블
   - `predefined_categories` seed data

2. TikTok API integration enhancement
   - `getUserInfo` + `getUserPosts` 통합 함수
   - Pagination handling for 50-100 videos
   - Rate limit management

3. Basic page routing
   - `/deep-analysis` route setup
   - Layout structure

### Phase 2: AI Agent System (4-5 days)

**Goals**: 분석 Agent 시스템 구축

**Tasks**:
1. Video Classifier Agent
   - AI 자동 분류 로직
   - Predefined category mapping
   - Custom tag suggestion

2. Account Metrics Agent
   - 기본 지표 계산
   - Engagement 지표 계산
   - Music-specific 지표 계산

3. Account Patterns Agent
   - 게시 패턴 분석
   - 콘텐츠 믹스 분석

4. Deep Analysis Orchestrator
   - Sequential execution flow
   - Error handling
   - Progress tracking

### Phase 3: Single Account Analysis UI (3-4 days)

**Goals**: 단일 계정 분석 화면 완성

**Tasks**:
1. Account Search Panel
   - Search functionality
   - Account selection (max 5)

2. Single Account View
   - Overview metrics
   - Content mix chart (donut)
   - Video grid with classifications
   - Performance chart

3. AI Insights Panel
   - Strategic recommendations
   - Content strategy
   - Growth opportunities

### Phase 4: Comparative Analysis (3-4 days)

**Goals**: 다중 계정 비교 기능 완성

**Tasks**:
1. Comparative Analysis Agent
   - Relative scoring
   - Significant difference detection
   - Benchmark comparison

2. Comparison UI
   - Radar chart comparison
   - Bar chart rankings
   - Detailed metrics table
   - Difference highlights

3. Strategic Insights Agent
   - Competitive insights
   - Cross-account recommendations

### Phase 5: Polish & Export (2-3 days)

**Goals**: 마무리 및 내보내기 기능

**Tasks**:
1. UI Polish
   - Loading states
   - Error handling
   - Responsive design
   - Animations

2. Language Support
   - ko/en toggle
   - All strings localized

3. Export Features
   - JSON export
   - PDF report generation (optional)

4. History & Caching
   - Save analysis results
   - Recent analyses list
   - Cache invalidation

---

## 8. Technical Considerations

### 8.1 Performance

- **Video Fetching**: Batch API calls with pagination (30 videos per call)
- **AI Analysis**: Sequential agents to manage API rate limits
- **Caching**: 24-hour cache for analysis results
- **Progress UI**: WebSocket or polling for real-time progress updates

### 8.2 Rate Limits

```typescript
// Rate limit management
const RATE_LIMITS = {
  tiktokApi: {
    requestsPerSecond: 5,
    requestsPerMinute: 100,
  },
  geminiApi: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
  },
};

// Implement with p-limit or similar
import pLimit from 'p-limit';
const apiLimit = pLimit(5);  // 5 concurrent requests
```

### 8.3 Error Handling

```typescript
// Graceful degradation
const analysisResult = {
  success: true,
  accountAnalyses: [
    {
      success: true,
      data: {...},
    },
    {
      success: false,
      error: 'Account not found',
      fallback: null,
    }
  ],
  warnings: [
    'Account @xyz has limited data (only 23 videos available)',
  ],
};
```

### 8.4 Security

- **Input validation**: Zod schemas for all inputs
- **API key protection**: Server-side only, never exposed to client
- **Rate limiting**: Per-user request limits

---

## 9. Metrics & KPIs (Industry Benchmarks)

### 9.1 TikTok Benchmark Data (2025)

| Metric | Industry Average | High Performer | Viral |
|--------|-----------------|----------------|-------|
| Engagement Rate | 5.96% | 8-12% | >15% |
| Like Rate | 4-5% | 6-8% | >10% |
| Comment Rate | 0.1-0.3% | 0.3-0.5% | >0.5% |
| Share Rate | 0.2-0.5% | 0.5-1% | >1% |
| Video Completion | 20-30% | 40-50% | >60% |

### 9.2 Music Artist Specific Benchmarks

| Metric | Average | Top Artist |
|--------|---------|------------|
| Fan Engagement Rate | 7% | 12%+ |
| Own Music Usage | 30% | 50%+ |
| Posting Frequency | 3-5/week | 7+/week |
| Challenge Participation | 20% | 40%+ |
| Fan Service Content | 15% | 25%+ |

---

## 10. Future Enhancements (Out of Scope)

다음 기능들은 현재 범위에서 제외되었으나 향후 추가 가능:

1. **Historical Tracking**: 시간별 지표 추이 모니터링
2. **Auto-scheduled Analysis**: 정기 자동 분석 (cron)
3. **Alerts**: 지표 변화 시 알림
4. **Competitor Monitoring**: 경쟁사 자동 추적
5. **Sentiment Analysis**: 댓글 감성 분석
6. **Hashtag Performance**: 해시태그별 성과 분석
7. **Collaboration Detection**: 콜라보 영상 자동 탐지
8. **Content Calendar**: 게시 일정 추천

---

## Summary

이 기획서는 `/deep-analysis` 페이지의 완전한 구현 계획을 담고 있습니다:

- **5개 주요 AI Agent**: 영상 분류, 지표 계산, 패턴 분석, 비교 분석, 전략 인사이트
- **음악 아티스트 특화**: 10개 사전 정의 카테고리, 음악 특화 KPI
- **포괄적 비교 기능**: 레이더/바/테이블 차트, 유의미한 차이점 하이라이트
- **다국어 지원**: 한국어/영어 선택

예상 개발 기간: **15-20일** (1인 기준)
