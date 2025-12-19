# Deep Analysis Backend 이전 명세서

## 개요

현재 Next.js API Routes에 구현된 Deep Analysis 기능을 EC2 백엔드로 이전하기 위한 기술 명세입니다.

---

## 1. API 엔드포인트 목록

### 1.1 TikTok 사용자 검색
```
GET /api/deep-analysis/search?q={keyword}&cursor={cursor}&limit={limit}
```

**요청 파라미터:**
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| q | string | ✅ | 검색 키워드 |
| cursor | string | ❌ | 페이지네이션 커서 (기본: "0") |
| limit | number | ❌ | 결과 수 (기본: 20) |

**응답:**
```json
{
  "success": true,
  "users": [
    {
      "id": "string",
      "uniqueId": "@username",
      "nickname": "닉네임",
      "avatarUrl": "https://...",
      "followers": 123456,
      "verified": true,
      "signature": "바이오",
      "videos": 100
    }
  ],
  "hasMore": true,
  "cursor": "next_cursor"
}
```

---

### 1.2 계정 분석 시작
```
POST /api/deep-analysis/analyze
```

**요청 바디:**
```json
{
  "uniqueId": "@username",
  "videoCount": 100,
  "language": "ko"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| uniqueId | string | ✅ | TikTok @username |
| videoCount | number | ❌ | 분석할 비디오 수 (기본: 100, 최대: 100) |
| language | string | ❌ | 분석 언어 ("ko" 또는 "en", 기본: "ko") |

**응답:**
```json
{
  "success": true,
  "analysisId": "uuid",
  "status": "PROCESSING",
  "cached": false
}
```

---

### 1.3 분석 결과 조회
```
GET /api/deep-analysis/{analysisId}
```

**응답:**
```json
{
  "success": true,
  "analysis": {
    "id": "uuid",
    "uniqueId": "@username",
    "nickname": "닉네임",
    "avatarUrl": "https://...",
    "verified": true,
    "followers": 123456,
    "following": 100,
    "totalLikes": 9876543,
    "totalVideos": 500,
    "videosAnalyzed": 100,
    "status": "COMPLETED",

    "basicMetrics": {
      "totalViews": 50000000,
      "totalLikes": 2000000,
      "avgViews": 500000,
      "avgLikes": 20000,
      "avgComments": 500,
      "avgShares": 200
    },

    "engagementMetrics": {
      "avgEngagementRate": 5.5,
      "medianEngagementRate": 4.8,
      "engagementRateStdDev": 2.1,
      "topPerformingRate": 12.5,
      "bottomPerformingRate": 1.2
    },

    "postingMetrics": {
      "postsPerWeek": 3.5,
      "mostActiveDay": "Friday",
      "mostActiveHour": 18,
      "avgDuration": 45,
      "avgHashtagCount": 5,
      "ownMusicPercentage": 30
    },

    "contentMixMetrics": {
      "categoryDistribution": [...],
      "dominantCategory": "dance",
      "contentDiversity": 0.75
    },

    "aiInsights": {
      "summary": "분석 요약...",
      "performanceScore": 85,
      "performanceTier": "excellent",
      "strengths": ["강점1", "강점2"],
      "weaknesses": ["약점1"],
      "contentStrategy": "콘텐츠 전략 분석...",
      "postingStrategy": "포스팅 전략 분석...",
      "growthPotential": "high",
      "recommendations": ["추천1", "추천2"]
    },

    "videoClassifications": [
      {
        "tiktokVideoId": "123456",
        "videoUrl": "https://tiktok.com/...",
        "thumbnailUrl": "https://...",
        "description": "비디오 설명",
        "playCount": 1000000,
        "likeCount": 50000,
        "commentCount": 1000,
        "shareCount": 500,
        "engagementRate": 5.1,
        "aiCategories": ["dance", "music"],
        "aiConfidence": 0.92,
        "reasoning": "분류 근거..."
      }
    ]
  }
}
```

---

### 1.4 분석 삭제
```
DELETE /api/deep-analysis/{analysisId}
```

---

### 1.5 다중 계정 비교 분석
```
POST /api/deep-analysis/compare
```

**요청 바디:**
```json
{
  "analysisIds": ["uuid1", "uuid2", "uuid3"],
  "language": "ko"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| analysisIds | string[] | ✅ | 비교할 분석 ID 목록 (2-10개) |
| language | string | ❌ | 분석 언어 (기본: "ko") |

**응답:**
```json
{
  "success": true,
  "reportId": "uuid",
  "comparison": {
    "overallSummary": "전체 비교 요약...",
    "rankings": {
      "engagementRate": [
        {"uniqueId": "@user1", "rank": 1, "value": 8.5},
        {"uniqueId": "@user2", "rank": 2, "value": 6.2}
      ]
    },
    "significantDifferences": [...],
    "radarChartData": {...},
    "strategicInsights": [...],
    "accountSpecificRecommendations": {...},
    "competitivePositioning": {...}
  },
  "duration": 45000
}
```

---

### 1.6 비교 리포트 조회
```
GET /api/deep-analysis/compare?id={reportId}
```

---

### 1.7 비교 리포트 목록
```
GET /api/deep-analysis/compare/list?limit={limit}&offset={offset}
```

---

### 1.8 비교 리포트 삭제
```
DELETE /api/deep-analysis/compare/list?id={reportId}
```

---

## 2. 외부 서비스 의존성

### 2.1 TikTok RapidAPI
```
Host: tiktok-api23.p.rapidapi.com
```

**필요한 API:**
| API | 용도 |
|-----|------|
| `GET /api/user/info` | 사용자 정보 조회 |
| `GET /api/user/posts` | 사용자 비디오 목록 |
| `GET /api/search/account` | 사용자 검색 |

**환경 변수:**
```env
RAPIDAPI_KEY=your_rapidapi_key
# 또는
TIKTOK_RAPIDAPI_KEY=your_rapidapi_key
```

---

### 2.2 Google AI Studio (Gemini)
```
모델: gemini-2.0-flash
용도: AI 분석 (비디오 분류, 메트릭 분석, 비교 분석)
```

**환경 변수:**
```env
GOOGLE_AI_API_KEY=your_google_ai_key
```

---

## 3. 데이터베이스 스키마

### 3.1 AccountAnalysis 테이블
```sql
CREATE TABLE account_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- TikTok 계정 정보
  tiktok_user_id VARCHAR NOT NULL,
  unique_id VARCHAR NOT NULL,  -- @username
  nickname VARCHAR NOT NULL,
  avatar_url VARCHAR,
  signature TEXT,
  verified BOOLEAN DEFAULT false,

  -- 계정 통계
  followers BIGINT NOT NULL,
  following INT NOT NULL,
  total_likes BIGINT NOT NULL,
  total_videos INT NOT NULL,

  -- 분석 파라미터
  videos_analyzed INT NOT NULL,
  analysis_language VARCHAR DEFAULT 'ko',
  status VARCHAR DEFAULT 'PENDING',  -- PENDING, PROCESSING, COMPLETED, FAILED

  -- 계산된 메트릭 (JSON)
  basic_metrics JSONB,
  engagement_metrics JSONB,
  content_mix_metrics JSONB,
  posting_metrics JSONB,

  -- AI 분석 결과
  ai_insights JSONB,
  recommendations JSONB,

  -- 메타데이터
  analyzed_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX idx_account_analyses_unique_id ON account_analyses(unique_id);
CREATE INDEX idx_account_analyses_status ON account_analyses(status);
CREATE INDEX idx_account_analyses_created_at ON account_analyses(created_at);
```

### 3.2 VideoClassification 테이블
```sql
CREATE TABLE video_classifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES account_analyses(id) ON DELETE CASCADE,

  -- 비디오 정보
  tiktok_video_id VARCHAR NOT NULL,
  video_url VARCHAR NOT NULL,
  thumbnail_url VARCHAR,
  description TEXT,

  -- 비디오 통계
  play_count BIGINT NOT NULL,
  like_count INT NOT NULL,
  comment_count INT NOT NULL,
  share_count INT NOT NULL,
  engagement_rate FLOAT NOT NULL,

  -- AI 분류
  ai_categories VARCHAR[] DEFAULT '{}',
  ai_confidence FLOAT DEFAULT 0,
  custom_tags VARCHAR[] DEFAULT '{}',
  reasoning TEXT,

  -- 음악 정보
  music_title VARCHAR,
  music_id VARCHAR,
  is_own_music BOOLEAN DEFAULT false,

  -- 게시 정보
  published_at TIMESTAMP,
  duration INT,

  -- AI 분석
  content_analysis JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_video_classifications_analysis_id ON video_classifications(analysis_id);
```

### 3.3 ComparisonReport 테이블
```sql
CREATE TABLE comparison_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  title VARCHAR,
  language VARCHAR DEFAULT 'ko',
  account_count INT DEFAULT 0,
  overall_summary TEXT,

  -- 비교 결과 (JSON)
  radar_chart_data JSONB,
  bar_chart_data JSONB,
  ranking_table JSONB,
  rankings JSONB,
  significant_diffs JSONB,
  significant_differences JSONB,
  benchmark_comparison JSONB,
  strategic_insights JSONB,
  account_recommendations JSONB,
  competitive_positioning JSONB,
  ai_comparison JSONB,

  created_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 비교 리포트-분석 연결 테이블
CREATE TABLE comparison_report_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES comparison_reports(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES account_analyses(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,

  UNIQUE(report_id, analysis_id)
);
```

---

## 4. 핵심 처리 로직

### 4.1 분석 프로세스 흐름
```
1. POST /analyze 요청 수신
   ↓
2. 24시간 내 동일 계정 분석 결과 캐시 확인
   ├── 있음 → 기존 analysisId 반환 (cached: true)
   └── 없음 → 새 분석 레코드 생성 (status: PENDING)
   ↓
3. 백그라운드 분석 시작 (비동기)
   ↓
4. TikTok API로 계정 정보 조회
   ↓
5. TikTok API로 비디오 목록 조회 (페이지네이션, 최대 100개)
   ↓
6. 기본 메트릭 계산
   - avgViews, avgLikes, avgComments, avgShares
   - avgEngagementRate, medianEngagementRate
   - postsPerWeek, mostActiveDay, mostActiveHour
   ↓
7. AI 분석 실행 (Orchestrator)
   ├── VideoClassifier: 비디오 카테고리 분류
   └── AccountMetrics: 종합 메트릭 분석 및 인사이트 생성
   ↓
8. DB에 결과 저장
   - AccountAnalysis 업데이트
   - VideoClassification 생성
   ↓
9. status: COMPLETED
```

### 4.2 AI Agent 구조

#### VideoClassifierAgent
- **입력**: 비디오 목록 (description, hashtags, musicTitle, duration, stats)
- **출력**:
  - 각 비디오별 카테고리 분류 (primaryCategory, secondaryCategories)
  - contentType (performance, behind-the-scenes, promotional, trend, other)
  - engagementPotential (high, medium, low)
  - 전체 categoryDistribution
  - contentDiversity 점수

#### AccountMetricsAgent
- **입력**: 계정 정보, 계산된 메트릭, 카테고리 분포, 벤치마크
- **출력**:
  - summary: 1-2문장 요약
  - performanceScore: 0-100 점수
  - performanceTier: poor/average/good/excellent
  - strengths: 강점 목록
  - weaknesses: 약점 목록
  - contentStrategy: 콘텐츠 전략 분석
  - postingStrategy: 포스팅 전략 분석
  - growthPotential: high/medium/low
  - recommendations: 개선 제안 목록

#### ComparativeAnalysisAgent (비교 분석 시)
- **입력**: 여러 계정의 메트릭 및 분류 결과
- **출력**:
  - overallSummary: 전체 비교 요약
  - rankings: 메트릭별 순위
  - significantDifferences: 주요 차이점
  - radarChartData: 레이더 차트 데이터
  - strategicInsights: 전략적 인사이트
  - accountSpecificRecommendations: 계정별 추천
  - competitivePositioning: 경쟁 포지셔닝

---

## 5. 메트릭 계산 로직

### 5.1 Engagement Rate
```python
engagement_rate = (likes + comments + shares) / views * 100
```

### 5.2 벤치마크 기준 (팔로워 기반)
| 티어 | 팔로워 | 평균 참여율 | 평균 조회수 |
|------|--------|-------------|-------------|
| micro | <10K | 8.5% | 1,000 |
| small | 10K-100K | 6.5% | 5,000 |
| medium | 100K-1M | 5.0% | 20,000 |
| large | 1M+ | 4.0% | 100,000 |

### 5.3 Posts Per Week
```python
if timestamps.length > 1:
    first_post = min(timestamps)
    last_post = max(timestamps)
    weeks_diff = (last_post - first_post) / (7 * 24 * 60 * 60)
    posts_per_week = len(timestamps) / weeks_diff
```

---

## 6. 구현 시 주의사항

### 6.1 Rate Limiting
- TikTok API 호출 간 200ms 딜레이 필요
- 페이지당 최대 30개 비디오

### 6.2 Retry 로직
- AI 분석 실패 시 최대 3회 재시도
- Exponential backoff: 1초, 2초, 4초

### 6.3 타임아웃
- 전체 분석 타임아웃: 10분 (600,000ms)
- 개별 API 호출 타임아웃: 30초

### 6.4 캐싱
- 동일 계정 분석 결과 24시간 캐싱 (같은 language인 경우)
- TikTok API 응답 24시간 캐싱 (재시도 시 재사용)

### 6.5 에러 처리
- TikTok API 실패 → status: FAILED
- AI 분석 실패 → 부분 결과 저장 후 status: COMPLETED
- DB 저장 실패 → 로그 기록 후 status: FAILED

---

## 7. 환경 변수 요약

```env
# TikTok API
RAPIDAPI_KEY=xxx
TIKTOK_RAPIDAPI_KEY=xxx  # 대체 키

# Google AI
GOOGLE_AI_API_KEY=xxx

# Database
DATABASE_URL=postgresql://...
```

---

## 8. 응답 시간 예상

| 단계 | 예상 시간 |
|------|-----------|
| TikTok 사용자 정보 조회 | 1-2초 |
| TikTok 비디오 100개 조회 | 10-30초 |
| 메트릭 계산 | <1초 |
| AI 비디오 분류 | 10-30초 |
| AI 메트릭 분석 | 10-20초 |
| DB 저장 | 1-5초 |
| **총 예상 시간** | **30-90초** |

---

## 9. 프론트엔드 연동

프론트엔드에서는 다음과 같이 연동해야 합니다:

1. `POST /analyze` → analysisId 받기
2. 폴링으로 `GET /{analysisId}` 호출 (3초 간격)
3. status가 `COMPLETED`가 될 때까지 대기
4. 결과 화면에 표시

---

## 10. 파일 참조

현재 구현된 코드 위치:
- API Routes: `app/api/deep-analysis/`
- TikTok Service: `lib/deep-analysis/tiktok-service.ts`
- AI Agents: `lib/agents/deep-analysis/`
- Types: `lib/deep-analysis/types.ts`
