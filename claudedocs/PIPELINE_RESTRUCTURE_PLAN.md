# Pipeline UI Restructure Plan: AI Generation vs Compose 분리

## 현재 상태 분석

### 핵심 문제점
```
┌─────────────────────────────────────────────────────────────┐
│                  Single VideoGeneration Table                │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   AI Generation     │    │      Compose                │ │
│  │   output_url        │    │   composed_output_url       │ │
│  │   Veo API 호출      │    │   MoviePy 렌더링            │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                    ↓ 동일한 Pipeline 뷰에서 혼합 표시 ↓       │
└─────────────────────────────────────────────────────────────┘
```

**현재 혼합되어 있는 부분:**
1. **데이터 모델**: 단일 `VideoGeneration` 테이블에 두 타입 저장
2. **Pipeline 페이지**: 타입 구분 없이 모든 배치 표시
3. **PipelineCard**: 동일한 UI로 두 타입 렌더링
4. **VariationModal**: 하나의 모달로 두 타입 처리
5. **Curation 페이지**: 모든 생성물 혼합 표시

---

## 목표 구조

### 완전히 분리된 두 개의 Pipeline 화면

```
campaigns/[id]/
├── pipeline/
│   ├── page.tsx              # 탭 기반 라우터 (AI | Compose)
│   ├── ai/
│   │   ├── page.tsx          # AI Pipeline 목록
│   │   └── [batchId]/page.tsx # AI Pipeline 상세
│   └── compose/
│       ├── page.tsx          # Compose Pipeline 목록
│       └── [batchId]/page.tsx # Compose Pipeline 상세
```

---

## Phase 1: 데이터 모델 확장

### 1.1 VideoGeneration 모델에 타입 필드 추가

```prisma
model VideoGeneration {
  // 기존 필드들...

  // 새로운 타입 구분 필드
  generationType    String    @default("ai") // "ai" | "compose"

  // AI 전용 필드 그룹
  outputUrl         String?   @map("output_url")
  outputAssetId     String?   @map("output_asset_id")

  // Compose 전용 필드 그룹
  composedOutputUrl String?   @map("composed_output_url")
  scriptData        Json?     @map("script_data")      // 스크립트 라인들
  imageAssets       Json?     @map("image_assets")     // 선택된 이미지들
  audioAssetId      String?   @map("audio_asset_id")
  audioAnalysis     Json?     @map("audio_analysis")
  effectPreset      String?   @map("effect_preset")
}
```

### 1.2 기존 데이터 마이그레이션
```sql
-- 기존 데이터에 generationType 설정
UPDATE video_generations
SET generation_type = CASE
  WHEN composed_output_url IS NOT NULL THEN 'compose'
  ELSE 'ai'
END;
```

---

## Phase 2: API 레이어 분리

### 2.1 Pipeline API 타입 분리

**현재**: `GET /api/v1/campaigns/[id]/generations`
**변경**:
- `GET /api/v1/campaigns/[id]/pipelines/ai` → AI 전용
- `GET /api/v1/campaigns/[id]/pipelines/compose` → Compose 전용

### 2.2 응답 타입 정의

```typescript
// AI Pipeline 전용 타입
interface AIPipelineItem {
  type: "ai"
  batch_id: string
  seed_generation: {
    id: string
    prompt: string
    output_url: string
    thumbnail_url: string
    quality_score: number
  }
  variations: {
    total: number
    completed: number
    failed: number
    applied_presets: StylePreset[]
    prompt_modifications: string[]
  }
  status: PipelineStatus
  created_at: string
}

// Compose Pipeline 전용 타입
interface ComposePipelineItem {
  type: "compose"
  batch_id: string
  seed_generation: {
    id: string
    prompt: string
    composed_output_url: string
    thumbnail_url: string
    script_summary: string
    audio_track: AudioInfo
    image_count: number
  }
  variations: {
    total: number
    completed: number
    failed: number
    keyword_variations: string[][]  // 각 변형의 키워드 조합
  }
  status: PipelineStatus
  created_at: string
}
```

---

## Phase 3: UI 컴포넌트 분리

### 3.1 새로운 컴포넌트 구조

```
components/features/pipeline/
├── index.ts                    # 공통 export
├── types.ts                    # 공유 타입 정의
├── shared/
│   ├── pipeline-status-badge.tsx
│   ├── pipeline-progress-bar.tsx
│   └── pipeline-actions-menu.tsx
├── ai/
│   ├── ai-pipeline-card.tsx       # AI 전용 카드
│   ├── ai-pipeline-detail.tsx     # AI 상세 뷰
│   ├── ai-variation-modal.tsx     # AI 변형 모달
│   └── ai-variation-grid.tsx      # AI 변형 그리드
└── compose/
    ├── compose-pipeline-card.tsx   # Compose 전용 카드
    ├── compose-pipeline-detail.tsx # Compose 상세 뷰
    ├── compose-variation-modal.tsx # Compose 변형 모달
    └── compose-variation-grid.tsx  # Compose 변형 그리드
```

### 3.2 AI Pipeline 카드 디자인

```
┌─────────────────────────────────────────────┐
│ 🎬 AI Generation                    [⋮]    │
├─────────────────────────────────────────────┤
│ ┌────────────┐                              │
│ │            │  "A cinematic shot of..."    │
│ │  AI Video  │                              │
│ │  Thumbnail │  ⭐ 92 Quality Score         │
│ │            │                              │
│ └────────────┘  🎨 Mood: dramatic           │
│                 📷 Camera: tracking shot     │
│                 ✨ Effect: film grain        │
├─────────────────────────────────────────────┤
│ Variations: 8/10 completed                  │
│ ████████░░ 80%                              │
├─────────────────────────────────────────────┤
│ [View Detail]  [Send to Curation]           │
└─────────────────────────────────────────────┘
```

### 3.3 Compose Pipeline 카드 디자인

```
┌─────────────────────────────────────────────┐
│ 🎵 Compose Video                    [⋮]    │
├─────────────────────────────────────────────┤
│ ┌────────────┐                              │
│ │            │  Script: 6 scenes, 15s       │
│ │  Composed  │                              │
│ │  Video     │  🖼️ 12 images selected       │
│ │  Thumbnail │  🎵 "Energetic Pop" 128 BPM  │
│ └────────────┘  ✨ Effect: zoom_pan         │
│                                             │
│ Keywords: #travel #adventure #nature        │
├─────────────────────────────────────────────┤
│ Variations: 5/5 completed                   │
│ ██████████ 100%                             │
├─────────────────────────────────────────────┤
│ [View Detail]  [Send to Curation]           │
└─────────────────────────────────────────────┘
```

---

## Phase 4: 페이지 라우팅 구조

### 4.1 메인 Pipeline 페이지 (탭 네비게이션)

```tsx
// app/(dashboard)/campaigns/[id]/pipeline/page.tsx

export default function PipelinePage() {
  const [activeTab, setActiveTab] = useState<"ai" | "compose">("ai")

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ai">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Generation
            <Badge variant="secondary">{aiCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="compose">
            <Film className="w-4 h-4 mr-2" />
            Compose
            <Badge variant="secondary">{composeCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <AIPipelineList campaignId={campaignId} />
        </TabsContent>

        <TabsContent value="compose">
          <ComposePipelineList campaignId={campaignId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### 4.2 AI Pipeline 상세 페이지

```tsx
// app/(dashboard)/campaigns/[id]/pipeline/ai/[batchId]/page.tsx

// AI 변형 상세 - 프롬프트 수정사항, 스타일 프리셋 중심
export default function AIPipelineDetailPage() {
  return (
    <div>
      {/* Seed Generation Preview */}
      <SeedVideoPlayer url={pipeline.seed_generation.output_url} />

      {/* Applied Style Presets */}
      <StylePresetGrid presets={pipeline.applied_presets} />

      {/* Prompt Variations */}
      <PromptVariationList variations={pipeline.prompt_modifications} />

      {/* Variation Grid - AI specific display */}
      <AIVariationGrid variations={variations} />
    </div>
  )
}
```

### 4.3 Compose Pipeline 상세 페이지

```tsx
// app/(dashboard)/campaigns/[id]/pipeline/compose/[batchId]/page.tsx

// Compose 변형 상세 - 이미지/키워드 변형 중심
export default function ComposePipelineDetailPage() {
  return (
    <div>
      {/* Seed Generation Preview */}
      <SeedVideoPlayer url={pipeline.seed_generation.composed_output_url} />

      {/* Script Timeline */}
      <ScriptTimeline script={pipeline.seed_generation.script_data} />

      {/* Audio Track Info */}
      <AudioTrackInfo audio={pipeline.seed_generation.audio_track} />

      {/* Keyword Variation Comparison */}
      <KeywordVariationCompare
        original={pipeline.seed_generation.keywords}
        variations={pipeline.keyword_variations}
      />

      {/* Variation Grid - Compose specific display */}
      <ComposeVariationGrid variations={variations} />
    </div>
  )
}
```

---

## Phase 5: 변형 모달 분리

### 5.1 AI Variation Modal

```tsx
// components/features/pipeline/ai/ai-variation-modal.tsx

interface AIVariationConfig {
  styleCategories: ("mood" | "lighting" | "cinematic" | "effect")[]
  selectedPresets: StylePreset[]
  enablePromptVariation: boolean
  promptVariationTypes: ("camera" | "expression")[]
  maxVariations: number
  autoPublish?: AutoPublishConfig
}

// UI 요소:
// - 스타일 카테고리 선택 (Mood, Lighting, Cinematic, Effect)
// - 각 카테고리별 프리셋 선택
// - 프롬프트 변형 옵션 (카메라 앵글, 표정)
// - 생성 개수 조절
// - 자동 퍼블리시 설정
```

### 5.2 Compose Variation Modal

```tsx
// components/features/pipeline/ai/compose-variation-modal.tsx

interface ComposeVariationConfig {
  keywordStrategy: "auto" | "manual"
  selectedTags: string[]           // 원본에서 추출된 태그
  variationKeywords: string[][]    // 각 변형의 키워드 조합
  keepSameAudio: boolean
  keepSameEffects: boolean
  maxVariations: number
  autoPublish?: AutoPublishConfig
}

// UI 요소:
// - 원본 키워드 태그 표시
// - 변형 키워드 조합 설정
// - 이미지 재검색 옵션
// - 오디오/이펙트 유지 옵션
// - 생성 개수 조절
// - 자동 퍼블리시 설정
```

---

## Phase 6: Curation 페이지 필터링

### 6.1 타입별 필터 추가

```tsx
// app/(dashboard)/campaigns/[id]/curation/page.tsx

// 새로운 필터 옵션
<Select value={typeFilter} onValueChange={setTypeFilter}>
  <SelectItem value="all">All Videos</SelectItem>
  <SelectItem value="ai">AI Generated Only</SelectItem>
  <SelectItem value="compose">Compose Only</SelectItem>
</Select>
```

### 6.2 타입별 다른 정보 표시

```tsx
// AI Generation인 경우
<AIGenerationCard>
  <QualityScore score={generation.quality_score} />
  <AppliedPresets presets={generation.applied_presets} />
  <PromptPreview prompt={generation.prompt} />
</AIGenerationCard>

// Compose인 경우
<ComposeGenerationCard>
  <ScriptSummary script={generation.script_data} />
  <ImageCollage images={generation.image_assets} />
  <AudioInfo audio={generation.audio_track} />
</ComposeGenerationCard>
```

---

## 구현 순서 (권장)

### Week 1: 데이터 레이어
1. [ ] Prisma 스키마에 `generationType` 필드 추가
2. [ ] 기존 데이터 마이그레이션 스크립트 작성
3. [ ] API 응답에 타입 필드 포함

### Week 2: API 분리
4. [ ] AI Pipeline API 엔드포인트 생성
5. [ ] Compose Pipeline API 엔드포인트 생성
6. [ ] 프론트엔드 API 클라이언트 분리

### Week 3: 컴포넌트 분리
7. [ ] 공유 컴포넌트 추출 (status badge, progress bar)
8. [ ] AI Pipeline Card 컴포넌트 생성
9. [ ] Compose Pipeline Card 컴포넌트 생성

### Week 4: 페이지 구현
10. [ ] 탭 기반 Pipeline 메인 페이지
11. [ ] AI Pipeline 상세 페이지
12. [ ] Compose Pipeline 상세 페이지

### Week 5: 모달 & 완성
13. [ ] AI Variation Modal 분리
14. [ ] Compose Variation Modal 분리
15. [ ] Curation 페이지 타입 필터 추가
16. [ ] 테스트 및 QA

---

## 파일 변경 목록

### 새로 생성할 파일
```
components/features/pipeline/
├── types.ts
├── shared/
│   ├── pipeline-status-badge.tsx
│   ├── pipeline-progress-bar.tsx
│   └── pipeline-actions-menu.tsx
├── ai/
│   ├── ai-pipeline-card.tsx
│   ├── ai-pipeline-detail.tsx
│   ├── ai-variation-modal.tsx
│   └── ai-variation-grid.tsx
└── compose/
    ├── compose-pipeline-card.tsx
    ├── compose-pipeline-detail.tsx
    ├── compose-variation-modal.tsx
    └── compose-variation-grid.tsx

app/(dashboard)/campaigns/[id]/pipeline/
├── ai/
│   ├── page.tsx
│   └── [batchId]/page.tsx
└── compose/
    ├── page.tsx
    └── [batchId]/page.tsx

lib/
├── ai-pipeline-api.ts
└── compose-pipeline-api.ts
```

### 수정할 파일
```
prisma/schema.prisma          # generationType 필드 추가
lib/pipeline-api.ts           # 타입별 분기 로직
app/.../pipeline/page.tsx     # 탭 네비게이션으로 변경
app/.../curation/page.tsx     # 타입 필터 추가
```

### 삭제/대체할 파일
```
components/features/pipeline-card.tsx      → ai/ + compose/ 분리
components/features/variation-modal.tsx    → ai/ + compose/ 분리
```

---

## 질문 및 결정 필요 사항

1. **URL 구조**: `/pipeline/ai/[batchId]` vs `/pipeline?type=ai&batch=[batchId]`?
2. **Curation 분리**: Curation도 AI/Compose 탭으로 분리할지?
3. **기존 데이터**: 마이그레이션 시 `generationType` 자동 감지 로직 확인 필요
4. **공통 액션**: "Send to Curation", "Delete" 등은 공유 컴포넌트로 유지?

---

## 예상 효과

✅ **명확한 워크플로우 분리**: AI와 Compose가 완전히 다른 UX
✅ **타입별 최적화된 정보 표시**: 각 타입에 맞는 메타데이터 강조
✅ **확장성**: 향후 새로운 생성 타입 추가 용이
✅ **유지보수성**: 컴포넌트 책임 분리로 코드 관리 개선
