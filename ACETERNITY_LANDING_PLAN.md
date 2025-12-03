# Aceternity UI Landing Page Conversion Plan

## Overview
Convert the current Hydra landing page to use 100% Aceternity UI components with Phosphor icons, maintaining a futuristic black & white aesthetic while preserving all Korean/English copy.

---

## Phase 1: Dependencies & Setup

### 1.1 Install Required Packages
```bash
# Aceternity UI components (via shadcn CLI)
npx shadcn@latest add @aceternity/spotlight
npx shadcn@latest add @aceternity/text-generate-effect
npx shadcn@latest add @aceternity/background-beams
npx shadcn@latest add @aceternity/bento-grid
npx shadcn@latest add @aceternity/card-hover-effect
npx shadcn@latest add @aceternity/glare-card
npx shadcn@latest add @aceternity/infinite-moving-cards
npx shadcn@latest add @aceternity/animated-modal
npx shadcn@latest add @aceternity/resizable-navbar
npx shadcn@latest add @aceternity/background-gradient
npx shadcn@latest add @aceternity/background-gradient-animation
npx shadcn@latest add @aceternity/canvas-reveal-effect
npx shadcn@latest add @aceternity/glowing-effect
npx shadcn@latest add @aceternity/animated-testimonials

# Phosphor icons (already installed - @phosphor-icons/react)
```

### 1.2 Tailwind Configuration Updates
Add necessary animations and keyframes for Aceternity components.

---

## Phase 2: Component Mapping

### Current → Aceternity Conversion Matrix

| Section | Current Implementation | Aceternity Components | Effect |
|---------|----------------------|----------------------|--------|
| **Navigation** | Custom floating nav | `ResizableNavbar` / `FloatingNavbar` | Glassmorphism nav with blur |
| **Hero** | RetroGrid + Meteors + motion | `Spotlight` + `TextGenerateEffect` + `BackgroundBeams` | Dramatic spotlight with typewriter text |
| **Problem** | Simple grid cards | `HoverEffect` cards | Interactive hover cards with glow |
| **Features** | Alternating image/text | `BentoGrid` with `GlowingEffect` | Modern bento layout |
| **How It Works** | Timeline with dots | `TracingBeam` or custom Timeline | Animated beam following scroll |
| **Use Cases** | Hover cards | `GlareCard` or `3DCard` | 3D tilt effect on hover |
| **Capabilities** | Grid of small cards | `InfiniteMovingCards` or `HoverEffect` | Auto-scrolling cards |
| **CTA** | Gradient blurs | `BackgroundGradientAnimation` + `Spotlight` | Animated gradient background |
| **Footer** | Standard footer | Minimalist with consistent styling | Clean black/white |

---

## Phase 3: Detailed Implementation

### 3.1 Navigation (`components/landing/navigation.tsx`)
**Aceternity Component:** `ResizableNavbar` / Custom Floating Navbar

```tsx
// Key Features:
- Glassmorphism effect with backdrop-blur
- Smooth scroll-based show/hide
- Language toggle with pill design
- Phosphor icons: List, X
- Black/white color scheme
```

### 3.2 Hero Section (`components/landing/hero-section.tsx`)
**Aceternity Components:** `Spotlight` + `TextGenerateEffect` + `BackgroundBeams`

```tsx
// Structure:
<section className="relative min-h-screen bg-black">
  <BackgroundBeams className="opacity-40" />
  <Spotlight className="-top-40 left-0 md:left-60" fill="white" />

  <div className="content">
    <TextGenerateEffect words={t.hero.headline1} className="text-white" />
    <TextGenerateEffect words={t.hero.headline2} className="text-zinc-400" />
    <p>{t.hero.subheadline}</p>
    <Button with ArrowRight icon />
  </div>
</section>
```

### 3.3 Problem Section (`components/landing/problem-section.tsx`)
**Aceternity Component:** `HoverEffect`

```tsx
// Structure:
<section className="bg-white py-24">
  <h2>{t.problem.headline1}</h2>
  <h2 className="text-zinc-400">{t.problem.headline2}</h2>

  <HoverEffect items={painPointsWithIcons} />
</section>

// Items format:
const painPoints = t.problem.painPoints.map((p, i) => ({
  title: p.title,
  description: p.description,
  icon: <PhosphorIcon />,
  link: "#"
}))
```

### 3.4 Features Section (`components/landing/features-section.tsx`)
**Aceternity Component:** `BentoGrid` + `BentoGridItem` + `GlowingEffect`

```tsx
// Structure:
<section id="features" className="py-24 bg-black">
  <BentoGrid className="max-w-7xl mx-auto">
    {features.map((feature, i) => (
      <BentoGridItem
        key={i}
        title={feature.title}
        description={feature.description}
        header={<FeatureHeader image={feature.image} />}
        icon={<PhosphorIcon />}
        className={getGridSpan(i)} // col-span-2 for some items
      />
    ))}
  </BentoGrid>
</section>

// Grid spans:
// - trendIntelligence: col-span-2
// - brandIP: col-span-1
// - massGeneration: col-span-1
// - oneClickPublish: col-span-2
// - hyperpersonalization: col-span-1
// - aeoGeo: col-span-1
```

### 3.5 Global Reach Section (NEW - After Features)
**Aceternity Component:** `GitHubGlobe`

```tsx
// Structure:
<section className="relative h-[80vh] bg-black overflow-hidden">
  <div className="absolute inset-0">
    <Globe
      globeConfig={{
        pointSize: 2,
        globeColor: '#1a1a1a',
        showAtmosphere: true,
        atmosphereColor: '#ffffff',
        atmosphereAltitude: 0.15,
        emissive: '#0a0a0a',
        emissiveIntensity: 0.1,
        shininess: 0.9,
        polygonColor: 'rgba(255,255,255,0.7)',
        ambientLight: '#ffffff',
        directionalLeftLight: '#ffffff',
        directionalTopLight: '#ffffff',
        pointLight: '#ffffff',
        arcTime: 2000,
        arcLength: 0.9,
        rings: 1,
        maxRings: 3,
        autoRotate: true,
        autoRotateSpeed: 0.5
      }}
      data={videoShareArcs} // Arcs showing videos being shared worldwide
    />
  </div>

  <div className="relative z-10 text-center pt-20">
    <span className="badge">글로벌 도달 / Global Reach</span>
    <h2>전 세계로 퍼져나가는 콘텐츠</h2>
    <h2 className="text-zinc-400">Your Content, Everywhere</h2>
    <p>
      AI가 생성한 영상이 TikTok, Instagram, YouTube를 통해
      전 세계 팬들에게 실시간으로 전달됩니다.
    </p>
  </div>
</section>

// Arc data example - videos spreading from Korea to the world:
const videoShareArcs = [
  // Korea to USA
  { order: 1, startLat: 37.5665, startLng: 126.9780, endLat: 40.7128, endLng: -74.0060, arcAlt: 0.3, color: '#ffffff' },
  // Korea to Japan
  { order: 2, startLat: 37.5665, startLng: 126.9780, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.1, color: '#ffffff' },
  // Korea to UK
  { order: 3, startLat: 37.5665, startLng: 126.9780, endLat: 51.5074, endLng: -0.1278, arcAlt: 0.4, color: '#ffffff' },
  // Korea to Brazil
  { order: 4, startLat: 37.5665, startLng: 126.9780, endLat: -23.5505, endLng: -46.6333, arcAlt: 0.5, color: '#ffffff' },
  // Korea to Australia
  { order: 5, startLat: 37.5665, startLng: 126.9780, endLat: -33.8688, endLng: 151.2093, arcAlt: 0.25, color: '#ffffff' },
  // ... more arcs for Southeast Asia, Europe, etc.
]
```

### 3.6 How It Works Section (`components/landing/how-it-works.tsx`)
**Aceternity Component:** Custom Timeline with `CanvasRevealEffect` on hover

```tsx
// Structure:
<section id="how-it-works" className="bg-black py-24">
  <div className="timeline">
    {steps.map((step, i) => (
      <div key={i} className="timeline-item">
        <div className="number-circle">{step.number}</div>
        <CanvasRevealEffect colors={[[255,255,255]]} />
        <h3>{step.title}</h3>
        <p>{step.description}</p>
      </div>
    ))}
  </div>
</section>
```

### 3.6 Use Cases Section (`components/landing/use-cases.tsx`)
**Aceternity Component:** `GlareCard`

```tsx
// Structure:
<section id="use-cases" className="bg-white py-24">
  <div className="grid grid-cols-3 gap-8">
    {useCases.map((useCase, i) => (
      <GlareCard key={i} className="p-8">
        <PhosphorIcon />
        <h3>{useCase.title}</h3>
        <p>{useCase.tagline}</p>
        <p>{useCase.description}</p>
      </GlareCard>
    ))}
  </div>
</section>
```

### 3.7 Capabilities Grid (`components/landing/capabilities-grid.tsx`)
**Aceternity Component:** `InfiniteMovingCards`

```tsx
// Structure:
<section className="bg-zinc-50 py-24 overflow-hidden">
  <InfiniteMovingCards
    items={capabilities}
    direction="left"
    speed="slow"
    className="py-4"
  />
  <InfiniteMovingCards
    items={capabilities.slice().reverse()}
    direction="right"
    speed="slow"
    className="py-4"
  />
</section>

// Items format:
const capabilities = t.capabilities.items.map((item, i) => ({
  title: item.title,
  description: item.description,
  icon: capabilityIcons[i]
}))
```

### 3.8 CTA Section (`components/landing/cta-section.tsx`)
**Aceternity Component:** `BackgroundGradientAnimation` + `Spotlight`

```tsx
// Structure:
<section className="relative min-h-[60vh] bg-black overflow-hidden">
  <BackgroundGradientAnimation
    gradientBackgroundStart="rgb(0, 0, 0)"
    gradientBackgroundEnd="rgb(30, 30, 30)"
    firstColor="50, 50, 50"
    secondColor="100, 100, 100"
    size="100%"
    blendingValue="overlay"
  >
    <Spotlight className="top-0 left-1/2" fill="white" />

    <div className="content text-center">
      <h2>{t.cta.title}</h2>
      <p>{t.cta.subtitle}</p>
      <Button />
    </div>
  </BackgroundGradientAnimation>
</section>
```

### 3.9 Footer (`components/landing/footer.tsx`)
**Styling:** Minimalist black/white consistent with theme

```tsx
// Keep current structure but update styling:
- Background: zinc-950
- Text: zinc-400 / white
- Clean grid layout
- Phosphor icons where applicable
```

---

## Phase 4: Phosphor Icon Mapping

| Current Icon | Component | Phosphor Icon |
|--------------|-----------|---------------|
| ArrowDown | Hero | `ArrowDown` |
| ArrowRight | Hero, CTA | `ArrowRight` |
| List, X | Navigation | `List`, `X` |
| TrendUp | Problem | `TrendUp` |
| Repeat | Problem | `ArrowsClockwise` |
| ShieldCheck | Problem | `ShieldCheck` |
| DeviceMobile | Problem | `DeviceMobile` |
| MagnifyingGlass | Features, HowItWorks | `MagnifyingGlass` |
| Fingerprint | Features | `Fingerprint` |
| Stack | Features | `Stack` |
| RocketLaunch | Features | `RocketLaunch` |
| Globe | Features | `Globe` |
| ChartLineUp | Features | `ChartLineUp` |
| Check | Features bullets | `Check` |
| Sparkle | HowItWorks | `Sparkle` |
| CheckSquare | HowItWorks | `CheckSquare` |
| PaperPlaneTilt | HowItWorks | `PaperPlaneTilt` |
| MusicNotes | UseCases | `MusicNotes` |
| ShoppingBag | UseCases | `ShoppingBag` |
| Buildings | UseCases | `Buildings` |
| All capability icons | Capabilities | Various Phosphor icons |

---

## Phase 5: Color Palette (Black & White)

```css
/* Primary Colors */
--black: #000000;
--white: #ffffff;

/* Grays */
--zinc-50: #fafafa;
--zinc-100: #f4f4f5;
--zinc-200: #e4e4e7;
--zinc-400: #a1a1aa;
--zinc-500: #71717a;
--zinc-600: #52525b;
--zinc-700: #3f3f46;
--zinc-800: #27272a;
--zinc-900: #18181b;
--zinc-950: #09090b;

/* Accent (subtle) */
--accent-glow: rgba(255, 255, 255, 0.1);
```

---

## Phase 6: Implementation Order

1. **Install Aceternity components** via shadcn CLI
2. **Update tailwind.config.ts** with required animations
3. **Create/update UI component files** in `components/ui/`
4. **Convert Navigation** (simplest, test the setup)
5. **Convert Hero Section** (most visual impact)
6. **Convert Problem Section** (HoverEffect cards)
7. **Convert Features Section** (BentoGrid)
8. **Add Global Reach Section** (GitHub Globe - NEW)
9. **Convert How It Works** (Timeline)
10. **Convert Use Cases** (GlareCard)
11. **Convert Capabilities** (InfiniteMovingCards)
12. **Convert CTA Section** (BackgroundGradientAnimation)
13. **Update Footer** (styling consistency)
14. **Update page.tsx** (ensure all imports work)
15. **Test & Polish** (animations, responsive, i18n)

---

## Phase 7: Files to Create/Modify

### New UI Components (in `components/ui/`)
- `spotlight.tsx`
- `text-generate-effect.tsx`
- `background-beams.tsx`
- `bento-grid.tsx`
- `card-hover-effect.tsx`
- `glare-card.tsx`
- `infinite-moving-cards.tsx`
- `background-gradient-animation.tsx`
- `canvas-reveal-effect.tsx`
- `glowing-effect.tsx`
- `floating-navbar.tsx`
- `globe.tsx` (GitHub Globe for global reach visualization)

### Landing Components to Update
- `components/landing/navigation.tsx`
- `components/landing/hero-section.tsx`
- `components/landing/problem-section.tsx`
- `components/landing/features-section.tsx`
- `components/landing/global-reach.tsx` (NEW - GitHub Globe section)
- `components/landing/how-it-works.tsx`
- `components/landing/use-cases.tsx`
- `components/landing/capabilities-grid.tsx`
- `components/landing/cta-section.tsx`
- `components/landing/footer.tsx`

### Config Updates
- `tailwind.config.ts` - Add animations
- `app/globals.css` - Add required CSS keyframes

---

## Key Design Principles

1. **Futuristic Aesthetic**: Use spotlights, beams, glows, and subtle animations
2. **Black & White Only**: No colors except grayscale
3. **Preserve Copy**: Keep all Korean and English translations intact
4. **Phosphor Icons**: Consistent icon family throughout
5. **Smooth Animations**: Framer Motion + Aceternity effects
6. **Responsive**: Mobile-first, works on all screen sizes
7. **Performance**: Lazy load heavy effects, optimize images

---

## Expected Result

A cutting-edge, futuristic landing page with:
- Dramatic spotlight hero with typewriter text effect
- Interactive hover cards with subtle glow effects
- Bento grid feature showcase
- Animated timeline for process steps
- 3D glare cards for use cases
- Auto-scrolling capability showcase
- Animated gradient CTA section
- Clean, minimal footer

All while maintaining the bilingual (KO/EN) content and brand messaging.
