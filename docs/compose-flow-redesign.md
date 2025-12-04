# Compose Flow Redesign Plan

## Overview

The current compose flow redirects users to `/campaigns/[id]/compose` - a separate page. The new design integrates compose **directly into the Create tab** as an inline multi-step wizard that:
1. Uses all metadata from Discover/Analyze stages
2. Follows the same UI patterns as the new flow
3. Only redirects to Processing page when user clicks "Generate"

---

## New Compose Flow Architecture

### Flow Stages (Within Create Tab)

```
CREATE TAB (when Compose selected)
├── Step 1: SCRIPT GENERATION
│   ├── Pre-filled with discover keywords, analyze idea, campaign context
│   ├── User refines concept prompt
│   ├── AI generates script with TikTok Hook Strategy
│   └── Script preview with timeline visualization
│
├── Step 2: IMAGE SELECTION
│   ├── Source modes: Campaign Assets / Web Search / Mixed
│   ├── Keyword-based search using discover keywords
│   ├── Quality scoring and auto-selection
│   └── 3-10 image selection requirement
│
├── Step 3: MUSIC MATCHING
│   ├── Auto-match based on script vibe & BPM range
│   ├── Campaign audio library integration
│   ├── AI-powered best segment analysis
│   └── Audio start time control with timeline preview
│
├── Step 4: EFFECTS & RENDER CONFIG
│   ├── Effect preset selection (zoom_beat, crossfade, bounce, minimal)
│   ├── Summary of all selections
│   ├── TikTok SEO preview & editing
│   └── "Generate" button → Processing page
│
└── → PROCESSING PAGE
    └── → PUBLISH PAGE
```

---

## Detailed Implementation

### STEP 1: Script Generation

**Features**:
- Pre-filled prompt from analyze stage (optimizedPrompt or selectedIdea.description)
- Aspect ratio selector (9:16, 16:9, 1:1)
- Keyword manager with discover keywords pre-loaded
- Generate script button triggers AI script generation
- Script timeline preview with TikTok Hook Strategy visualization
- TikTok SEO preview and editing

**Context Integration**:
- Keywords from discover.keywords
- Hashtags from discover.selectedHashtags
- User idea from analyze.userIdea
- Selected idea from analyze.selectedIdea
- AI insights from discover.aiInsights

### STEP 2: Image Selection

**Features**:
- Source mode toggle (Assets Only / Search Only / Mixed)
- Campaign assets automatically loaded via useAssets hook
- Keyword-based web search using selected keywords
- Quality scoring display (resolution, aspect ratio bonuses)
- 3-10 image selection requirement
- Selection order indicators (numbered badges)
- Inspiration thumbnails from discover as visual reference

### STEP 3: Music Selection

**Features**:
- Auto-match on step entry based on script vibe & BPM range
- Campaign audio library integration
- Match score display (vibe match + BPM match + duration match)
- AI-powered best segment analysis
- Start time slider with timeline preview
- Audio structure visualization (hook zone, beat drop, climax)

### STEP 4: Effects & Summary

**Features**:
- Effect preset dropdown (zoom_beat, crossfade, bounce, minimal)
- Summary cards: images count, audio BPM, aspect ratio, vibe
- TikTok SEO preview with editing capability
- Hashtag review (merged from all sources)
- "Generate Compose" button triggers render and navigates to Processing

---

## Data Flow

```
DISCOVER → keywords, hashtags, inspiration, metrics, aiInsights
    ↓
ANALYZE → campaignId, selectedIdea, optimizedPrompt, hashtags
    ↓
CREATE (Compose)
    Step 1: prompt (pre-filled), keywords → scriptData, tiktokSEO
    Step 2: assets, keywords, inspiration → selectedImages
    Step 3: vibe, bpmRange, audio → selectedAudio, audioStartTime
    Step 4: all outputs → effectPreset, generate
    ↓
PROCESSING → video with generationType: "COMPOSE"
    ↓
PUBLISH → caption/hashtags pre-filled from tiktokSEO
```

---

## Files to Create

1. `components/features/create/InlineComposeFlow.tsx` - Main container
2. `components/features/create/compose/ComposeScriptStep.tsx` - Step 1
3. `components/features/create/compose/ComposeImageStep.tsx` - Step 2
4. `components/features/create/compose/ComposeMusicStep.tsx` - Step 3
5. `components/features/create/compose/ComposeEffectStep.tsx` - Step 4
6. `components/features/create/compose/ComposeContextPanel.tsx` - Sidebar

## Files to Modify

1. `app/(dashboard)/create/page.tsx` - Add inline compose support
2. `app/(dashboard)/processing/page.tsx` - Enhance compose metadata display
3. `app/(dashboard)/publish/page.tsx` - Pre-fill from compose TikTok SEO

---

## UI/UX Consistency Requirements

- Color palette: Muted colors (black, grey, white) - neutral-50, neutral-100, neutral-200, neutral-900
- Step indicators: Horizontal pills with checkmarks
- Cards: neutral-50 backgrounds, neutral-200 borders
- Buttons: neutral-900 primary, outline secondary
- Context panel: Left sidebar showing workflow context
- Match discover/analyze page layouts and component styles
