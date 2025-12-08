# Viral Video List UX Design

## Overview
바이럴 영상 리스트를 각 키워드별로 표시하고, 영상 선택을 통해 콘텐츠 생성으로 연결하는 UX 설계

## Requirements
- 키워드당 최대 50개 영상 지원
- 초기 로딩: 10개 표시
- 전체 보기 옵션 필요
- 썸네일 없음 (데이터 기반 표시)
- 영상 선택 → 콘텐츠 생성 플로우

---

## 1. Video List Display (Without Thumbnails)

### 1.1 List Item Design
썸네일 없이 데이터 중심의 리스트 아이템 디자인

```
┌──────────────────────────────────────────────────────────────────┐
│ #1 ⬆️45%                                                    ☑️  │
│ ─────────────────────────────────────────────────────────────── │
│ @kpopfan123                              👁 5.2M    💬 14.2%    │
│ POV: When your bias finally notices you...                      │
│ #kpop #fyp #viral #newjeans                                     │
│ ─────────────────────────────────────────────────────────────── │
│ 📊 Engagement Score: 92/100      🔗 View on TikTok             │
└──────────────────────────────────────────────────────────────────┘
```

**Data Fields:**
| Field | Description | Priority |
|-------|-------------|----------|
| Rank | 순위 (바이럴 점수 기준) | P0 |
| Author | @username | P0 |
| Views | 조회수 (formatted: 5.2M) | P0 |
| Engagement | 참여율 (%) | P0 |
| Description | 영상 설명 (truncated) | P1 |
| Hashtags | 사용된 해시태그 | P1 |
| Trend | 상승/하락 트렌드 | P2 |
| Score | AI 기반 바이럴 점수 | P2 |

### 1.2 View Modes

**Option A: Compact Table View (추천)**
- 한 눈에 많은 영상 비교 가능
- 정렬/필터 용이
- 선택 체크박스 지원

```
┌───┬──────────────┬────────┬────────┬──────────────────────┬────────┐
│ # │ Creator      │ Views  │ Eng %  │ Hashtags             │ Score  │
├───┼──────────────┼────────┼────────┼──────────────────────┼────────┤
│ #1 │ @kpopfan123  │ 5.2M   │ 14.2%  │ #kpop #fyp #viral    │ 92     │
│ #2 │ @dancequeen  │ 3.8M   │ 12.8%  │ #dance #trending     │ 87     │
│ #3 │ @kpopreacts  │ 2.9M   │ 11.5%  │ #kpop #reaction      │ 83     │
└───┴──────────────┴────────┴────────┴──────────────────────┴────────┘
```

**Option B: Card Grid View**
- 더 많은 정보 표시
- 시각적으로 풍부함
- 스크롤 필요

**Option C: Hybrid (추천 - 채택)**
- 상위 3개: 강조된 Featured Cards
- 나머지: Compact Table
- Best of both worlds

---

## 2. Progressive Loading Strategy

### 2.1 Initial Load Pattern
```
[Featured Top 3 Cards]
     ▼
[Compact Table: #4-10]
     ▼
[Load More Button: "40개 더 보기"]
```

### 2.2 Load More Options

**Option A: In-Page Expansion (채택)**
- "더 보기" 버튼 클릭 → 10개씩 추가 로딩
- 장점: 연속성, 컨텍스트 유지
- UX: `[10개 더 보기 (40개 남음)]`

**Option B: Full Dialog/Modal**
- 별도 다이얼로그에서 전체 50개 표시
- 장점: 넓은 화면 활용, 비교 편리
- 언제: 분석/비교 목적

**Option C: Slide-out Panel**
- 화면 우측에서 슬라이드 패널
- 장점: 대시보드 유지하면서 상세 확인
- 언제: 빠른 탐색

### 2.3 Recommended Pattern: Hybrid Approach
```
Initial: Top 3 Featured + #4-10 Table = 10개
         ↓
     [10개 더 보기 (40개 남음)]
         ↓
     Click: Expand in-page
         ↓
     At 20+ items: Show [전체 보기] button
         ↓
     Click: Open Full Modal with sorting/filtering
```

---

## 3. Content Creation Flow (2가지 방식)

### 3.1 방식 A: 키워드 트렌드 기반 생성

섹션 헤더에 "이 트렌드로 생성" 버튼 배치
- 해당 키워드의 전체 바이럴 패턴 분석
- 공통 해시태그, 스타일, 성공 요인 기반 생성

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏆 바이럴 영상 (50개)                    [✨ 이 트렌드로 생성 →]   │
├─────────────────────────────────────────────────────────────────────┤
│  ...video list...                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Flow:**
```
1. "이 트렌드로 생성" 버튼 클릭
2. Create Page로 이동 (키워드 + 트렌드 데이터 전달)
3. AI가 키워드의 바이럴 패턴 분석:
   - Top 해시태그 조합
   - 평균 참여율 높은 콘텐츠 스타일
   - 성공 크리에이터 패턴
4. 분석 기반 프롬프트 자동 제안
```

### 3.2 방식 B: 단일 영상 참고 생성

영상 행에 액션 버튼 배치 (DropdownMenu)

```
┌────────────────────────────────────────────────────────────────────────┐
│ #1 │ @kpopfan123 │ 5.2M │ 14.2% │ #kpop #fyp │ 92 │  [⋮]  │          │
└────────────────────────────────────────────────────────────────────────┘
                                                       ↓ 클릭
                                         ┌─────────────────────────────┐
                                         │ ✨ 이 영상 참고해서 생성     │
                                         │ 🔗 TikTok에서 보기          │
                                         │ 📋 해시태그 복사            │
                                         └─────────────────────────────┘
```

**Flow:**
```
1. 영상 행의 [⋮] 액션 버튼 클릭 → 드롭다운 메뉴 표시
2. "이 영상 참고해서 생성" 선택
3. Create Page로 이동 (참고 영상 정보 전달)
4. AI가 해당 영상의 특징 분석 후 유사 콘텐츠 프롬프트 제안
```

### 3.3 State Persistence

```typescript
// 키워드 트렌드 기반 생성
interface TrendBasedContext {
  type: 'trend';
  keyword: string;
  trendData: {
    topHashtags: string[];
    avgEngagement: number;
    viralThreshold: string;
    videoCount: number;
  };
}

// 단일 영상 참고 생성
interface VideoBasedContext {
  type: 'video';
  keyword: string;
  video: {
    id: string;
    author: string;
    views: number;
    engagement: number;
    hashtags: string[];
    description: string;
  };
}

// URL 전달 방식
/create?ref=trend&keyword=kpop
/create?ref=video&keyword=kpop&videoId=v1
```

---

## 4. Component Structure

### 4.1 Component Hierarchy

```
<ViralVideoSection>
  ├── <SectionHeader>
  │     ├── Title ("바이럴 영상")
  │     ├── Count Badge (50개)
  │     ├── Sort Dropdown (Views, Engagement, Recent)
  │     └── View Toggle (Table/Card)
  │
  ├── <FeaturedVideos> (Top 3)
  │     └── <FeaturedVideoCard> x3
  │
  ├── <VideoTable>
  │     ├── <TableHeader> (with sort controls)
  │     └── <VideoTableRow> x7 (initially)
  │           ├── Checkbox
  │           ├── Rank
  │           ├── Author
  │           ├── Views
  │           ├── Engagement
  │           ├── Hashtags
  │           ├── Score
  │           └── Actions Menu
  │
  ├── <LoadMoreButton>
  │     └── "10개 더 보기 (40개 남음)"
  │
  └── <SelectionActionBar> (when items selected)
        ├── Selection Count
        ├── "패턴 분석" Button
        ├── "콘텐츠 생성" Button
        └── "선택 해제" Button
</ViralVideoSection>
```

### 4.2 Key Component Props

```typescript
// Featured Video Card (Top 3)
interface FeaturedVideoCardProps {
  video: ViralVideo;
  rank: 1 | 2 | 3;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (action: VideoAction) => void;
}

// Table Row
interface VideoTableRowProps {
  video: ViralVideo;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (action: VideoAction) => void;
}

// Action Types
type VideoAction =
  | 'create-similar'      // 비슷한 콘텐츠 생성
  | 'view-analysis'       // 분석 리포트
  | 'copy-hashtags'       // 해시태그 복사
  | 'open-tiktok';        // TikTok에서 보기

// Selection Action Bar
interface SelectionActionBarProps {
  selectedCount: number;
  onAnalyzePattern: () => void;
  onCreateContent: () => void;
  onClearSelection: () => void;
}
```

---

## 5. Interaction Details

### 5.1 Sorting Options
| Sort By | Default | Description |
|---------|---------|-------------|
| Views | DESC | 조회수 높은 순 |
| Engagement | DESC | 참여율 높은 순 |
| Score | DESC | AI 바이럴 점수 순 |
| Recent | DESC | 최신 순 |

### 5.2 Keyboard Shortcuts
| Key | Action |
|-----|--------|
| Space | Toggle selection on focused row |
| Enter | Open action menu |
| Escape | Clear selection |
| Ctrl+A | Select all visible |

### 5.3 Mobile Considerations
- Table → Stacked Card layout
- Selection via long press
- Swipe actions for quick menu

---

## 6. Visual Design Specifications

### 6.1 Featured Card (Top 3)
```
┌────────────────────────────────────────────┐
│  🏆 #1                           ☑️ 선택   │
│ ──────────────────────────────────────────│
│                                            │
│  @kpopfan123                               │
│  ────────────────────────────────          │
│  POV: When your bias finally notices...    │
│                                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ 👁 5.2M │ │ 💬 14.2%│ │ 🎯 92   │      │
│  │ Views   │ │ Eng     │ │ Score   │      │
│  └─────────┘ └─────────┘ └─────────┘      │
│                                            │
│  #kpop #fyp #viral #newjeans #trending     │
│                                            │
│  [이 영상으로 생성 →]                       │
└────────────────────────────────────────────┘
```

### 6.2 Color Coding
- Rank 1: Gold accent (#FFD700)
- Rank 2: Silver accent (#C0C0C0)
- Rank 3: Bronze accent (#CD7F32)
- High Engagement (>10%): Green highlight
- Trending Up: Green arrow
- Trending Down: Red arrow

### 6.3 Spacing & Layout
```
Section Padding: 24px
Card Gap: 16px
Table Row Height: 56px
Featured Card Height: ~200px
```

---

## 7. Implementation Priority

### Phase 1 (MVP)
- [x] Basic video list display
- [ ] Featured cards for top 3
- [ ] Compact table for rest
- [ ] Load more (in-page)
- [ ] Single video selection → Create

### Phase 2
- [ ] Multi-selection with action bar
- [ ] Pattern analysis flow
- [ ] Full dialog for all videos
- [ ] Sorting functionality

### Phase 3
- [ ] Advanced filtering
- [ ] Keyboard navigation
- [ ] Mobile optimization
- [ ] Batch operations

---

## 8. Mock Data Structure

```typescript
interface ViralVideo {
  id: string;
  author: string;
  authorUrl: string;
  videoUrl: string;
  description: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number; // calculated %
  hashtags: string[];
  postedAt: string;
  duration: number; // seconds
  viralScore: number; // 0-100 AI score
  trend: {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
  };
}

// 50 videos per keyword
interface KeywordVideoData {
  keyword: string;
  videos: ViralVideo[];
  totalCount: number;
  lastUpdated: string;
}
```

---

## Summary

**핵심 UX 결정:**

1. **Display**: Hybrid (Top 3 Featured + Table for rest)
2. **Loading**: Progressive (10 → Load More → Full Modal)
3. **Selection**: No multi-select needed
4. **Creation Flow**:
   - Single: Quick action menu → Create
   - Multi: Pattern analysis → Create with insights
5. **No Thumbnails**: Data-rich cards with engagement metrics, hashtags, viral score

**다음 단계**: 이 설계 기반으로 컴포넌트 구현 진행
