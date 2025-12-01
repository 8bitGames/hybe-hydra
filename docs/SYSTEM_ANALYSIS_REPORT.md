# HYBE HYDRA 시스템 종합 분석 리포트

**분석 일자:** 2025-12-01
**분석 범위:** 전체 시스템 아키텍처, 데이터베이스, API, 프론트엔드, 기능 연결성

---

## 목차

1. [전체 시스템 평가](#전체-시스템-평가)
2. [시스템 구조 요약](#시스템-구조-요약)
3. [Critical Issues (즉시 해결 필요)](#critical-issues-즉시-해결-필요)
4. [High Priority Issues](#high-priority-issues)
5. [Medium Priority Issues](#medium-priority-issues)
6. [기능별 연결 상태 매트릭스](#기능별-연결-상태-매트릭스)
7. [상세 기능 분석](#상세-기능-분석)
8. [데이터베이스 분석](#데이터베이스-분석)
9. [권장 해결 순서](#권장-해결-순서)
10. [결론](#결론)

---

## 전체 시스템 평가

| 영역 | 완성도 | 상태 | 비고 |
|------|--------|------|------|
| 아키텍처 | 70% | 구조 양호, 연결 부족 | Next.js + Python 하이브리드 |
| 데이터베이스 | 85% | 일부 FK 누락 | Prisma ORM 사용 |
| API | 80% | Publishing 미구현 | RESTful 구조 |
| 프론트엔드 | 75% | UI 존재, 플로우 단절 | App Router 사용 |
| **통합성** | **55%** | **가장 큰 문제** | 기능 간 연결 부족 |

### 핵심 기술 스택

- **Frontend:** Next.js 14 (App Router), React, TailwindCSS, shadcn/ui
- **Backend API:** Next.js API Routes
- **Video Engine:** Python FastAPI + MoviePy + FFmpeg
- **Database:** PostgreSQL + Prisma ORM
- **Queue:** Redis
- **Storage:** MinIO (S3 호환)
- **AI Services:** Google Veo, Gemini, Imagen

---

## 시스템 구조 요약

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HYBE HYDRA Architecture                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │   Bridge     │     │    Trends    │     │   Compose    │        │
│  │  (TikTok     │  ❌  │  (트렌드     │  △  │  (영상 제작  │        │
│  │   분석)      │────→│   분석)      │────→│   위자드)    │        │
│  └──────────────┘     └──────────────┘     └──────────────┘        │
│         │                                         │                 │
│         │ ✅                                      │ ❌ 연결 없음    │
│         ▼                                         ▼                 │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │                    Campaign Workflow                      │      │
│  │  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐ │      │
│  │  │Campaign │ → │ Generate │ → │ Curation │ → │Publish │ │      │
│  │  │ Detail  │   │ (Veo AI) │   │ (품질평가)│   │ (SNS)  │ │      │
│  │  └─────────┘   └──────────┘   └──────────┘   └────────┘ │      │
│  │       ↓              ↓                                    │      │
│  │  ┌─────────┐   ┌──────────┐                              │      │
│  │  │ Assets  │   │ Pipeline │                              │      │
│  │  │ Upload  │   │(Variation)│                             │      │
│  │  └─────────┘   └──────────┘                              │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
│  ┌──────────────┐                    ┌──────────────────────┐      │
│  │ Next.js API  │◄──────────────────►│  Compose Engine      │      │
│  │   Routes     │      HTTP          │  (Python/FastAPI)    │      │
│  └──────────────┘                    └──────────────────────┘      │
│         │                                      │                    │
│         ▼                                      ▼                    │
│  ┌──────────────┐                    ┌──────────────────────┐      │
│  │ PostgreSQL   │                    │  Redis (Job Queue)   │      │
│  │ (Prisma)     │                    │  MinIO (Storage)     │      │
│  └──────────────┘                    └──────────────────────┘      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 주요 워크플로우

1. **Campaign Workflow (4단계):**
   - Campaign Detail → Generate → Curation → Publish

2. **Compose Workflow (4단계):**
   - Script → Images → Music → Render

3. **Bridge Workflow:**
   - TikTok URL 분석 → 트렌드 추출 → Generate 연결

4. **Pipeline Workflow:**
   - Seed Generation → Variation 생성 → 배치 관리

---

## Critical Issues (즉시 해결 필요)

### Issue #1: Compose 결과물 후처리 경로 부재

**파일 위치:** `app/(dashboard)/campaigns/[id]/compose/page.tsx:1269`

**문제:**
- Compose 완료 후 `/compose/gallery` 링크하지만 **페이지가 존재하지 않음**
- Compose로 만든 영상이 Curation에 표시되지 않음
- 영상을 만들어도 Publish로 연결 불가

**영향:**
- 사용자가 Compose 기능을 사용해도 결과물 활용 불가
- 핵심 기능이 사실상 무용지물

**현재 코드:**
```tsx
// compose/page.tsx:1267-1273
<Button asChild>
  <Link href="/compose/gallery">  {/* ❌ 존재하지 않는 페이지 */}
    {t.compose.finish}
    <ChevronRight className="w-4 h-4 ml-2" />
  </Link>
</Button>
```

**해결책:**
```
Option A: /compose/gallery 페이지 생성
  - 캠페인별 Compose 결과물 갤러리
  - Curation과 유사한 UI

Option B: Compose 결과를 Curation에 통합 표시 (권장)
  - composed_output_url이 있으면 우선 표시
  - 기존 Curation 로직 활용
  - /campaigns/[id]/curation으로 리다이렉트
```

---

### Issue #2: ScheduledPost FK 관계 누락

**파일 위치:** `prisma/schema.prisma:492-541`

**문제:**
```prisma
model ScheduledPost {
  campaignId      String   @map("campaign_id")     // ❌ FK relation 없음
  generationId    String   @map("generation_id")   // ❌ FK relation 없음
  socialAccountId String   @map("social_account_id")

  // Relations
  socialAccount SocialAccount @relation(fields: [socialAccountId], references: [id])
  // ❌ campaign relation 없음
  // ❌ generation relation 없음
}
```

**영향:**
- Campaign 삭제 시 ScheduledPost가 고아 레코드로 남음
- VideoGeneration 삭제 시 데이터 무결성 깨짐
- CASCADE 삭제 미작동
- 조인 쿼리 비효율

**해결책:**
```prisma
model ScheduledPost {
  // 기존 필드...
  campaignId   String @map("campaign_id")
  generationId String @map("generation_id")

  // Relations 추가
  campaign   Campaign        @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  generation VideoGeneration @relation(fields: [generationId], references: [id], onDelete: Cascade)
}

// Campaign 모델에도 추가
model Campaign {
  // 기존 필드...
  scheduledPosts ScheduledPost[]
}

// VideoGeneration 모델에도 추가
model VideoGeneration {
  // 기존 필드...
  scheduledPosts ScheduledPost[]
}
```

**마이그레이션 주의사항:**
1. 기존 데이터의 campaignId, generationId 유효성 검증 필요
2. 잘못된 참조 데이터 정리 후 마이그레이션

---

### Issue #3: Publishing 실제 기능 미구현

**파일 위치:**
- `lib/publishing-api.ts` - API 클라이언트 (완성)
- `app/api/v1/publishing/*` - API 라우트 (구조만 존재)

**문제:**
- ScheduledPost CRUD는 작동
- **실제 SNS API 호출 없음**
- OAuth 플로우 불완전
- 스케줄러 미구현

**현재 상태:**

| 기능 | 상태 | 설명 |
|------|------|------|
| ScheduledPost CRUD | ✅ 작동 | DB 저장/조회 가능 |
| SocialAccount 관리 | ✅ 작동 | 계정 정보 저장 |
| TikTok OAuth | ❌ 미구현 | 콜백 처리 없음 |
| YouTube OAuth | ❌ 미구현 | - |
| Instagram OAuth | ❌ 미구현 | - |
| 실제 게시 | ❌ 미구현 | API 호출 코드 없음 |
| 토큰 암호화 | ❌ 평문 저장 | 보안 위험 |
| 토큰 갱신 | ❌ 미구현 | refresh_token 미사용 |
| 자동 스케줄링 | ❌ 미구현 | cron/queue 없음 |
| Analytics 동기화 | ❌ 미구현 | SNS 데이터 수집 없음 |

**필요한 구현:**

1. **OAuth 플로우:**
```typescript
// TikTok OAuth 콜백 처리
// app/api/v1/publishing/oauth/tiktok/callback/route.ts 필요
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  // 1. code로 access_token 교환
  // 2. 토큰 암호화 후 DB 저장
  // 3. 사용자 프로필 가져오기
}
```

2. **실제 게시:**
```typescript
// TikTok Video Upload API 호출
async function publishToTikTok(post: ScheduledPost) {
  // 1. access_token 복호화
  // 2. 토큰 만료 시 갱신
  // 3. TikTok API로 영상 업로드
  // 4. 결과 저장
}
```

3. **스케줄러:**
```typescript
// Bull Queue 또는 node-cron 사용
// 매 분마다 예약된 게시물 확인 및 게시
```

---

## High Priority Issues

### Issue #4: Generate와 Compose 경로 분리

**문제:**
- **Generate 경로:** Veo AI → `output_url` (AI 생성 영상)
- **Compose 경로:** FFmpeg → `composed_output_url` (이미지+오디오 조합)
- 같은 `VideoGeneration` 테이블 사용하지만 용도가 다름
- Curation에서 `composed_output_url` 표시 안됨

**사용자 혼란:**
```
"영상을 어디서 만들어야 하지?"

Generate: AI가 프롬프트로 처음부터 생성
  - Veo API 사용
  - 창의적 영상 생성
  - output_url에 저장

Compose: 이미지+오디오로 조합
  - FFmpeg/MoviePy 사용
  - 기존 소스 활용
  - composed_output_url에 저장

→ 두 기능의 차이점이 UI에서 명확하지 않음
```

**해결책:**
```
Option A: 통합 UI
  - Generate 페이지에서 "AI 생성" / "Compose" 탭으로 구분
  - 결과물은 동일하게 Curation으로 연결

Option B: 명확한 분리 (권장)
  - Generate: AI 영상 생성 전용
  - Compose: 편집/조합 전용
  - 사이드바에서 목적 명확히 표시

Option C: Curation 개선
  - output_url과 composed_output_url 모두 표시
  - 영상 타입(AI생성/조합) 뱃지로 구분
```

---

### Issue #5: Bridge → Compose 연결 부재

**파일 위치:**
- `app/(dashboard)/bridge/page.tsx`
- `lib/bridge-storage.ts`

**문제:**
- Bridge에서 TikTok 영상 분석 → 트렌드 스타일 추출
- Compose에서 TrendRecommendationsCard 별도 존재
- **두 기능이 연결되지 않음**

**현재 플로우:**
```
Bridge 분석
    ↓
LocalStorage 저장 (bridge-storage.ts)
    ↓
Generate 페이지 ✅ (연결됨)

Compose 페이지 ❌ (연결 없음)
    ↓
TrendRecommendationsCard (별도 API 호출)
```

**해결책:**
```typescript
// Compose 페이지에서 Bridge 데이터 활용
import { getBridgeSession } from '@/lib/bridge-storage';

// Compose 초기화 시
const bridgeData = getBridgeSession();
if (bridgeData) {
  // 트렌드 키워드 자동 설정
  setEditableKeywords(bridgeData.trend_keywords);
  // 스타일 제안 적용
  setPrompt(bridgeData.suggested_prompt);
}
```

---

### Issue #6: audioAssetId 필수 필드 문제

**파일 위치:** `prisma/schema.prisma:208`

**문제:**
```prisma
audioAssetId String @map("audio_asset_id")  // NOT NULL
```

- VideoGeneration 생성 시 오디오 **필수**
- Generate 페이지에서 오디오 선택 없이 진행하면 에러
- 일부 워크플로우에서는 오디오 없이 영상만 필요할 수 있음

**해결책:**
```
Option A: nullable로 변경
  audioAssetId String? @map("audio_asset_id")
  - 마이그레이션 필요
  - API 로직 수정 필요

Option B: 기본 오디오 에셋 지정
  - 시스템 기본 무음 오디오 준비
  - 선택하지 않으면 기본값 사용

Option C: UI에서 필수 선택 강제 (현재 상태 유지)
  - 에러 메시지 개선
  - 오디오 선택 단계 명확히 표시
```

---

## Medium Priority Issues

### Issue #7: Trends 수집 자동화 없음

**문제:**
- `/api/v1/trends/collect` API 존재
- 자동 수집 스케줄러 없음
- 수동으로 호출해야 함

**해결책:**
```typescript
// cron job 설정 (예: 매 6시간)
// 또는 Vercel Cron Jobs 사용
export const config = {
  schedule: '0 */6 * * *'
};

export default async function handler() {
  await collectTikTokTrends();
  await collectYouTubeTrends();
}
```

---

### Issue #8: Pipeline 테이블 정규화 필요

**문제:**
- Pipeline 전용 테이블 없음
- `VideoGeneration.quality_metadata`에 batchId, seedGenerationId 저장
- JSON 필드 내 쿼리 비효율

**현재 구조:**
```json
// quality_metadata 예시
{
  "batchId": "batch-123",
  "seedGenerationId": "gen-456",
  "variationType": "variation",
  "appliedPresets": [...]
}
```

**해결책:**
```prisma
model VariationBatch {
  id               String   @id @default(uuid())
  seedGenerationId String   @map("seed_generation_id")
  status           String   // pending, processing, completed, partial_failure
  styleCategories  String[]
  createdAt        DateTime @default(now())

  seedGeneration VideoGeneration  @relation("SeedGeneration", fields: [seedGenerationId], references: [id])
  variations     VideoGeneration[] @relation("BatchVariations")
}
```

---

### Issue #9: 중복 기능 존재

| 기능 | Next.js 위치 | Python 위치 | 비고 |
|------|-------------|-------------|------|
| Audio Analyzer | `lib/audio-analyzer.ts` | `backend/compose-engine/app/services/audio_analyzer.py` | 기능 중복 |
| BPM Detection | lib/audio-analyzer.ts | services/audio_analyzer.py | 알고리즘 다를 수 있음 |

**권장:**
- Python 버전을 기준으로 통일 (FFmpeg 기반으로 더 정확)
- Next.js에서는 API 호출만 수행

---

### Issue #10: Health Check 통합 부재

**현재 상태:**
- `/api/health` - Next.js 앱
- `/api/health/db` - PostgreSQL
- `/api/health/redis` - Redis
- **Compose Engine 헬스체크 없음**

**해결책:**
```typescript
// /api/health/compose-engine/route.ts
export async function GET() {
  try {
    const res = await fetch(`${COMPOSE_ENGINE_URL}/health`);
    return NextResponse.json({ status: res.ok ? 'healthy' : 'unhealthy' });
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 503 });
  }
}
```

---

## 기능별 연결 상태 매트릭스

| From ↓ / To → | Campaign | Generate | Compose | Curation | Publish | Bridge | Trends | Pipeline |
|---------------|----------|----------|---------|----------|---------|--------|--------|----------|
| **Campaign** | - | ✅ | ✅ | ✅ | ✅ | - | - | ✅ |
| **Generate** | ✅ | - | ❌ | ✅ | △ | ✅ | △ | ✅ |
| **Compose** | ✅ | ❌ | - | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Curation** | ✅ | ✅ | ❌ | - | ✅ | - | - | △ |
| **Publish** | ✅ | - | - | ✅ | - | - | - | - |
| **Bridge** | - | ✅ | ❌ | - | - | - | △ | - |
| **Trends** | - | △ | ✅ | - | - | △ | - | - |
| **Pipeline** | ✅ | ✅ | ❌ | △ | - | - | - | - |

**범례:**
- ✅ 완전 연결: 데이터 흐름 및 UI 네비게이션 모두 작동
- △ 부분 연결: 데이터는 연결되나 UI 경험이 불완전
- ❌ 연결 없음: 기능 간 연결이 전혀 없음

---

## 상세 기능 분석

### Campaign Workflow (메인 플로우)

#### Step 1: Campaign Detail (`/campaigns/[id]`)

| 기능 | 상태 | 비고 |
|------|------|------|
| 캠페인 정보 표시 | ✅ | 아티스트, 기간, 상태 |
| 에셋 업로드 | ✅ | IMAGE, VIDEO, AUDIO, GOODS |
| 에셋 목록/삭제 | ✅ | 타입별 필터링 |
| Generate 연결 | ✅ | 사이드바/버튼 |

#### Step 2: Generate (`/campaigns/[id]/generate`)

| 기능 | 상태 | 비고 |
|------|------|------|
| 프롬프트 입력 | ✅ | - |
| Prompt Alchemist | ✅ | AI 프롬프트 변환 |
| 오디오 선택 | ⚠️ | 필수이나 UX 불명확 |
| 트렌드 키워드 | △ | Bridge 연결만 있음 |
| Veo 영상 생성 | ✅ | - |
| 배치 생성 | ✅ | 스타일 프리셋 |
| 참조 이미지 | ✅ | Image-to-Video |

#### Step 3: Curation (`/campaigns/[id]/curation`)

| 기능 | 상태 | 비고 |
|------|------|------|
| 영상 목록 | ✅ | - |
| AI 품질 점수 | ✅ | 자동 스코어링 |
| 즐겨찾기/태그 | ✅ | - |
| 필터/정렬 | ✅ | - |
| 영상 삭제 | ✅ | - |
| Compose 영상 표시 | ❌ | composed_output_url 미표시 |
| Publish 연결 | ✅ | - |

#### Step 4: Publish (`/campaigns/[id]/publish`)

| 기능 | 상태 | 비고 |
|------|------|------|
| SNS 계정 목록 | ✅ | - |
| 게시 스케줄 생성 | ✅ | - |
| 캡션/해시태그 | ✅ | - |
| 예약 시간 설정 | ✅ | - |
| 실제 게시 | ❌ | API 호출 없음 |
| Analytics | ❌ | 동기화 없음 |

---

### Compose Workflow

#### Step 1: Script Generation

| 기능 | 상태 | 비고 |
|------|------|------|
| 프롬프트 입력 | ✅ | - |
| Vibe 분석 | ✅ | Exciting/Emotional/Pop/Minimal |
| 스크립트 라인 생성 | ✅ | 타이밍 포함 |
| 트렌드 자동 반영 | ✅ | TrendRecommendationsCard |
| TikTok SEO 생성 | ✅ | 해시태그, 키워드 |
| Google Grounding | ✅ | 실시간 정보 활용 |

#### Step 2: Image Search

| 기능 | 상태 | 비고 |
|------|------|------|
| 키워드 기반 검색 | ✅ | Google Custom Search |
| 품질 점수 표시 | ✅ | - |
| 이미지 선택 | ✅ | 최대 10개 |
| 키워드 편집 | ✅ | 추가/삭제 |
| 재검색 | ✅ | - |
| Hotlink 우회 | ✅ | MinIO 프록시 |

#### Step 3: Music Matching

| 기능 | 상태 | 비고 |
|------|------|------|
| BPM 기반 매칭 | ✅ | - |
| Vibe 기반 매칭 | ✅ | - |
| 매칭 점수 | ✅ | - |
| 미리 듣기 | ✅ | - |
| 에셋 없을 때 안내 | ⚠️ | 업로드 링크만 제공 |

#### Step 4: Render

| 기능 | 상태 | 비고 |
|------|------|------|
| 이펙트 프리셋 | ✅ | zoom_beat, crossfade 등 |
| 비트 싱크 | ✅ | - |
| 텍스트 오버레이 | ✅ | 스크립트 기반 |
| 진행률 표시 | ✅ | - |
| 결과 다운로드 | ✅ | - |
| 결과 활용 | ❌ | Gallery 페이지 없음 |

---

### Bridge Workflow

| 기능 | 상태 | 비고 |
|------|------|------|
| TikTok URL 입력 | ✅ | - |
| 영상 메타데이터 추출 | ✅ | 스크래핑 기반 |
| 스타일 분석 | ✅ | AI 분석 |
| 프롬프트 제안 | ✅ | - |
| LocalStorage 저장 | ✅ | - |
| Generate 연결 | ✅ | - |
| Compose 연결 | ❌ | 연결 없음 |
| DB 저장 | ❌ | 휘발성 데이터 |

---

### Trends System

| 기능 | 상태 | 비고 |
|------|------|------|
| TrendSnapshot 저장 | ✅ | - |
| TrendVideo 저장 | ✅ | - |
| Text 분석 | ✅ | 해시태그, 캡션 |
| Video 분석 | ✅ | 비주얼 스타일 |
| 종합 리포트 | ✅ | - |
| 자동 수집 | ❌ | 스케줄러 없음 |
| 캠페인 통합 | △ | 부분적 |

---

### Pipeline System

| 기능 | 상태 | 비고 |
|------|------|------|
| Variation 생성 | ✅ | - |
| 배치 상태 추적 | ✅ | - |
| 스타일 카테고리 | ✅ | - |
| 프롬프트 변형 | ✅ | - |
| 전용 테이블 | ❌ | metadata 기반 |
| 취소 기능 | ❌ | placeholder |
| Pipeline 페이지 | △ | 부분 구현 |

---

## 데이터베이스 분석

### 테이블 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                      Database Schema                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐     ┌──────────┐     ┌─────────────────┐          │
│  │  User   │────▶│ Campaign │────▶│ VideoGeneration │          │
│  └─────────┘     └──────────┘     └─────────────────┘          │
│       │               │                    │                    │
│       │               │                    ▼                    │
│       │               │           ┌───────────────┐            │
│       │               ▼           │ScheduledPost  │ ⚠️FK 누락  │
│       │          ┌────────┐      └───────────────┘             │
│       └─────────▶│ Asset  │              │                     │
│                  └────────┘              ▼                     │
│                       │          ┌───────────────┐             │
│                       │          │ SocialAccount │             │
│                       ▼          └───────────────┘             │
│               ┌────────────┐                                   │
│               │MerchandiseItem│                                │
│               └────────────┘                                   │
│                                                                 │
│  ┌──────────────┐  ┌───────────────────┐  ┌─────────────┐     │
│  │TrendSnapshot │  │TextTrendAnalysis  │  │TrendReport  │     │
│  └──────────────┘  └───────────────────┘  └─────────────┘     │
│         │                    │                   │              │
│         └────────────────────┴───────────────────┘              │
│                          │                                      │
│                   ┌──────────────┐                             │
│                   │  TrendVideo  │                             │
│                   └──────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### FK 관계 문제

| 테이블 | 필드 | 문제 | 영향 |
|--------|------|------|------|
| ScheduledPost | campaignId | FK 없음 | CASCADE 미작동 |
| ScheduledPost | generationId | FK 없음 | 무결성 위험 |

### Enum 정의

```prisma
enum UserRole { ADMIN, PRODUCER, VIEWER }
enum CampaignStatus { DRAFT, ACTIVE, COMPLETED, ARCHIVED }
enum AssetType { IMAGE, VIDEO, AUDIO, GOODS }
enum VideoGenerationStatus { PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED }
enum TrendPlatform { TIKTOK, YOUTUBE, INSTAGRAM }
enum PublishPlatform { TIKTOK, YOUTUBE, INSTAGRAM, TWITTER }
enum PublishStatus { DRAFT, SCHEDULED, PUBLISHING, PUBLISHED, FAILED, CANCELLED }
enum MerchandiseType { ALBUM, PHOTOCARD, LIGHTSTICK, APPAREL, ACCESSORY, OTHER }
enum MerchandiseContext { HOLDING, WEARING, SHOWING, BACKGROUND }
```

### 주요 JSON 필드

| 테이블 | 필드 | 용도 |
|--------|------|------|
| VideoGeneration | quality_metadata | 배치 정보, 변형 정보 |
| VideoGeneration | audio_analysis | BPM, 에너지 커브 |
| VideoGeneration | tiktok_seo | SEO 메타데이터 |
| ScheduledPost | platform_settings | 플랫폼별 설정 |
| TrendSnapshot | metadata | 플랫폼별 추가 데이터 |

---

## 권장 해결 순서

### Phase 1: 핵심 플로우 완성 ✅ 완료 (2025-12-01)

**목표:** 영상 제작 → 큐레이션 → 퍼블리싱 기본 플로우 완성

#### Task 1.1: Compose → Curation 연결 ✅
```
- [x] Compose 완료 후 /campaigns/[id]/curation으로 리다이렉트
- [x] Curation에서 composed_output_url 표시 로직 추가
- [x] 영상 타입 구분 UI (AI생성 vs Compose) - 보라색 Compose 뱃지 추가
```

#### Task 1.2: ScheduledPost FK 마이그레이션 ✅
```
- [x] 기존 데이터 검증 스크립트 작성
- [x] 잘못된 참조 데이터 정리 (orphan 레코드 2개 삭제)
- [x] Prisma 스키마 수정 (Campaign, VideoGeneration FK 관계 추가)
- [x] 마이그레이션 실행 완료
```

#### Task 1.3: Compose 완료 UI 개선 ✅
```
- [x] "영상 관리" → Curation 페이지로 이동
- [x] "Publish" → Publish 페이지로 이동 (두 버튼 모두 제공)
```

---

### Phase 2: Generate/Compose 통합 ✅ 완료 (2025-12-01)

**목표:** 두 영상 제작 경로 명확화 및 통합

#### Task 2.1: 통합 영상 제작 UI ✅
```
- [x] 사이드바에서 차이점 명시
  - Generate: "AI creates video from prompt"
  - Compose: "Build video from images + audio"
  - Pipeline: "Batch variations & A/B testing"
```

#### Task 2.2: Curation 개선 ✅ (Phase 1에서 완료)
```
- [x] output_url, composed_output_url 우선순위 로직 (getVideoUrl 헬퍼)
- [x] 영상 소스 표시 (AI/Compose 뱃지)
```

#### Task 2.3: audioAssetId 처리 ✅
```
- [x] Generate에서 오디오 없이 진행 허용 (audioAssetId nullable로 변경)
- [x] Prisma 스키마 및 DB 마이그레이션 완료
```

---

### Phase 3: 트렌드/Bridge 통합 (예상 3일)

**목표:** 트렌드 분석 결과를 워크플로우 전체에서 활용

#### Task 3.1: Bridge → Compose 연결 ✅ (2025-12-01 완료)
```
- [x] Compose 페이지에서 bridge-storage 데이터 활용 (loadBridgePrompt 구현)
- [x] 트렌드 키워드 자동 적용 (selectedTrends → editableKeywords)
- [x] Bridge 페이지에 Compose 버튼 추가 (handleNavigateToCompose)
- [x] PromptInterfacePanel에 Generate/Compose 듀얼 버튼 UI 구현
```

#### Task 3.2: Trends 캠페인 통합 ✅ (2025-12-01 완료)
```
- [x] 캠페인 컨텍스트에서 트렌드 분석 (Campaign Context selector 추가)
- [x] 아티스트 관련 트렌드 자동 추천 (generateSuggestedKeywords 구현)
- [x] Trends 페이지에 캠페인 선택 UI 추가
- [x] 아티스트명 기반 키워드 자동 생성 (artist_name, artist_stage_name 활용)
```

#### Task 3.3: Trends 자동 수집 ✅ (2025-12-01 완료)
```
- [x] Vercel Cron Jobs 설정 (vercel.json 생성)
- [x] Cron endpoint 구현 (/api/cron/trends)
- [x] 6시간마다 자동 수집 스케줄 설정
- [x] K-pop 관련 기본 키워드 11개 자동 수집
- [x] CRON_SECRET 기반 인증 구현
```

---

### Phase 4: Publishing 완성 (예상 2주)

**목표:** 실제 SNS 게시 기능 구현

#### Task 4.1: TikTok OAuth ✅ COMPLETED
```
- [x] TikTok Developer 앱 설정 - lib/tiktok.ts
- [x] OAuth 콜백 라우트 구현 - app/api/auth/tiktok/callback/route.ts
- [x] 토큰 암호화 저장 - SocialAccount 모델
- [x] 토큰 갱신 로직 - refreshAccessToken() in lib/tiktok.ts
```

#### Task 4.2: 실제 게시 구현 ✅ COMPLETED
```
- [x] TikTok Video Upload API 연동 - publishVideoToTikTok() in lib/tiktok.ts
- [x] 게시 결과 저장 - ScheduledPost 업데이트
- [x] 에러 핸들링 및 재시도 - retryCount 및 errorMessage 필드
```

#### Task 4.3: 스케줄러 구현 ✅ COMPLETED
```
- [x] Vercel Cron 설정 - vercel.json (매 5분)
- [x] 예약된 게시물 자동 처리 - app/api/cron/publish/route.ts
- [x] 실패 시 재시도 (최대 3회)
```

#### Task 4.4: Analytics 동기화 ✅ COMPLETED
```
- [x] TikTok Video Query API로 조회수/좋아요 수집
- [x] 주기적 동기화 스케줄러 - app/api/cron/analytics/route.ts (매 4시간)
- [x] ScheduledPost에 viewCount, likeCount 등 저장
```

---

## 결론

### 핵심 인사이트

> **AI로 기능을 개별 추가하다 보니 각 기능은 작동하지만, 전체 사용자 여정(User Journey)이 끊어져 있습니다.**

### 현재 상태

- **개별 기능:** 대부분 작동 (70-85%)
- **기능 연결:** 불완전 (55%)
- **핵심 플로우:** 부분적으로 끊김

### 우선순위

1. **즉시 해결:** Compose 결과물 활용, DB FK 수정
2. **높은 우선순위:** Generate/Compose 통합, Bridge 연결
3. **중간 우선순위:** Trends 자동화, Pipeline 정규화
4. **장기 과제:** Publishing 완전 구현

### 예상 소요 시간

| Phase | 작업량 | 예상 시간 |
|-------|--------|----------|
| Phase 1 | 핵심 플로우 | 1주 |
| Phase 2 | Generate/Compose | 1주 |
| Phase 3 | Trends/Bridge | 3일 |
| Phase 4 | Publishing | 2주 |
| **Total** | - | **약 5주** |

---

## 부록: API 엔드포인트 목록

### Authentication
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/users/me`

### Campaigns
- `GET/POST /api/v1/campaigns`
- `GET/PATCH/DELETE /api/v1/campaigns/[id]`
- `GET/POST /api/v1/campaigns/[id]/assets`
- `GET /api/v1/campaigns/[id]/assets/stats`
- `GET /api/v1/campaigns/[id]/dashboard`

### Generations
- `GET/POST /api/v1/campaigns/[id]/generations`
- `GET /api/v1/campaigns/[id]/generations/stats`
- `POST /api/v1/campaigns/[id]/generations/batch`
- `POST /api/v1/campaigns/[id]/generations/score-all`
- `GET/DELETE /api/v1/generations/[id]`
- `POST /api/v1/generations/[id]/cancel`
- `GET/POST /api/v1/generations/[id]/score`
- `GET/POST /api/v1/generations/[id]/compose`
- `GET/POST /api/v1/generations/[id]/caption`
- `GET/POST /api/v1/generations/[id]/variations`

### Compose Engine
- `POST /api/v1/compose/script`
- `POST /api/v1/compose/images/search`
- `POST /api/v1/compose/music/match`
- `POST /api/v1/compose/proxy-images`
- `POST /api/v1/compose/render`
- `GET /api/v1/compose/[id]/status`
- `GET /api/v1/compose/videos`

### Trends
- `GET/POST /api/v1/trends`
- `GET /api/v1/trends/[platform]`
- `GET /api/v1/trends/suggestions`
- `GET /api/v1/trends/collect`
- `GET /api/v1/trends/videos`
- `POST /api/v1/trends/analyze/text`
- `POST /api/v1/trends/analyze/video`
- `GET/POST /api/v1/trends/analyze/report`

### Publishing
- `GET/POST /api/v1/publishing/accounts`
- `GET/POST /api/v1/publishing/schedule`
- `GET/PATCH/DELETE /api/v1/publishing/schedule/[id]`
- `POST /api/v1/publishing/schedule/[id]/publish`
- `GET /api/v1/publishing/analytics/campaign/[id]`
- `GET /api/v1/publishing/analytics/posts`
- `POST /api/v1/publishing/analytics/sync/[id]`
- `PATCH /api/v1/publishing/analytics/[id]`

### Others
- `GET /api/v1/artists`
- `GET/POST /api/v1/presets`
- `GET /api/v1/presets/[id]`
- `GET/DELETE /api/v1/assets/[id]`
- `GET/POST /api/v1/merchandise`
- `GET /api/v1/merchandise/suggestions`
- `POST /api/v1/prompts/transform`
- `POST /api/v1/analyze-video`
- `POST /api/v1/captions/hashtags`
- `POST /api/v1/scrape`

### Health
- `GET /api/health`
- `GET /api/health/db`
- `GET /api/health/redis`

---

*이 문서는 2025-12-01 기준으로 작성되었습니다.*
