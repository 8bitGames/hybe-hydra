# AI Video 자막 + 음원 가사 추출 구현 계획서

## 개요

### 목표
1. **AI Video에 자막 추가**: 현재 fastcut만 자막을 지원하는데, AI Video에도 자막 기능 추가
2. **음원 가사 추출**: 음원(Asset)에서 가사를 타임스탬프와 함께 추출하여 저장
3. **가사 → 자막 싱크**: 음원 선택 시 저장된 가사가 자막으로 자동 싱크

### 기술 선택
- **가사 추출**: Gemini Audio Understanding API (프로젝트에서 이미 사용 중)
- **저장 위치**: Asset.metadata JSON 필드 (한번 추출 후 캐싱)
- **자막 스타일**: 미리 정의된 SubtitleStyleSet 프리셋 사용

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        가사 + 자막 시스템 아키텍처                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌─────────────────────┐    ┌───────────────────┐  │
│  │   Asset      │───▶│  Gemini Audio API   │───▶│  Asset.metadata   │  │
│  │  (음원 파일)  │    │  가사 추출 + 타임스탬프 │    │  { lyrics: {...} } │  │
│  └──────────────┘    └─────────────────────┘    └─────────┬─────────┘  │
│                                                           │             │
│                                                           ▼             │
│  ┌──────────────┐    ┌─────────────────────┐    ┌───────────────────┐  │
│  │  AI Video    │───▶│  Lyrics → Subtitle  │◀───│  저장된 가사 로드   │  │
│  │  /FastCut    │    │  Converter          │    │                   │  │
│  └──────────────┘    └──────────┬──────────┘    └───────────────────┘  │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    SubtitleStyleSet 적용                          │  │
│  │  • karaoke_sync: 가라오케 스타일 (가사 싱크)                        │  │
│  │  • lyric_fade: 부드러운 가사 페이드                                 │  │
│  │  • bold_lyrics: 강렬한 가사 텍스트                                  │  │
│  │  • minimal_caption: 미니멀 캡션                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                 │                                       │
│                                 ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              FFmpeg ASS 자막 렌더링 (text_overlay.py)              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 데이터 구조

### 1. 가사 데이터 (Asset.metadata.lyrics)

```typescript
interface LyricsData {
  // 메타 정보
  language: 'ko' | 'en' | 'ja' | 'auto';
  extractedAt: string;          // ISO timestamp
  source: 'gemini';             // 추출 소스
  confidence: number;           // 0-1 신뢰도

  // 전체 텍스트
  fullText: string;             // 전체 가사 텍스트

  // 세그먼트 (Gemini는 segment-level timestamps 제공)
  segments: LyricsSegment[];
}

interface LyricsSegment {
  text: string;                 // 세그먼트 텍스트
  start: number;                // 시작 시간 (초)
  end: number;                  // 종료 시간 (초)
}
```

### 2. 자막 엔트리 (SubtitleEntry)

```typescript
interface SubtitleEntry {
  text: string;
  start: number;                // 시작 시간 (초)
  end: number;                  // 종료 시간 (초)
  type?: 'lyrics' | 'hook' | 'verse' | 'chorus' | 'cta';
  styleId?: string;             // SubtitleStyleSet ID
}
```

### 3. 자막 스타일 세트 (SubtitleStyleSet)

```typescript
interface SubtitleStyleSet {
  // 식별
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;

  // 텍스트 스타일
  text: {
    fontStyle: 'bold' | 'modern' | 'minimal' | 'classic';
    fontSize: 'small' | 'medium' | 'large';
    color: string;              // hex color
    strokeColor: string;        // outline color
    strokeWidth: number;
  };

  // 애니메이션
  animation: {
    type: 'fade' | 'typewriter' | 'karaoke' | 'slide_up' | 'scale_pop' | 'bounce';
    inDuration: number;         // 초
    outDuration: number;        // 초
  };

  // 위치
  position: {
    vertical: 'top' | 'center' | 'bottom';
    bottomMargin: number;       // % of screen height
  };

  // 매칭 키워드 (AI 자동 선택용)
  matchKeywords: {
    ko: string[];
    en: string[];
  };

  // UI
  previewColor: string;
  icon: string;
}
```

---

## 자막 스타일 프리셋

### 6가지 자막 스타일 세트

| ID | 이름 | 용도 | 애니메이션 | 위치 |
|----|------|------|-----------|------|
| `karaoke_sync` | 가라오케 싱크 | 음원 가사 싱크 | karaoke | center |
| `lyric_fade` | 리릭 페이드 | 감성적 가사 | fade | bottom |
| `bold_lyrics` | 볼드 리릭스 | 강렬한 가사 강조 | scale_pop | center |
| `minimal_caption` | 미니멀 캡션 | 깔끔한 정보 전달 | fade | bottom |
| `hook_impact` | 훅 임팩트 | 훅/CTA 강조 | bounce | center |
| `story_type` | 스토리 타입 | 타이프라이터 효과 | typewriter | bottom |

### 상세 스타일 정의

```typescript
// 1. 가라오케 싱크 - 음원 가사용
const KARAOKE_SYNC: SubtitleStyleSet = {
  id: 'karaoke_sync',
  name: 'Karaoke Sync',
  nameKo: '가라오케 싱크',
  description: 'Synchronized lyrics with karaoke-style highlight',
  descriptionKo: '가라오케 스타일로 가사가 하이라이트되며 싱크',

  text: {
    fontStyle: 'bold',
    fontSize: 'large',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 3,
  },

  animation: {
    type: 'karaoke',
    inDuration: 0,
    outDuration: 0.1,
  },

  position: {
    vertical: 'center',
    bottomMargin: 40,
  },

  matchKeywords: {
    ko: ['가사', '노래', '뮤직비디오', '음악', '싱크', '가라오케'],
    en: ['lyrics', 'music', 'song', 'mv', 'sync', 'karaoke'],
  },

  previewColor: '#9B59B6',
  icon: '🎤',
};

// 2. 리릭 페이드 - 감성 가사용
const LYRIC_FADE: SubtitleStyleSet = {
  id: 'lyric_fade',
  name: 'Lyric Fade',
  nameKo: '리릭 페이드',
  description: 'Gentle fade for emotional lyrics',
  descriptionKo: '감성적인 가사에 어울리는 부드러운 페이드',

  text: {
    fontStyle: 'minimal',
    fontSize: 'medium',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 2,
  },

  animation: {
    type: 'fade',
    inDuration: 0.4,
    outDuration: 0.4,
  },

  position: {
    vertical: 'bottom',
    bottomMargin: 18,
  },

  matchKeywords: {
    ko: ['감성', '발라드', '슬픈', '서정', '무드'],
    en: ['emotional', 'ballad', 'sad', 'mood', 'soft'],
  },

  previewColor: '#3498DB',
  icon: '🎵',
};

// 3. 볼드 리릭스 - 강렬한 가사용
const BOLD_LYRICS: SubtitleStyleSet = {
  id: 'bold_lyrics',
  name: 'Bold Lyrics',
  nameKo: '볼드 리릭스',
  description: 'Bold, impactful lyrics with pop animation',
  descriptionKo: '강렬한 가사 강조, 팝 애니메이션',

  text: {
    fontStyle: 'bold',
    fontSize: 'large',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 4,
  },

  animation: {
    type: 'scale_pop',
    inDuration: 0.15,
    outDuration: 0.15,
  },

  position: {
    vertical: 'center',
    bottomMargin: 35,
  },

  matchKeywords: {
    ko: ['강렬', '파워풀', '힙합', '랩', '에너지'],
    en: ['bold', 'powerful', 'hiphop', 'rap', 'energy', 'intense'],
  },

  previewColor: '#E74C3C',
  icon: '🔥',
};

// 4. 미니멀 캡션 - 깔끔한 자막용
const MINIMAL_CAPTION: SubtitleStyleSet = {
  id: 'minimal_caption',
  name: 'Minimal Caption',
  nameKo: '미니멀 캡션',
  description: 'Clean, minimal captions for information',
  descriptionKo: '깔끔하고 미니멀한 정보 전달용 자막',

  text: {
    fontStyle: 'modern',
    fontSize: 'medium',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 2,
  },

  animation: {
    type: 'fade',
    inDuration: 0.3,
    outDuration: 0.3,
  },

  position: {
    vertical: 'bottom',
    bottomMargin: 18,
  },

  matchKeywords: {
    ko: ['미니멀', '심플', '깔끔', '정보', '설명'],
    en: ['minimal', 'simple', 'clean', 'info', 'caption'],
  },

  previewColor: '#95A5A6',
  icon: '✨',
};

// 5. 훅 임팩트 - 훅/CTA 강조용
const HOOK_IMPACT: SubtitleStyleSet = {
  id: 'hook_impact',
  name: 'Hook Impact',
  nameKo: '훅 임팩트',
  description: 'Bouncy animation for hooks and CTAs',
  descriptionKo: '훅과 CTA를 위한 바운스 임팩트',

  text: {
    fontStyle: 'bold',
    fontSize: 'large',
    color: '#FFFFFF',
    strokeColor: '#FF0054',
    strokeWidth: 3,
  },

  animation: {
    type: 'bounce',
    inDuration: 0.4,
    outDuration: 0.2,
  },

  position: {
    vertical: 'center',
    bottomMargin: 40,
  },

  matchKeywords: {
    ko: ['훅', '임팩트', '강조', 'CTA', '주목'],
    en: ['hook', 'impact', 'cta', 'attention', 'highlight'],
  },

  previewColor: '#FF006E',
  icon: '💥',
};

// 6. 스토리 타입 - 타이프라이터 효과용
const STORY_TYPE: SubtitleStyleSet = {
  id: 'story_type',
  name: 'Story Type',
  nameKo: '스토리 타입',
  description: 'Typewriter effect for storytelling',
  descriptionKo: '스토리텔링을 위한 타이프라이터 효과',

  text: {
    fontStyle: 'classic',
    fontSize: 'medium',
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 2,
  },

  animation: {
    type: 'typewriter',
    inDuration: 0.5,
    outDuration: 0.2,
  },

  position: {
    vertical: 'bottom',
    bottomMargin: 20,
  },

  matchKeywords: {
    ko: ['스토리', '이야기', '나레이션', '설명', '자막'],
    en: ['story', 'narrative', 'narration', 'caption', 'subtitle'],
  },

  previewColor: '#2ECC71',
  icon: '📝',
};
```

---

## 구현 파일 목록

### 신규 생성 파일

| 파일 경로 | 목적 |
|----------|------|
| `lib/services/lyrics-extractor.ts` | Gemini 가사 추출 서비스 |
| `lib/services/lyrics-to-subtitle.ts` | 가사 → 자막 변환기 |
| `lib/subtitle-styles/types.ts` | 자막 스타일 타입 정의 |
| `lib/subtitle-styles/presets.ts` | 6가지 자막 스타일 프리셋 |
| `lib/subtitle-styles/index.ts` | 자막 스타일 export |
| `app/api/v1/audio/lyrics/route.ts` | 가사 추출 API 엔드포인트 |
| `app/api/v1/audio/[assetId]/lyrics/route.ts` | 가사 조회 API |
| `components/features/lyrics-preview.tsx` | 가사 미리보기 UI |

### 수정 파일

| 파일 경로 | 수정 내용 |
|----------|----------|
| `backend/.../ffmpeg_renderer.py` | script.lines 렌더링 로직 추가 |
| `lib/modal/client.ts` | subtitle style 지원 추가 |
| `app/api/v1/generations/[id]/compose/route.ts` | 자막 옵션 추가 |

---

## API 설계

### 1. 가사 추출 API

```
POST /api/v1/audio/lyrics
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "assetId": "asset-uuid",
  "language": "ko" | "en" | "ja" | "auto"  // optional, default: auto
}

Response:
{
  "success": true,
  "data": {
    "assetId": "asset-uuid",
    "lyrics": {
      "language": "ko",
      "extractedAt": "2025-12-12T10:00:00Z",
      "source": "gemini",
      "confidence": 0.92,
      "fullText": "가사 전체 텍스트...",
      "segments": [
        { "text": "첫 번째 구절", "start": 0.0, "end": 3.5 },
        { "text": "두 번째 구절", "start": 3.5, "end": 7.2 },
        ...
      ]
    },
    "cached": false
  }
}
```

### 2. 가사 조회 API

```
GET /api/v1/audio/{assetId}/lyrics
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "hasLyrics": true,
    "lyrics": { ... }  // LyricsData
  }
}
```

### 3. 자막 스타일 목록 API

```
GET /api/v1/subtitle-styles
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "styles": [
      { "id": "karaoke_sync", "name": "Karaoke Sync", "nameKo": "가라오케 싱크", ... },
      { "id": "lyric_fade", "name": "Lyric Fade", "nameKo": "리릭 페이드", ... },
      ...
    ]
  }
}
```

---

## Gemini 가사 추출 프롬프트

```typescript
const LYRICS_EXTRACTION_PROMPT = `
You are an expert at transcribing song lyrics from audio.

Listen to this audio carefully and transcribe the lyrics with timestamps.

Requirements:
1. Transcribe the lyrics word-by-word
2. Group lyrics into natural phrases/lines
3. Provide timestamps in MM:SS format for each phrase
4. Detect the language (Korean, English, Japanese, or mixed)
5. If instrumental or no vocals, respond with "INSTRUMENTAL"

Output format (JSON):
{
  "language": "ko" | "en" | "ja" | "mixed",
  "isInstrumental": false,
  "confidence": 0.95,
  "segments": [
    {
      "text": "가사 텍스트",
      "startTime": "0:00",
      "endTime": "0:03"
    },
    ...
  ]
}

Notes:
- For Korean lyrics, maintain proper spacing between words
- Include both romanized and original text if mixed language
- Timestamps should align with the actual vocal timing
`;
```

---

## 가사 → 자막 변환 로직

```typescript
async function convertLyricsToSubtitles(
  lyrics: LyricsData,
  options: {
    audioStartTime: number,    // 음원 시작 지점 (초)
    videoDuration: number,     // 비디오 길이 (초)
    styleId: string,           // 자막 스타일 ID
    maxLinesPerScreen?: number, // 기본값: 2
  }
): Promise<SubtitleEntry[]> {

  const { audioStartTime, videoDuration, styleId, maxLinesPerScreen = 2 } = options;

  // 1. 비디오 구간에 해당하는 가사 필터링
  const endTime = audioStartTime + videoDuration;
  const relevantSegments = lyrics.segments.filter(seg =>
    seg.start >= audioStartTime && seg.start < endTime
  );

  // 2. 시간 오프셋 조정 (비디오 시작 = 0초)
  const adjustedSegments = relevantSegments.map(seg => ({
    ...seg,
    start: seg.start - audioStartTime,
    end: seg.end - audioStartTime,
  }));

  // 3. 자막 엔트리로 변환
  const subtitles: SubtitleEntry[] = adjustedSegments.map(seg => ({
    text: seg.text,
    start: seg.start,
    end: Math.min(seg.end, videoDuration),
    type: 'lyrics',
    styleId,
  }));

  // 4. 긴 세그먼트 분할 (최대 4초)
  const MAX_DURATION = 4;
  const splitSubtitles = subtitles.flatMap(sub => {
    if (sub.end - sub.start <= MAX_DURATION) return [sub];
    // 긴 자막은 분할
    const words = sub.text.split(' ');
    const midpoint = Math.floor(words.length / 2);
    const midTime = (sub.start + sub.end) / 2;
    return [
      { ...sub, text: words.slice(0, midpoint).join(' '), end: midTime },
      { ...sub, text: words.slice(midpoint).join(' '), start: midTime },
    ];
  });

  return splitSubtitles;
}
```

---

## 구현 순서

### Phase 1: 기반 작업 (1일)
1. `lib/subtitle-styles/` 자막 스타일 시스템 구현
2. `lib/services/lyrics-extractor.ts` Gemini 가사 추출 서비스
3. 데이터 타입 정의

### Phase 2: API 구현 (1일)
1. `/api/v1/audio/lyrics` 가사 추출 API
2. `/api/v1/audio/[assetId]/lyrics` 가사 조회 API
3. `/api/v1/subtitle-styles` 스타일 목록 API

### Phase 3: 변환 로직 (1일)
1. `lib/services/lyrics-to-subtitle.ts` 변환기
2. FFmpeg 렌더러 script 렌더링 수정
3. Compose API에 자막 옵션 추가

### Phase 4: UI/UX (1일)
1. 가사 추출 버튼 및 진행 상태
2. 가사 미리보기 컴포넌트
3. 자막 스타일 선택 UI

---

## 예상 비용

Gemini Audio Understanding은 현재 프로젝트에서 이미 사용 중이므로 추가 비용 없음.
(기존 Gemini API 사용량에 포함)

---

## 테스트 체크리스트

- [ ] 한국어 가사 추출 정확도 테스트
- [ ] 영어 가사 추출 테스트
- [ ] 인스트루멘탈 감지 테스트
- [ ] 가사 → 자막 변환 타이밍 정확도
- [ ] 6가지 자막 스타일 렌더링 테스트
- [ ] FastCut + 가사 싱크 테스트
- [ ] AI Video + 가사 싱크 테스트

---

## 최종 사용자 플로우

```
1. 음원 Asset 업로드/선택
   ↓
2. [가사 추출] 버튼 클릭
   ↓
3. Gemini Audio API로 가사 + 타임스탬프 추출
   ↓
4. Asset.metadata.lyrics에 저장 (캐싱)
   ↓
5. 비디오 생성 시:
   - 자막 스타일 선택 (6가지 중)
   - 음원 시작점 지정
   ↓
6. 가사 → 자막 자동 변환 (시간 싱크)
   ↓
7. FFmpeg ASS 자막으로 렌더링
   ↓
8. 완성된 비디오에 가사 자막 포함
```

---

*작성일: 2025-12-12*
*작성자: Claude Code*
