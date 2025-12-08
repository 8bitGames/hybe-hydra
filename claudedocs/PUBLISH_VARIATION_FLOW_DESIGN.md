# Publish → Variation 연결 설계

## 현재 상황 분석

### 기존 워크플로우
```
Start → Analyze → Create → Processing → Publish → [종료/리셋]
```

### 사용자 요구사항
- 퍼블리시 페이지에서 베리에이션 생성 가능
- 기존 영상 기반으로 다양한 버전 생성 후 연속 퍼블리시
- 플로우 진행 중 자연스럽게 연결

---

## 설계 제안: 3단계 연결 시스템

### 1단계: Publish 페이지 내 "Variation" 버튼 추가

**위치**: 비디오 프리뷰 영역 하단

```
┌─────────────────────────────────────────────────────────────┐
│  Video Preview (Left Column)                                │
│  ┌─────────────────────┐                                    │
│  │                     │                                    │
│  │    [Video Player]   │                                    │
│  │                     │                                    │
│  └─────────────────────┘                                    │
│  ← 1/3 →                                                    │
│  [Thumbnail] [Thumbnail] [Thumbnail]                        │
│                                                             │
│  ┌─────────────────────────────────────────┐                │
│  │ 🎨 이 영상으로 더 만들기                    │ ← NEW       │
│  │                                         │                │
│  │ [AI 변형 생성] [Compose 변형]            │                │
│  │  다양한 스타일로   음악/이펙트 변경         │                │
│  │  9개 생성 예상     3개 생성 예상          │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

**기능**:
- 현재 선택된 영상을 seed로 variation 생성
- AI 변형: 스타일 카테고리 선택 (mood, lighting 등)
- Compose 변형: 다른 음악/이펙트 조합

---

### 2단계: 발행 성공 후 "계속하기" 옵션

**현재**: 발행 후 `/publishing`으로 리다이렉트 + 워크플로우 리셋

**개선**: 성공 다이얼로그에서 선택지 제공

```
┌─────────────────────────────────────────┐
│  ✅ 발행 예약 완료!                      │
│                                         │
│  3개의 영상이 TikTok에 예약되었습니다     │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🔄 이 영상들로 변형 더 만들기       │  │ ← 메인 CTA
│  │    AI가 새로운 스타일 버전을 생성    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [예약 현황 보기]    [새 프로젝트 시작]   │
└─────────────────────────────────────────┘
```

**선택지**:
1. **변형 더 만들기** (권장): Variation Modal 열기 → Processing 이동
2. **예약 현황 보기**: `/publishing` 이동
3. **새 프로젝트 시작**: 워크플로우 리셋 → `/start` 이동

---

### 3단계: Variation Modal 개선 - 퍼블리시 컨텍스트 연동

**현재 설정 자동 상속**:
- 선택된 TikTok 계정
- 캡션 템플릿
- 해시태그
- 퍼블리시 설정 (privacy, duet, stitch, comment)

```
┌─────────────────────────────────────────────────────────────┐
│  🎨 변형 생성                                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✅ 이전 발행 설정 가져오기                           │   │ ← NEW
│  │   @my_tiktok_account · #kpop #viral                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [스타일 카테고리 선택...]                                  │
│  [프롬프트 변형 옵션...]                                    │
│  [최대 생성 수: 9]                                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⏱️ 자동 발행 스케줄                                  │   │
│  │                                                     │   │
│  │   시작 시간: 이전 발행 후 30분                       │   │
│  │   간격: 30분                                        │   │
│  │                                                     │   │
│  │   📊 예상 스케줄                                    │   │
│  │   • 1번째: 오후 3:00                                │   │
│  │   • 2번째: 오후 3:30                                │   │
│  │   • 3번째: 오후 4:00                                │   │
│  │   ...                                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  예상 생성: 9개 영상                                        │
│  [취소]                    [9개 변형 생성 & 자동 발행]      │
└─────────────────────────────────────────────────────────────┘
```

---

## 기술 구현 명세

### 1. PublishPage 컴포넌트 수정

**파일**: `app/(dashboard)/publish/page.tsx`

```typescript
// 새로운 state 추가
const [showVariationPanel, setShowVariationPanel] = useState(false);
const [variationModalOpen, setVariationModalOpen] = useState(false);
const [variationType, setVariationType] = useState<"ai" | "compose">("ai");
const [showSuccessDialog, setShowSuccessDialog] = useState(false);
const [publishedVideos, setPublishedVideos] = useState<ProcessingVideo[]>([]);

// 새로운 함수: 변형 생성 핸들러
const handleCreateVariation = async (config: VariationConfig) => {
  // variation API 호출
  // processing 페이지로 이동 (variationBatchId 전달)
};

// handlePublish 수정: 성공 시 다이얼로그 표시
const handlePublish = async () => {
  // ... 기존 로직 ...
  if (successCount > 0) {
    setPublishedVideos(approvedVideos);
    setShowSuccessDialog(true); // 바로 리다이렉트 대신 다이얼로그
    // resetWorkflow(); // 나중에 사용자 선택에 따라
  }
};
```

### 2. 새 컴포넌트: VariationQuickPanel

**파일**: `components/features/publish/VariationQuickPanel.tsx`

```typescript
interface VariationQuickPanelProps {
  video: ProcessingVideo;
  onCreateAIVariation: () => void;
  onCreateComposeVariation: () => void;
  isKorean: boolean;
}

export function VariationQuickPanel({
  video,
  onCreateAIVariation,
  onCreateComposeVariation,
  isKorean,
}: VariationQuickPanelProps) {
  return (
    <div className="bg-neutral-50 rounded-xl p-4 mt-4 border border-neutral-200">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-neutral-600" />
        <span className="text-sm font-medium">
          {isKorean ? "이 영상으로 더 만들기" : "Create More From This"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateAIVariation}
          className="flex flex-col h-auto py-3"
        >
          <Wand2 className="w-4 h-4 mb-1" />
          <span className="text-xs font-medium">
            {isKorean ? "AI 변형" : "AI Variation"}
          </span>
          <span className="text-[10px] text-neutral-500">
            {isKorean ? "스타일 변경" : "Style changes"}
          </span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onCreateComposeVariation}
          className="flex flex-col h-auto py-3"
        >
          <Film className="w-4 h-4 mb-1" />
          <span className="text-xs font-medium">
            {isKorean ? "Compose 변형" : "Compose Variation"}
          </span>
          <span className="text-[10px] text-neutral-500">
            {isKorean ? "음악/이펙트" : "Music/Effects"}
          </span>
        </Button>
      </div>
    </div>
  );
}
```

### 3. 새 컴포넌트: PublishSuccessDialog

**파일**: `components/features/publish/PublishSuccessDialog.tsx`

```typescript
interface PublishSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  publishedCount: number;
  videos: ProcessingVideo[];
  publishContext: {
    accountId: string;
    accountName: string;
    caption: string;
    hashtags: string[];
  };
  onCreateVariations: () => void;
  onViewSchedule: () => void;
  onStartNew: () => void;
  isKorean: boolean;
}

export function PublishSuccessDialog({
  isOpen,
  onClose,
  publishedCount,
  videos,
  publishContext,
  onCreateVariations,
  onViewSchedule,
  onStartNew,
  isKorean,
}: PublishSuccessDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>

          <h2 className="text-xl font-semibold mb-2">
            {isKorean ? "발행 예약 완료!" : "Successfully Scheduled!"}
          </h2>

          <p className="text-neutral-500 mb-6">
            {isKorean
              ? `${publishedCount}개의 영상이 TikTok에 예약되었습니다`
              : `${publishedCount} videos scheduled to TikTok`}
          </p>

          {/* 메인 CTA: 변형 생성 */}
          <Button
            onClick={onCreateVariations}
            className="w-full mb-4 h-14 bg-black hover:bg-neutral-800"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">
                  {isKorean ? "이 영상들로 변형 더 만들기" : "Create More Variations"}
                </div>
                <div className="text-xs text-neutral-300">
                  {isKorean
                    ? "AI가 새로운 스타일 버전을 생성합니다"
                    : "AI generates new style versions"}
                </div>
              </div>
            </div>
          </Button>

          {/* 보조 액션 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onViewSchedule}
              className="flex-1"
            >
              {isKorean ? "예약 현황" : "View Schedule"}
            </Button>
            <Button
              variant="ghost"
              onClick={onStartNew}
              className="flex-1"
            >
              {isKorean ? "새 프로젝트" : "New Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 4. Workflow Store 확장

**파일**: `lib/stores/workflow-store.ts`

```typescript
// PublishData 타입 확장
export interface PublishData {
  // ... 기존 필드 ...

  // 변형 연결용 컨텍스트
  lastPublishedContext?: {
    videos: ProcessingVideo[];
    accountId: string;
    accountName: string;
    caption: string;
    hashtags: string[];
    scheduledAt: string | null;
    platformSettings: Record<string, unknown>;
  };
}

// 새 액션 추가
interface WorkflowState {
  // ... 기존 액션 ...

  // Publish → Variation 브릿지
  savePublishContext: (context: PublishData["lastPublishedContext"]) => void;
  startVariationFromPublish: (seedVideoId: string) => void;
}
```

### 5. API 연동 수정

**변형 생성 시 publish 컨텍스트 전달**:

```typescript
// POST /api/v1/generations/[id]/variations 호출 시
const response = await api.post(`/api/v1/generations/${seedGenerationId}/variations`, {
  style_categories: config.styleCategories,
  enable_prompt_variation: config.enablePromptVariation,
  prompt_variation_types: config.promptVariationTypes,
  max_variations: config.maxVariations,

  // 퍼블리시 컨텍스트에서 가져온 자동 발행 설정
  auto_publish: {
    enabled: true,
    social_account_id: publishContext.accountId,
    interval_minutes: 30,
    caption: publishContext.caption,
    hashtags: publishContext.hashtags,
    platform_settings: publishContext.platformSettings,
    // 이전 발행 시간 이후로 스케줄링
    start_after: publishContext.scheduledAt,
  },
});
```

---

## 사용자 플로우 시나리오

### 시나리오 1: 첫 발행 전 변형 생성

```
1. 사용자가 Processing에서 영상 승인
2. Publish 페이지로 이동
3. 비디오 프리뷰 아래 "이 영상으로 더 만들기" 패널 확인
4. "AI 변형" 버튼 클릭
5. VariationModal에서 설정 (스타일, 개수, 자동발행 옵션)
6. "9개 변형 생성" 클릭
7. Processing 페이지로 이동, 변형 생성 진행 상황 확인
8. 완료 후 다시 Publish로 이동하여 발행
```

### 시나리오 2: 발행 후 연속 변형

```
1. 사용자가 3개 영상 발행 예약 완료
2. 성공 다이얼로그 표시
3. "이 영상들로 변형 더 만들기" 클릭
4. VariationModal 열림 (이전 발행 설정 자동 로드됨)
5. 설정 확인 후 "생성 & 자동 발행" 클릭
6. 변형이 생성되고 이전 발행 시간 이후로 자동 스케줄링
7. Processing 페이지에서 진행 상황 모니터링
```

### 시나리오 3: 반복 변형으로 콘텐츠 스케일링

```
1. 원본 영상 1개 발행 (12:00)
2. 변형 9개 생성 & 자동 발행 (12:30, 13:00, 13:30, ...)
3. 변형 완료 후 다시 "변형 더 만들기"
4. 다른 스타일로 추가 9개 생성
5. 총 19개 영상이 하루에 걸쳐 자동 발행됨
```

---

## UI/UX 고려사항

### 1. 비주얼 일관성
- 기존 Publish 페이지의 미니멀한 디자인 유지
- 변형 패널은 접이식으로 복잡도 조절
- 성공 다이얼로그는 축하 느낌 (녹색 체크, 밝은 톤)

### 2. 정보 계층
- 메인 액션: 발행하기 (헤더 우측)
- 보조 액션: 변형 생성 (비디오 프리뷰 하단)
- 옵션 액션: 성공 후 선택지

### 3. 컨텍스트 보존
- 변형 모달에서 이전 설정 자동 로드
- 사용자가 수정할 수 있지만 기본값 제공
- "이전 설정 사용" 토글로 명확하게 표시

### 4. 에러 처리
- 변형 생성 실패 시 재시도 옵션
- 일부 성공 시 성공 건만 스케줄링
- 네트워크 오류 시 로컬 큐에 저장

---

## 구현 우선순위

### Phase 1 (MVP)
1. ✅ Publish 페이지에 VariationQuickPanel 추가
2. ✅ 기존 VariationModal 연동
3. ✅ 변형 생성 후 Processing 이동

### Phase 2 (Enhancement)
1. PublishSuccessDialog 구현
2. 발행 컨텍스트 자동 상속
3. 자동 발행 스케줄 프리뷰

### Phase 3 (Polish)
1. 반복 변형 플로우 최적화
2. 변형 히스토리 트래킹
3. 변형 성과 분석 (어떤 스타일이 더 좋은 성과?)

---

## 예상 파일 변경

```
app/(dashboard)/publish/page.tsx          # 주요 수정
components/features/publish/
  ├── VariationQuickPanel.tsx             # 신규
  └── PublishSuccessDialog.tsx            # 신규
lib/stores/workflow-store.ts              # 확장
lib/i18n/translations/ko.json             # 번역 추가
lib/i18n/translations/en.json             # 번역 추가
```
