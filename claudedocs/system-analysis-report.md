# Hybe-Hydra 시스템 분석 보고서

> 분석일: 2025-12-23
> 분석 대상: 7개 주요 기능

---

## 목차

1. [AI Video](#1-ai-video)
2. [FastCut](#2-fastcut)
3. [영상 배포 (Video Publishing)](#3-영상-배포-video-publishing)
4. [틱톡 트렌드 인텔리전스](#4-틱톡-트렌드-인텔리전스)
5. [영상 배리에이션 (Video Variations)](#5-영상-배리에이션-video-variations)
6. [Video Edit](#6-video-edit)
7. [AI Video Extend](#7-ai-video-extend)
8. [기능 간 유기적 연결](#기능-간-유기적-연결)
9. [레거시 코드 및 기술 부채](#레거시-코드-및-기술-부채)
10. [권장 개선 사항](#권장-개선-사항)
11. [전체 평가](#전체-평가)

---

## 1. AI Video

### 아키텍처

```
Frontend → video-api.ts → /api/v1/generations/ → Compose Engine → Veo API (Vertex AI)
                                              ↓
                                    /api/v1/jobs/callback
```

### 핵심 컴포넌트

| 파일 | 역할 |
|------|------|
| `lib/video-api.ts` | 프론트엔드 API 클라이언트 |
| `app/api/v1/generations/` | 15개 엔드포인트 (CRUD, extend, edit, variations) |
| `lib/stores/workflow-store.ts` | Zustand 상태 관리 (persist) |
| `lib/agents/creators/i2v-specialist.ts` | I2V 프롬프트 생성 에이전트 |

### 프로세스 플로우

1. Start → Analyze → Create → Processing → Publish
2. I2V Mode: 이미지 프롬프트 → Imagen 생성 → 비디오 프롬프트 → Veo 생성
3. Callback 기반 비동기 처리

### 상태: ✅ 양호

---

## 2. FastCut

### 아키텍처

```
Frontend → fast-cut-api.ts → /api/v1/fast-cut/ → Modal (serverless) → S3
                                              ↓
                                    /api/v1/fast-cut/callback
```

### 핵심 컴포넌트

| 파일 | 역할 |
|------|------|
| `lib/fast-cut-api.ts` | 프론트엔드 API (~866 lines) |
| `app/api/v1/fast-cut/render/route.ts` | 렌더링 API |
| `lib/stores/fast-cut-context.tsx` | React Context 상태 관리 |
| `components/features/create/fast-cut/` | 단계별 UI 컴포넌트 |

### 프로세스 플로우

1. Start → Script → Images → Music → Effects → Render → Publish
2. Style Set System: `styleSetId` vs Legacy 개별 파라미터
3. AI Effects: `effectPreset`, `aiEffect`, `aiEffectVariant`

### 레거시 이슈

```typescript
// app/api/v1/fast-cut/render/route.ts:209-210
// Use individual parameters (legacy mode)
console.log(`${LOG_PREFIX} Legacy mode - using individual parameters`);
```

### 상태: ⚠️ 레거시 정리 필요

---

## 3. 영상 배포 (Video Publishing)

### 아키텍처

```
Frontend → publishing-api.ts → /api/v1/publishing/ → Compose Engine → SNS APIs
                            ↓                                        ↓
                    OAuth 인증 관리                        /api/v1/jobs/callback
```

### 지원 플랫폼

| 플랫폼 | 상태 | 특수 설정 |
|--------|------|-----------|
| TikTok | ✅ 완료 | duet, stitch, privacy_level |
| YouTube | ✅ 완료 | Shorts, category, made_for_kids |
| Instagram | ✅ 완료 | Reels, share_to_feed |
| Twitter | ⏳ 미구현 | - |

### 핵심 엔드포인트

| 엔드포인트 | 기능 |
|-----------|------|
| `POST /api/v1/publishing/schedule/[id]/publish` | 수동 게시 |
| `GET /api/v1/publishing/analytics/campaign/[id]` | 캠페인 분석 |
| `POST /api/v1/publishing/oauth/tiktok` | TikTok OAuth |
| `POST /api/v1/publishing/oauth/youtube` | YouTube OAuth |
| `POST /api/v1/publishing/oauth/instagram` | Instagram OAuth |

### 상태: ✅ 양호 (Twitter 미구현)

---

## 4. 틱톡 트렌드 인텔리전스

### 아키텍처

```
Frontend → trends-api.ts → /api/v1/trends/ → TikTok Research API
                                          ↓
                              Text/Video Analysis → Report Generation
```

### 핵심 기능

| API | 기능 |
|-----|------|
| `analyzeText` | 해시태그, 캡션, 감정 분석 |
| `analyzeVideo` | 시각적 스타일, 패턴 분석 |
| `generateReport` | 종합 트렌드 리포트 |
| `getReportForBridge` | AI Video 연동 포맷 |
| `getReportForCompose` | FastCut 연동 포맷 |

### API 엔드포인트 (20개)

```
/api/v1/trends/
├── route.ts                    # 기본 트렌드 조회
├── [platform]/route.ts         # 플랫폼별 트렌드
├── analyze/
│   ├── text/route.ts           # 텍스트 분석
│   ├── video/route.ts          # 비디오 분석
│   └── report/route.ts         # 리포트 생성
├── expand/
│   ├── keywords/route.ts       # 키워드 확장
│   └── accounts/route.ts       # 계정 확장
├── suggestions/route.ts        # 프롬프트 제안
├── trending/route.ts           # 트렌딩 목록
├── keyword-history/route.ts    # 키워드 히스토리
├── keyword-analysis/route.ts   # 키워드 분석
├── videos/route.ts             # 비디오 검색
├── collect/route.ts            # 데이터 수집
├── live/route.ts               # 실시간 트렌드
├── recommendations/route.ts    # 추천
├── explore/route.ts            # 탐색 전략
├── saved-keywords/route.ts     # 저장된 키워드
├── saved-keywords/[id]/route.ts
├── saved-keywords/sync/route.ts
└── heatmap/route.ts            # 히트맵 데이터
```

### 상태: ✅ 매우 양호 (가장 성숙한 기능)

---

## 5. 영상 배리에이션 (Video Variations)

### 아키텍처

```
Seed Generation → /api/v1/generations/[id]/variations → Compose Engine
                                                      ↓
                            I2V Agent → Imagen → Veo → Audio Overlay → S3
```

### 핵심 기능

| 기능 | 설명 |
|------|------|
| Style Presets | 다양한 스타일 조합 생성 |
| Auto-Publish | 배리에이션 완료 후 자동 게시 |
| Batch Processing | 여러 배리에이션 동시 처리 |

### 프로세스 플로우

```typescript
// app/api/v1/generations/[id]/variations/route.ts
1. seedGeneration 검증 (status === 'COMPLETED')
2. I2V Agent로 이미지/비디오 프롬프트 생성
3. Imagen으로 이미지 생성
4. Veo로 비디오 생성
5. Audio overlay (선택적)
6. Auto-publish (선택적)
```

### 상태: ✅ 양호

---

## 6. Video Edit

### 아키텍처

```
Original Generation → /api/v1/generations/[id]/edit → Compose Engine
                                                    ↓
                                    Audio Overlay + Subtitles → New Generation
```

### 핵심 기능

| 기능 | 옵션 |
|------|------|
| Audio Overlay | volume, fade_in, fade_out, start_time |
| Subtitles | lines[], style{font_size, color, position, animation...} |
| Original 보존 | 새 Generation 생성 (originalGenerationId 추적) |

### 요청 인터페이스

```typescript
interface VideoEditRequestBody {
  audio?: {
    asset_id: string;
    start_time?: number;
    volume?: number;
    fade_in?: number;
    fade_out?: number;
  };
  subtitles?: {
    lines: { text: string; start: number; end: number }[];
    style?: {
      font_size?: string;
      font_style?: string;
      color?: string;
      stroke_color?: string;
      stroke_width?: number;
      animation?: string;
      position?: string;
      bottom_margin?: number;
    };
  };
}
```

### 제한사항

- Audio 또는 Subtitles 중 하나 이상 필수
- 원본 outputUrl 또는 composedOutputUrl 필요

### 상태: ✅ 양호

---

## 7. AI Video Extend

### 아키텍처

```
Completed Generation → /api/v1/generations/[id]/extend → Compose Engine → Veo 3.1
                                                       ↓
                                            VideoExtensionHistory 기록
```

### 제한사항

| 항목 | 제한 |
|------|------|
| 최대 연장 횟수 | 20회 |
| 연장 길이 | 7초/회 |
| 대상 | AI 생성 비디오만 (Compose 불가) |
| 필수 조건 | gcsUri 존재, status === 'COMPLETED' |

### 특이점

- `VideoExtensionHistory` 테이블로 계보(lineage) 추적
- Audio overlay 옵션 제공 (`apply_audio_after`)
- 커스텀 프롬프트 지원 (continuation context)

### 상태: ✅ 양호

---

## 기능 간 유기적 연결

### 연결 다이어그램

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Trends    │────▶│  AI Video   │────▶│  Variations │
│ Intelligence│     │  / FastCut  │     │             │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐     ┌──────────────┐
                    │ Video Edit   │     │ AI Extend    │
                    └──────┬───────┘     └──────┬───────┘
                           │                    │
                           └────────┬───────────┘
                                    ▼
                           ┌──────────────┐
                           │  Publishing  │
                           └──────────────┘
```

### 잘 되어 있는 연결

| 연결 | 구현 방식 |
|------|-----------|
| Trends → AI Video/FastCut | `getReportForBridge/Compose` 포맷 지원 |
| Generation → Variations | seedGenerationId로 연결 |
| Variations → Auto-Publish | `autoPublish` 옵션 + `socialAccountId` |
| Generation → Edit | originalGenerationId 추적 |
| Generation → Extend | VideoExtensionHistory 테이블 |
| Workflow → Processing | processing-session-store.ts |

### 개선이 필요한 연결

| 연결 | 문제 | 위치 |
|------|------|------|
| Variations → Publish | temp ID (`var-*`) 문제로 수동 게시 불가 | `app/(dashboard)/publish/page.tsx:344` |
| FastCut → AI Video | 데이터 모델 불일치, 변환 로직 복잡 | `lib/stores/workflow-store.ts` |
| Start → Discover | 레거시 DiscoverData와 StartData 중복 | `lib/stores/workflow-store.ts:172-189` |

---

## 레거시 코드 및 기술 부채

### 1. Deprecated 파일/함수

| 파일 | 상태 | 대체 방안 |
|------|------|-----------|
| `lib/geo-aeo-generator.ts` | @deprecated | GeoAeoOptimizerAgent 사용 |
| `lib/gemini-prompt.ts` | 전체 @deprecated | I2V Specialist Agent 사용 |
| `lib/imagen.ts:225` | @deprecated | Direct mode 사용 |

### 2. 레거시 패턴

#### 2.1 DiscoverData vs StartData

```typescript
// lib/stores/workflow-store.ts
// 현재: 두 인터페이스 중복 유지
discover: DiscoverData; // Legacy - kept for backward compatibility
start: StartData;       // New workflow entry point
```

**권장**: StartData로 완전 마이그레이션 후 DiscoverData 제거

#### 2.2 composeApi Alias 중복

```typescript
// lib/fast-cut-api.ts:866
export const composeApi = fastCutApi;

// lib/video-api.ts:566
export const composeApi = { ... };
```

**권장**: 하나의 네이밍 규칙으로 통일 (fastCutApi 권장)

#### 2.3 StyleSet vs Legacy Parameters

```typescript
// app/api/v1/fast-cut/render/route.ts:209-210
if (styleSetId) {
  // Use style set settings (신규 방식)
  const styleSet = getStyleSetById(styleSetId);
  const renderSettings = styleSetToRenderSettings(styleSet);
} else {
  // Use individual parameters (legacy mode)
  console.log(`${LOG_PREFIX} Legacy mode - using individual parameters`);
  vibe = body.vibe || 'Exciting';
  effectPreset = body.effectPreset || 'zoom_beat';
}
```

**권장**: StyleSet 전용 모드로 전환, Legacy parameter 지원 제거

### 3. 백워드 호환성 코드 목록

| 위치 | 설명 |
|------|------|
| `lib/agents/index.ts:272` | FastCut* → Compose* 별칭 |
| `lib/tiktok-trends.ts:1146` | 이전 함수명 별칭 |
| `lib/tiktok-mcp.ts:1017` | Search 래퍼 함수 |
| `lib/image-cache.ts:192` | LEGACY FUNCTIONS 섹션 |
| `lib/auth.ts:22` | 패스워드 해싱 (Supabase 이전) |
| `components/workflow/WorkflowHeader.tsx:32` | Legacy STAGES |
| `lib/stores/workflow-store.ts:166` | legacyInsights 필드 |
| `lib/stores/workflow-store.ts:390` | aiInsights 타입 호환 |
| `lib/fast-cut-api.ts:283-296` | Individual settings (legacy) |

### 4. TODO/FIXME 항목

| 파일:라인 | 내용 |
|-----------|------|
| `lib/prompt-alchemist.ts:306` | Gemini Vision 구현 필요 |
| `lib/preview-image.ts:336` | reference image support 추가 |
| `lib/pipeline-api.ts:263` | cancel endpoint 구현 |
| `claudedocs/trend-expansion-implementation-plan.md:315` | trendDirection 계산 |
| `claudedocs/trend-expansion-implementation-plan.md:480` | video URLs 추가 |

---

## 권장 개선 사항

### 우선순위: 높음

1. **DiscoverData 제거**
   - StartData로 완전 마이그레이션
   - workflow-store.ts에서 discover 관련 코드 정리
   - 예상 영향: workflow 관련 컴포넌트 수정 필요

2. **composeApi 네이밍 통일**
   - fastCutApi 또는 composeApi 중 하나로 통일
   - 전체 codebase grep 후 일괄 변경
   - 예상 영향: import 문 수정

3. **Variations → Publish temp ID 문제 해결**
   - `var-*` ID를 실제 generation ID로 매핑
   - `app/(dashboard)/publish/page.tsx:344` 수정
   - 예상 영향: 배리에이션 게시 워크플로우 개선

### 우선순위: 중간

4. **Deprecated 파일 정리**
   - `lib/gemini-prompt.ts` 삭제
   - `lib/geo-aeo-generator.ts` 삭제
   - 참조하는 코드 확인 후 제거

5. **StyleSet 전용 모드**
   - Legacy parameter 지원 제거
   - `app/api/v1/fast-cut/render/route.ts` 수정
   - Frontend에서 항상 styleSetId 전송하도록 변경

6. **Twitter 배포 구현**
   - OAuth 라우트 추가
   - Compose Engine에 Twitter 게시 기능 추가

### 우선순위: 낮음

7. **TODO 항목 해결**
   - Gemini Vision 통합
   - Reference image support
   - Cancel endpoint 구현

8. **백워드 호환성 별칭 정리**
   - 마이그레이션 완료 후 별칭 제거
   - 단계적 deprecation 적용

9. **테스트 커버리지 향상**
   - API 라우트 단위 테스트 추가
   - 통합 테스트 시나리오 작성

---

## 전체 평가

### 기능별 평가

| 기능 | 구조 | 연결성 | 레거시 수준 | 종합 |
|------|------|--------|-------------|------|
| AI Video | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 낮음 | 양호 |
| FastCut | ⭐⭐⭐ | ⭐⭐⭐ | **높음** | 개선 필요 |
| Video Publishing | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 낮음 | 양호 |
| Trend Intelligence | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 매우 낮음 | 우수 |
| Variations | ⭐⭐⭐⭐ | ⭐⭐⭐ | 낮음 | 양호 |
| Video Edit | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 낮음 | 양호 |
| AI Extend | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 낮음 | 양호 |

### 결론

1. **전반적 평가**: 시스템 구조는 전반적으로 양호하며, 7개 기능 모두 핵심 워크플로우가 잘 구현되어 있음

2. **가장 성숙한 기능**: Trend Intelligence (20개 API, 완전한 분석 파이프라인, 다른 기능과의 연동 포맷 제공)

3. **주요 기술 부채**: FastCut 관련 레거시 코드
   - DiscoverData vs StartData 중복
   - composeApi 네이밍 혼란
   - StyleSet vs Legacy mode 이중 지원

4. **핵심 개선 포인트**:
   - DiscoverData → StartData 완전 마이그레이션
   - 레거시 모드 제거를 통한 코드 단순화
   - Variations → Publish 연결 개선

5. **강점**:
   - Callback 기반 비동기 처리 일관성
   - Zustand + persist를 통한 상태 관리
   - Agent 시스템을 통한 AI 기능 캡슐화
   - RBAC 기반 접근 제어

---

*이 문서는 Claude Code에 의해 자동 생성되었습니다.*
