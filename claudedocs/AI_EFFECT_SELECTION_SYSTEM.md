# AI 기반 영상 효과 선택 시스템 개발 계획

## 개요

프롬프트 기반으로 영상 컨셉에 맞는 효과를 자동 선택하는 시스템

### 목표
- GL Transitions (80+), FFmpeg xfade (44개), Custom 효과를 통합 관리
- AI가 프롬프트를 분석하여 적합한 효과 자동 추천
- 현재 compose-engine과 seamless 통합

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Effect Selection System                          │
│                                                                     │
│   사용자 프롬프트                                                    │
│   "신나는 K-POP 댄스 영상, 빠른 비트에 맞춰 화려한 전환"              │
│                          │                                          │
│                          ▼                                          │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  1. Prompt Analyzer (Gemini)                             │     │
│   │     → mood: [energetic, dynamic]                         │     │
│   │     → genre: [kpop, dance]                               │     │
│   │     → intensity: high                                    │     │
│   │     → keywords: [빠른, 화려한, 댄스, 비트]                 │     │
│   └──────────────────────────────────────────────────────────┘     │
│                          │                                          │
│                          ▼                                          │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  2. Effects Registry (150+ 효과)                         │     │
│   │     ├─ GL Transitions: 80개                              │     │
│   │     ├─ FFmpeg xfade: 44개                                │     │
│   │     └─ Custom/Remotion: 26개                             │     │
│   └──────────────────────────────────────────────────────────┘     │
│                          │                                          │
│                          ▼                                          │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  3. Effect Selector (하이브리드)                          │     │
│   │     ├─ 규칙 기반 필터링 → 후보 30개                        │     │
│   │     └─ LLM 최종 선택 → 5-10개 효과 조합                    │     │
│   └──────────────────────────────────────────────────────────┘     │
│                          │                                          │
│                          ▼                                          │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  4. Renderer Adapter                                     │     │
│   │     ├─ GL Transition Renderer (GPU)                      │     │
│   │     ├─ FFmpeg xfade Renderer                             │     │
│   │     └─ MoviePy Renderer (기존)                           │     │
│   └──────────────────────────────────────────────────────────┘     │
│                          │                                          │
│                          ▼                                          │
│                   🎥 Final Video                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 데이터 구조

### EffectMetadata 스키마

```typescript
interface EffectMetadata {
  // 식별
  id: string;                    // "gl_crosswarp", "xfade_circleopen"
  name: string;                  // "Crosswarp", "Circle Open"
  source: 'gl-transitions' | 'ffmpeg-xfade' | 'remotion' | 'moviepy';
  type: 'transition' | 'motion' | 'filter' | 'text';

  // AI 매칭용 시맨틱 태그
  mood: string[];               // ['energetic', 'calm', 'dramatic', ...]
  genre: string[];              // ['kpop', 'hiphop', 'emotional', ...]
  intensity: 'low' | 'medium' | 'high';

  // AI 매칭용 설명
  description: string;          // 효과 설명 (영문)
  description_ko: string;       // 효과 설명 (한글)
  keywords: string[];           // 매칭 키워드

  // 기술적 속성
  duration_range: [number, number];  // 권장 지속시간 (초)
  gpu_required: boolean;
  params: Record<string, ParamDef>;  // 효과별 파라미터

  // 호환성
  compatible_with: string[];    // 함께 쓰기 좋은 효과
  conflicts_with: string[];     // 충돌하는 효과

  // 렌더링 정보
  render_info: {
    glsl_file?: string;         // GL Transitions용
    ffmpeg_filter?: string;     // FFmpeg용
    moviepy_func?: string;      // MoviePy용
  };
}
```

### Mood 분류 체계

| Mood | 설명 | 대표 효과 |
|------|------|----------|
| energetic | 에너지 넘치는, 활발한 | crosswarp, pixelize, glitch |
| calm | 차분한, 평온한 | fade, dissolve, dreamy |
| dramatic | 극적인, 임팩트 있는 | circleopen, doorway, cube |
| playful | 장난스러운, 재미있는 | bounce, squeeze, swirl |
| elegant | 우아한, 세련된 | crossfade, radial, wipe |
| romantic | 로맨틱한, 감성적인 | dreamy, blur, fade |
| dark | 어두운, 무거운 | fadeblack, morph, displacement |
| bright | 밝은, 경쾌한 | fadewhite, zoomin, slide |

### Genre 분류 체계

| Genre | 설명 | 추천 효과 스타일 |
|-------|------|-----------------|
| kpop | K-POP 뮤직비디오 | 빠른 전환, 화려한 효과 |
| hiphop | 힙합/랩 | 글리치, 픽셀화, 강렬한 컷 |
| emotional | 감성/발라드 | 부드러운 페이드, 크로스페이드 |
| corporate | 기업/비즈니스 | 깔끔한 와이프, 슬라이드 |
| tiktok | TikTok 숏폼 | 트렌디한 전환, 빠른 페이스 |
| cinematic | 시네마틱/영화 | 극적인 전환, 블러 효과 |
| vlog | 브이로그 | 자연스러운 전환, 밝은 톤 |
| documentary | 다큐멘터리 | 클래식한 전환, 서클 |

---

## API 설계

### 1. 효과 목록 조회

```
GET /api/v1/effects
Query: ?source=gl-transitions&type=transition&mood=energetic
```

### 2. AI 효과 선택 (핵심)

```
POST /api/v1/effects/select

Request:
{
  "prompt": "신나는 K-POP 댄스 영상, 빠른 비트에 맞춰 화려한 전환",
  "audio_bpm": 128,
  "image_count": 8,
  "duration": 15,
  "preferences": {
    "intensity": "high",
    "sources": ["gl-transitions", "ffmpeg-xfade"]
  }
}

Response:
{
  "analysis": {
    "detected_mood": ["energetic", "dynamic"],
    "detected_genre": ["kpop", "dance"],
    "detected_keywords": ["빠른", "화려한", "댄스", "비트"],
    "suggested_intensity": "high",
    "reasoning": "K-POP 댄스 영상에 맞춰 에너지틱한 트랜지션 선택..."
  },
  "selected_effects": {
    "transitions": [...],
    "motions": [...],
    "filters": [...],
    "text_animations": [...]
  }
}
```

---

## 파일 구조

```
hybe-hydra/
├── lib/
│   └── effects/
│       ├── types.ts              # 효과 타입 정의
│       ├── effects-api.ts        # API 클라이언트
│       └── use-effects.ts        # React 훅
│
├── app/api/v1/effects/
│   ├── route.ts                  # GET: 효과 목록
│   └── select/
│       └── route.ts              # POST: AI 효과 선택
│
└── backend/compose-engine/
    └── app/
        ├── effects/
        │   ├── registry.py       # 효과 레지스트리
        │   ├── analyzer.py       # 프롬프트 분석
        │   ├── selector.py       # 효과 선택 로직
        │   └── renderers/
        │       ├── gl_renderer.py
        │       ├── xfade_renderer.py
        │       └── adapter.py
        │
        └── data/
            └── effects_catalog.json
```

---

## 개발 단계

### Phase 1: 효과 카탈로그 구축 ✅ 완료
- [x] 문서 작성
- [x] GL Transitions 56개 메타데이터 수집
- [x] FFmpeg xfade 39개 메타데이터 수집
- [x] 커스텀 효과 정의 (motion 6개, filter 8개, text 4개)
- [x] Mood/Genre/Keywords 태깅
- [x] effects_catalog.json 통합 (총 113개 효과)

### Phase 2: AI 선택 시스템 ✅ 완료
- [x] 효과 레지스트리 구현 (`registry.py`)
- [x] 프롬프트 분석기 구현 (`analyzer.py` - Gemini)
- [x] 효과 선택기 구현 (`selector.py`)
- [x] Effect Select API (`/api/v1/effects/select`)

### Phase 3: 렌더러 통합 ✅ 완료
- [x] FFmpeg xfade 렌더러 (`xfade_renderer.py`)
- [x] 렌더러 어댑터 (`adapter.py`)
- [x] GL Transitions 의존성 추가 (Modal/Dockerfile)
- [x] GL Transitions → xfade 폴백 매핑 구현

### Phase 3.5: video_renderer.py 통합 ✅ 완료
- [x] RenderSettings 모델에 AI 효과 필드 추가
  - `use_ai_effects: bool` - AI 효과 사용 여부
  - `ai_prompt: Optional[str]` - AI 효과 선택용 프롬프트
  - `ai_effects: Optional[AIEffectSelection]` - 사전 선택된 효과
- [x] AIEffectSelection 모델 추가
- [x] video_renderer.py Step 6에 AI 전환 효과 적용
- [x] `_apply_ai_transitions()` 메서드 구현
- [x] `_get_ai_effects()` 메서드 구현
- [x] Fallback 분석기 (`_create_fallback_analysis()`) 구현

### Phase 4: Frontend 통합 ✅ 완료
- [x] `lib/effects-api.ts` - Frontend API 클라이언트
- [x] Next.js API 라우트 (`/api/v1/effects/*`)
- [x] `lib/compose-api.ts` - AI 효과 필드 추가
- [x] Modal 클라이언트에 AI 효과 필드 추가
- [ ] 효과 선택 UI 컴포넌트 (추후 구현)
- [ ] 효과 미리보기 (추후 구현)

### Phase 5: 최적화 (미구현)
- [ ] 캐싱 구현
- [ ] 성능 최적화
- [ ] GL Transitions 네이티브 렌더러 (ffmpeg-gl-transition 빌드)

---

## 사용 방법

### video_renderer.py 통합 (권장)

```python
from app.models.render_job import RenderRequest, RenderSettings, AIEffectSelection

# 방법 1: AI 프롬프트로 자동 선택
request = RenderRequest(
    job_id="job123",
    images=[...],
    audio=AudioData(...),
    settings=RenderSettings(
        use_ai_effects=True,
        ai_prompt="신나는 K-POP 댄스 영상, 화려한 전환",
        # vibe, effect_preset 등은 폴백용
    ),
    output=OutputSettings(...)
)

# 방법 2: 사전 선택된 효과 사용
request = RenderRequest(
    job_id="job123",
    images=[...],
    audio=AudioData(...),
    settings=RenderSettings(
        use_ai_effects=True,
        ai_effects=AIEffectSelection(
            transitions=["gl_crosswarp", "xfade_pixelize", "gl_cube"],
            motions=["motion_zoom_in"],
            filters=["filter_vibrant"]
        )
    ),
    output=OutputSettings(...)
)

# 렌더링
renderer = VideoRenderer()
s3_url = await renderer.render(request)
```

### Python (compose-engine)

```python
from app.effects import (
    get_registry,
    PromptAnalysis,
    EffectSelector,
    SelectionConfig,
    get_renderer
)

# 1. 프롬프트 분석 (Gemini 사용)
from app.effects.analyzer import get_analyzer
analyzer = get_analyzer()
analysis = await analyzer.analyze("신나는 K-POP 댄스 영상")

# 2. 효과 선택
selector = EffectSelector()
config = SelectionConfig(num_transitions=5, prefer_gpu=True)
selected = selector.select(analysis, config)

print(selected.to_ids())
# {'transitions': ['gl_crosswarp', 'gl_pixelize', ...],
#  'motions': ['motion_zoom_in'],
#  'filters': ['filter_vibrant']}

# 3. 렌더러로 적용
renderer = get_renderer()
result = renderer.apply_transitions_to_clips(
    clips=moviepy_clips,
    transitions=[TransitionSpec(e.id, 0.5) for e in selected.transitions],
    temp_dir="/tmp/job123"
)
```

### API 사용

```bash
# 효과 선택
curl -X POST http://localhost:8000/api/v1/effects/select \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "신나는 K-POP 댄스 영상",
    "audio_bpm": 128,
    "image_count": 8
  }'

# 효과 목록 조회
curl "http://localhost:8000/api/v1/effects?type=transition&mood=energetic"

# 효과 검색
curl "http://localhost:8000/api/v1/effects/search?q=zoom"
```

---

## 기술적 고려사항

### GL Transitions 통합
- Modal Dockerfile에 ffmpeg-gl-transition 빌드 추가
- 폴백: GL 실패 시 → FFmpeg xfade → MoviePy

### 하위 호환성
```python
class RenderSettings(BaseModel):
    # 기존 필드 유지
    vibe: Optional[VibeType] = None

    # 새 필드 추가
    use_ai_effects: bool = False  # 기본값 false
    selected_effects: Optional[SelectedEffects] = None
```

### 성능 최적화
- 카탈로그 캐싱 (서버 시작 시 메모리 로드)
- AI 응답 캐싱 (Redis, TTL: 1시간)
- GPU 활용 (GL Transitions + NVENC)

---

## 참고 자료

- [GL Transitions](https://gl-transitions.com/)
- [ffmpeg-gl-transition](https://github.com/transitive-bullshit/ffmpeg-gl-transition)
- [FFmpeg xfade filter](https://ffmpeg.org/ffmpeg-filters.html#xfade)
- [Movis](https://github.com/rezoo/movis)
