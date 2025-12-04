# HYDRA Unified Workflow Plan

## Discover → Analyze → Create → Publish

---

## Executive Summary

This document outlines a comprehensive restructuring of the HYDRA platform's navigation and workflow into a clear, linear 4-stage pipeline: **Discover → Analyze → Create → Publish**. This consolidation will improve user experience, reduce cognitive load, and create a more intuitive content creation journey.

---

## Current State Analysis

### Existing Navigation Structure
```
Current Menu:
├── Dashboard (overview)
├── Campaigns (campaign management)
├── Create (dropdown: Quick Create, AI Video, Compose Video)
├── Library (dropdown: All Videos, Compose Videos, Assets)
├── Trends (keyword analysis + partial creation)
├── Pipeline (job monitoring)
└── Publishing (scheduling + accounts)
```

### Current Pain Points

| Issue | Description |
|-------|-------------|
| **Fragmented Discovery** | Trending content is in Dashboard tiles AND Trends page |
| **Split Creation Context** | Trends page has both analysis AND creation UI in a 60/40 split |
| **Disconnected Flow** | User must mentally track context between pages |
| **Unclear Pipeline Position** | Pipeline is a separate section, not part of the workflow |
| **Library Outside Flow** | Assets/Videos feel disconnected from the creation process |

### Features to Consolidate

| Current Location | Feature | Target Section |
|-----------------|---------|----------------|
| `/dashboard` | TrendingVideosTile | **Discover** |
| `/dashboard` | TrendAnalysisTile | **Discover** |
| `/trends` (left panel) | Keyword Search | **Discover** |
| `/trends` (left panel) | Performance Tiers | **Discover** |
| `/trends` (left panel) | Hashtag Recommendations | **Discover** |
| `/trends` (left panel) | Creator Insights | **Discover** |
| `/trends` (right panel) | Idea Input | **Analyze** |
| `/trends` (right panel) | AI Prompt Optimization | **Analyze** |
| `/trends` (right panel) | Trend Application | **Analyze** |
| `/create?mode=generate` | AI Video Generation | **Create** |
| `/create?mode=compose` | Composite Video | **Create** |
| `/assets` | Asset Library | **Analyze** / **Create** |
| `/publishing` | Scheduling | **Publish** |
| `/publishing` | Social Accounts | **Publish** |
| `/pipeline` | Job Monitoring | **Inline in Create** |

---

## Proposed Architecture

### New Navigation Structure

```
New Primary Menu:
├── Dashboard (quick overview + entry points)
├── Discover (trend research & inspiration)
├── Analyze (ideation & preparation)
├── Create (video generation)
├── Publish (scheduling & distribution)
└── Library (reference/archive only)

Secondary (Settings Bar):
├── Campaigns
├── Settings
└── Profile
```

### Workflow Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HYDRA CONTENT PIPELINE                              │
├─────────────┬─────────────┬─────────────┬─────────────┬───────────────────────┤
│   DISCOVER  │   ANALYZE   │   CREATE    │   PUBLISH   │       STATUS          │
│  ○ ── ── ── │ ── ○ ── ── │ ── ── ○ ── │ ── ── ── ○  │   ✓ ✓ ◐ ○            │
├─────────────┼─────────────┼─────────────┼─────────────┼───────────────────────┤
│ • Keywords  │ • Ideas     │ • AI Video  │ • Schedule  │  Campaign Progress    │
│ • Trends    │ • Assets    │ • Compose   │ • Accounts  │  Pipeline Status      │
│ • Insights  │ • AI Brief  │ • Preview   │ • Analytics │  Quality Metrics      │
└─────────────┴─────────────┴─────────────┴─────────────┴───────────────────────┘
```

---

## Stage 1: DISCOVER

### Purpose
Research trending content, discover viral patterns, and gather inspiration for content creation.

### URL Structure
```
/discover
/discover/keywords     (keyword analysis)
/discover/trending     (live trending videos)
/discover/creators     (top creator analysis)
/discover/saved        (saved inspiration)
```

### Features

#### 1.1 Unified Search Hub
```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Search keywords, hashtags, or paste TikTok URL...          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ #kpop, dance challenge, viral                               ││
│  └─────────────────────────────────────────────────────────────┘│
│  [Search]  [Add Keyword +]                                      │
│                                                                 │
│  Recent: #newjeans  #blackpink  summer vibes  dance trend      │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.2 Live Trending Feed (from TikTok/Instagram)
- Real-time trending videos grid
- 24-hour cache with refresh option
- Filter by: Platform, Category, Region
- Quick actions: Save to Inspiration, Use as Reference

#### 1.3 Keyword Analysis Results
```
┌─────────────────────────────────────────────────────────────────┐
│  Keyword Analysis: "kpop dance"                                 │
├─────────────────────────────────────────────────────────────────┤
│  📊 Performance Summary                                         │
│  ├── Average Views: 2.4M                                        │
│  ├── Engagement Rate: 8.2%                                      │
│  └── Viral Benchmark: 500K+ views                               │
│                                                                 │
│  🔥 Viral Videos (Top 10%)           [View All →]               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                               │
│  │ 📹  │ │ 📹  │ │ 📹  │ │ 📹  │                               │
│  │5.2M │ │4.8M │ │3.9M │ │3.1M │                               │
│  └─────┘ └─────┘ └─────┘ └─────┘                               │
│                                                                 │
│  #️⃣ Recommended Hashtags                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │ #kpop    │ │ #dance   │ │ #fyp     │                        │
│  │ +45% ↑   │ │ +32% ↑   │ │ +28% ↑   │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
│                                                                 │
│  👤 Top Creators in This Space                                  │
│  @creator1 (2.1M followers) | @creator2 (1.8M) | @creator3     │
│                                                                 │
│  [💡 Start Analyzing →]                                         │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.4 Inspiration Board
- Save videos for later reference
- Create inspiration collections
- Tag and categorize saved content
- Quick "Use This" action to Analyze stage

### Data Flow Out (to Analyze)
```typescript
interface DiscoverContext {
  selectedKeywords: string[];
  selectedHashtags: string[];
  selectedTrends: TrendData[];
  inspirationVideos: Video[];
  performanceMetrics: {
    avgViews: number;
    engagementRate: number;
    viralBenchmark: number;
  };
  aiInsights: string[];
}
```

### Components to Build/Migrate

| Component | Source | Action |
|-----------|--------|--------|
| `KeywordSearchBar` | New | Build unified search |
| `TrendingFeed` | `/dashboard/TrendingVideosTile` | Migrate & expand |
| `KeywordAnalysisPanel` | `/trends` left panel | Migrate |
| `PerformanceTierGrid` | `/trends` | Migrate |
| `HashtagRecommendations` | `/trends` | Migrate |
| `CreatorInsights` | `/trends` | Migrate |
| `InspirationBoard` | New | Build |
| `VideoPreviewCard` | Existing | Enhance |

---

## Stage 2: ANALYZE

### Purpose
Input user's creative vision, combine with discovered trends, organize assets, and prepare AI-optimized content briefs.

### URL Structure
```
/analyze
/analyze/brief          (content brief builder)
/analyze/assets         (asset management)
/analyze/ideas          (AI-generated ideas)
```

### Features

#### 2.1 Context Reception Panel
```
┌─────────────────────────────────────────────────────────────────┐
│  📥 From Discovery                                              │
├─────────────────────────────────────────────────────────────────┤
│  Keywords: #kpop, dance challenge                               │
│  Trends: Summer dance trend (+45% this week)                    │
│  Reference Videos: 3 saved                                      │
│  Hashtags: #kpop #dance #fyp #viral (4 selected)               │
│                                                                 │
│  [Edit Selection] [Clear & Start Fresh]                         │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2 Creative Brief Builder (with Gemini 3)
```
┌─────────────────────────────────────────────────────────────────┐
│  📝 Your Creative Brief                                         │
├─────────────────────────────────────────────────────────────────┤
│  Campaign: [Select Campaign ▼] or [+ New Campaign]              │
│                                                                 │
│  Your Idea / Concept:                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Create a dance challenge video featuring NewJeans style     ││
│  │ choreography with summer beach vibes...                     ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Target Audience:                                               │
│  [Gen Z ▼] [K-pop Fans ▼] [Dance Enthusiasts ▼]                │
│                                                                 │
│  Content Goals:                                                 │
│  ☑ Brand Awareness  ☑ Engagement  ☐ Sales  ☐ Education        │
│                                                                 │
│  [🤖 Generate AI Content Ideas]                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3 AI-Powered Idea Generation (Gemini 3)
```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 AI Content Ideas                              Powered by    │
│                                                    Gemini 3     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💡 Idea 1: Beach Dance Challenge                               │
│  ├── Type: AI Video (VEO)                                       │
│  ├── Hook: "POV: Summer just hits different with K-pop"         │
│  ├── Estimated Engagement: High (based on trend data)           │
│  ├── Optimized Prompt: "A group of dancers performing..."       │
│  └── [Select for Creation →]                                    │
│                                                                 │
│  💡 Idea 2: Choreography Tutorial Slideshow                     │
│  ├── Type: Compose Video                                        │
│  ├── Script: 8-scene breakdown of dance moves                   │
│  ├── Music Match: 128 BPM energetic track                       │
│  └── [Select for Creation →]                                    │
│                                                                 │
│  💡 Idea 3: Before/After Dance Practice                         │
│  ├── Type: AI Video (VEO)                                       │
│  ├── Hook: "Day 1 vs Day 30 of learning K-pop choreo"           │
│  └── [Select for Creation →]                                    │
│                                                                 │
│  [🔄 Generate More Ideas]                                       │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.4 Asset Manager Integration
```
┌─────────────────────────────────────────────────────────────────┐
│  📁 Assets for This Project                                     │
├─────────────────────────────────────────────────────────────────┤
│  From Campaign Library (12 assets):                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                       │
│  │ 🖼️  │ │ 🖼️  │ │ 🎵  │ │ 📹  │ │ + │                        │
│  │img1 │ │img2 │ │aud1 │ │vid1 │ │Add │                        │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                       │
│                                                                 │
│  AI Image Search:                                               │
│  🔍 [Search for "beach dance summer"...      ] [Search]        │
│                                                                 │
│  Reference Images (from Discover):                              │
│  ┌─────┐ ┌─────┐ ┌─────┐                                       │
│  │ 📹  │ │ 📹  │ │ 📹  │  ← Saved from trending                │
│  └─────┘ └─────┘ └─────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.5 Creation Package Summary
```
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Ready for Creation                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Campaign: Summer Dance Campaign                                │
│  Selected Idea: Beach Dance Challenge (AI Video)                │
│                                                                 │
│  📝 Optimized VEO Prompt:                                       │
│  "A cinematic shot of dancers on a sunny beach performing       │
│   synchronized K-pop choreography, golden hour lighting,        │
│   energetic and youthful atmosphere, 4K quality..."             │
│                                                                 │
│  🎵 Music: Energetic Summer Pop (128 BPM)                       │
│  ⚙️ Settings: 9:16 aspect, 60fps, 30 seconds                    │
│  #️⃣ Hashtags: #kpop #dance #summer #fyp #viral                  │
│                                                                 │
│  ┌─────────────────────┐ ┌─────────────────────┐                │
│  │  🎬 Create AI Video │ │  📸 Create Compose  │                │
│  │    (VEO Generation) │ │    (Image + Audio)  │                │
│  └─────────────────────┘ └─────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### Gemini 3 Integration Points

```typescript
// Gemini 3 Content Idea Generation
interface GeminiContentRequest {
  userIdea: string;
  discoveryContext: DiscoverContext;
  targetAudience: string[];
  contentGoals: string[];
  campaignHistory?: CampaignData;
}

interface GeminiContentResponse {
  ideas: ContentIdea[];
  optimizedPrompts: {
    veo: string;
    compose: string;
  };
  hashtagRecommendations: string[];
  contentStrategy: string;
  celebrityWarnings: string[];
}

// API: POST /api/v1/analyze/generate-ideas
// Uses: gemini-flash-lite-latest with googleSearch tool
```

### Data Flow Out (to Create)
```typescript
interface AnalyzeContext {
  campaign: Campaign;
  selectedIdea: ContentIdea;
  optimizedPrompt: string;
  assets: Asset[];
  musicSelection?: Music;
  settings: {
    aspectRatio: '9:16' | '16:9' | '1:1';
    duration: number;
    fps: number;
  };
  hashtags: string[];
  discoveryContext: DiscoverContext;
}
```

### Components to Build/Migrate

| Component | Source | Action |
|-----------|--------|--------|
| `ContextReceptionPanel` | New | Build |
| `CreativeBriefBuilder` | Partial from `/trends` | Rebuild |
| `GeminiIdeaGenerator` | New | Build with Gemini 3 |
| `AssetManagerPanel` | `/assets` | Migrate & integrate |
| `CreationPackageSummary` | Partial from `/trends` | Rebuild |
| `AudienceSelector` | New | Build |
| `ContentGoalPicker` | New | Build |

---

## Stage 3: CREATE

### Purpose
Generate videos using AI (VEO) or composite methods, preview results, and prepare for publishing.

### URL Structure
```
/create
/create/ai              (VEO AI generation)
/create/compose         (image + audio composition)
/create/batch           (bulk variations)
/create/preview/[id]    (preview & edit)
```

### Features

#### 3.1 Creation Mode Selector
```
┌─────────────────────────────────────────────────────────────────┐
│  🎬 Choose Creation Method                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │     🤖 AI Video         │  │     📸 Compose Video        │  │
│  │                         │  │                             │  │
│  │  Generate with VEO AI   │  │  Images + Audio Slideshow   │  │
│  │  Full motion video      │  │  Ken Burns effects          │  │
│  │  from text prompt       │  │  Music synchronization      │  │
│  │                         │  │                             │  │
│  │  ⏱️ ~2-5 min            │  │  ⏱️ ~30 sec                 │  │
│  │  [Recommended ✓]        │  │  [Fast & Reliable]          │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                 │
│  From Analysis: Beach Dance Challenge → AI Video recommended    │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2 AI Video Creation (VEO)
```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 AI Video Generation                        Step 1 of 3      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Prompt (from Analysis):                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ A cinematic shot of dancers on a sunny beach performing     ││
│  │ synchronized K-pop choreography, golden hour lighting...    ││
│  └─────────────────────────────────────────────────────────────┘│
│  [✏️ Edit] [🔄 Re-optimize with AI]                             │
│                                                                 │
│  Generation Settings:                                           │
│  ├── Aspect Ratio: [9:16 ▼] (TikTok/Reels optimized)           │
│  ├── Duration: [30 sec ▼]                                       │
│  ├── Quality: [High ▼]                                          │
│  └── Variations: [3 ▼]                                          │
│                                                                 │
│  Audio:                                                         │
│  🎵 Energetic Summer Pop (128 BPM) [Change →]                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │           [🚀 Generate 3 Variations]                        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### 3.3 Inline Pipeline Status (No Separate Page)
```
┌─────────────────────────────────────────────────────────────────┐
│  ⏳ Generation in Progress                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Variation 1          [████████████░░░░░░░░] 65%            ││
│  │  ⏱️ Est. 1:30 remaining                                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Variation 2          [██████░░░░░░░░░░░░░░] 32%            ││
│  │  ⏱️ Est. 2:45 remaining                                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Variation 3          [████░░░░░░░░░░░░░░░░] 18%            ││
│  │  ⏱️ Est. 3:30 remaining                                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  💡 Tip: You can continue browsing. We'll notify you when done. │
│                                                                 │
│  [Cancel All] [Generate More While Waiting]                     │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.4 Results & Selection
```
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Generation Complete                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   📹 V1      │  │   📹 V2      │  │   📹 V3      │          │
│  │              │  │              │  │              │          │
│  │   [▶ Play]   │  │   [▶ Play]   │  │   [▶ Play]   │          │
│  │              │  │              │  │              │          │
│  │  Score: 92   │  │  Score: 87   │  │  Score: 78   │          │
│  │  ⭐ Best     │  │              │  │              │          │
│  │  ☑ Selected  │  │  ☐ Select    │  │  ☐ Select    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  AI Quality Assessment:                                         │
│  ├── V1: Excellent motion, great lighting, matches prompt well  │
│  ├── V2: Good quality, slight color inconsistency               │
│  └── V3: Acceptable, motion artifacts detected                  │
│                                                                 │
│  [📹 Generate More Variations]  [✅ Proceed to Publish →]       │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.5 Compose Video Flow
```
┌─────────────────────────────────────────────────────────────────┐
│  📸 Compose Video                              Step 1 of 4      │
├─────────────────────────────────────────────────────────────────┤
│  ○ Script ─── ○ Images ─── ○ Music ─── ○ Render                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📝 AI Script Generation (from your brief):                     │
│                                                                 │
│  Scene 1: [Opening hook - text overlay: "POV: Summer vibes"]    │
│  Scene 2: [Beach establishing shot - wide angle]                │
│  Scene 3: [Dancers warming up - medium shot]                    │
│  Scene 4: [Dance sequence begins - dynamic angles]              │
│  Scene 5: [Highlight move - slow motion effect]                 │
│  Scene 6: [Group formation - aerial view]                       │
│  Scene 7: [Final pose - freeze frame]                           │
│  Scene 8: [Call to action - "Follow for more!"]                 │
│                                                                 │
│  [🔄 Regenerate Script]  [✏️ Edit Manually]  [Next: Images →]   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Out (to Publish)
```typescript
interface CreateContext {
  campaign: Campaign;
  generatedVideos: GeneratedVideo[];
  selectedVideos: GeneratedVideo[];
  metadata: {
    title: string;
    description: string;
    hashtags: string[];
  };
  analyzeContext: AnalyzeContext;
}
```

### Components to Migrate/Enhance

| Component | Source | Action |
|-----------|--------|--------|
| `CreationModeSelector` | `/create` ModeSelector | Enhance |
| `AIVideoGenerator` | `/create` GenerateMode | Refactor |
| `ComposeVideoWizard` | `/create` ComposeMode | Refactor |
| `InlinePipelineStatus` | `/pipeline` | New inline version |
| `ResultsGrid` | Existing | Enhance |
| `QualityScoreCard` | Existing | Migrate |
| `VideoPreviewPlayer` | Existing | Enhance |

---

## Stage 4: PUBLISH

### Purpose
Schedule and distribute content across social platforms, manage accounts, and track post-publish performance.

### URL Structure
```
/publish
/publish/schedule       (scheduling interface)
/publish/accounts       (connected accounts)
/publish/analytics      (post-publish metrics)
/publish/history        (published content history)
```

### Features

#### 4.1 Ready-to-Publish Queue
```
┌─────────────────────────────────────────────────────────────────┐
│  📤 Ready to Publish                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  From: Beach Dance Challenge (Campaign: Summer Dance)           │
│                                                                 │
│  ┌──────────────┐  ┌────────────────────────────────────────┐  │
│  │   📹 V1      │  │  Post Details                          │  │
│  │              │  │                                        │  │
│  │   [▶ Play]   │  │  Caption:                              │  │
│  │              │  │  ┌──────────────────────────────────┐  │  │
│  │   Score: 92  │  │  │ Summer just hits different ☀️🌊  │  │  │
│  │   ⭐ Best    │  │  │ #kpop #dance #summer #fyp        │  │  │
│  │              │  │  └──────────────────────────────────┘  │  │
│  └──────────────┘  │                                        │  │
│                    │  Publish To:                            │  │
│                    │  ☑ TikTok (@brand_official)             │  │
│                    │  ☑ Instagram Reels (@brand)             │  │
│                    │  ☐ YouTube Shorts (@brandYT)            │  │
│                    │                                        │  │
│                    │  Schedule:                              │  │
│                    │  ○ Publish Now                          │  │
│                    │  ● Schedule: [Dec 5, 2025 ▼] [6:00 PM]  │  │
│                    │                                        │  │
│                    │  🤖 AI Optimal Time: 6:00 PM (highest   │  │
│                    │     engagement for your audience)       │  │
│                    └────────────────────────────────────────┘  │
│                                                                 │
│  [📅 Schedule Post]  [🚀 Publish Now]                           │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.2 Scheduling Calendar View
```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Publishing Calendar                        December 2025    │
├─────────────────────────────────────────────────────────────────┤
│  Sun    Mon    Tue    Wed    Thu    Fri    Sat                  │
│  ────────────────────────────────────────────────────────────   │
│   1      2      3      4      5      6      7                   │
│         📹     📹           📹📹                               │
│                              ↑                                  │
│                      Beach Dance (6PM)                          │
│  ────────────────────────────────────────────────────────────   │
│   8      9     10     11     12     13     14                   │
│  📹📹   📹                  📹                                 │
│                                                                 │
│  ────────────────────────────────────────────────────────────   │
│                                                                 │
│  Legend: 📹 = Scheduled Post  ✅ = Published  ❌ = Failed       │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3 Connected Accounts Management
```
┌─────────────────────────────────────────────────────────────────┐
│  🔗 Connected Accounts                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  TikTok                           ✅ Connected               ││
│  │  @brand_official                                             ││
│  │  Followers: 1.2M | Last post: 2 days ago                    ││
│  │  [Disconnect] [Refresh Token]                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Instagram                        ✅ Connected               ││
│  │  @brand                                                      ││
│  │  Followers: 890K | Last post: 1 day ago                     ││
│  │  [Disconnect] [Refresh Token]                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  YouTube                          ⚠️ Token Expired          ││
│  │  @brandYT                                                    ││
│  │  [Reconnect Account]                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [+ Connect New Account]                                        │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.4 Post-Publish Analytics
```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Post Performance                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Beach Dance Challenge                 Published: Dec 5, 6 PM   │
│                                                                 │
│  Platform Performance (24 hours):                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  TikTok                                                     ││
│  │  👁️ 125,000 views  ❤️ 12,500 likes  💬 892 comments        ││
│  │  📈 Engagement: 10.7% (Above average!)                      ││
│  │  🔥 Trending in #dance                                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Instagram Reels                                            ││
│  │  👁️ 45,000 views   ❤️ 5,200 likes   💬 234 comments        ││
│  │  📈 Engagement: 12.1% (Excellent!)                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [🔄 Sync Latest Data]  [📊 View Full Analytics]                │
└─────────────────────────────────────────────────────────────────┘
```

### Components to Migrate/Enhance

| Component | Source | Action |
|-----------|--------|--------|
| `PublishQueue` | `/publishing` | Migrate & enhance |
| `SchedulingCalendar` | New | Build |
| `AccountManager` | `/publishing` + `/settings/accounts` | Consolidate |
| `PostPerformanceCard` | `/publishing` | Migrate & enhance |
| `CaptionEditor` | Existing | Migrate |
| `PlatformSelector` | Existing | Migrate |
| `OptimalTimeRecommender` | New | Build with AI |

---

## Dashboard Redesign

### New Dashboard Role
The Dashboard becomes a **status overview** and **quick entry point** rather than a feature destination.

```
┌─────────────────────────────────────────────────────────────────┐
│  HYDRA Dashboard                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 Quick Stats                                                 │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐   │
│  │Active │ │Videos │ │Queue  │ │Views  │ │Engage.│ │Quality│   │
│  │Camps  │ │Today  │ │Ready  │ │7 Days │ │Rate   │ │Score  │   │
│  │  5    │ │  12   │ │   8   │ │ 2.4M  │ │ 8.2%  │ │  91   │   │
│  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘   │
│                                                                 │
│  🚀 Quick Actions                                               │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ 🔍 Discover     │ │ 🎬 Create Video │ │ 📤 Publish Now  │   │
│  │ Find Trends     │ │ Start Creating  │ │ 8 videos ready  │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                 │
│  📈 Pipeline Status                                             │
│  Discover ──○── Analyze ──○── Create ──●── Publish              │
│                                    ↑                            │
│                              3 generating                       │
│                                                                 │
│  📋 Recent Activity                                             │
│  • Beach Dance v1 generated (Score: 92) - 2 min ago            │
│  • Summer Vibes published to TikTok - 1 hour ago               │
│  • New trending keyword detected: #summerdance - 3 hours ago   │
│                                                                 │
│  🔥 Trending Now (Preview)        [Go to Discover →]           │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                               │
│  │ 📹  │ │ 📹  │ │ 📹  │ │ 📹  │                               │
│  └─────┘ └─────┘ └─────┘ └─────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Architecture

### Global Workflow State

```typescript
// lib/workflow-context.ts

interface WorkflowState {
  currentStage: 'discover' | 'analyze' | 'create' | 'publish';

  discover: {
    keywords: string[];
    selectedHashtags: string[];
    savedInspiration: Video[];
    trendData: TrendAnalysis;
  };

  analyze: {
    campaign: Campaign | null;
    userIdea: string;
    aiGeneratedIdeas: ContentIdea[];
    selectedIdea: ContentIdea | null;
    assets: Asset[];
    optimizedPrompt: string;
    settings: GenerationSettings;
  };

  create: {
    creationType: 'ai' | 'compose';
    generations: Generation[];
    selectedGenerations: Generation[];
    pipelineStatus: PipelineStatus[];
  };

  publish: {
    scheduledPosts: ScheduledPost[];
    selectedPlatforms: Platform[];
    publishTime: Date | 'now';
    caption: string;
    hashtags: string[];
  };
}

// Zustand store for workflow state
export const useWorkflowStore = create<WorkflowState>(...)
```

### Stage Transition Hooks

```typescript
// hooks/useWorkflowNavigation.ts

export function useWorkflowNavigation() {
  const router = useRouter();
  const workflow = useWorkflowStore();

  const goToAnalyze = (discoverContext: DiscoverContext) => {
    workflow.setDiscoverData(discoverContext);
    router.push('/analyze');
  };

  const goToCreate = (analyzeContext: AnalyzeContext) => {
    workflow.setAnalyzeData(analyzeContext);
    router.push('/create');
  };

  const goToPublish = (createContext: CreateContext) => {
    workflow.setCreateData(createContext);
    router.push('/publish');
  };

  return { goToAnalyze, goToCreate, goToPublish };
}
```

---

## API Structure Changes

### New API Routes

```
/api/v1/workflow/
├── /discover/
│   ├── /search          POST - Unified keyword/hashtag search
│   ├── /trending        GET  - Live trending feed
│   ├── /analyze-keyword POST - Deep keyword analysis
│   ├── /inspiration     CRUD - Saved inspiration management
│   └── /ai-insights     POST - Get AI insights for trends
│
├── /analyze/
│   ├── /generate-ideas  POST - Gemini 3 content idea generation
│   ├── /optimize-prompt POST - Optimize prompts for VEO
│   ├── /brief           CRUD - Save/load creative briefs
│   └── /assets          GET  - Campaign + search assets
│
├── /create/
│   ├── /ai-video        POST - Trigger VEO generation
│   ├── /compose         POST - Trigger compose generation
│   ├── /status/[id]     GET  - Generation status
│   ├── /results/[id]    GET  - Get generated videos
│   └── /score/[id]      POST - Quality scoring
│
└── /publish/
    ├── /queue           GET  - Ready to publish queue
    ├── /schedule        POST - Schedule post
    ├── /now             POST - Publish immediately
    ├── /accounts        CRUD - Connected accounts
    ├── /calendar        GET  - Calendar view data
    └── /analytics/[id]  GET  - Post analytics
```

---

## Migration Plan

### Phase 1: Foundation (Core Structure)
1. Create new route structure (`/discover`, `/analyze`, `/create`, `/publish`)
2. Build `WorkflowStore` with Zustand
3. Create `useWorkflowNavigation` hook
4. Update main navigation component
5. Build workflow progress indicator component

### Phase 2: Discover Stage
1. Migrate `TrendingVideosTile` → `/discover/trending`
2. Migrate keyword analysis from `/trends` → `/discover/keywords`
3. Build unified search component
4. Build inspiration board feature
5. Create `DiscoverContext` passing mechanism

### Phase 3: Analyze Stage
1. Build `ContextReceptionPanel`
2. Integrate Gemini 3 for idea generation
3. Migrate asset manager integration
4. Build `CreativeBriefBuilder`
5. Build `CreationPackageSummary`

### Phase 4: Create Stage
1. Refactor `GenerateMode` → `/create/ai`
2. Refactor `ComposeMode` → `/create/compose`
3. Build inline pipeline status (remove separate `/pipeline` page)
4. Enhance results grid with selection
5. Build quality assessment display

### Phase 5: Publish Stage
1. Migrate from `/publishing`
2. Build calendar scheduling view
3. Consolidate account management
4. Enhance analytics display
5. Build optimal time recommender

### Phase 6: Dashboard & Polish
1. Redesign dashboard as status/entry hub
2. Remove deprecated routes
3. Update all navigation links
4. Add workflow progress persistence
5. Polish transitions and animations

---

## File Structure

```
app/
├── (dashboard)/
│   ├── dashboard/
│   │   └── page.tsx              # Redesigned status hub
│   ├── discover/
│   │   ├── page.tsx              # Main discover page
│   │   ├── keywords/page.tsx     # Keyword analysis
│   │   ├── trending/page.tsx     # Live trending
│   │   └── saved/page.tsx        # Saved inspiration
│   ├── analyze/
│   │   ├── page.tsx              # Main analyze page
│   │   ├── brief/page.tsx        # Brief builder
│   │   └── assets/page.tsx       # Asset management
│   ├── create/
│   │   ├── page.tsx              # Mode selection
│   │   ├── ai/page.tsx           # VEO generation
│   │   ├── compose/page.tsx      # Compose generation
│   │   └── preview/[id]/page.tsx # Preview results
│   ├── publish/
│   │   ├── page.tsx              # Main publish page
│   │   ├── schedule/page.tsx     # Scheduling
│   │   ├── accounts/page.tsx     # Connected accounts
│   │   └── analytics/page.tsx    # Post analytics
│   └── library/                  # Archive only
│       ├── videos/page.tsx
│       └── campaigns/page.tsx
│
├── api/v1/
│   ├── workflow/
│   │   ├── discover/
│   │   ├── analyze/
│   │   ├── create/
│   │   └── publish/
│   └── ... (existing APIs)

components/
├── workflow/
│   ├── WorkflowProgressBar.tsx
│   ├── StageNavigation.tsx
│   └── ContextBridge.tsx
├── discover/
│   ├── UnifiedSearch.tsx
│   ├── TrendingFeed.tsx
│   ├── KeywordAnalysis.tsx
│   ├── InspirationBoard.tsx
│   └── VideoPreviewCard.tsx
├── analyze/
│   ├── ContextReception.tsx
│   ├── CreativeBriefBuilder.tsx
│   ├── GeminiIdeaGenerator.tsx
│   ├── AssetManager.tsx
│   └── CreationPackage.tsx
├── create/
│   ├── ModeSelector.tsx
│   ├── AIVideoGenerator.tsx
│   ├── ComposeWizard.tsx
│   ├── InlinePipelineStatus.tsx
│   └── ResultsGrid.tsx
├── publish/
│   ├── PublishQueue.tsx
│   ├── SchedulingCalendar.tsx
│   ├── AccountManager.tsx
│   ├── CaptionEditor.tsx
│   └── PerformanceCard.tsx
└── layout/
    └── main-navigation.tsx       # Updated navigation

lib/
├── stores/
│   └── workflow-store.ts         # Zustand workflow state
├── hooks/
│   └── useWorkflowNavigation.ts  # Navigation hooks
└── workflow-context.ts           # Context types
```

---

## Success Metrics

### User Experience
- **Reduced navigation clicks**: 60% fewer clicks from discovery to publish
- **Faster content creation**: 40% reduction in time from idea to published video
- **Improved context retention**: 0% context loss between workflow stages

### Technical
- **Code consolidation**: 30% reduction in duplicate components
- **API efficiency**: 50% fewer API calls through better state management
- **Load performance**: <2s page transitions between stages

### Business
- **User completion rate**: Track % of users completing full workflow
- **Video output**: Increase in videos created per user session
- **Publishing efficiency**: Increase in scheduled vs. immediate publishes

---

## Conclusion

This restructuring transforms HYDRA from a feature-collection platform into a **streamlined content pipeline**. The clear Discover → Analyze → Create → Publish flow:

1. **Reduces cognitive load** by presenting one stage at a time
2. **Improves context retention** through proper state management
3. **Eliminates redundancy** by consolidating scattered features
4. **Guides users** through a logical content creation journey
5. **Maximizes AI assistance** at each stage with Gemini 3 integration

The result is a more intuitive, efficient, and powerful video creation platform.
