---
name: fast-cut
description: Fast-cut video generation workflow for creating TikTok-style slideshow videos. Use when user wants to create quick video content, image slideshows, or says "fast cut", "quick video", "slideshow video".
---

# Fast-Cut Video Skill

Create TikTok-style slideshow videos quickly using AI-powered script generation, image search, and automated rendering.

## When to Use

- User says: "fast cut", "quick video", "slideshow", "image video"
- Creating promotional content quickly
- Generating trend-based video content
- Need video without filming

## Fast-Cut Workflow

```
Concept → Script → Images → Music → Effects → Render
```

### Stage 1: Script Generation

AI generates a video script with timing and scene descriptions.

```typescript
// API: POST /api/v1/fast-cut/script
{
  "concept": "New album release announcement",
  "artistName": "Artist Name",
  "platform": "tiktok",
  "language": "ko",
  "duration": 15  // seconds
}

// Response
{
  "scenes": [
    {
      "sceneNumber": 1,
      "text": "hook text",
      "duration": 3,
      "imageKeywords": ["album", "music"],
      "purpose": "hook"
    }
  ],
  "totalDuration": 15,
  "suggestedBpm": { "min": 120, "max": 140 }
}
```

### Stage 2: Image Search/Selection

Find or generate images for each scene.

```typescript
// API: POST /api/v1/fast-cut/images/search
{
  "keywords": ["kpop album", "music stage"],
  "count": 10,
  "aspectRatio": "9:16"
}

// Response
{
  "images": [
    {
      "url": "https://...",
      "width": 1080,
      "height": 1920,
      "source": "web_search"
    }
  ]
}
```

### Stage 3: Music Matching

Find appropriate background music.

```typescript
// API: POST /api/v1/fast-cut/music/match
{
  "bpmRange": { "min": 120, "max": 140 },
  "mood": "energetic",
  "genre": "pop"
}
```

### Stage 4: Effects Selection

Choose transition effects between scenes.

```typescript
// API: GET /api/v1/effects
// Lists available effects

// API: POST /api/v1/effects/select
{
  "sceneCount": 5,
  "style": "dynamic"  // dynamic | smooth | minimal
}
```

### Stage 5: Render Video

Send to compose-engine for final rendering.

```typescript
// API: POST /api/v1/compose/render
{
  "type": "fast-cut",
  "scenes": [...],
  "music": { "assetId": "...", "startTime": 0 },
  "effects": ["zoom_in", "fade", "slide_left"],
  "output": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  }
}
```

## Key Components

### Agents

| Agent | Purpose | File |
|-------|---------|------|
| ScriptGenerator | Generate video script | `lib/agents/fast-cut/script-generator.ts` |
| ImageKeywordGenerator | Extract search keywords | `lib/agents/fast-cut/image-keyword-generator.ts` |
| SceneAnalyzer | Analyze scene requirements | `lib/agents/fast-cut/scene-analyzer.ts` |
| EffectAnalyzer | Suggest effects | `lib/agents/fast-cut/effect-analyzer.ts` |
| Conductor | Orchestrate workflow | `lib/agents/fast-cut/conductor.ts` |

### UI Components

| Component | Purpose |
|-----------|---------|
| `InlineFastCutFlow` | Main workflow container |
| `FastCutScriptStep` | Script generation UI |
| `FastCutImageStep` | Image selection UI |
| `FastCutAIImageStep` | AI image generation UI |

### API Endpoints

```
POST /api/v1/fast-cut/script         - Generate script
POST /api/v1/fast-cut/images/search  - Search images
POST /api/v1/fast-cut/images/generate - AI generate images
POST /api/v1/fast-cut/music/match    - Match music
GET  /api/v1/fast-cut/style-sets     - Get style presets
POST /api/v1/compose/render          - Render video
```

## Workflow States

```typescript
type FastCutStep =
  | 'script'    // Generating/editing script
  | 'images'    // Selecting images for each scene
  | 'music'     // Choosing background music
  | 'effects'   // Selecting transitions
  | 'preview'   // Preview before render
  | 'render'    // Rendering video
  | 'complete'; // Done
```

## Common Issues & Solutions

### Script Too Long

Reduce scene count or duration per scene:
```typescript
{
  "duration": 15,  // Target 15 seconds
  "maxScenes": 5   // Limit scenes
}
```

### Images Not Relevant

Improve search keywords:
```typescript
// Bad: generic keywords
["music", "stage"]

// Good: specific keywords
["kpop concert stage lighting", "album cover art aesthetic"]
```

### Slow Rendering

Check GPU availability on compose-engine:
```bash
ssh hydra-compose
nvidia-smi
docker logs hydra-compose-engine-gpu --tail 50
```

## Style Presets

| Style | Description | BPM Range | Effects |
|-------|-------------|-----------|---------|
| Energetic | Fast, dynamic | 120-150 | zoom, slide |
| Emotional | Slow, smooth | 60-90 | fade, dissolve |
| Minimal | Clean, simple | 90-110 | cut, fade |
| Trendy | Current TikTok style | 100-130 | glitch, zoom |

## Example Usage

```typescript
// Full fast-cut workflow
async function createFastCutVideo(concept: string) {
  // 1. Generate script
  const script = await fetch('/api/v1/fast-cut/script', {
    method: 'POST',
    body: JSON.stringify({ concept, duration: 15 })
  });

  // 2. Search images for each scene
  const images = await Promise.all(
    script.scenes.map(scene =>
      fetch('/api/v1/fast-cut/images/search', {
        method: 'POST',
        body: JSON.stringify({ keywords: scene.imageKeywords })
      })
    )
  );

  // 3. Match music
  const music = await fetch('/api/v1/fast-cut/music/match', {
    method: 'POST',
    body: JSON.stringify({ bpmRange: script.suggestedBpm })
  });

  // 4. Render
  const result = await fetch('/api/v1/compose/render', {
    method: 'POST',
    body: JSON.stringify({
      type: 'fast-cut',
      scenes: script.scenes.map((s, i) => ({
        ...s,
        imageUrl: images[i].images[0].url
      })),
      music: music.track
    })
  });

  return result;
}
```
