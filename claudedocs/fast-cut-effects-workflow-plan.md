# Fast Cut 효과 시스템 워크플로우 계획

## 문제 요약

현재 Fast Cut 비디오 생성 시스템에서 **쉐이더 깨짐** 및 **효과 렌더링 오류**가 발생하고 있습니다.

### 주요 원인
1. **블랙리스트 효과 사용**: slice 계열 효과가 줄무늬 발생
2. **GLSL 쉐이더 불안정**: GPU 의존성, 파일 누락
3. **프론트엔드-백엔드 불일치**: 지원되지 않는 효과 요청

---

## 현재 블랙리스트 효과 (사용 금지)

```python
# backend/compose-engine/app/effects/registry.py
BLACKLISTED_EFFECTS = {
    # Slice 효과 - 줄무늬 발생
    "xfade_hlslice", "xfade_hrslice", "xfade_vuslice", "xfade_vdslice",
    "hlslice", "hrslice", "vuslice", "vdslice",

    # Blur 효과 - 이미지 안보임
    "xfade_hblur", "xfade_vblur", "hblur", "vblur",

    # GLSL 문제
    "gl_burn", "gl_overexposure", "gl_windowslice",

    # 기타
    "rectcrop"  # 줄무늬 발생
}
```

---

## 안정적인 FFmpeg xfade 효과 (권장)

### A. 페이드 계열 (가장 안정)
| 효과명 | 설명 | 권장 스타일 |
|--------|------|------------|
| `fade` | 기본 페이드 | 모든 스타일 |
| `fadeblack` | 검은 배경 페이드 | Cinematic, Professional |
| `fadewhite` | 흰 배경 페이드 | Dreamy, Clean |
| `fadegrays` | 그레이스케일 페이드 | Retro, Professional |

### B. 와이프 계열 (깔끔한 전환)
| 효과명 | 설명 | 권장 스타일 |
|--------|------|------------|
| `wipeleft` | 왼쪽으로 닦기 | Viral, Energetic |
| `wiperight` | 오른쪽으로 닦기 | Viral, Energetic |
| `wipeup` | 위로 닦기 | Bold Impact |
| `wipedown` | 아래로 닦기 | Bold Impact |

### C. 슬라이드 계열 (동적 전환)
| 효과명 | 설명 | 권장 스타일 |
|--------|------|------------|
| `slideleft` | 왼쪽 슬라이드 | Viral, Energetic |
| `slideright` | 오른쪽 슬라이드 | Viral, Energetic |
| `slideup` | 위로 슬라이드 | Bold Impact |
| `slidedown` | 아래로 슬라이드 | Bold Impact |

### D. 원형/기하학적 (임팩트)
| 효과명 | 설명 | 권장 스타일 |
|--------|------|------------|
| `circleclose` | 원형 닫힘 | Bold Impact, Viral |
| `circleopen` | 원형 열림 | Energetic |
| `radial` | 방사형 | Energetic, Bold |

### E. 부드러운 전환
| 효과명 | 설명 | 권장 스타일 |
|--------|------|------------|
| `smoothleft` | 부드러운 왼쪽 | Professional |
| `smoothright` | 부드러운 오른쪽 | Professional |
| `dissolve` | 디졸브 | Cinematic, Dreamy |
| `pixelize` | 픽셀화 | Retro |

### F. 대각선 전환
| 효과명 | 설명 | 권장 스타일 |
|--------|------|------------|
| `diagtl` | 대각선 좌상단 | Modern |
| `diagtr` | 대각선 우상단 | Modern |
| `diagbl` | 대각선 좌하단 | Modern |
| `diagbr` | 대각선 우하단 | Modern |

---

## 스타일별 권장 효과 매핑

### 1. Viral TikTok (바이럴 틱톡)
```typescript
{
  transitions: ["wipeleft", "slideright", "circleclose", "radial"],
  transitionDuration: 0.3,
  motions: ["zoom_in", "shake", "pulse"],
  colorGrade: "vibrant"
}
```

### 2. Cinematic Mood (시네마틱 무드)
```typescript
{
  transitions: ["fade", "fadeblack", "dissolve"],
  transitionDuration: 2.0,
  motions: ["ken_burns", "subtle_zoom"],
  colorGrade: "cinematic"
}
```

### 3. Clean Minimal (클린 미니멀)
```typescript
{
  transitions: ["fade", "wipeleft", "wiperight"],
  transitionDuration: 1.5,
  motions: ["subtle_zoom"],
  colorGrade: "natural"
}
```

### 4. Energetic Beat (에너제틱 비트)
```typescript
{
  transitions: ["slideright", "slideleft", "circleopen", "radial"],
  transitionDuration: 0.4,
  motions: ["pulse", "shake", "zoom_in"],
  colorGrade: "vibrant"
}
```

### 5. Retro Aesthetic (레트로 감성)
```typescript
{
  transitions: ["fade", "dissolve", "pixelize"],
  transitionDuration: 1.0,
  motions: ["ken_burns", "subtle_zoom"],
  colorGrade: "moody"
}
```

### 6. Professional (프로페셔널)
```typescript
{
  transitions: ["fade", "dissolve", "smoothleft", "smoothright"],
  transitionDuration: 1.8,
  motions: ["subtle_zoom"],
  colorGrade: "cinematic"
}
```

### 7. Dreamy Soft (드리미 소프트)
```typescript
{
  transitions: ["fade", "fadewhite", "dissolve"],
  transitionDuration: 2.0,
  motions: ["ken_burns", "subtle_zoom"],
  colorGrade: "bright"
}
```

### 8. Bold Impact (볼드 임팩트)
```typescript
{
  transitions: ["circleclose", "radial", "wipedown"],
  transitionDuration: 0.5,
  motions: ["zoom_in", "shake", "pulse"],
  colorGrade: "moody"
}
```

---

## FFmpeg 명령어 참조

### 기본 xfade 트랜지션
```bash
# fade 트랜지션 (2초 길이, 5초 지점에서 시작)
ffmpeg -i first.mp4 -i second.mp4 \
  -filter_complex "xfade=transition=fade:duration=2:offset=5" \
  output.mp4

# circleclose 트랜지션
ffmpeg -i first.mp4 -i second.mp4 \
  -filter_complex "xfade=transition=circleclose:duration=1:offset=3" \
  output.mp4

# slideright 트랜지션 (빠른 전환)
ffmpeg -i first.mp4 -i second.mp4 \
  -filter_complex "xfade=transition=slideright:duration=0.5:offset=2" \
  output.mp4
```

### 여러 이미지 연결
```bash
# 3개 이미지를 fade로 연결
ffmpeg -loop 1 -t 3 -i img1.jpg \
       -loop 1 -t 3 -i img2.jpg \
       -loop 1 -t 3 -i img3.jpg \
  -filter_complex \
    "[0:v][1:v]xfade=transition=fade:duration=1:offset=2[v01]; \
     [v01][2:v]xfade=transition=fade:duration=1:offset=4[outv]" \
  -map "[outv]" output.mp4
```

### 색보정 필터
```bash
# vibrant (채도 높임)
ffmpeg -i input.mp4 -vf "eq=saturation=1.3:contrast=1.1" output.mp4

# cinematic (따뜻한 톤, 대비 강화)
ffmpeg -i input.mp4 -vf "colorbalance=rs=0.1:gs=-0.05:bs=-0.1,eq=contrast=1.2" output.mp4

# moody (어두운 톤)
ffmpeg -i input.mp4 -vf "eq=brightness=-0.1:contrast=1.2:saturation=0.8" output.mp4
```

---

## 구현 계획

### Phase 1: 프론트엔드 프리셋 수정

**파일**: `lib/fast-cut/style-sets/presets.ts`

```typescript
// 변경 전 (문제 있음)
transitions: ['zoom', 'glitch', 'slide'],

// 변경 후 (안정적)
transitions: ['wipeleft', 'slideright', 'circleclose'],
```

### Phase 2: 백엔드 안전 효과 적용

**파일**: `backend/compose-engine/app/effects/safe_effects.py` (신규)

```python
"""안전한 효과 레지스트리"""

SAFE_XFADE_TRANSITIONS = [
    # 페이드 계열
    "fade", "fadeblack", "fadewhite", "fadegrays",
    # 와이프 계열
    "wipeleft", "wiperight", "wipeup", "wipedown",
    # 슬라이드 계열
    "slideleft", "slideright", "slideup", "slidedown",
    # 원형/기하학적
    "circleclose", "circleopen", "radial",
    # 부드러운 전환
    "smoothleft", "smoothright", "dissolve", "pixelize",
    # 대각선
    "diagtl", "diagtr", "diagbl", "diagbr"
]

def get_safe_transition(requested: str) -> str:
    """안전한 트랜지션 반환, 블랙리스트는 fallback"""
    from .registry import BLACKLISTED_EFFECTS

    if requested in BLACKLISTED_EFFECTS:
        return "fade"
    if requested not in SAFE_XFADE_TRANSITIONS:
        return "fade"
    return requested
```

### Phase 3: 프론트엔드-백엔드 매핑

**효과 이름 변환 테이블**:
| 프론트엔드 | 백엔드 xfade |
|-----------|-------------|
| `zoom` | `circleclose` |
| `glitch` | `pixelize` |
| `slide` | `slideright` |
| `fade` | `fade` |
| `dissolve` | `dissolve` |
| `crossfade` | `fade` |
| `wipe` | `wipeleft` |
| `flash` | `fadewhite` |
| `slam` | `circleclose` |
| `vhs` | `pixelize` |
| `blur` | `fade` |

---

## 테스트 체크리스트

### 각 스타일 세트별 테스트
- [ ] Viral TikTok: 빠른 전환, 줄무늬 없음
- [ ] Cinematic Mood: 느린 fade, 부드러운 전환
- [ ] Clean Minimal: 깔끔한 전환
- [ ] Energetic Beat: 비트 싱크 동작
- [ ] Retro Aesthetic: 픽셀화 효과 정상
- [ ] Professional: 세련된 전환
- [ ] Dreamy Soft: 부드러운 페이드
- [ ] Bold Impact: 강한 임팩트 효과

### 렌더링 품질 테스트
- [ ] 이미지 간 전환 시 깨짐 없음
- [ ] 색보정 정상 적용
- [ ] 오디오 싱크 정상
- [ ] 최종 비디오 파일 정상 재생

---

## 예상 결과

1. **쉐이더 깨짐 100% 해결**: GLSL 효과 제거, FFmpeg xfade만 사용
2. **안정성 향상**: 검증된 효과만 사용
3. **GPU 의존성 제거**: CPU에서도 동일한 결과
4. **성능 개선**: FFmpeg 파이프라인이 MoviePy보다 3배 빠름

---

## 참고 문서

- [FFmpeg xfade 공식 문서](https://ffmpeg.org/ffmpeg-all.html#xfade)
- [Remotion Transitions](https://www.remotion.dev/docs/transitions)
- 내부 문서: `backend/compose-engine/app/effects/registry.py`
