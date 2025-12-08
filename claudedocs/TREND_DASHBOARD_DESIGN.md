# Trend Intelligence Dashboard - Design Specification

## Executive Summary

새로운 대시보드는 사용자가 등록해둔 키워드/해시태그를 기준으로 TikTok 트렌드를 한눈에 파악하고, 어떤 콘텐츠를 만들면 좋을지 빠르게 결정할 수 있는 **Trend Intelligence Hub** 역할을 합니다.

---

## 1. Page Purpose & Goals

### Primary Goals
1. **트렌드 모니터링**: 등록한 키워드/해시태그의 실시간 트렌드 현황 파악
2. **콘텐츠 아이디어 발굴**: AI 기반 콘텐츠 제안 및 바이럴 패턴 분석
3. **빠른 의사결정**: 한눈에 보는 핵심 지표와 추천 액션

### Target Users
- 콘텐츠 크리에이터/마케터
- 캠페인 매니저
- 소셜 미디어 전략가

---

## 2. Screen Layout Design

### 2.1 Overall Structure (Grid Layout)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Trend Intelligence Dashboard                        [+ Add Keyword] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────┐  │
│  │  SECTION A: Content Production      │  │  SECTION B: Quick Actions   │  │
│  │  Summary (Compact)                  │  │  - Create Content           │  │
│  │  - Total Generated: 156             │  │  - Analyze Trend            │  │
│  │  - Processing: 3                    │  │  - View Discover            │  │
│  │  - Published: 89                    │  │                             │  │
│  └─────────────────────────────────────┘  └─────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  SECTION C: My Tracked Keywords (Horizontal Scroll/Grid)             │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │ #kpop    │ │ #dance   │ │ country  │ │ #newjeans│ │ + Add    │   │  │
│  │  │ ▲ 23%    │ │ ▼ 5%     │ │ → 0%     │ │ ▲ 45%    │ │ Keyword  │   │  │
│  │  │ 1.2M avg │ │ 890K avg │ │ 456K avg │ │ 2.1M avg │ │          │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  SECTION D: Trend Overview (Selected Keyword Detail)                 │  │
│  │  ┌─────────────────────────────┐ ┌─────────────────────────────────┐ │  │
│  │  │ D1: Performance Metrics     │ │ D2: Top Hashtags               │ │  │
│  │  │ - Avg Views: 1.2M          │ │ #fyp #viral #trending          │ │  │
│  │  │ - Avg Engagement: 8.5%     │ │ #dance #challenge              │ │  │
│  │  │ - Viral Threshold: >12%    │ │ [Copy All] [Use in Content]    │ │  │
│  │  └─────────────────────────────┘ └─────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────┐ ┌─────────────────────────────────┐ │  │
│  │  │ D3: Viral Videos (Top 3)   │ │ D4: AI Content Suggestions     │ │  │
│  │  │ 📹 Video 1 - 5.2M views    │ │ 💡 "Try dance challenge..."   │ │  │
│  │  │ 📹 Video 2 - 3.8M views    │ │ 💡 "Use trending audio..."    │ │  │
│  │  │ 📹 Video 3 - 2.9M views    │ │ 💡 "Caption template..."      │ │  │
│  │  └─────────────────────────────┘ └─────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  SECTION E: Cross-Keyword Insights                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │ E1: Trending Across All Keywords                                │ │  │
│  │  │ Common hashtags appearing in multiple tracked keywords:         │ │  │
│  │  │ #fyp (5/5) | #viral (4/5) | #trending (4/5) | #2024 (3/5)      │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │ E2: Today's Content Recommendation                              │ │  │
│  │  │ Based on your keywords, here's what to create today:            │ │  │
│  │  │ 🎯 Primary: "K-pop dance challenge with #newjeans trend"        │ │  │
│  │  │ 🎯 Secondary: "Country music x K-pop fusion content"            │ │  │
│  │  │                                              [Start Creating →] │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  SECTION F: Search History & Recent Analysis                         │  │
│  │  ┌────────────┬────────────┬────────────┬────────────┬────────────┐ │  │
│  │  │ Yesterday  │ 2 days ago │ 3 days ago │ Last week  │ View All   │ │  │
│  │  │ "kpop"     │ "dance"    │ "viral"    │ "music"    │    →       │ │  │
│  │  │ 45 videos  │ 32 videos  │ 28 videos  │ 51 videos  │            │ │  │
│  │  └────────────┴────────────┴────────────┴────────────┴────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

### Section A: Content Production Summary (Compact)
**Purpose**: 현재 콘텐츠 제작 현황을 간략히 표시

```typescript
interface ContentSummary {
  totalGenerated: number;
  processing: number;
  completed: number;
  published: number;
  recentActivity: {
    last24h: number;
    last7d: number;
  };
}
```

**UI Elements**:
- 4개의 소형 메트릭 카드 (가로 배열)
- 아이콘 + 숫자 + 라벨
- 클릭 시 해당 상세 페이지로 이동

---

### Section B: Quick Actions
**Purpose**: 주요 액션 버튼 모음

**Actions**:
1. **Create Content** → `/create` 페이지로 이동
2. **Analyze New Keyword** → 키워드 입력 모달 → `/discover`로 이동
3. **View All Trends** → `/discover` 페이지로 이동

---

### Section C: My Tracked Keywords
**Purpose**: 사용자가 등록/저장한 키워드 목록 및 트렌드 변화

```typescript
interface TrackedKeyword {
  id: string;
  keyword: string;
  type: 'keyword' | 'hashtag';
  addedAt: Date;
  lastAnalyzedAt: Date;

  // Trend metrics
  currentMetrics: {
    avgViews: number;
    avgEngagement: number;
    totalVideos: number;
  };

  // Change from last analysis
  trend: {
    direction: 'up' | 'down' | 'stable';
    percentChange: number;
  };

  // Alert settings
  alerts: {
    enabled: boolean;
    threshold: number; // e.g., notify if engagement drops >20%
  };
}
```

**UI Elements**:
- 가로 스크롤 카드 리스트 (모바일) / 그리드 (데스크톱)
- 각 카드: 키워드명, 트렌드 화살표(▲/▼/→), 평균 조회수
- 클릭 시 Section D에 상세 정보 표시
- "+" 버튼으로 새 키워드 추가

---

### Section D: Trend Overview (Selected Keyword)
**Purpose**: 선택한 키워드의 상세 트렌드 분석

#### D1: Performance Metrics
```typescript
interface KeywordMetrics {
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgEngagementRate: number;
  medianViews: number;

  benchmarks: {
    viralThreshold: string;    // ">12% engagement"
    highPerformingThreshold: string;
    averagePerformance: string;
  };
}
```

#### D2: Top Hashtags
- 해당 키워드와 함께 자주 사용되는 해시태그 (상위 10개)
- 각 해시태그별 평균 engagement
- "Copy All" 버튼 - 클립보드 복사
- "Use in Content" 버튼 - 콘텐츠 생성 페이지로 전달

#### D3: Viral Videos Preview
- 상위 3개 바이럴 비디오 썸네일 (또는 텍스트 기반)
- 조회수, engagement rate
- 클릭 시 TikTok으로 이동 또는 상세 모달

#### D4: AI Content Suggestions
- KeywordInsightsAgent의 AI 분석 결과
- 콘텐츠 전략 제안
- 캡션 템플릿
- 비디오 아이디어

---

### Section E: Cross-Keyword Insights
**Purpose**: 여러 키워드를 종합 분석한 인사이트

#### E1: Common Trending Elements
- 등록된 모든 키워드에서 공통으로 나타나는 해시태그
- 공통 콘텐츠 패턴
- 공통 CTA 패턴

#### E2: Today's Content Recommendation
- AI가 종합 분석한 "오늘 만들면 좋을 콘텐츠"
- 우선순위별 추천 (Primary, Secondary)
- "Start Creating" 버튼 → 콘텐츠 생성 페이지로 추천 데이터 전달

---

### Section F: Search History
**Purpose**: 최근 검색/분석한 키워드 히스토리

```typescript
interface SearchHistory {
  id: string;
  keyword: string;
  searchedAt: Date;
  videosAnalyzed: number;
  topInsight: string; // AI 요약 한 줄
}
```

---

## 4. Database Schema Changes

### New Table: `tracked_keywords`

```prisma
model TrackedKeyword {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  keyword       String
  type          KeywordType @default(KEYWORD) // KEYWORD or HASHTAG
  displayName   String?  @map("display_name") // User-friendly name

  // Tracking settings
  isActive      Boolean  @default(true) @map("is_active")
  alertEnabled  Boolean  @default(false) @map("alert_enabled")
  alertThreshold Float?  @map("alert_threshold") // % change to trigger alert

  // Metrics snapshot (updated on each analysis)
  lastAvgViews       BigInt?  @map("last_avg_views")
  lastAvgEngagement  Float?   @map("last_avg_engagement")
  lastTotalVideos    Int?     @map("last_total_videos")
  lastAnalyzedAt     DateTime? @map("last_analyzed_at")

  // Previous metrics for trend calculation
  prevAvgViews       BigInt?  @map("prev_avg_views")
  prevAvgEngagement  Float?   @map("prev_avg_engagement")

  // Metadata
  sortOrder     Int      @default(0) @map("sort_order")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@unique([userId, keyword])
  @@index([userId])
  @@index([isActive])
  @@map("tracked_keywords")
}

enum KeywordType {
  KEYWORD
  HASHTAG
}
```

### New Table: `keyword_search_history`

```prisma
model KeywordSearchHistory {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  keyword       String
  platform      TrendPlatform @default(TIKTOK)

  // Results summary
  videosAnalyzed   Int      @map("videos_analyzed")
  avgEngagement    Float?   @map("avg_engagement")
  topInsight       String?  @map("top_insight") // AI summary

  // Reference to full analysis (optional)
  analysisId    String?  @map("analysis_id")

  searchedAt    DateTime @default(now()) @map("searched_at")

  @@index([userId])
  @@index([searchedAt])
  @@map("keyword_search_history")
}
```

### New Table: `daily_content_recommendations`

```prisma
model DailyContentRecommendation {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")

  // Recommendations
  primaryRecommendation    String   @map("primary_recommendation")
  primaryKeywords          String[] @map("primary_keywords")
  secondaryRecommendation  String?  @map("secondary_recommendation")
  secondaryKeywords        String[] @map("secondary_keywords")

  // Source analysis
  basedOnKeywords    String[] @map("based_on_keywords")
  analysisContext    Json?    @map("analysis_context")

  // Validity
  generatedAt  DateTime @default(now()) @map("generated_at")
  validUntil   DateTime @map("valid_until") // Usually end of day

  @@index([userId])
  @@index([validUntil])
  @@map("daily_content_recommendations")
}
```

---

## 5. API Endpoints

### 5.1 Tracked Keywords API

```typescript
// GET /api/v1/trend-dashboard/keywords
// List all tracked keywords for current user
interface GetTrackedKeywordsResponse {
  keywords: TrackedKeyword[];
  totalCount: number;
}

// POST /api/v1/trend-dashboard/keywords
// Add new tracked keyword
interface AddKeywordRequest {
  keyword: string;
  type: 'keyword' | 'hashtag';
  displayName?: string;
  alertEnabled?: boolean;
  alertThreshold?: number;
}

// DELETE /api/v1/trend-dashboard/keywords/:id
// Remove tracked keyword

// PATCH /api/v1/trend-dashboard/keywords/:id
// Update keyword settings (alerts, display name, sort order)

// POST /api/v1/trend-dashboard/keywords/refresh
// Force refresh analysis for all tracked keywords
interface RefreshKeywordsResponse {
  refreshed: number;
  errors: { keyword: string; error: string }[];
}
```

### 5.2 Dashboard Summary API

```typescript
// GET /api/v1/trend-dashboard/summary
interface DashboardSummaryResponse {
  contentProduction: {
    totalGenerated: number;
    processing: number;
    completed: number;
    published: number;
    last24h: number;
    last7d: number;
  };

  trackedKeywords: {
    total: number;
    withPositiveTrend: number;
    withNegativeTrend: number;
    lastUpdated: string;
  };

  dailyRecommendation: {
    primary: string;
    primaryKeywords: string[];
    secondary?: string;
    secondaryKeywords?: string[];
    generatedAt: string;
  } | null;
}
```

### 5.3 Cross-Keyword Analysis API

```typescript
// GET /api/v1/trend-dashboard/cross-analysis
interface CrossKeywordAnalysisResponse {
  commonHashtags: {
    tag: string;
    appearanceCount: number;
    totalKeywords: number;
    avgEngagement: number;
  }[];

  commonPatterns: {
    pattern: string;
    keywordsFound: string[];
    examples: string[];
  }[];

  trendingAcross: {
    element: string;
    type: 'hashtag' | 'phrase' | 'emoji';
    momentum: 'rising' | 'stable' | 'declining';
  }[];
}
```

### 5.4 Search History API

```typescript
// GET /api/v1/trend-dashboard/history
interface SearchHistoryResponse {
  history: {
    id: string;
    keyword: string;
    searchedAt: string;
    videosAnalyzed: number;
    topInsight: string;
  }[];
  totalCount: number;
}

// GET /api/v1/trend-dashboard/history/:id
// Get full analysis from history
```

---

## 6. UI Component Architecture

### Component Tree

```
TrendDashboardPage/
├── TrendDashboardHeader/
│   ├── PageTitle
│   └── AddKeywordButton
│
├── ContentSummarySection/
│   ├── MetricCard (x4)
│   └── QuickActionsPanel/
│       ├── CreateContentButton
│       ├── AnalyzeKeywordButton
│       └── ViewAllTrendsButton
│
├── TrackedKeywordsSection/
│   ├── KeywordCardList/
│   │   ├── KeywordCard (per keyword)
│   │   │   ├── KeywordBadge
│   │   │   ├── TrendIndicator (▲/▼/→)
│   │   │   └── MetricPreview
│   │   └── AddKeywordCard
│   └── KeywordManagementDialog
│
├── TrendOverviewSection/
│   ├── PerformanceMetricsPanel/
│   │   ├── MetricItem (views, engagement, etc.)
│   │   └── BenchmarkIndicators
│   ├── TopHashtagsPanel/
│   │   ├── HashtagBadge (x10)
│   │   ├── CopyAllButton
│   │   └── UseInContentButton
│   ├── ViralVideosPanel/
│   │   └── VideoPreviewCard (x3)
│   └── AISuggestionsPanel/
│       ├── SuggestionItem (strategies)
│       ├── CaptionTemplateItem
│       └── VideoIdeaItem
│
├── CrossKeywordInsightsSection/
│   ├── CommonTrendingPanel/
│   │   └── TrendingElementBadge (with count)
│   └── DailyRecommendationPanel/
│       ├── PrimaryRecommendation
│       ├── SecondaryRecommendation
│       └── StartCreatingButton
│
└── SearchHistorySection/
    ├── HistoryTimeline/
    │   └── HistoryCard (per search)
    └── ViewAllHistoryLink
```

### Key Components

#### 1. KeywordCard
```typescript
interface KeywordCardProps {
  keyword: TrackedKeyword;
  isSelected: boolean;
  onSelect: (keyword: TrackedKeyword) => void;
  onRemove: (id: string) => void;
  onEditSettings: (keyword: TrackedKeyword) => void;
}
```

#### 2. TrendIndicator
```typescript
interface TrendIndicatorProps {
  direction: 'up' | 'down' | 'stable';
  percentChange: number;
  size?: 'sm' | 'md' | 'lg';
}
```

#### 3. AISuggestionsPanel
```typescript
interface AISuggestionsPanelProps {
  insights: KeywordAnalysis['aiInsights'];
  keyword: string;
  onUseStrategy: (strategy: string) => void;
  onUseCaptionTemplate: (template: string) => void;
  onCreateFromIdea: (idea: string) => void;
}
```

---

## 7. State Management

### Zustand Store: `trend-dashboard-store.ts`

```typescript
interface TrendDashboardState {
  // Tracked Keywords
  trackedKeywords: TrackedKeyword[];
  selectedKeywordId: string | null;
  isLoadingKeywords: boolean;

  // Current Analysis
  currentAnalysis: KeywordAnalysis | null;
  isLoadingAnalysis: boolean;

  // Cross-Keyword Data
  crossAnalysis: CrossKeywordAnalysis | null;
  dailyRecommendation: DailyRecommendation | null;

  // Search History
  searchHistory: SearchHistoryItem[];

  // Actions
  loadTrackedKeywords: () => Promise<void>;
  addKeyword: (keyword: string, type: 'keyword' | 'hashtag') => Promise<void>;
  removeKeyword: (id: string) => Promise<void>;
  selectKeyword: (id: string) => void;
  refreshKeyword: (id: string) => Promise<void>;
  refreshAllKeywords: () => Promise<void>;
  loadCrossAnalysis: () => Promise<void>;
  loadDailyRecommendation: () => Promise<void>;
}
```

---

## 8. Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTIONS                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TREND DASHBOARD PAGE                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Add Keyword │  │ Select      │  │ Refresh     │  │ Create      │    │
│  │ Action      │  │ Keyword     │  │ All         │  │ Content     │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ZUSTAND STORE                                    │
│  trackedKeywords | selectedKeyword | crossAnalysis | dailyRecommendation│
└─────────────────────────────────────────────────────────────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                      │
│  /keywords      | /keyword-analysis | /cross-analysis | /recommendations│
└─────────────────────────────────────────────────────────────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE                                         │
│  TrackedKeyword | KeywordAnalysis | (computed)    | DailyRecommendation │
└─────────────────────────────────────────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                                    │
│  TikTok RapidAPI (trends) │ Gemini AI (insights) │ S3 (thumbnails)      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure (2-3 days)
1. Database schema migration (TrackedKeyword, SearchHistory)
2. Basic API endpoints (CRUD for tracked keywords)
3. Page routing setup (hide old dashboard, create new route)

### Phase 2: Dashboard UI Foundation (2-3 days)
1. Layout structure with sections A-F
2. Content Summary Section (reuse existing stats API)
3. Tracked Keywords Section (add/remove/display)
4. Basic state management setup

### Phase 3: Trend Analysis Integration (2-3 days)
1. Connect keyword selection to existing `/trends/keyword-analysis` API
2. Trend Overview Section with metrics, hashtags, viral videos
3. AI Suggestions Panel integration

### Phase 4: Cross-Keyword Intelligence (2 days)
1. Cross-analysis API endpoint
2. Common trending elements analysis
3. Daily recommendation generation (AI)

### Phase 5: Polish & History (1-2 days)
1. Search history tracking and display
2. Trend indicators and animations
3. Mobile responsive design
4. Loading states and error handling

---

## 10. Technical Considerations

### Performance
- **Lazy Loading**: Load keyword analysis on-demand when selected
- **Caching**: Use TanStack Query with 5-minute stale time for dashboard data
- **Background Refresh**: Auto-refresh tracked keywords every 6 hours

### Accessibility
- Keyboard navigation for keyword selection
- Screen reader labels for trend indicators
- Focus management for modals

### Mobile Responsiveness
- Horizontal scroll for keyword cards on mobile
- Collapsible sections on smaller screens
- Touch-friendly interaction targets

### Error Handling
- Graceful degradation when API fails
- Stale data indicator when cache is outdated
- Retry mechanisms for failed refreshes

---

## 11. File Structure

```
app/(dashboard)/
├── trends/                          # NEW: Trend Intelligence Dashboard
│   └── page.tsx                     # Main dashboard page
│
├── dashboard/                       # OLD: Hide or redirect
│   └── page.tsx                     # Add redirect or feature flag

components/features/trends/          # NEW: Trend dashboard components
├── ContentSummarySection.tsx
├── QuickActionsPanel.tsx
├── TrackedKeywordsSection/
│   ├── index.tsx
│   ├── KeywordCard.tsx
│   ├── KeywordManagementDialog.tsx
│   └── AddKeywordCard.tsx
├── TrendOverviewSection/
│   ├── index.tsx
│   ├── PerformanceMetricsPanel.tsx
│   ├── TopHashtagsPanel.tsx
│   ├── ViralVideosPanel.tsx
│   └── AISuggestionsPanel.tsx
├── CrossKeywordInsightsSection/
│   ├── index.tsx
│   ├── CommonTrendingPanel.tsx
│   └── DailyRecommendationPanel.tsx
└── SearchHistorySection.tsx

lib/stores/
└── trend-dashboard-store.ts         # NEW: Zustand store

app/api/v1/trend-dashboard/
├── keywords/
│   ├── route.ts                     # GET, POST tracked keywords
│   └── [id]/route.ts                # PATCH, DELETE keyword
├── summary/route.ts                 # GET dashboard summary
├── cross-analysis/route.ts          # GET cross-keyword analysis
├── history/route.ts                 # GET search history
└── recommendations/route.ts         # GET daily recommendations
```

---

## 12. Navigation Changes

### Main Navigation Update
```typescript
// components/layout/main-navigation.tsx
// Change:
// - Dashboard → Trends (new dashboard)
// - Hide or move old dashboard to settings/admin

const navigationItems = [
  { name: 'Trends', href: '/trends', icon: TrendingUpIcon },  // NEW primary
  { name: 'Discover', href: '/discover', icon: SearchIcon },
  { name: 'Create', href: '/create', icon: PlusCircleIcon },
  // ... rest
];
```

---

## Summary

이 설계는 사용자가:
1. **등록한 키워드 관리**: 최대 10개 키워드/해시태그 트래킹
2. **트렌드 한눈에 파악**: 각 키워드별 성과 지표, 변화 추이
3. **AI 콘텐츠 추천**: 오늘 만들면 좋을 콘텐츠 자동 제안
4. **빠른 액션**: 클릭 한 번으로 콘텐츠 생성 페이지로 데이터 전달

를 할 수 있는 **Trend Intelligence Hub**를 구축합니다.
