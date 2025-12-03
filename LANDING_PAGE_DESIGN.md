# HYDRA Enterprise Landing Page - Design Document

## Overview

**Target Audience:** Enterprise brands, agencies, marketing teams who need to produce video content at scale with their own IP and contextual awareness.

**Core Message:** "AI가 만드는 수천 개의 브랜드 영상, 단 몇 분 만에" (Thousands of brand videos created by AI, in just minutes)

**Design Philosophy:** Minimal, premium, high-contrast black & white with subtle animations. Clean typography that conveys trust and sophistication.

---

## Brand Assets

### Logo
- **File:** `/public/logo.png` and `/public/logo.svg`
- **Design:** Multi-headed Hydra dragon silhouette with "HYDRA" wordmark
- **Usage:** Black on white backgrounds, White (inverted) on black backgrounds
- **Minimum size:** 120px width for digital
- **Clear space:** Minimum 16px on all sides

```
┌─────────────────────────────────┐
│                                 │
│         🐉🐉🐉                  │
│          (Hydra icon)           │
│                                 │
│          HYDRA                  │
│                                 │
└─────────────────────────────────┘
```

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js (existing project) |
| Styling | Tailwind CSS v4 |
| UI Components | Radix UI + shadcn/ui |
| Icons | Phosphor Icons |
| Animations | Framer Motion |
| Fonts | Geist (headings/UI) + Noto Sans KR (Korean body) |
| Colors | Black (#000), White (#fff), Grays (zinc scale) |

---

## Color Palette

```
Primary:
- Black: #000000 (backgrounds, primary text)
- White: #FFFFFF (backgrounds, inverse text)

Grays (Zinc scale):
- zinc-50:  #fafafa (subtle backgrounds)
- zinc-100: #f4f4f5 (cards, borders)
- zinc-200: #e4e4e7 (borders)
- zinc-300: #d4d4d8 (disabled states)
- zinc-400: #a1a1aa (secondary text)
- zinc-500: #71717a (muted text)
- zinc-600: #52525b (body text on light)
- zinc-700: #3f3f46 (dark surfaces)
- zinc-800: #27272a (dark cards)
- zinc-900: #18181b (dark backgrounds)
- zinc-950: #09090b (deepest black)

Accent (minimal use):
- Single accent for CTAs: White on black, Black on white
```

---

## Typography

```css
/* Geist - Headlines, UI elements, English */
--font-geist: 'Geist', system-ui, sans-serif;

/* Noto Sans KR - Korean text, body copy */
--font-noto: 'Noto Sans KR', sans-serif;

/* Scale */
Display: 72px / 80px (hero)
H1: 56px / 64px
H2: 40px / 48px
H3: 28px / 36px
H4: 20px / 28px
Body Large: 18px / 28px
Body: 16px / 24px
Small: 14px / 20px
Caption: 12px / 16px
```

---

## Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  NAVIGATION (sticky)                                            │
│  Logo | Features | How It Works | Use Cases | Contact | [KR/EN] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HERO SECTION                                                   │
│  ═══════════════════════════════════════════════════════════    │
│  "AI가 만드는 수천 개의 브랜드 영상"                               │
│  "단 몇 분 만에"                                                 │
│                                                                 │
│  Subheadline explaining the value prop                          │
│  [데모 요청] [더 알아보기]                                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Video/Image showcase - abstract visualization of       │   │
│  │  multiple videos being generated                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PROBLEM STATEMENT                                              │
│  ═══════════════════════════════════════════════════════════    │
│  "매일 수백 개의 콘텐츠가 필요합니다.                               │
│   하지만 제작 시간은 항상 부족합니다."                              │
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  Pain   │  │  Pain   │  │  Pain   │  │  Pain   │            │
│  │ Point 1 │  │ Point 2 │  │ Point 3 │  │ Point 4 │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CORE FEATURES (6 pillars)                                      │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ FEATURE 1: 트렌드 인텔리전스                              │   │
│  │ Social Media Research Tool                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ FEATURE 2: 브랜드 IP 통합                                │   │
│  │ Your IP, Your Videos                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ FEATURE 3: 대량 생성                                     │   │
│  │ Scale to Thousands                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ FEATURE 4: 원클릭 배포                                   │   │
│  │ Publish Everywhere                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ FEATURE 5: 하이퍼 개인화 & 지역화                         │   │
│  │ Hyperpersonalization & Localization                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ FEATURE 6: AEO/GEO 최적화                               │   │
│  │ Viral Copy Optimization                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HOW IT WORKS                                                   │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  "4단계로 완성되는 콘텐츠 자동화"                                  │
│                                                                 │
│  [1]──────[2]──────[3]──────[4]                                 │
│  연구      생성      검토      배포                               │
│  Research  Create   Review   Publish                            │
│                                                                 │
│  Each step expands on hover/click with detail                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  USE CASES                                                      │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  "어떤 브랜드든, 어떤 규모든"                                      │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │ 엔터테인먼트    │  │ 이커머스       │  │ 에이전시       │       │
│  │ Entertainment │  │ E-commerce    │  │ Agency        │       │
│  │               │  │               │  │               │       │
│  │ Use case      │  │ Use case      │  │ Use case      │       │
│  │ description   │  │ description   │  │ description   │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CAPABILITIES GRID                                              │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Grid of specific capabilities with icons                       │
│  - AI 프롬프트 최적화                                            │
│  - 트렌드 키워드 자동 적용                                        │
│  - 스타일 프리셋 라이브러리                                       │
│  - 멀티 플랫폼 동시 배포                                          │
│  - 실시간 성과 분석                                              │
│  - 팀 협업 워크플로우                                            │
│  - 브랜드 가이드라인 준수                                         │
│  - API 연동                                                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FINAL CTA                                                      │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  "지금 바로 시작하세요"                                           │
│  "Start Creating Today"                                         │
│                                                                 │
│  Brief value recap                                              │
│                                                                 │
│  [데모 예약하기]  [문의하기]                                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FOOTER                                                         │
│  ─────────────────────────────────────────────────────────      │
│  Logo | Links | Legal | Language Selector                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Section Details

### 1. Navigation

**Layout:** Sticky top, blur backdrop, subtle border bottom
**Content:**
- Logo (left)
- Nav links: 기능 | 작동 방식 | 활용 사례 | 문의
- Language toggle: KR / EN (right)
- CTA button: 데모 요청 (right)

**Behavior:**
- Shrinks slightly on scroll
- Background blur increases on scroll
- Smooth scroll to sections

---

### 2. Hero Section

**Background:** Pure black (#000)
**Text:** White

**Content (Korean):**
```
주요 헤드라인:
"AI가 만드는 수천 개의 브랜드 영상"
"단 몇 분 만에"

서브헤드라인:
"트렌드 분석부터 대량 생성, 멀티 플랫폼 배포까지.
브랜드의 IP를 활용한 맞춤형 영상 콘텐츠를 자동으로 제작합니다."

CTA:
[데모 요청하기] (primary - white bg, black text)
[더 알아보기] (secondary - outline)
```

**Content (English):**
```
Main headline:
"Thousands of Brand Videos"
"Created by AI in Minutes"

Subheadline:
"From trend analysis to mass generation and multi-platform publishing.
Automatically create custom video content using your brand's IP."

CTA:
[Request Demo] (primary)
[Learn More] (secondary)
```

**Visual Element:**
- Abstract grid showing multiple video thumbnails generating
- Staggered animation as videos "appear"
- Stock image suggestion: Multiple phone screens showing short videos, or abstract data visualization

**Animation:**
- Text fades in with slight upward motion (stagger each line)
- Grid animates in with stagger effect
- Subtle particle or grid background animation

---

### 3. Problem Statement

**Background:** White
**Text:** Black

**Content (Korean):**
```
헤드라인:
"매일 수백 개의 콘텐츠가 필요합니다.
하지만 제작 시간은 항상 부족합니다."

Pain Points:
1. 트렌드 파악의 어려움
   "지금 무엇이 유행인지 파악하는 데만 몇 시간이 걸립니다"

2. 반복적인 제작 작업
   "비슷한 영상을 수십 개 만들어야 할 때의 비효율"

3. 브랜드 일관성 유지
   "대량 제작 시 브랜드 가이드라인을 지키기 어렵습니다"

4. 플랫폼별 최적화
   "TikTok, Instagram, YouTube마다 다른 포맷이 필요합니다"
```

**Layout:**
- Centered headline
- 4 cards in a row (responsive: 2x2 on tablet, stack on mobile)
- Each card has icon + title + description

**Animation:**
- Cards stagger in from bottom as they enter viewport

---

### 4. Core Features (4 Pillars)

Alternating layout: Image left/right

#### Feature 1: 트렌드 인텔리전스 (Trend Intelligence)

**Content (Korean):**
```
Label: 소셜 리서치
Title: 트렌드 인텔리전스
Subtitle: "지금 뜨는 것을 먼저 아는 것이 경쟁력입니다"

Description:
"TikTok, Instagram에서 실시간으로 트렌드를 수집하고 분석합니다.
해시태그 전략, 영상 스타일, 컬러 팔레트까지 AI가 분석하여
가장 효과적인 콘텐츠 방향을 제시합니다."

Bullets:
• 실시간 해시태그 트렌드 분석
• AI 기반 영상 스타일 분석
• 트렌드 키워드 자동 추천
```

**Visual:** Stock image of data dashboard / analytics visualization

---

#### Feature 2: 브랜드 IP 통합 (Brand IP Integration)

**Content (Korean):**
```
Label: IP 보호
Title: 브랜드 IP 통합
Subtitle: "당신의 IP가 영상의 중심이 됩니다"

Description:
"로고, 제품 이미지, 음원, 브랜드 가이드라인을 업로드하면
AI가 이를 학습하여 브랜드 정체성을 유지한 영상을 생성합니다.
굿즈, 앨범, 의류 등 제품을 자연스럽게 영상에 통합합니다."

Bullets:
• 브랜드 에셋 라이브러리 관리
• 제품 이미지 자동 통합
• 브랜드 가이드라인 준수 검증
```

**Visual:** Stock image showing brand assets / product photography

---

#### Feature 3: 대량 생성 (Mass Generation)

**Content (Korean):**
```
Label: 스케일
Title: 대량 생성
Subtitle: "수백, 수천 개의 영상을 동시에"

Description:
"하나의 컨셉으로 수백 가지 변형을 자동 생성합니다.
스타일, 음악, 제품, 텍스트를 조합하여
테스트할 수 있는 무한한 변형을 만들어냅니다."

Bullets:
• 배치 생성으로 대량 제작
• 스타일 프리셋 일괄 적용
• 자동 품질 스코어링
```

**Visual:** Stock image showing grid of video variations / multiple screens

---

#### Feature 4: 원클릭 배포 (One-Click Publishing)

**Content (Korean):**
```
Label: 자동화
Title: 원클릭 배포
Subtitle: "모든 플랫폼에 동시에"

Description:
"TikTok, Instagram, YouTube에 직접 연결하여
예약 발행, 자동 배포, 성과 추적까지 한 곳에서 관리합니다.
플랫폼별 최적 포맷으로 자동 변환됩니다."

Bullets:
• 멀티 플랫폼 동시 배포
• 스케줄링 및 자동 발행
• 실시간 성과 동기화
```

**Visual:** Stock image showing social media platforms / scheduling interface

---

#### Feature 5: 하이퍼 개인화 & 지역화 (Hyperpersonalization & Localization)

**Content (Korean):**
```
Label: 글로벌 타겟팅
Title: 하이퍼 개인화 & 지역화
Subtitle: "타겟 지역의 트렌드가 곧 당신의 콘텐츠가 됩니다"

Description:
"미국, 일본, 동남아 등 타겟 시장의 로컬 트렌드를 실시간으로 수집합니다.
각 지역에서 실제로 바이럴되는 콘텐츠를 분석하여
해당 문화와 취향에 맞는 맞춤형 영상을 자동 생성합니다."

Bullets:
• 국가별/지역별 트렌드 수집
• 로컬 해시태그 & 키워드 자동 적용
• 문화권별 콘텐츠 스타일 최적화
```

**Content (English):**
```
Label: Global Targeting
Title: Hyperpersonalization & Localization
Subtitle: "Local trends become your content"

Description:
"Collect real-time local trends from target markets like US, Japan, Southeast Asia.
Analyze what's actually going viral in each region and automatically
generate videos tailored to local culture and preferences."

Bullets:
• Region-specific trend collection
• Auto-apply local hashtags & keywords
• Culture-optimized content styles
```

**Visual:** Stock image showing world map with data points / global connectivity

---

#### Feature 6: AEO/GEO 최적화 (AEO/GEO Optimization)

**Content (Korean):**
```
Label: 바이럴 최적화
Title: AEO/GEO 최적화 카피
Subtitle: "알고리즘이 선택하는 콘텐츠를 만듭니다"

Description:
"AI가 각 플랫폼의 알고리즘 패턴을 분석하여
검색 최적화(AEO)와 지역 최적화(GEO)가 적용된 카피를 자동 생성합니다.
해시태그, 캡션, 키워드가 바이럴을 위해 완벽하게 최적화됩니다."

Bullets:
• AI 기반 바이럴 카피 생성
• 플랫폼별 알고리즘 최적화
• 검색/추천 노출 극대화
```

**Content (English):**
```
Label: Viral Optimization
Title: AEO/GEO Optimized Copy
Subtitle: "Create content the algorithm chooses"

Description:
"AI analyzes each platform's algorithm patterns to automatically generate
AEO (Algorithm Engine Optimization) and GEO (Geographic Engine Optimization) copy.
Hashtags, captions, and keywords perfectly optimized for viral potential."

Bullets:
• AI-powered viral copy generation
• Platform algorithm optimization
• Maximize search & recommendation exposure
```

**Visual:** Stock image showing SEO/analytics metrics rising / growth charts

---

### 5. How It Works

**Background:** Black
**Text:** White

**Content (Korean):**
```
Label: 프로세스
Title: "4단계로 완성되는 콘텐츠 자동화"

Steps:
1. 연구 (Research)
   "트렌드 분석 및 전략 수립"
   "AI가 현재 트렌드를 분석하고 최적의 콘텐츠 방향을 제안합니다"

2. 생성 (Create)
   "AI 기반 대량 영상 제작"
   "프롬프트 하나로 수백 개의 브랜드 맞춤 영상을 생성합니다"

3. 검토 (Review)
   "품질 확인 및 큐레이션"
   "AI 품질 스코어링으로 최고의 콘텐츠를 빠르게 선별합니다"

4. 배포 (Publish)
   "멀티 플랫폼 자동 배포"
   "모든 채널에 최적화된 포맷으로 예약 발행합니다"
```

**Layout:**
- Horizontal timeline with numbered circles connected by line
- Each step expands on hover to show description
- Mobile: Vertical timeline

**Animation:**
- Line draws as user scrolls
- Numbers fill in sequence
- Descriptions fade in on hover/tap

---

### 6. Use Cases

**Background:** White
**Text:** Black

**Content (Korean):**
```
Label: 활용 사례
Title: "어떤 브랜드든, 어떤 규모든"

Cases:
1. 엔터테인먼트 (Entertainment)
   Icon: MusicNotes
   "아티스트 프로모션, 팬 콘텐츠, 앨범 마케팅"
   "아티스트별 수십 개의 계정을 운영하면서도
   일관된 브랜드 이미지를 유지할 수 있습니다"

2. 이커머스 (E-commerce)
   Icon: ShoppingBag
   "제품 영상, 리뷰 콘텐츠, 프로모션 광고"
   "수천 개의 제품 각각에 맞춤형 영상을
   자동으로 생성하고 배포합니다"

3. 에이전시 (Agency)
   Icon: Buildings
   "다중 클라이언트 관리, 캠페인 운영"
   "여러 클라이언트의 브랜드 가이드라인을
   각각 준수하면서 대량의 콘텐츠를 제작합니다"
```

**Layout:**
- 3 cards in a row
- Each card: Icon + Title + Tagline + Description
- Hover: Subtle lift effect

---

### 7. Capabilities Grid

**Background:** zinc-50 (near white)
**Text:** Black

**Content (Korean):**
```
Label: 핵심 기능
Title: "엔터프라이즈를 위한 완벽한 솔루션"

Grid items (4x3):
1. AI 프롬프트 최적화
   "자연어를 최적의 영상 프롬프트로 변환"

2. 지역별 트렌드 수집
   "타겟 시장의 로컬 트렌드 실시간 분석"

3. 스타일 프리셋
   "시네마틱, 로파이, 네온 등 다양한 스타일"

4. 멀티 플랫폼 배포
   "TikTok, Instagram, YouTube 동시 지원"

5. AEO 카피 생성
   "알고리즘 최적화된 해시태그 & 캡션"

6. GEO 타겟팅
   "국가/지역별 맞춤 콘텐츠 최적화"

7. 실시간 분석
   "조회수, 참여율, 성과 자동 추적"

8. 팀 협업
   "역할 기반 권한 관리 및 워크플로우"

9. 브랜드 준수
   "가이드라인 자동 검증 및 적용"

10. 바이럴 최적화
    "플랫폼별 노출 극대화 전략"

11. 문화권별 최적화
    "로컬 문화에 맞는 콘텐츠 스타일"

12. API 연동
    "기존 시스템과 원활한 통합"
```

**Layout:**
- 4 columns x 3 rows grid (12 items)
- Each item: Icon + Title + Short description
- Responsive: 2 columns on tablet, 1 column on mobile

---

### 8. Final CTA

**Background:** Black
**Text:** White

**Content (Korean):**
```
Title: "지금 바로 시작하세요"
Subtitle: "브랜드의 콘텐츠 제작 방식을 혁신할 준비가 되셨나요?"

CTA Buttons:
[데모 예약하기] (primary - white bg)
[문의하기] (secondary - outline white)
```

**Visual Element:**
- Subtle gradient or pattern background
- Optional: Floating abstract shapes

---

### 9. Footer

**Background:** zinc-950 (near black)
**Text:** zinc-400 (muted)

**Content:**
```
Left: Logo

Center:
Links: 기능 | 작동 방식 | 활용 사례 | 문의
Legal: 이용약관 | 개인정보처리방침

Right:
Language: 한국어 | English
© 2024 HYBE. All rights reserved.
```

---

## Animation Specifications

### Global
- **Page load:** Fade in with slight upward motion
- **Scroll animations:** Elements animate in when 20% visible
- **Duration:** 0.5-0.8s for most animations
- **Easing:** `[0.25, 0.46, 0.45, 0.94]` (smooth ease-out)

### Specific Animations

| Element | Animation |
|---------|-----------|
| Hero text | Stagger fade up (0.1s delay between lines) |
| Hero video grid | Stagger scale in from 0.9 to 1 |
| Pain point cards | Stagger fade up from bottom |
| Feature sections | Fade in + slide from side (alternating) |
| Timeline | Line draws on scroll, numbers pop |
| Use case cards | Stagger fade up |
| Capability grid | Stagger fade in (wave pattern) |
| CTA section | Fade in with scale |
| Buttons | Hover: subtle scale (1.02) + shadow |
| Cards | Hover: translateY(-4px) + shadow |

---

## Stock Image Suggestions

| Section | Image Description | Suggested Search Terms |
|---------|-------------------|----------------------|
| Hero | Abstract visualization of multiple video screens or content grid | "multiple screens video content", "content creation abstract" |
| Trend Intelligence | Analytics dashboard or data visualization | "analytics dashboard dark", "data visualization minimal" |
| Brand IP | Product photography setup or brand assets | "brand assets flat lay", "product photography minimal" |
| Mass Generation | Grid of similar variations or factory automation | "content grid variations", "digital production scale" |
| One-Click Publishing | Social media platforms or scheduling interface | "social media management", "content scheduling" |
| Hyperpersonalization | World map with connected data points | "global data network", "world map connections", "localization global" |
| AEO/GEO Optimization | Growth charts, algorithm visualization, viral metrics | "viral growth chart", "algorithm optimization", "SEO analytics dark" |

**Style for all images:**
- High contrast
- Preferably black and white or desaturated
- Clean, minimal compositions
- Professional quality

---

## Responsive Breakpoints

| Breakpoint | Screen | Layout Adjustments |
|------------|--------|-------------------|
| `sm` | 640px | Single column, smaller text |
| `md` | 768px | 2 columns where applicable |
| `lg` | 1024px | Full layout |
| `xl` | 1280px | Max container width |
| `2xl` | 1536px | Extra spacing |

---

## File Structure

```
app/
└── (landing)/
    └── enterprise/
        └── page.tsx           # Main landing page

components/
└── landing/
    ├── navigation.tsx         # Sticky nav
    ├── hero-section.tsx       # Hero
    ├── problem-section.tsx    # Pain points
    ├── feature-section.tsx    # Single feature (reusable)
    ├── features-section.tsx   # All features container
    ├── how-it-works.tsx       # Timeline
    ├── use-cases.tsx          # Use case cards
    ├── capabilities-grid.tsx  # Feature grid
    ├── cta-section.tsx        # Final CTA
    ├── footer.tsx             # Footer
    └── language-toggle.tsx    # KR/EN switch

lib/
└── i18n/
    └── landing.ts             # Translation strings
```

---

## Implementation Notes

1. **Fonts Setup:**
   - Add Geist via next/font/google or local
   - Add Noto Sans KR via next/font/google
   - Configure font variables in tailwind config

2. **Language Toggle:**
   - Use React state or URL params for language
   - All strings in centralized translation file
   - Default to Korean, option for English

3. **Images:**
   - Use Next.js Image component for optimization
   - Placeholder blur during load
   - Consider using Unsplash API or static placeholders

4. **Accessibility:**
   - Proper heading hierarchy
   - Alt text for all images
   - Focus states for interactive elements
   - Reduced motion support

5. **Performance:**
   - Lazy load below-fold sections
   - Optimize animation for 60fps
   - Use Intersection Observer for scroll animations
