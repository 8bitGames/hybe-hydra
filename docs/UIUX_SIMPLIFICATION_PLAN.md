# HYBE HYDRA UI/UX Simplification Plan
# HYBE HYDRA UI/UX 간소화 계획

> **Version**: 1.0
> **Date**: 2025-12-02
> **Target Platform**: PC (Desktop)
> **Design Philosophy**: Simple by Default, Complex on Demand
> **설계 철학**: 기본은 심플하게, 필요시에만 복잡하게

---

## Table of Contents / 목차

1. [Executive Summary / 개요](#1-executive-summary--개요)
2. [Current State Analysis / 현재 상태 분석](#2-current-state-analysis--현재-상태-분석)
3. [Design Principles / 설계 원칙](#3-design-principles--설계-원칙)
4. [Navigation Restructuring / 네비게이션 재구성](#4-navigation-restructuring--네비게이션-재구성)
5. [Page-by-Page Redesign / 페이지별 재설계](#5-page-by-page-redesign--페이지별-재설계)
6. [Component Architecture / 컴포넌트 아키텍처](#6-component-architecture--컴포넌트-아키텍처)
7. [Progressive Disclosure Pattern / 점진적 공개 패턴](#7-progressive-disclosure-pattern--점진적-공개-패턴)
8. [Internationalization (i18n) / 다국어 지원](#8-internationalization-i18n--다국어-지원)
9. [Background Process Integration / 백그라운드 프로세스 통합](#9-background-process-integration--백그라운드-프로세스-통합)
10. [Data Model Considerations / 데이터 모델 고려사항](#10-data-model-considerations--데이터-모델-고려사항)
11. [API Endpoint Mapping / API 엔드포인트 매핑](#11-api-endpoint-mapping--api-엔드포인트-매핑)
12. [Implementation Roadmap / 구현 로드맵](#12-implementation-roadmap--구현-로드맵)
13. [File Structure Changes / 파일 구조 변경](#13-file-structure-changes--파일-구조-변경)

---

## 1. Executive Summary / 개요

### Vision / 비전

Transform HYBE HYDRA from a feature-rich but complex platform into an **intuitive, flow-based experience** where:
- **Simple actions require zero configuration** (1-click video generation)
- **Advanced settings are hidden until needed** (expandable panels)
- **Background processes are transparent** (global job tracker)
- **All features remain accessible** but organized by frequency of use

HYBE HYDRA를 기능이 풍부하지만 복잡한 플랫폼에서 **직관적이고 흐름 기반의 경험**으로 전환합니다:
- **간단한 작업은 설정 없이** (1-클릭 영상 생성)
- **고급 설정은 필요할 때만** (확장 가능한 패널)
- **백그라운드 프로세스는 투명하게** (글로벌 작업 트래커)
- **모든 기능은 접근 가능하지만** 사용 빈도에 따라 정리

### Key Changes Summary / 주요 변경 요약

| Area | Current | Proposed | Impact |
|------|---------|----------|--------|
| Navigation depth | 3 levels (dropdown) | 2 levels (flat) | -33% clicks |
| Create flows | 3 separate pages | 1 unified page with modes | Unified mental model |
| Settings visibility | All visible always | Progressive disclosure | Reduced cognitive load |
| Job tracking | None visible | Global status panel | Transparency |
| Campaign workflow | 6 separate pages | Tabbed single-page | Context preservation |

---

## 2. Current State Analysis / 현재 상태 분석

### 2.1 Current Navigation Structure / 현재 네비게이션 구조

```
Current (복잡)
─────────────────────────────────────────────────────
Home
Create (dropdown)
  ├── AI Generate        → /create/generate
  └── Image Compose      → /create/compose
Manage (dropdown)
  ├── Campaigns          → /campaigns
  ├── Pipeline           → /pipeline
  ├── All Videos         → /videos
  └── Publishing         → /publishing
Insights                 → /insights
```

**Problems Identified / 식별된 문제점**:
1. **Hidden primary actions**: "Create" requires 2 clicks
2. **Scattered workflows**: Campaign context lost between pages
3. **Redundant navigation**: Bridge, Trends, Dashboard not in main nav
4. **No job visibility**: Users don't know what's processing

### 2.2 Current Page Inventory / 현재 페이지 인벤토리

| Route | Purpose | Complexity | Usage Frequency |
|-------|---------|------------|-----------------|
| `/home` | Entry point, quick stats | Low | High |
| `/create/generate` | AI video from prompt | High | Very High |
| `/create/compose` | Image slideshow creation | High | Medium |
| `/create/batch` | Batch generation | High | Low |
| `/bridge` | Trend + prompt alchemy | High | Medium |
| `/campaigns` | Campaign list | Medium | High |
| `/campaigns/[id]` | Campaign assets | Medium | High |
| `/campaigns/[id]/generate` | Campaign-specific generation | High | Very High |
| `/campaigns/[id]/compose` | Campaign-specific compose | High | Medium |
| `/campaigns/[id]/pipeline` | Batch variations | Medium | Low |
| `/campaigns/[id]/pipeline/[batchId]` | Pipeline detail | Medium | Low |
| `/campaigns/[id]/curation` | Video review/scoring | Medium | High |
| `/campaigns/[id]/publish` | Schedule posts | Medium | High |
| `/campaigns/[id]/analytics` | Performance metrics | Low | Medium |
| `/pipeline` | Global pipeline view | Medium | Low |
| `/publishing` | Global publishing view | Medium | Medium |
| `/videos` | All videos list | Low | Medium |
| `/insights` | Analytics overview | Medium | Medium |
| `/trends` | Trend exploration | Medium | Low |
| `/dashboard` | Legacy dashboard | Low | Low |
| `/settings/accounts` | Social account OAuth | Low | Low |

### 2.3 Current Data Models Used / 현재 사용 데이터 모델

```prisma
// Primary entities for UI
Campaign          // 캠페인 관리
VideoGeneration   // 영상 생성 (핵심)
Asset             // 에셋 관리
StylePreset       // 스타일 프리셋
TrendSnapshot     // 트렌드 스냅샷
TrendVideo        // 트렌드 영상
TextTrendAnalysis // 텍스트 트렌드 분석
VideoTrendAnalysis // 영상 트렌드 분석
TrendReport       // 트렌드 리포트
SocialAccount     // 소셜 계정
ScheduledPost     // 예약 게시
MerchandiseItem   // 굿즈/머천다이즈
```

---

## 3. Design Principles / 설계 원칙

### 3.1 Core Philosophy: "Simple by Default" / 핵심 철학: "기본은 심플하게"

```
┌─────────────────────────────────────────────────────────────────┐
│                     INTERACTION LAYERS                          │
├─────────────────────────────────────────────────────────────────┤
│  Level 0: One-Click Actions (항상 노출)                          │
│  ├── Quick Create button                                        │
│  ├── Recent campaigns                                           │
│  └── Active jobs indicator                                      │
├─────────────────────────────────────────────────────────────────┤
│  Level 1: Primary Settings (기본 노출, 수정 가능)                  │
│  ├── Prompt input                                               │
│  ├── Duration selector (5s/8s default)                          │
│  └── Aspect ratio (9:16 default)                                │
├─────────────────────────────────────────────────────────────────┤
│  Level 2: Advanced Settings (숨김, 클릭시 펼침)                    │
│  ├── Negative prompt                                            │
│  ├── Reference image selection                                  │
│  ├── Style presets                                              │
│  ├── Audio selection                                            │
│  └── Merchandise integration                                    │
├─────────────────────────────────────────────────────────────────┤
│  Level 3: Expert Mode (별도 패널/모달)                            │
│  ├── Batch generation                                           │
│  ├── Variation creation                                         │
│  ├── Custom style parameters                                    │
│  └── API/Webhook configuration                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Design Tokens / 디자인 토큰

```typescript
// Design constants for consistency
const DESIGN_TOKENS = {
  // Spacing
  spacing: {
    panel: '24px',      // 패널 내부 패딩
    section: '32px',    // 섹션 간격
    compact: '16px',    // 압축 간격
    inline: '8px',      // 인라인 요소 간격
  },

  // Animation
  animation: {
    collapse: '200ms ease-out',   // 펼침/접힘
    fade: '150ms ease-in-out',    // 페이드
    slide: '250ms ease-out',      // 슬라이드
  },

  // Breakpoints (PC focused)
  breakpoints: {
    sidebar: '1024px',   // 사이드바 표시
    wide: '1440px',      // 와이드 레이아웃
    ultrawide: '1920px', // 울트라와이드
  },

  // Z-index layers
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    modal: 30,
    toast: 40,
    jobTracker: 50,  // 항상 최상단
  }
};
```

### 3.3 Color Semantics / 색상 의미론

```typescript
const STATUS_COLORS = {
  // Job/Process status
  pending: 'text-muted-foreground',     // 대기중 (회색)
  processing: 'text-blue-500',          // 처리중 (파랑)
  completed: 'text-green-500',          // 완료 (초록)
  failed: 'text-destructive',           // 실패 (빨강)
  cancelled: 'text-yellow-500',         // 취소됨 (노랑)

  // Content quality
  excellent: 'text-green-500',          // 90+점
  good: 'text-blue-500',                // 70-89점
  average: 'text-yellow-500',           // 50-69점
  poor: 'text-orange-500',              // 30-49점
  reject: 'text-destructive',           // 30점 미만

  // Trend indicators
  rising: 'text-green-500',             // 상승 트렌드
  stable: 'text-blue-500',              // 안정 트렌드
  declining: 'text-orange-500',         // 하락 트렌드
};
```

---

## 4. Navigation Restructuring / 네비게이션 재구성

### 4.1 New Navigation Structure / 새 네비게이션 구조

```
Proposed (심플)
─────────────────────────────────────────────────────
[Logo]  Create   Campaigns   Videos   Insights   [JobTracker] [Settings]
           │
           └── Unified create page with mode tabs
```

**Key Changes / 주요 변경**:
1. **Flatten "Manage" dropdown** → Direct top-level links
2. **Remove "Create" dropdown** → Single unified page
3. **Add global JobTracker** → Always-visible status
4. **Merge Pipeline into Campaigns** → Contextual workflow

### 4.2 New Routes / 새 라우트 구조

```typescript
const NEW_ROUTES = {
  // Primary navigation (1st level)
  '/create': 'Unified creation page with mode tabs',
  '/campaigns': 'Campaign list',
  '/campaigns/[id]': 'Campaign workspace (tabbed)',
  '/videos': 'All videos gallery',
  '/insights': 'Analytics & trends combined',
  '/settings': 'Settings hub',

  // Campaign workspace tabs (2nd level, no navigation change)
  '/campaigns/[id]?tab=assets': 'Assets management',
  '/campaigns/[id]?tab=generate': 'Video generation',
  '/campaigns/[id]?tab=compose': 'Image composition',
  '/campaigns/[id]?tab=videos': 'Generated videos',
  '/campaigns/[id]?tab=publish': 'Publishing schedule',
  '/campaigns/[id]?tab=analytics': 'Campaign analytics',

  // Create page modes (tab parameter)
  '/create?mode=quick': 'Quick 1-click generation',
  '/create?mode=generate': 'Full AI generation',
  '/create?mode=compose': 'Image slideshow',
  '/create?mode=batch': 'Batch generation',

  // Settings sub-pages
  '/settings/accounts': 'Social accounts OAuth',
  '/settings/presets': 'Style presets management',
  '/settings/profile': 'User profile',
};
```

### 4.3 Navigation Component Changes / 네비게이션 컴포넌트 변경

**File**: `components/layout/main-navigation.tsx`

```typescript
// NEW navigation structure
const navigationItems: NavItem[] = [
  {
    name: { ko: '만들기', en: 'Create' },
    href: '/create',
    icon: Sparkles,
    badge: null,
  },
  {
    name: { ko: '캠페인', en: 'Campaigns' },
    href: '/campaigns',
    icon: FolderOpen,
    badge: null,
  },
  {
    name: { ko: '영상', en: 'Videos' },
    href: '/videos',
    icon: PlayCircle,
    badge: null,
  },
  {
    name: { ko: '인사이트', en: 'Insights' },
    href: '/insights',
    icon: TrendingUp,
    badge: { ko: '트렌드', en: 'Trends' },
  },
];

// Right-side items
const rightItems = [
  { component: <GlobalJobTracker /> },           // 글로벌 작업 상태
  { component: <LanguageSwitcher /> },           // 언어 전환
  { component: <UserMenu /> },                   // 사용자 메뉴
];
```

### 4.4 Remove Campaign Sidebar / 캠페인 사이드바 제거

**Current**: `components/layout/campaign-sidebar.tsx` (264 lines)

**Change**: Replace with **tabbed interface within campaign page**

**Reason**:
- Sidebar wastes horizontal space on PC
- Tab navigation is more intuitive for workflow steps
- Context stays within single page

---

## 5. Page-by-Page Redesign / 페이지별 재설계

### 5.1 Unified Create Page / 통합 만들기 페이지

**Route**: `/create`
**File**: `app/(dashboard)/create/page.tsx` (NEW unified)

#### Layout Structure / 레이아웃 구조

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: Create / 만들기                                          │
├──────────────────┬──────────────────────────────────────────────┤
│ Mode Tabs        │                                              │
│ ┌──────────────┐ │  Main Content Area                           │
│ │ Quick        │ │  (Changes based on selected mode)            │
│ │ 빠른 생성     │ │                                              │
│ ├──────────────┤ │  ┌────────────────────────────────────────┐  │
│ │ AI Generate  │ │  │                                        │  │
│ │ AI 생성      │ │  │  Mode-specific content                 │  │
│ ├──────────────┤ │  │                                        │  │
│ │ Compose      │ │  │                                        │  │
│ │ 슬라이드쇼   │ │  │                                        │  │
│ ├──────────────┤ │  └────────────────────────────────────────┘  │
│ │ Batch        │ │                                              │
│ │ 대량 생성    │ │  ┌────────────────────────────────────────┐  │
│ └──────────────┘ │  │ Advanced Settings (Collapsible)        │  │
│                  │  │ 고급 설정 (접을 수 있음)                  │  │
│ Campaign Select  │  └────────────────────────────────────────┘  │
│ ┌──────────────┐ │                                              │
│ │ Select...    │ │                                              │
│ └──────────────┘ │                                              │
│                  │                                              │
│ Trend Sidebar    │                                              │
│ (Optional)       │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

#### Mode: Quick Create / 빠른 생성 모드

```typescript
interface QuickCreateMode {
  // Visible by default (기본 노출)
  prompt: string;              // 프롬프트 입력
  campaignId?: string;         // 캠페인 선택 (선택)

  // Hidden defaults (숨김 기본값)
  duration: 5;                 // 5초 고정
  aspectRatio: '9:16';         // 세로 고정

  // Not available in quick mode (빠른 모드 비활성)
  referenceImage: null;
  audioAsset: null;
  stylePresets: [];
  merchandise: [];
}
```

**UI Elements**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Quick Create / 빠른 생성                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Enter your idea... / 아이디어를 입력하세요...              │   │
│  │                                                          │   │
│  │ [Trend suggestion chips] [#K-pop] [#Dance] [#BTS]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Generate Now / 지금 생성]                      5s • 9:16     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Need more control? / 더 많은 설정이 필요하세요?                  │
│  [Switch to AI Generate mode →]                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Mode: AI Generate / AI 생성 모드

**Progressive Disclosure Levels**:

```typescript
// Level 1: Always visible (항상 노출)
interface GenerateLevel1 {
  prompt: string;
  duration: 5 | 8;           // Simple toggle
  aspectRatio: '9:16' | '16:9' | '1:1';
}

// Level 2: Expandable panel "Options" (옵션 패널)
interface GenerateLevel2 {
  negativePrompt?: string;
  referenceImage?: Asset;
  imageUsageDescription?: string;
}

// Level 3: Expandable panel "Audio & Style" (오디오 & 스타일 패널)
interface GenerateLevel3 {
  audioAsset?: Asset;
  audioStartTime?: number;
  audioDuration?: number;
  stylePresets: StylePreset[];
}

// Level 4: Expandable panel "Merchandise" (굿즈 패널)
interface GenerateLevel4 {
  merchandise: MerchandiseItem[];
  merchandiseContext: MerchandiseContext;
  guidanceScale: number;
}
```

**UI Structure**:
```
┌─────────────────────────────────────────────────────────────────┐
│  AI Generate / AI 생성                                          │
│                                                                 │
│  Campaign: [Select campaign... ▼] (Optional)                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Prompt / 프롬프트                                        │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │ Jungkook dancing in neon-lit streets with rain...   │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  │ [✨ Optimize with AI / AI로 최적화]                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Duration / 길이        Aspect Ratio / 비율                     │
│  [5s] [8s]              [9:16] [16:9] [1:1]                    │
│                                                                 │
│  ▶ Options / 옵션 ──────────────────────────────────────────── │
│  │ Negative prompt / 네거티브 프롬프트                          │
│  │ ┌─────────────────────────────────────────────────────┐    │
│  │ │ blurry, low quality, text overlay...                │    │
│  │ └─────────────────────────────────────────────────────┘    │
│  │                                                             │
│  │ Reference Image / 참조 이미지 (Optional)                    │
│  │ [🖼️ Select from assets] or [📤 Upload]                     │
│  └─────────────────────────────────────────────────────────────│
│                                                                 │
│  ▶ Audio & Style / 오디오 & 스타일 ─────────────────────────── │
│  │ (Collapsed by default / 기본 접힘)                          │
│  └─────────────────────────────────────────────────────────────│
│                                                                 │
│  ▶ Merchandise / 굿즈 ──────────────────────────────────────── │
│  │ (Collapsed by default / 기본 접힘)                          │
│  └─────────────────────────────────────────────────────────────│
│                                                                 │
│  [Generate / 생성]                                              │
└─────────────────────────────────────────────────────────────────┘
```

#### Mode: Compose / 슬라이드쇼 모드

**Step-based wizard with progress indicator**:

```
Step 1: Script → Step 2: Images → Step 3: Music → Step 4: Render
단계 1: 스크립트  단계 2: 이미지   단계 3: 음악    단계 4: 렌더링
  ●───────────────○───────────────○───────────────○
```

Each step shows only relevant controls, with "Advanced" collapsible section.

#### Mode: Batch / 대량 생성 모드

```
┌─────────────────────────────────────────────────────────────────┐
│  Batch Generate / 대량 생성                                      │
│                                                                 │
│  Base Settings / 기본 설정                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Prompt template / 프롬프트 템플릿                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Variation Categories / 변형 카테고리                            │
│  ☑️ AI Prompt Variations (5) / AI 프롬프트 변형                  │
│  ☑️ Camera Angles (4) / 카메라 앵글                              │
│  ☐ Expressions (3) / 표현 변형                                   │
│  ☐ Style Presets (6) / 스타일 프리셋                             │
│                                                                 │
│  Max Variations / 최대 생성 수: [15 ▼]                           │
│  Estimated: 20 videos (capped to 15)                            │
│  예상: 20개 영상 (15개로 제한됨)                                   │
│                                                                 │
│  ⚠️ This will generate 15 videos.                               │
│     15개의 영상이 생성됩니다.                                      │
│                                                                 │
│  [Generate Batch / 대량 생성]                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.2 Campaign Workspace / 캠페인 워크스페이스

**Route**: `/campaigns/[id]`
**File**: `app/(dashboard)/campaigns/[id]/page.tsx` (REFACTORED)

#### Tabbed Interface / 탭 인터페이스

Replace sidebar with horizontal tabs that preserve context:

```
┌─────────────────────────────────────────────────────────────────┐
│ Campaign: BTS 2025 Summer Comeback                              │
│ Artist: BTS • Status: Active • 12 videos                        │
├─────────────────────────────────────────────────────────────────┤
│ [Assets] [Generate] [Compose] [Videos] [Publish] [Analytics]   │
│     ↓        ↓          ↓        ↓         ↓          ↓        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              Tab Content (switches based on selection)          │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Tab Mapping to Current Pages**:

| Tab | Current Route | New Route | Key Components |
|-----|---------------|-----------|----------------|
| Assets | `/campaigns/[id]` | `?tab=assets` | Asset grid, upload |
| Generate | `/campaigns/[id]/generate` | `?tab=generate` | Same as /create AI mode |
| Compose | `/campaigns/[id]/compose` | `?tab=compose` | Same as /create Compose mode |
| Videos | `/campaigns/[id]/curation` | `?tab=videos` | Video grid, scoring, filtering |
| Publish | `/campaigns/[id]/publish` | `?tab=publish` | Schedule table, calendar |
| Analytics | `/campaigns/[id]/analytics` | `?tab=analytics` | Charts, metrics |

#### Pipeline Integration / 파이프라인 통합

**Remove**: `/campaigns/[id]/pipeline` as separate page
**Add**: Pipeline status as overlay/drawer within Videos tab

```
┌─────────────────────────────────────────────────────────────────┐
│ [Assets] [Generate] [Compose] [Videos ●] [Publish] [Analytics] │
├─────────────────────────────────────────────────────────────────┤
│ Videos / 영상                                    [+ Pipeline ▼] │
│                                                                 │
│ Filter: [All ▼] [Status ▼] [Score ▼]           Sort: [Recent ▼]│
│                                                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │ Video 1 │ │ Video 2 │ │ Video 3 │ │ Video 4 │ │ Video 5 │    │
│ │ ★ 92    │ │ ★ 87    │ │ ★ 78    │ │ ⏳ ...  │ │ ⏳ ...  │    │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Active Pipeline: Batch #1 (12/15 complete)                  │ │
│ │ ████████████████████░░░░░░ 80%                              │ │
│ │ [View Details] [Pause] [Cancel]                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.3 Insights Page / 인사이트 페이지

**Route**: `/insights`
**Merge**: `/trends`, `/dashboard`, `/bridge` trend features

#### Layout / 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│ Insights / 인사이트                                              │
├─────────────────────────────────────────────────────────────────┤
│ [Overview] [Trends] [Performance] [Bridge]                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Overview Tab:                                                   │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│ │ Total Videos  │ │ Published     │ │ Avg Score     │          │
│ │     156       │ │      42       │ │     82.3      │          │
│ └───────────────┘ └───────────────┘ └───────────────┘          │
│                                                                 │
│ Trends Tab:                                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Platform: [TikTok ▼]    Region: [KR ▼]    [Refresh]         │ │
│ │                                                             │ │
│ │ Trending Now / 지금 인기                                     │ │
│ │ 1. #NewJeans    ▲ 2.3M views                                │ │
│ │ 2. #KpopDance   ▲ 1.8M views                                │ │
│ │ 3. #BTS         → 1.5M views                                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Bridge Tab (Prompt Alchemy):                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Enter idea → Apply trends → Generate optimized prompt       │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.4 Videos Gallery / 영상 갤러리

**Route**: `/videos`
**Current**: `/videos` (simple list)

#### Enhanced Gallery / 향상된 갤러리

```
┌─────────────────────────────────────────────────────────────────┐
│ Videos / 영상                                                    │
├─────────────────────────────────────────────────────────────────┤
│ View: [Grid ▼] [List]    Filter: [Campaign ▼] [Status ▼]        │
│ Search: [________________]                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │▶ Video  │ │▶ Video  │ │▶ Video  │ │▶ Video  │ │▶ Video  │    │
│ │         │ │         │ │         │ │         │ │         │    │
│ │ ★ 92    │ │ ★ 87    │ │ ★ 78    │ │ ★ 65    │ │ ★ 91    │    │
│ │ BTS...  │ │ NJ...   │ │ BTS...  │ │ SVT...  │ │ BTS...  │    │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
│                                                                 │
│ Quick Actions on Hover:                                         │
│ [▶ Play] [📤 Publish] [📋 Copy Prompt] [🗑️ Delete]              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Component Architecture / 컴포넌트 아키텍처

### 6.1 New Component Structure / 새 컴포넌트 구조

```
components/
├── ui/                          # shadcn primitives (unchanged)
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
│
├── shared/                      # Cross-feature components (NEW)
│   ├── GlobalJobTracker.tsx     # 글로벌 작업 트래커
│   ├── LanguageSwitcher.tsx     # 언어 전환
│   ├── CollapsiblePanel.tsx     # 접을 수 있는 패널
│   ├── ProgressIndicator.tsx    # 진행 상태 표시
│   ├── VideoThumbnail.tsx       # 영상 썸네일
│   ├── TrendChip.tsx            # 트렌드 칩
│   ├── CampaignSelector.tsx     # 캠페인 선택기
│   └── AssetPicker.tsx          # 에셋 선택기
│
├── layout/                      # Layout components
│   ├── main-navigation.tsx      # (REFACTORED) Flat nav
│   ├── header.tsx               # (REFACTORED) With JobTracker
│   └── page-header.tsx          # Page title + actions
│
├── features/                    # Feature-specific components
│   ├── create/                  # Unified create page
│   │   ├── CreatePage.tsx       # Main container
│   │   ├── ModeSelector.tsx     # Tab selector
│   │   ├── QuickCreateMode.tsx  # Quick mode
│   │   ├── GenerateMode.tsx     # AI generate mode
│   │   ├── ComposeMode.tsx      # Compose mode
│   │   ├── BatchMode.tsx        # Batch mode
│   │   └── AdvancedPanel.tsx    # Collapsible advanced settings
│   │
│   ├── campaigns/               # Campaign workspace
│   │   ├── CampaignWorkspace.tsx    # Tabbed container
│   │   ├── AssetsTab.tsx
│   │   ├── GenerateTab.tsx
│   │   ├── ComposeTab.tsx
│   │   ├── VideosTab.tsx
│   │   ├── PublishTab.tsx
│   │   └── AnalyticsTab.tsx
│   │
│   ├── videos/                  # Video gallery
│   │   ├── VideoGallery.tsx
│   │   ├── VideoCard.tsx
│   │   └── VideoFilters.tsx
│   │
│   ├── insights/                # Insights hub
│   │   ├── InsightsPage.tsx
│   │   ├── OverviewTab.tsx
│   │   ├── TrendsTab.tsx
│   │   ├── PerformanceTab.tsx
│   │   └── BridgeTab.tsx
│   │
│   └── jobs/                    # Job tracking (NEW)
│       ├── JobList.tsx
│       ├── JobItem.tsx
│       └── JobProgress.tsx
```

### 6.2 GlobalJobTracker Component / 글로벌 작업 트래커

**File**: `components/shared/GlobalJobTracker.tsx`

```typescript
interface Job {
  id: string;
  type: 'generation' | 'compose' | 'trend_collect' | 'trend_analyze' | 'publish';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;        // 0-100
  title: string;           // "Generating video..."
  titleKo: string;         // "영상 생성 중..."
  campaignId?: string;
  createdAt: Date;
  estimatedTime?: number;  // seconds remaining
}

interface GlobalJobTrackerProps {
  position: 'header' | 'floating';
}
```

**UI States**:

```
// Collapsed (No active jobs)
┌───────────────────────────┐
│ ✓ All tasks complete      │
└───────────────────────────┘

// Collapsed (Jobs running)
┌───────────────────────────┐
│ ⏳ 3 tasks running    [▼] │
└───────────────────────────┘

// Expanded
┌───────────────────────────────────────────────────────────┐
│ Active Tasks / 진행 중인 작업                        [×]  │
├───────────────────────────────────────────────────────────┤
│ ⏳ Generating video... / 영상 생성 중...                   │
│    ████████████░░░░░░░░ 60%  ~2 min                       │
│    Campaign: BTS Summer                                   │
├───────────────────────────────────────────────────────────┤
│ ⏳ Collecting trends... / 트렌드 수집 중...                │
│    ████████░░░░░░░░░░░░ 40%  ~30 sec                      │
├───────────────────────────────────────────────────────────┤
│ ✓ Video generated / 영상 생성 완료                        │
│    BTS Dance Challenge • Score: 87                        │
│    [View] [Publish]                                       │
└───────────────────────────────────────────────────────────┘
```

### 6.3 CollapsiblePanel Component / 접을 수 있는 패널

**File**: `components/shared/CollapsiblePanel.tsx`

```typescript
interface CollapsiblePanelProps {
  title: string;
  titleKo: string;
  defaultOpen?: boolean;
  badge?: string;           // e.g., "Optional", "Advanced"
  children: React.ReactNode;
}

// Usage
<CollapsiblePanel
  title="Advanced Settings"
  titleKo="고급 설정"
  defaultOpen={false}
  badge="Optional"
>
  <NegativePromptInput />
  <ReferenceImagePicker />
</CollapsiblePanel>
```

**Visual Design**:
```
// Collapsed
┌─────────────────────────────────────────────────────────────┐
│ ▶ Advanced Settings / 고급 설정              [Optional]     │
└─────────────────────────────────────────────────────────────┘

// Expanded
┌─────────────────────────────────────────────────────────────┐
│ ▼ Advanced Settings / 고급 설정              [Optional]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Content here...                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Progressive Disclosure Pattern / 점진적 공개 패턴

### 7.1 Pattern Definition / 패턴 정의

```typescript
type DisclosureLevel = 'always' | 'default' | 'advanced' | 'expert';

interface FieldConfig {
  name: string;
  level: DisclosureLevel;
  defaultValue?: unknown;
  required?: boolean;
}

// Example: Video Generation fields
const GENERATION_FIELDS: FieldConfig[] = [
  // Always visible
  { name: 'prompt', level: 'always', required: true },
  { name: 'duration', level: 'always', defaultValue: 5 },
  { name: 'aspectRatio', level: 'always', defaultValue: '9:16' },

  // Default panel (collapsed by default)
  { name: 'negativePrompt', level: 'default' },
  { name: 'referenceImage', level: 'default' },
  { name: 'imageUsageDescription', level: 'default' },

  // Advanced panel
  { name: 'audioAsset', level: 'advanced' },
  { name: 'audioStartTime', level: 'advanced' },
  { name: 'stylePresets', level: 'advanced' },

  // Expert panel
  { name: 'merchandise', level: 'expert' },
  { name: 'merchandiseContext', level: 'expert' },
  { name: 'guidanceScale', level: 'expert' },
  { name: 'trendKeywords', level: 'expert' },
];
```

### 7.2 Panel Configuration / 패널 구성

```typescript
interface PanelConfig {
  id: string;
  title: { ko: string; en: string };
  level: DisclosureLevel;
  defaultOpen: boolean;
  fields: string[];
}

const GENERATE_PANELS: PanelConfig[] = [
  {
    id: 'main',
    title: { ko: '기본 설정', en: 'Basic Settings' },
    level: 'always',
    defaultOpen: true,
    fields: ['prompt', 'duration', 'aspectRatio'],
  },
  {
    id: 'options',
    title: { ko: '옵션', en: 'Options' },
    level: 'default',
    defaultOpen: false,
    fields: ['negativePrompt', 'referenceImage', 'imageUsageDescription'],
  },
  {
    id: 'audio-style',
    title: { ko: '오디오 & 스타일', en: 'Audio & Style' },
    level: 'advanced',
    defaultOpen: false,
    fields: ['audioAsset', 'audioStartTime', 'stylePresets'],
  },
  {
    id: 'merchandise',
    title: { ko: '굿즈', en: 'Merchandise' },
    level: 'expert',
    defaultOpen: false,
    fields: ['merchandise', 'merchandiseContext', 'guidanceScale'],
  },
];
```

### 7.3 Smart Defaults / 스마트 기본값

```typescript
const SMART_DEFAULTS = {
  // Duration based on platform
  duration: {
    tiktok: 5,      // TikTok optimal
    youtube: 8,     // YouTube Shorts
    instagram: 8,   // Instagram Reels
  },

  // Aspect ratio based on platform
  aspectRatio: {
    tiktok: '9:16',
    youtube: '9:16',
    instagram: '9:16',
    general: '16:9',
  },

  // Negative prompts (always applied)
  defaultNegativePrompt: 'blurry, low quality, distorted, text overlay, watermark',

  // Audio sync
  audioDuration: 15,      // Max 15 seconds
  audioStartTime: 0,      // Start from beginning
};
```

---

## 8. Internationalization (i18n) / 다국어 지원

### 8.1 Translation Structure Enhancement / 번역 구조 개선

**File**: `lib/i18n/translations.ts` (ENHANCED)

```typescript
// Add new sections for simplified UI
export interface Translations {
  // ... existing sections ...

  // NEW: Unified Create page
  create: {
    title: string;
    modes: {
      quick: { name: string; description: string };
      generate: { name: string; description: string };
      compose: { name: string; description: string };
      batch: { name: string; description: string };
    };
    panels: {
      options: string;
      audioStyle: string;
      merchandise: string;
    };
    actions: {
      generate: string;
      generating: string;
      switchMode: string;
    };
    hints: {
      needMoreControl: string;
      quickModeInfo: string;
    };
  };

  // NEW: Job tracker
  jobs: {
    title: string;
    noActiveJobs: string;
    tasksRunning: string;
    estimatedTime: string;
    actions: {
      view: string;
      cancel: string;
      retry: string;
    };
    types: {
      generation: string;
      compose: string;
      trendCollect: string;
      trendAnalyze: string;
      publish: string;
    };
  };

  // NEW: Collapsible panels
  panels: {
    expand: string;
    collapse: string;
    optional: string;
    advanced: string;
    expert: string;
  };
}
```

### 8.2 New Translations / 새 번역

```typescript
// Korean translations
ko: {
  create: {
    title: '만들기',
    modes: {
      quick: {
        name: '빠른 생성',
        description: '1클릭으로 AI 영상 생성'
      },
      generate: {
        name: 'AI 생성',
        description: '상세 설정으로 영상 생성'
      },
      compose: {
        name: '슬라이드쇼',
        description: '이미지 + 오디오 합성'
      },
      batch: {
        name: '대량 생성',
        description: '다양한 변형 일괄 생성'
      },
    },
    panels: {
      options: '옵션',
      audioStyle: '오디오 & 스타일',
      merchandise: '굿즈',
    },
    actions: {
      generate: '생성',
      generating: '생성 중...',
      switchMode: '모드 전환',
    },
    hints: {
      needMoreControl: '더 많은 설정이 필요하세요?',
      quickModeInfo: '빠른 모드는 5초 세로 영상을 기본으로 합니다',
    },
  },
  jobs: {
    title: '진행 중인 작업',
    noActiveJobs: '모든 작업 완료',
    tasksRunning: '개 작업 진행 중',
    estimatedTime: '예상 소요 시간',
    actions: {
      view: '보기',
      cancel: '취소',
      retry: '재시도',
    },
    types: {
      generation: '영상 생성',
      compose: '슬라이드쇼 렌더링',
      trendCollect: '트렌드 수집',
      trendAnalyze: '트렌드 분석',
      publish: '발행',
    },
  },
  panels: {
    expand: '펼치기',
    collapse: '접기',
    optional: '선택',
    advanced: '고급',
    expert: '전문가',
  },
},

// English translations
en: {
  create: {
    title: 'Create',
    modes: {
      quick: {
        name: 'Quick Create',
        description: '1-click AI video generation'
      },
      generate: {
        name: 'AI Generate',
        description: 'Full control video generation'
      },
      compose: {
        name: 'Slideshow',
        description: 'Combine images + audio'
      },
      batch: {
        name: 'Batch Create',
        description: 'Generate multiple variations'
      },
    },
    // ... rest of English translations
  },
  // ...
}
```

### 8.3 Bilingual Display Pattern / 이중 언어 표시 패턴

For critical UI elements, show both languages for clarity:

```tsx
// Pattern for bilingual labels
interface BilingualLabelProps {
  ko: string;
  en: string;
  showBoth?: boolean;  // Default: based on user preference
}

function BilingualLabel({ ko, en, showBoth }: BilingualLabelProps) {
  const { language, showBothLanguages } = useLanguage();

  if (showBoth || showBothLanguages) {
    return (
      <span>
        {language === 'ko' ? ko : en}
        <span className="text-muted-foreground ml-1">
          ({language === 'ko' ? en : ko})
        </span>
      </span>
    );
  }

  return <span>{language === 'ko' ? ko : en}</span>;
}

// Usage
<BilingualLabel ko="영상 생성" en="Generate Video" />
// Renders: "영상 생성 (Generate Video)" or "Generate Video (영상 생성)"
```

---

## 9. Background Process Integration / 백그라운드 프로세스 통합

### 9.1 Job Types and States / 작업 유형 및 상태

```typescript
// Unified job type covering all background processes
enum JobType {
  VIDEO_GENERATION = 'VIDEO_GENERATION',
  VIDEO_COMPOSE = 'VIDEO_COMPOSE',
  BATCH_GENERATION = 'BATCH_GENERATION',
  TREND_COLLECT = 'TREND_COLLECT',
  TREND_ANALYZE_TEXT = 'TREND_ANALYZE_TEXT',
  TREND_ANALYZE_VIDEO = 'TREND_ANALYZE_VIDEO',
  TREND_REPORT = 'TREND_REPORT',
  PUBLISH = 'PUBLISH',
  SCORE_ALL = 'SCORE_ALL',
}

enum JobStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;

  // Localized messages
  title: { ko: string; en: string };
  currentStep: { ko: string; en: string };

  // Context
  campaignId?: string;
  generationId?: string;

  // Timing
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;  // seconds

  // Result
  result?: {
    outputUrl?: string;
    score?: number;
    error?: string;
  };
}
```

### 9.2 Job Tracking API / 작업 추적 API

**New Endpoint**: `GET /api/v1/jobs`

```typescript
// API Response
interface JobsResponse {
  active: Job[];
  recent: Job[];  // Last 10 completed/failed
  counts: {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

// Polling interval
const JOB_POLL_INTERVAL = 2000; // 2 seconds
```

### 9.3 Real-time Updates with SWR / SWR을 사용한 실시간 업데이트

```typescript
// hooks/useJobs.ts
import useSWR from 'swr';

export function useJobs() {
  const { data, error, mutate } = useSWR<JobsResponse>(
    '/api/v1/jobs',
    fetcher,
    {
      refreshInterval: JOB_POLL_INTERVAL,
      revalidateOnFocus: true,
    }
  );

  return {
    jobs: data?.active ?? [],
    recentJobs: data?.recent ?? [],
    counts: data?.counts ?? { queued: 0, processing: 0, completed: 0, failed: 0 },
    isLoading: !data && !error,
    error,
    refresh: mutate,
  };
}
```

### 9.4 Inngest Integration Points / Inngest 통합 지점

**Jobs to migrate to Inngest**:

| Current Endpoint | Inngest Function | Priority |
|------------------|------------------|----------|
| `POST /api/v1/trends/collect` | `inngest/trends/collect` | High |
| `POST /api/v1/trends/analyze/text` | `inngest/trends/analyze-text` | High |
| `POST /api/v1/trends/analyze/video` | `inngest/trends/analyze-video` | High |
| `POST /api/v1/trends/analyze/report` | `inngest/trends/report` | High |
| `POST /api/v1/analyze-video` | `inngest/video/analyze` | High |
| `POST /api/v1/campaigns/[id]/generations/score-all` | `inngest/video/score-batch` | Medium |
| `POST /api/v1/campaigns/[id]/generations` | `inngest/video/generate` | Medium |
| `POST /api/v1/quick-create` | `inngest/video/quick-create` | Medium |

---

## 10. Data Model Considerations / 데이터 모델 고려사항

### 10.1 No Schema Changes Required / 스키마 변경 불필요

The current Prisma schema supports all proposed UI changes. Key models remain:

| Model | UI Component | Usage |
|-------|--------------|-------|
| `Campaign` | CampaignWorkspace, CampaignSelector | Campaign context |
| `VideoGeneration` | VideosTab, VideoGallery | Video display & management |
| `Asset` | AssetsTab, AssetPicker | Asset management |
| `StylePreset` | GenerateMode (advanced) | Style selection |
| `TrendSnapshot` | TrendsTab | Trend display |
| `TrendVideo` | TrendsTab | Trend video preview |
| `TextTrendAnalysis` | BridgeTab | Text trend insights |
| `VideoTrendAnalysis` | BridgeTab | Video trend insights |
| `TrendReport` | BridgeTab | Combined recommendations |
| `SocialAccount` | PublishTab, Settings | OAuth accounts |
| `ScheduledPost` | PublishTab | Scheduling |
| `MerchandiseItem` | GenerateMode (expert) | Merchandise picker |

### 10.2 New Client-Side State / 새 클라이언트 상태

```typescript
// stores/ui-store.ts
interface UIState {
  // Create page
  createMode: 'quick' | 'generate' | 'compose' | 'batch';
  expandedPanels: Set<string>;

  // Campaign workspace
  activeTab: 'assets' | 'generate' | 'compose' | 'videos' | 'publish' | 'analytics';

  // Job tracker
  jobTrackerExpanded: boolean;

  // Language
  language: 'ko' | 'en';
  showBothLanguages: boolean;
}

// Persist in localStorage
const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      createMode: 'quick',
      expandedPanels: new Set(),
      activeTab: 'assets',
      jobTrackerExpanded: false,
      language: 'ko',
      showBothLanguages: false,

      setCreateMode: (mode) => set({ createMode: mode }),
      togglePanel: (id) => set((state) => ({
        expandedPanels: state.expandedPanels.has(id)
          ? new Set([...state.expandedPanels].filter(p => p !== id))
          : new Set([...state.expandedPanels, id])
      })),
      // ... other actions
    }),
    { name: 'hydra-ui-state' }
  )
);
```

### 10.3 API Response Optimization / API 응답 최적화

For the unified create page, optimize API calls:

```typescript
// New endpoint for create page initialization
// GET /api/v1/create/init
interface CreateInitResponse {
  campaigns: Pick<Campaign, 'id' | 'name' | 'status' | 'artist_name'>[];
  recentAudio: Pick<Asset, 'id' | 'filename' | 's3_url'>[];
  stylePresets: Pick<StylePreset, 'id' | 'name' | 'nameKo' | 'category'>[];
  trendSuggestions: { keyword: string; viewCount: number }[];
}
```

---

## 11. API Endpoint Mapping / API 엔드포인트 매핑

### 11.1 Endpoints by UI Component / UI 컴포넌트별 엔드포인트

#### Create Page / 만들기 페이지

| UI Action | Method | Endpoint | Notes |
|-----------|--------|----------|-------|
| Initialize page | GET | `/api/v1/create/init` | NEW: Combined init |
| Quick create | POST | `/api/v1/quick-create` | Existing |
| Full generate | POST | `/api/v1/campaigns/[id]/generations` | Existing |
| Compose script | POST | `/api/v1/compose/script` | Existing |
| Compose render | POST | `/api/v1/compose/render` | Existing |
| Batch generate | POST | `/api/v1/campaigns/[id]/generations/batch` | Existing |
| Transform prompt | POST | `/api/v1/prompts/transform` | Existing |
| Search images | POST | `/api/v1/compose/images/search` | Existing |
| Match music | POST | `/api/v1/compose/music/match` | Existing |
| Get presets | GET | `/api/v1/presets` | Existing |
| Get merchandise | GET | `/api/v1/merchandise` | Existing |

#### Campaign Workspace / 캠페인 워크스페이스

| Tab | Method | Endpoint | Notes |
|-----|--------|----------|-------|
| Assets | GET | `/api/v1/campaigns/[id]/assets` | Existing |
| Assets upload | POST | `/api/v1/assets/presign` | Existing |
| Generate | POST | `/api/v1/campaigns/[id]/generations` | Same as Create |
| Compose | POST | `/api/v1/compose/render` | Same as Create |
| Videos | GET | `/api/v1/campaigns/[id]/generations` | Existing |
| Score video | POST | `/api/v1/generations/[id]/score` | Existing |
| Score all | POST | `/api/v1/campaigns/[id]/generations/score-all` | → Inngest |
| Publish list | GET | `/api/v1/publishing/schedule?campaign=[id]` | Existing |
| Schedule post | POST | `/api/v1/publishing/schedule` | Existing |
| Analytics | GET | `/api/v1/campaigns/[id]/dashboard` | Existing |

#### Insights Page / 인사이트 페이지

| Tab | Method | Endpoint | Notes |
|-----|--------|----------|-------|
| Overview | GET | `/api/v1/dashboard/stats` | Existing |
| Trends | GET | `/api/v1/trends` | Existing |
| Trend videos | GET | `/api/v1/trends/videos` | Existing |
| Collect trends | POST | `/api/v1/trends/collect` | → Inngest |
| Analyze text | POST | `/api/v1/trends/analyze/text` | → Inngest |
| Analyze video | POST | `/api/v1/trends/analyze/video` | → Inngest |
| Bridge prompt | POST | `/api/v1/prompts/transform` | Existing |

#### Job Tracker / 작업 트래커

| Action | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| Get jobs | GET | `/api/v1/jobs` | NEW |
| Cancel job | POST | `/api/v1/jobs/[id]/cancel` | NEW |
| Retry job | POST | `/api/v1/jobs/[id]/retry` | NEW |

### 11.2 New Endpoints Required / 필요한 새 엔드포인트

```typescript
// 1. Create page initialization
// GET /api/v1/create/init
app.get('/api/v1/create/init', async (req, res) => {
  const [campaigns, recentAudio, stylePresets, trends] = await Promise.all([
    prisma.campaign.findMany({ select: { id, name, status, artist: { select: { stageName } } }, take: 20 }),
    prisma.asset.findMany({ where: { type: 'AUDIO' }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.stylePreset.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.trendSnapshot.findMany({ orderBy: { viewCount: 'desc' }, take: 10 }),
  ]);

  return { campaigns, recentAudio, stylePresets, trendSuggestions: trends };
});

// 2. Jobs list
// GET /api/v1/jobs
app.get('/api/v1/jobs', async (req, res) => {
  // Query from Inngest or database job tracking table
  const active = await inngest.getActiveJobs();
  const recent = await inngest.getRecentJobs({ limit: 10 });

  return { active, recent, counts: { ... } };
});

// 3. Job cancellation
// POST /api/v1/jobs/[id]/cancel
app.post('/api/v1/jobs/:id/cancel', async (req, res) => {
  await inngest.cancelJob(req.params.id);
  return { success: true };
});
```

---

## 12. Implementation Roadmap / 구현 로드맵

### Phase 1: Foundation (Week 1-2) / 1단계: 기반 (1-2주)

#### Tasks / 작업
1. **Create shared components**
   - [ ] `GlobalJobTracker.tsx`
   - [ ] `CollapsiblePanel.tsx`
   - [ ] `BilingualLabel.tsx`
   - [ ] `ProgressIndicator.tsx`

2. **Update navigation**
   - [ ] Flatten `main-navigation.tsx`
   - [ ] Add JobTracker to header
   - [ ] Remove campaign sidebar

3. **Add i18n extensions**
   - [ ] Add new translation keys
   - [ ] Implement language toggle

#### Files Changed / 변경 파일
```
components/shared/GlobalJobTracker.tsx       (NEW)
components/shared/CollapsiblePanel.tsx       (NEW)
components/shared/BilingualLabel.tsx         (NEW)
components/layout/main-navigation.tsx        (MODIFIED)
components/layout/header.tsx                 (MODIFIED)
lib/i18n/translations.ts                     (MODIFIED)
```

### Phase 2: Unified Create Page (Week 2-3) / 2단계: 통합 만들기 페이지 (2-3주)

#### Tasks / 작업
1. **Create unified page structure**
   - [ ] `CreatePage.tsx` with mode tabs
   - [ ] `QuickCreateMode.tsx`
   - [ ] `GenerateMode.tsx` with progressive disclosure
   - [ ] `ComposeMode.tsx` as stepper
   - [ ] `BatchMode.tsx`

2. **Migrate existing logic**
   - [ ] Move `/create/generate` logic to GenerateMode
   - [ ] Move `/create/compose` logic to ComposeMode
   - [ ] Move `/create/batch` logic to BatchMode

3. **Add new API endpoint**
   - [ ] `GET /api/v1/create/init`

#### Files Changed / 변경 파일
```
app/(dashboard)/create/page.tsx              (REPLACED)
components/features/create/CreatePage.tsx    (NEW)
components/features/create/ModeSelector.tsx  (NEW)
components/features/create/QuickCreateMode.tsx   (NEW)
components/features/create/GenerateMode.tsx      (NEW)
components/features/create/ComposeMode.tsx       (NEW)
components/features/create/BatchMode.tsx         (NEW)
components/features/create/AdvancedPanel.tsx     (NEW)
app/api/v1/create/init/route.ts              (NEW)
```

### Phase 3: Campaign Workspace (Week 3-4) / 3단계: 캠페인 워크스페이스 (3-4주)

#### Tasks / 작업
1. **Create tabbed workspace**
   - [ ] `CampaignWorkspace.tsx` with tabs
   - [ ] Tab components for each section
   - [ ] URL sync with tab state

2. **Migrate existing pages**
   - [ ] Merge `/campaigns/[id]` subpages into tabs
   - [ ] Remove campaign sidebar
   - [ ] Update routing

3. **Integrate pipeline into Videos tab**
   - [ ] Add pipeline status overlay
   - [ ] Merge `/campaigns/[id]/pipeline` into Videos tab

#### Files Changed / 변경 파일
```
app/(dashboard)/campaigns/[id]/page.tsx      (REPLACED)
components/features/campaigns/CampaignWorkspace.tsx  (NEW)
components/features/campaigns/AssetsTab.tsx          (NEW)
components/features/campaigns/GenerateTab.tsx        (NEW)
components/features/campaigns/ComposeTab.tsx         (NEW)
components/features/campaigns/VideosTab.tsx          (NEW)
components/features/campaigns/PublishTab.tsx         (NEW)
components/features/campaigns/AnalyticsTab.tsx       (NEW)
components/layout/campaign-sidebar.tsx       (DELETED)
```

### Phase 4: Insights & Videos (Week 4-5) / 4단계: 인사이트 & 영상 (4-5주)

#### Tasks / 작업
1. **Merge insights pages**
   - [ ] Create tabbed Insights page
   - [ ] Merge `/trends`, `/dashboard`, Bridge into tabs
   - [ ] Add trend suggestions inline

2. **Enhance videos gallery**
   - [ ] Add filtering and search
   - [ ] Add quick actions on hover
   - [ ] Improve video preview

#### Files Changed / 변경 파일
```
app/(dashboard)/insights/page.tsx            (REPLACED)
components/features/insights/InsightsPage.tsx    (NEW)
components/features/insights/OverviewTab.tsx     (NEW)
components/features/insights/TrendsTab.tsx       (NEW)
components/features/insights/PerformanceTab.tsx  (NEW)
components/features/insights/BridgeTab.tsx       (NEW)
app/(dashboard)/videos/page.tsx              (MODIFIED)
components/features/videos/VideoGallery.tsx      (NEW)
```

### Phase 5: Background Jobs (Week 5-6) / 5단계: 백그라운드 작업 (5-6주)

#### Tasks / 작업
1. **Implement Inngest**
   - [ ] Set up Inngest client
   - [ ] Create job functions for blocking endpoints
   - [ ] Add job tracking API

2. **Connect to GlobalJobTracker**
   - [ ] Implement job polling
   - [ ] Add job notifications
   - [ ] Test end-to-end

#### Files Changed / 변경 파일
```
lib/inngest/client.ts                        (NEW)
lib/inngest/functions/trends.ts              (NEW)
lib/inngest/functions/video.ts               (NEW)
app/api/v1/jobs/route.ts                     (NEW)
app/api/v1/jobs/[id]/cancel/route.ts         (NEW)
app/api/inngest/route.ts                     (NEW)
```

---

## 13. File Structure Changes / 파일 구조 변경

### 13.1 Files to Create / 생성할 파일

```
components/
├── shared/
│   ├── GlobalJobTracker.tsx           # 글로벌 작업 트래커
│   ├── CollapsiblePanel.tsx           # 접을 수 있는 패널
│   ├── BilingualLabel.tsx             # 이중 언어 레이블
│   ├── ProgressIndicator.tsx          # 진행 상태 표시
│   ├── CampaignSelector.tsx           # 캠페인 선택기
│   └── AssetPicker.tsx                # 에셋 선택기
│
├── features/
│   ├── create/
│   │   ├── CreatePage.tsx
│   │   ├── ModeSelector.tsx
│   │   ├── QuickCreateMode.tsx
│   │   ├── GenerateMode.tsx
│   │   ├── ComposeMode.tsx
│   │   ├── BatchMode.tsx
│   │   ├── AdvancedPanel.tsx
│   │   └── index.ts
│   │
│   ├── campaigns/
│   │   ├── CampaignWorkspace.tsx
│   │   ├── AssetsTab.tsx
│   │   ├── GenerateTab.tsx
│   │   ├── ComposeTab.tsx
│   │   ├── VideosTab.tsx
│   │   ├── PublishTab.tsx
│   │   ├── AnalyticsTab.tsx
│   │   └── index.ts
│   │
│   ├── insights/
│   │   ├── InsightsPage.tsx
│   │   ├── OverviewTab.tsx
│   │   ├── TrendsTab.tsx
│   │   ├── PerformanceTab.tsx
│   │   ├── BridgeTab.tsx
│   │   └── index.ts
│   │
│   ├── videos/
│   │   ├── VideoGallery.tsx
│   │   ├── VideoCard.tsx
│   │   ├── VideoFilters.tsx
│   │   └── index.ts
│   │
│   └── jobs/
│       ├── JobList.tsx
│       ├── JobItem.tsx
│       ├── JobProgress.tsx
│       └── index.ts

lib/
├── inngest/
│   ├── client.ts
│   └── functions/
│       ├── trends.ts
│       ├── video.ts
│       └── index.ts
│
└── stores/
    └── ui-store.ts                    # UI state management

app/
├── api/
│   └── v1/
│       ├── create/
│       │   └── init/
│       │       └── route.ts           # Create page init API
│       ├── jobs/
│       │   ├── route.ts               # Job list API
│       │   └── [id]/
│       │       ├── cancel/
│       │       │   └── route.ts       # Cancel job API
│       │       └── retry/
│       │           └── route.ts       # Retry job API
│       └── inngest/
│           └── route.ts               # Inngest webhook
│
└── (dashboard)/
    ├── create/
    │   └── page.tsx                   # Unified create page
    ├── campaigns/
    │   └── [id]/
    │       └── page.tsx               # Tabbed workspace
    ├── insights/
    │   └── page.tsx                   # Merged insights
    └── videos/
        └── page.tsx                   # Enhanced gallery
```

### 13.2 Files to Delete / 삭제할 파일

```
# Replaced by unified create page
app/(dashboard)/create/generate/page.tsx
app/(dashboard)/create/compose/page.tsx
app/(dashboard)/create/batch/page.tsx

# Replaced by campaign workspace tabs
app/(dashboard)/campaigns/[id]/generate/page.tsx
app/(dashboard)/campaigns/[id]/compose/page.tsx
app/(dashboard)/campaigns/[id]/pipeline/page.tsx
app/(dashboard)/campaigns/[id]/pipeline/[batchId]/page.tsx
app/(dashboard)/campaigns/[id]/curation/page.tsx
app/(dashboard)/campaigns/[id]/publish/page.tsx
app/(dashboard)/campaigns/[id]/analytics/page.tsx

# Replaced by insights page
app/(dashboard)/bridge/page.tsx
app/(dashboard)/trends/page.tsx
app/(dashboard)/dashboard/page.tsx

# Replaced by tabbed interface
components/layout/campaign-sidebar.tsx
```

### 13.3 Files to Modify / 수정할 파일

```
# Navigation changes
components/layout/main-navigation.tsx      # Flatten structure
components/layout/header.tsx               # Add JobTracker

# i18n extensions
lib/i18n/translations.ts                   # Add new translations

# Existing pages (minor updates)
app/(dashboard)/campaigns/page.tsx         # Update links
app/(dashboard)/publishing/page.tsx        # Update links
app/(dashboard)/settings/page.tsx          # Update links
app/(dashboard)/settings/accounts/page.tsx # No change needed
```

---

## Summary / 요약

This plan transforms HYBE HYDRA from a complex, multi-page application into a **streamlined, intuitive experience** while preserving all functionality:

### Key Outcomes / 주요 결과

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Navigation levels | 3 | 2 | -33% |
| Pages to manage | 26 | 12 | -54% |
| Clicks to generate | 3-4 | 1-2 | -50% |
| Settings visibility | 100% always | 20% default | Reduced cognitive load |
| Job visibility | 0% | 100% | Full transparency |
| Language support | Partial | Complete | KO/EN everywhere |

### Design Philosophy Achieved / 달성된 설계 철학

1. **Simple by Default**: Quick Create mode for 1-click generation
2. **Complex on Demand**: Progressive disclosure for advanced settings
3. **Context Preservation**: Tabbed interfaces keep users oriented
4. **Background Transparency**: GlobalJobTracker shows all active processes
5. **Bilingual First**: Korean and English supported throughout

---

**Document Version**: 1.0
**Last Updated**: 2025-12-02
**Author**: Claude (AI Assistant)
**Status**: Ready for Review

---

*이 문서는 HYBE HYDRA의 UI/UX 간소화를 위한 상세 계획입니다. 모든 기존 기능은 유지하면서 더 직관적인 사용자 경험을 제공합니다.*
