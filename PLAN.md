# Trend Analysis & Content Recommendation System - Development Plan

## Overview

This plan outlines the development of a comprehensive trend analysis system that:
1. Analyzes text trends (hashtags, descriptions) from TikTok search results
2. Analyzes video trends (visual style, content patterns) from top videos
3. Generates content creation recommendations for both text and video
4. Integrates with Bridge and Compose pages for seamless workflow

---

## Phase 1: Database Schema Extensions

### 1.1 New Models

```prisma
// Text Trend Analysis - aggregated analysis from search results
model TextTrendAnalysis {
  id              String   @id @default(uuid())
  searchQuery     String   @map("search_query")
  platform        TrendPlatform

  // Hashtag Analysis
  topHashtags     Json     @map("top_hashtags")     // [{hashtag, count, avgLikes}]
  hashtagClusters Json     @map("hashtag_clusters") // Grouped by theme

  // Content Analysis
  topicThemes     String[] @map("topic_themes")     // ["dance challenge", "reaction", ...]
  commonPhrases   Json     @map("common_phrases")   // [{phrase, frequency}]
  sentimentTrend  String   @map("sentiment_trend")  // "positive", "neutral", "negative"

  // Popularity Metrics
  totalVideos     Int      @map("total_videos")
  avgLikes        Float    @map("avg_likes")
  avgComments     Float    @map("avg_comments")
  avgShares       Float    @map("avg_shares")

  // Text Content Recommendations
  captionTemplates   Json   @map("caption_templates")    // Recommended caption styles
  hashtagStrategy    Json   @map("hashtag_strategy")     // Recommended hashtag combinations
  contentSuggestions Json   @map("content_suggestions")  // What to write about

  analyzedAt      DateTime @default(now()) @map("analyzed_at")
  expiresAt       DateTime @map("expires_at")

  @@unique([platform, searchQuery])
  @@map("text_trend_analyses")
}

// Video Trend Analysis - visual style analysis from top videos
model VideoTrendAnalysis {
  id              String   @id @default(uuid())
  searchQuery     String   @map("search_query")
  platform        TrendPlatform

  // Visual Style Patterns
  dominantStyles     String[] @map("dominant_styles")     // ["cinematic", "lo-fi", ...]
  colorPalettes      Json     @map("color_palettes")      // Common color schemes
  lightingPatterns   String[] @map("lighting_patterns")   // ["natural", "neon", ...]
  cameraMovements    String[] @map("camera_movements")    // ["slow zoom", "tracking", ...]
  transitionStyles   String[] @map("transition_styles")   // ["jump cut", "fade", ...]

  // Content Patterns
  commonSubjects     String[] @map("common_subjects")     // ["person dancing", "product", ...]
  settingTypes       String[] @map("setting_types")       // ["studio", "outdoor", ...]
  propCategories     String[] @map("prop_categories")     // ["fashion", "tech", ...]

  // Mood & Pace
  dominantMood       String   @map("dominant_mood")       // "energetic", "calm", ...
  averagePace        String   @map("average_pace")        // "fast", "medium", "slow"
  effectsTrending    String[] @map("effects_trending")    // Popular visual effects

  // Video Content Recommendations
  promptTemplates    Json     @map("prompt_templates")     // Veo prompt suggestions
  styleGuidelines    Json     @map("style_guidelines")     // Visual style recommendations
  technicalSpecs     Json     @map("technical_specs")      // aspect_ratio, duration, etc.

  // Source Videos Analyzed
  analyzedVideoIds   String[] @map("analyzed_video_ids")
  videosAnalyzed     Int      @map("videos_analyzed")

  analyzedAt         DateTime @default(now()) @map("analyzed_at")
  expiresAt          DateTime @map("expires_at")

  @@unique([platform, searchQuery])
  @@map("video_trend_analyses")
}

// Combined Trend Report - unified recommendations
model TrendReport {
  id              String   @id @default(uuid())
  searchQuery     String   @map("search_query")
  platform        TrendPlatform

  // References
  textAnalysisId     String?  @map("text_analysis_id")
  videoAnalysisId    String?  @map("video_analysis_id")

  // Unified Recommendations
  trendScore         Float    @map("trend_score")         // 0-100 overall trend strength
  trendDirection     String   @map("trend_direction")     // "rising", "stable", "declining"

  // Content Creation Guide
  textGuide          Json     @map("text_guide")          // Caption/hashtag recommendations
  videoGuide         Json     @map("video_guide")         // Visual style recommendations
  combinedStrategy   Json     @map("combined_strategy")   // Unified approach

  // For Campaign Integration
  targetAudience     String[] @map("target_audience")
  bestPostingTimes   Json     @map("best_posting_times")
  competitorInsights Json     @map("competitor_insights")

  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@unique([platform, searchQuery])
  @@map("trend_reports")
}
```

---

## Phase 2: Backend API Development

### 2.1 Text Trend Analysis API

**Endpoint**: `POST /api/v1/trends/analyze/text`

```typescript
// Request
{
  searchQuery: string;
  platform: "TIKTOK";
  maxVideos?: number;  // default 40
}

// Response
{
  success: boolean;
  analysis: {
    topHashtags: Array<{hashtag: string, count: number, avgLikes: number}>;
    hashtagClusters: Array<{theme: string, hashtags: string[], popularity: number}>;
    topicThemes: string[];
    contentSuggestions: {
      captionTemplates: string[];
      hashtagStrategy: {
        primary: string[];    // Must use
        secondary: string[];  // Recommended
        niche: string[];      // For targeting
      };
      toneRecommendation: string;
    };
  };
}
```

**Implementation Logic**:
1. Fetch videos from TikTok search (existing `searchTikTok` function)
2. Extract all hashtags and descriptions
3. Analyze frequency and engagement correlation
4. Cluster hashtags by theme using text similarity
5. Generate caption templates from top-performing descriptions
6. Use Gemini AI for semantic analysis of content themes

### 2.2 Video Trend Analysis API

**Endpoint**: `POST /api/v1/trends/analyze/video`

```typescript
// Request
{
  searchQuery: string;
  platform: "TIKTOK";
  maxVideos?: number;  // default 10 (top videos only)
}

// Response
{
  success: boolean;
  analysis: {
    visualPatterns: {
      dominantStyles: string[];
      colorPalettes: string[][];
      lightingPatterns: string[];
      cameraMovements: string[];
    };
    contentPatterns: {
      commonSubjects: string[];
      settingTypes: string[];
      propCategories: string[];
    };
    videoRecommendations: {
      promptTemplates: Array<{
        template: string;
        style: string;
        useCase: string;
      }>;
      styleGuidelines: {
        visualStyle: string;
        mood: string;
        pace: string;
        effects: string[];
      };
      technicalSpecs: {
        aspectRatio: string;
        duration: number;
        cameraStyle: string;
      };
    };
  };
}
```

**Implementation Logic**:
1. Fetch top videos from TikTok search (by like count)
2. For each video (top 5-10):
   - Use existing `analyzeTikTokVideo` function (Gemini Vision)
   - Extract style_analysis and content_analysis
3. Aggregate patterns across all analyzed videos
4. Identify dominant trends and generate recommendations
5. Create prompt templates based on common patterns

### 2.3 Combined Trend Report API

**Endpoint**: `POST /api/v1/trends/analyze/report`

```typescript
// Request
{
  searchQuery: string;
  platform: "TIKTOK";
  includeText?: boolean;   // default true
  includeVideo?: boolean;  // default true
}

// Response
{
  success: boolean;
  report: {
    trendScore: number;      // 0-100
    trendDirection: string;  // "rising" | "stable" | "declining"

    textGuide: {
      captionStyle: string;
      hashtags: { primary: string[], secondary: string[] };
      contentThemes: string[];
    };

    videoGuide: {
      visualStyle: string;
      promptTemplate: string;
      technicalSpecs: object;
    };

    combinedStrategy: {
      summary: string;
      keyActions: string[];
      bestPractices: string[];
    };
  };
}
```

---

## Phase 3: Frontend Components

### 3.1 Enhanced Trends Page (`/trends`)

Add new sections to existing page:

```
┌─────────────────────────────────────────────────────────────┐
│ TikTok Trends                                               │
├─────────────────────────────────────────────────────────────┤
│ [Search] ───────────────────────────────── [Analyze Trends] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ 📝 TEXT TRENDS          │ │ 🎬 VIDEO TRENDS             │ │
│ ├─────────────────────────┤ ├─────────────────────────────┤ │
│ │ Top Hashtags            │ │ Dominant Styles             │ │
│ │ #kpop (45K avg likes)   │ │ • Cinematic (60%)           │ │
│ │ #dance (32K avg likes)  │ │ • Lo-fi aesthetic (25%)     │ │
│ │ ...                     │ │ ...                         │ │
│ │                         │ │                             │ │
│ │ Topic Themes            │ │ Visual Patterns             │ │
│ │ • Dance challenges      │ │ • Neon lighting             │ │
│ │ • Fan edits             │ │ • Fast cuts                 │ │
│ │ ...                     │ │ ...                         │ │
│ └─────────────────────────┘ └─────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💡 CONTENT RECOMMENDATIONS                              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │                                                         │ │
│ │ Caption Template:                                       │ │
│ │ "POV: [scenario] 🔥 #kpop #dance #fyp"                 │ │
│ │                                                         │ │
│ │ Video Prompt:                                           │ │
│ │ "Cinematic, neon-lit dance sequence with fast cuts..."  │ │
│ │                                                         │ │
│ │ [Copy to Clipboard] [Send to Bridge] [Send to Compose]  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Bridge Page Integration

Add "Trend Insights" panel to Bridge page:

```
┌─────────────────────────────────────────────────────────────┐
│ Bridge                                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Video Analyzer          │ │ 🔥 TREND INSIGHTS           │ │
│ │ [Current functionality] │ │                             │ │
│ │                         │ │ Current Query: "kpop"       │ │
│ │                         │ │                             │ │
│ │                         │ │ Text Recommendations:       │ │
│ │                         │ │ • Use #fyp #kpop #viral     │ │
│ │                         │ │ • Include dance reference   │ │
│ │                         │ │                             │ │
│ │                         │ │ Video Style Match:          │ │
│ │                         │ │ ✓ Cinematic (matches trend) │ │
│ │                         │ │ ⚠ Consider faster pace      │ │
│ │                         │ │                             │ │
│ │                         │ │ [Apply Trend Style]         │ │
│ └─────────────────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Compose Page Integration

Add trend-aware suggestions to Compose workflow:

```
┌─────────────────────────────────────────────────────────────┐
│ Compose - Step 1: Script Generation                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔥 Trending Now for "kpop"                              │ │
│ │                                                         │ │
│ │ Suggested Script Style:                                 │ │
│ │ ┌─────────────────────────────────────────────────────┐ │
│ │ │ "POV: When your bias releases a new song 🔥"        │ │
│ │ │ #kpop #bias #newmusic #fyp                          │ │
│ │ └─────────────────────────────────────────────────────┘ │
│ │ [Use This] [Customize] [See More]                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🎬 Trending Visual Style                                │ │
│ │                                                         │ │
│ │ • Cinematic with neon accents                          │ │
│ │ • Fast-paced editing (2-3 sec cuts)                    │ │
│ │ • High contrast color grading                          │ │
│ │                                                         │ │
│ │ [Apply to Video Settings]                               │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 4: Service Layer

### 4.1 Text Trend Analyzer Service

**File**: `lib/services/text-trend-analyzer.ts`

```typescript
class TextTrendAnalyzer {
  // Analyze hashtags from video list
  analyzeHashtags(videos: TrendVideo[]): HashtagAnalysis;

  // Cluster hashtags by semantic similarity
  clusterHashtags(hashtags: string[]): HashtagCluster[];

  // Extract common phrases from descriptions
  extractPhrases(descriptions: string[]): PhraseAnalysis;

  // Generate caption templates
  generateCaptionTemplates(analysis: TextAnalysis): string[];

  // Use Gemini for semantic analysis
  analyzeContentThemes(descriptions: string[]): Promise<string[]>;
}
```

### 4.2 Video Trend Analyzer Service

**File**: `lib/services/video-trend-analyzer.ts`

```typescript
class VideoTrendAnalyzer {
  // Analyze multiple videos and aggregate patterns
  analyzeVideoTrends(videoUrls: string[]): Promise<VideoTrendAnalysis>;

  // Aggregate style patterns from multiple analyses
  aggregateStylePatterns(analyses: TikTokAnalysisResult[]): StylePatterns;

  // Generate prompt templates from patterns
  generatePromptTemplates(patterns: StylePatterns): PromptTemplate[];

  // Calculate trend score based on engagement
  calculateTrendScore(videos: TrendVideo[]): number;
}
```

### 4.3 Trend Report Generator Service

**File**: `lib/services/trend-report-generator.ts`

```typescript
class TrendReportGenerator {
  // Generate combined report
  generateReport(
    textAnalysis: TextTrendAnalysis,
    videoAnalysis: VideoTrendAnalysis
  ): TrendReport;

  // Generate content strategy
  generateStrategy(report: TrendReport): ContentStrategy;

  // Format for Bridge integration
  formatForBridge(report: TrendReport): BridgeTrendData;

  // Format for Compose integration
  formatForCompose(report: TrendReport): ComposeTrendData;
}
```

---

## Phase 5: Integration Points

### 5.1 Bridge Page Integration

**Changes to**: `app/(dashboard)/bridge/page.tsx`

1. Add `useTrendInsights` hook to fetch trend data
2. Add `TrendInsightsPanel` component
3. Modify prompt generation to incorporate trend recommendations
4. Add "Apply Trend Style" button to apply trending patterns

### 5.2 Compose Page Integration

**Changes to**: `app/(dashboard)/campaigns/[id]/compose/page.tsx`

1. Add trend-aware script generation suggestions
2. Add visual style recommendations based on trends
3. Integrate hashtag strategy into final output
4. Add "trending" badge to recommended options

### 5.3 Shared State Management

Create a new Zustand store for trend data:

**File**: `lib/stores/trend-store.ts`

```typescript
interface TrendStore {
  currentTrendReport: TrendReport | null;
  textAnalysis: TextTrendAnalysis | null;
  videoAnalysis: VideoTrendAnalysis | null;

  fetchTrendReport: (query: string) => Promise<void>;
  clearTrends: () => void;

  // For Bridge
  getTrendStyleRecommendations: () => StyleRecommendation[];

  // For Compose
  getTrendCaptionTemplates: () => string[];
  getTrendHashtags: () => HashtagStrategy;
}
```

---

## Phase 6: Data Flow

```
                    ┌─────────────┐
                    │  /trends    │
                    │    page     │
                    └──────┬──────┘
                           │
                           │ Search Query
                           ▼
            ┌──────────────────────────────┐
            │     TikTok Search API        │
            │   (existing searchTikTok)    │
            └──────────────┬───────────────┘
                           │
                           │ Videos with stats
                           ▼
            ┌──────────────┴───────────────┐
            │                              │
            ▼                              ▼
    ┌───────────────┐            ┌───────────────┐
    │ Text Analyzer │            │ Video Analyzer│
    │   Service     │            │   Service     │
    └───────┬───────┘            └───────┬───────┘
            │                            │
            │ Hashtags,                  │ Visual styles,
            │ Descriptions               │ Content patterns
            ▼                            ▼
    ┌───────────────┐            ┌───────────────┐
    │ Gemini AI     │            │ Gemini Vision │
    │ (Text)        │            │ (Video)       │
    └───────┬───────┘            └───────┬───────┘
            │                            │
            ▼                            ▼
    ┌───────────────┐            ┌───────────────┐
    │TextTrendAnaly-│            │VideoTrendAnaly│
    │    sis DB     │            │    sis DB     │
    └───────┬───────┘            └───────┬───────┘
            │                            │
            └──────────┬─────────────────┘
                       │
                       ▼
              ┌───────────────┐
              │ Trend Report  │
              │   Generator   │
              └───────┬───────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    ┌───────────┐           ┌───────────┐
    │  /bridge  │           │ /compose  │
    │   page    │           │   page    │
    └───────────┘           └───────────┘
```

---

## Phase 7: Implementation Order

### Sprint 1: Database & Core Services (3-4 days)
1. [ ] Add Prisma schema extensions
2. [ ] Run migrations
3. [ ] Create TextTrendAnalyzer service
4. [ ] Create VideoTrendAnalyzer service
5. [ ] Create TrendReportGenerator service

### Sprint 2: API Endpoints (2-3 days)
1. [ ] Create `/api/v1/trends/analyze/text` endpoint
2. [ ] Create `/api/v1/trends/analyze/video` endpoint
3. [ ] Create `/api/v1/trends/analyze/report` endpoint
4. [ ] Add API client functions in `lib/trends-api.ts`

### Sprint 3: Trends Page Enhancement (2-3 days)
1. [ ] Add "Analyze Trends" button to /trends page
2. [ ] Create TextTrendPanel component
3. [ ] Create VideoTrendPanel component
4. [ ] Create RecommendationsPanel component
5. [ ] Add loading states and error handling

### Sprint 4: Bridge Integration (1-2 days)
1. [ ] Create TrendInsightsPanel component
2. [ ] Add trend data fetching to Bridge page
3. [ ] Implement "Apply Trend Style" functionality
4. [ ] Add trend comparison to video analysis

### Sprint 5: Compose Integration (1-2 days)
1. [ ] Add trend suggestions to script generation step
2. [ ] Add visual style recommendations
3. [ ] Integrate hashtag strategy into output
4. [ ] Add "trending" indicators

### Sprint 6: Testing & Polish (1-2 days)
1. [ ] End-to-end testing of full workflow
2. [ ] Performance optimization
3. [ ] Error handling improvements
4. [ ] UI polish and responsive design

---

## Technical Considerations

### Performance
- Cache trend analyses for 24 hours (configurable via `expiresAt`)
- Limit video analysis to top 5-10 videos per query
- Use background jobs for heavy analysis tasks
- Implement rate limiting for TikTok scraping

### Error Handling
- Graceful degradation if video analysis fails
- Fallback to text-only analysis if Gemini unavailable
- Retry logic for TikTok API failures
- Clear error messages for users

### Scalability
- Consider job queue (Bull/BullMQ) for batch analyses
- Implement caching layer (Redis) for frequent queries
- Monitor Gemini API usage and costs
- Database indexing for trend queries

---

## Success Metrics

1. **Analysis Accuracy**: Trend recommendations lead to higher engagement
2. **User Adoption**: % of users using trend features in Bridge/Compose
3. **Time Savings**: Reduced time from trend research to content creation
4. **Coverage**: Number of unique queries analyzed per day
