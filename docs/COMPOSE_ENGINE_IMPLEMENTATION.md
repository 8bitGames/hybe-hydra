# HYBE HYDRA - Compose Engine Implementation Guide

## Overview

MoviePy 기반 실사 이미지 합성 영상 생성 시스템 구현 문서입니다.
기존 Veo 3 AI 영상 생성과 병렬로 작동하는 두 번째 파이프라인입니다.

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Next.js Frontend (Existing + Extended)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Generate Page│  │ Compose Page │  │ Bridge Page  │                  │
│  │ (Veo 3 AI)   │  │ (MoviePy)    │  │ (Trends)     │                  │
│  │   [기존]      │  │   [신규]      │  │   [기존]      │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
└─────────┼─────────────────┼─────────────────┼──────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes Layer                             │
│  ┌───────────────────────┐  ┌───────────────────────┐                  │
│  │ /api/v1/generations/* │  │ /api/v1/compose/*     │                  │
│  │ (Veo 3 - 기존)         │  │ (MoviePy - 신규)       │                  │
│  └───────────┬───────────┘  └───────────┬───────────┘                  │
└──────────────┼──────────────────────────┼──────────────────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────┐  ┌──────────────────────────────────────────┐
│ Google Veo 3 API         │  │ Python Compose Engine (FastAPI)          │
│ (External - 기존)         │  │ http://localhost:8001 (신규)              │
└──────────────────────────┘  │  ┌─────────────┐ ┌─────────────┐        │
                              │  │Image Fetcher│ │Beat Sync    │        │
                              │  │(Google CSE) │ │(librosa)    │        │
                              │  └─────────────┘ └─────────────┘        │
                              │  ┌─────────────┐ ┌─────────────┐        │
                              │  │Video Render │ │Effect Engine│        │
                              │  │(MoviePy)    │ │(Presets)    │        │
                              │  └─────────────┘ └─────────────┘        │
                              └──────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Storage Layer                                   │
│  MinIO/S3: hydra-assets bucket                                          │
│  ├─ /assets/          (기존 - 캠페인 에셋, 음원 포함)                     │
│  ├─ /compose/images/  (신규 - 검색된 이미지 캐시)                         │
│  └─ /compose/renders/ (신규 - 렌더링된 영상)                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Comparison: Veo 3 vs Compose Engine

| Feature | Generate (Veo 3) | Compose (MoviePy) |
|---------|------------------|-------------------|
| **Input** | Text prompt | Real images + Audio |
| **Generation** | AI creates from scratch | Slideshow composition |
| **Control Level** | Low (AI decides) | High (User selects) |
| **Output Style** | Creative/Abstract | Real-photo based |
| **Use Case** | Artistic content | Fan content, promos |
| **Audio Source** | Asset Locker | Asset Locker |
| **Processing** | External API | Local Python service |

### 1.3 Data Flow

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Script Generation                                        │
│   - Artist selection                                             │
│   - Trend keywords from Bridge                                   │
│   - User prompt/request                                          │
│           ↓                                                      │
│   Gemini API → Script + Vibe Tag + Search Keywords              │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Image Collection                                         │
│   - Google Custom Search API                                     │
│   - Quality filtering (resolution, watermark)                    │
│   - Cache to S3                                                  │
│           ↓                                                      │
│   User reviews → Select/Deselect → Reorder by drag-drop         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Music Matching                                           │
│   - Query Asset Locker for audio assets                         │
│   - Filter by Vibe + BPM range                                  │
│   - Audio preview                                                │
│           ↓                                                      │
│   User selects final audio track                                │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Rendering                                                │
│   - Send to Python Compose Engine                               │
│   - BPM analysis → Beat points extraction                       │
│   - Apply Vibe preset (transitions, effects)                    │
│   - Sync image cuts to beats                                    │
│   - Overlay script text                                         │
│   - Render final MP4                                            │
│           ↓                                                      │
│   Upload to S3 → Update VideoGeneration record                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema Extensions

### 2.1 VideoGeneration Model Extension

```prisma
// prisma/schema.prisma

// New enum for generation type
enum GenerationType {
  VEO       // Existing Veo 3 AI generation
  COMPOSE   // New MoviePy composition
}

model VideoGeneration {
  // ========== Existing Fields (Keep All) ==========
  id                    String   @id @default(uuid())
  campaignId            String
  prompt                String   @db.Text
  negativePrompt        String?  @db.Text
  durationSeconds       Int      @default(5)
  aspectRatio           String   @default("9:16")
  status                GenerationStatus @default(PENDING)
  progress              Int      @default(0)
  errorMessage          String?  @db.Text

  audioAssetId          String
  audioAnalysis         Json?
  audioStartTime        Float?   @default(0)
  audioDuration         Float?
  composedOutputUrl     String?

  outputAssetId         String?
  outputUrl             String?
  qualityScore          Int?
  qualityMetadata       Json?

  originalInput         String?  @db.Text
  trendKeywords         String[]
  referenceUrls         String[]
  promptAnalysis        Json?
  isFavorite            Boolean  @default(false)
  tags                  String[]

  referenceImageId      String?
  referenceStyle        String?

  createdBy             String
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // ========== NEW: Compose-specific Fields ==========
  generationType        GenerationType @default(VEO)

  // Compose job tracking
  composeJobId          String?       // Python service job ID
  composeProgress       Int?          // Render progress 0-100
  composeStep           String?       // Current step description

  // Script data from LLM
  composeScript         Json?         // { lines: [{text, timing}], totalDuration }
  composeVibe           String?       // Exciting, Emotional, Pop, Chill
  composeSearchKeywords String[]      // Keywords for image search

  // Music matching
  composeMusicBpm       Int?          // Matched music BPM
  composeBpmRange       Json?         // { min: 120, max: 140 }

  // Effect settings
  composeEffectPreset   String?       // zoom_beat, crossfade, bounce
  composeEffectSettings Json?         // Custom effect parameters

  // Relations
  campaign              Campaign      @relation(fields: [campaignId], references: [id])
  creator               User          @relation(fields: [createdBy], references: [id])
  referenceImage        Asset?        @relation("ReferenceImage", fields: [referenceImageId], references: [id])
  outputAsset           Asset?        @relation("OutputAsset", fields: [outputAssetId], references: [id])
  audioAsset            Asset         @relation("AudioAsset", fields: [audioAssetId], references: [id])
  merchandiseReferences GenerationMerchandise[]
  composeImages         ComposeImageCandidate[]  // NEW relation

  @@index([campaignId])
  @@index([createdBy])
  @@index([status])
  @@index([generationType])  // NEW index
}
```

### 2.2 New Model: ComposeImageCandidate

```prisma
// Stores image candidates from Google Search for user selection
model ComposeImageCandidate {
  id            String          @id @default(uuid())
  generationId  String
  generation    VideoGeneration @relation(fields: [generationId], references: [id], onDelete: Cascade)

  // Image source info
  sourceUrl     String          // Original URL from Google Search
  sourceTitle   String?         // Page title
  sourceDomain  String?         // Domain name

  // Cached copy in S3
  cachedS3Url   String?         // S3 URL after download
  cachedS3Key   String?         // S3 key for deletion
  thumbnailUrl  String?         // Thumbnail for preview

  // Image metadata
  width         Int?
  height        Int?
  fileSize      Int?
  mimeType      String?

  // User selection state
  isSelected    Boolean         @default(true)
  sortOrder     Int             @default(0)

  // Auto-filtering results
  qualityScore  Float?          // 0-1 quality assessment
  isFiltered    Boolean         @default(false)
  filterReason  String?         // "low_resolution", "watermark", etc.

  createdAt     DateTime        @default(now())

  @@index([generationId])
  @@index([isSelected])
}
```

### 2.3 Asset Model Extension (for Audio BPM)

```prisma
model Asset {
  // ========== Existing Fields (Keep All) ==========
  id              String    @id @default(uuid())
  campaignId      String
  type            AssetType
  merchandiseType MerchandiseType?
  filename        String
  s3Url           String
  s3Key           String
  fileSize        Int
  mimeType        String
  thumbnailUrl    String?
  metadata        Json?
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // ========== NEW: Audio metadata for music matching ==========
  audioBpm        Int?              // BPM for audio files
  audioVibe       String?           // Vibe tag: Exciting, Emotional, Pop, Chill
  audioGenre      String?           // Genre: Hip-hop, EDM, Acoustic, etc.
  audioDuration   Float?            // Duration in seconds
  audioEnergy     Float?            // 0-1 energy level
  audioAnalyzed   Boolean @default(false)  // Whether BPM analysis is done

  // Relations (existing)
  campaign              Campaign        @relation(fields: [campaignId], references: [id])
  creator               User            @relation(fields: [createdBy], references: [id])
  referenceGenerations  VideoGeneration[] @relation("ReferenceImage")
  outputGenerations     VideoGeneration[] @relation("OutputAsset")
  audioGenerations      VideoGeneration[] @relation("AudioAsset")
  merchandiseReferences GenerationMerchandise[]

  @@index([campaignId])
  @@index([type])
  @@index([audioVibe, audioBpm])  // NEW index for music matching
}
```

---

## 3. API Endpoints Design

### 3.1 Next.js API Routes (New)

#### 3.1.1 Script Generation

```typescript
// POST /api/v1/compose/script
// Generate script and vibe tag using Gemini

Request:
{
  "campaignId": "uuid",
  "artistName": "BTS",
  "artistContext": "Global K-pop group known for...",
  "trendKeywords": ["viral", "challenge", "dance"],
  "userPrompt": "새 앨범 프로모션 영상을 만들고 싶어요",
  "targetDuration": 15  // seconds
}

Response:
{
  "success": true,
  "data": {
    "script": {
      "lines": [
        { "text": "The wait is finally over", "timing": 0, "duration": 3 },
        { "text": "BTS returns with a new era", "timing": 3, "duration": 3 },
        { "text": "Experience the magic", "timing": 6, "duration": 3 },
        { "text": "Coming soon", "timing": 9, "duration": 3 }
      ],
      "totalDuration": 15
    },
    "vibe": "Exciting",
    "vibeReason": "New album promotion calls for energetic, anticipation-building content",
    "suggestedBpmRange": { "min": 120, "max": 140 },
    "searchKeywords": [
      "BTS 2024 concert",
      "BTS members HD",
      "BTS performance stage",
      "BTS photoshoot"
    ],
    "effectRecommendation": "zoom_beat"
  }
}
```

#### 3.1.2 Image Search

```typescript
// POST /api/v1/compose/images/search
// Search images using Google Custom Search API

Request:
{
  "generationId": "uuid",
  "keywords": ["BTS 2024 concert", "BTS members HD"],
  "maxImages": 20,
  "minWidth": 720,
  "minHeight": 1280,  // For 9:16 aspect ratio
  "safeSearch": "active"
}

Response:
{
  "success": true,
  "data": {
    "candidates": [
      {
        "id": "uuid",
        "sourceUrl": "https://example.com/bts-concert.jpg",
        "thumbnailUrl": "https://...",
        "sourceTitle": "BTS World Tour 2024",
        "sourceDomain": "example.com",
        "width": 1920,
        "height": 1080,
        "isSelected": true,
        "sortOrder": 0,
        "qualityScore": 0.92
      }
    ],
    "totalFound": 20,
    "filtered": 3,
    "filterReasons": {
      "low_resolution": 2,
      "watermark_detected": 1
    }
  }
}
```

#### 3.1.3 Image Selection Update

```typescript
// PATCH /api/v1/compose/images/selection
// Update user's image selections and order

Request:
{
  "generationId": "uuid",
  "selections": [
    { "id": "uuid-1", "isSelected": true, "sortOrder": 0 },
    { "id": "uuid-2", "isSelected": false },
    { "id": "uuid-3", "isSelected": true, "sortOrder": 1 },
    { "id": "uuid-4", "isSelected": true, "sortOrder": 2 }
  ]
}

Response:
{
  "success": true,
  "data": {
    "selectedCount": 3,
    "totalCount": 4
  }
}
```

#### 3.1.4 User Image Upload

```typescript
// POST /api/v1/compose/images/upload
// Upload user's own images to add to candidates

Request: FormData
{
  "generationId": "uuid",
  "files": [File, File, ...]
}

Response:
{
  "success": true,
  "data": {
    "uploaded": [
      {
        "id": "uuid",
        "cachedS3Url": "https://s3.../compose/images/...",
        "thumbnailUrl": "https://...",
        "width": 1080,
        "height": 1920,
        "isSelected": true,
        "sortOrder": 10  // Appended to end
      }
    ]
  }
}
```

#### 3.1.5 Music Matching

```typescript
// POST /api/v1/compose/music/match
// Find matching audio assets from Asset Locker

Request:
{
  "campaignId": "uuid",
  "vibe": "Exciting",
  "bpmRange": { "min": 120, "max": 140 },
  "minDuration": 15,
  "genre": null  // Optional filter
}

Response:
{
  "success": true,
  "data": {
    "matches": [
      {
        "id": "asset-uuid",
        "filename": "energetic_beat_01.mp3",
        "s3Url": "https://s3.../assets/...",
        "bpm": 128,
        "vibe": "Exciting",
        "genre": "EDM",
        "duration": 180,
        "energy": 0.85,
        "matchScore": 0.95  // How well it matches criteria
      }
    ],
    "totalMatches": 5
  }
}
```

#### 3.1.6 Analyze Untagged Audio

```typescript
// POST /api/v1/compose/music/analyze
// Analyze BPM/vibe for audio assets without tags

Request:
{
  "assetId": "uuid"
}

Response:
{
  "success": true,
  "data": {
    "bpm": 128,
    "energy": 0.85,
    "suggestedVibe": "Exciting",
    "duration": 180.5,
    "beatPoints": [0.0, 0.46, 0.93, 1.40, ...]  // First 10 beats
  }
}
```

#### 3.1.7 Start Rendering

```typescript
// POST /api/v1/compose/render
// Start the MoviePy rendering job

Request:
{
  "generationId": "uuid",
  "audioAssetId": "uuid",
  "effectPreset": "zoom_beat",  // zoom_beat, crossfade, bounce, minimal
  "aspectRatio": "9:16",  // 9:16, 16:9, 1:1
  "targetDuration": 15,
  "textStyle": "bold_pop",  // bold_pop, fade_in, slide_in, minimal
  "colorGrade": "vibrant"  // vibrant, cinematic, bright, natural
}

Response:
{
  "success": true,
  "data": {
    "jobId": "python-job-uuid",
    "status": "queued",
    "estimatedSeconds": 120,
    "queuePosition": 0
  }
}
```

#### 3.1.8 Check Render Status

```typescript
// GET /api/v1/compose/{generationId}/status
// Poll for rendering progress

Response:
{
  "success": true,
  "data": {
    "status": "processing",  // queued, processing, completed, failed
    "progress": 45,
    "currentStep": "Applying beat-synced transitions",
    "steps": [
      { "name": "Downloading images", "completed": true },
      { "name": "Analyzing audio beats", "completed": true },
      { "name": "Applying transitions", "completed": false, "progress": 60 },
      { "name": "Adding text overlays", "completed": false },
      { "name": "Final rendering", "completed": false }
    ],
    "outputUrl": null,  // Populated when completed
    "error": null
  }
}

// When completed:
{
  "success": true,
  "data": {
    "status": "completed",
    "progress": 100,
    "outputUrl": "https://s3.../compose/renders/xxx.mp4",
    "outputS3Key": "compose/renders/xxx.mp4",
    "renderDuration": 95,  // Seconds it took to render
    "fileSize": 15234567
  }
}
```

### 3.2 Python FastAPI Endpoints

```python
# POST /render
# Main rendering endpoint

Request:
{
    "job_id": "uuid",
    "images": [
        {"url": "https://s3.../image1.jpg", "order": 0},
        {"url": "https://s3.../image2.jpg", "order": 1}
    ],
    "audio": {
        "url": "https://s3.../music.mp3",
        "start_time": 0,
        "duration": 15
    },
    "script": {
        "lines": [
            {"text": "The wait is over", "timing": 0, "duration": 3}
        ]
    },
    "settings": {
        "vibe": "Exciting",
        "effect_preset": "zoom_beat",
        "aspect_ratio": "9:16",
        "target_duration": 15,
        "text_style": "bold_pop",
        "color_grade": "vibrant"
    },
    "output": {
        "s3_bucket": "hydra-assets",
        "s3_key": "compose/renders/{job_id}.mp4"
    }
}

Response:
{
    "status": "accepted",
    "job_id": "uuid"
}

# GET /job/{job_id}/status
# Check job status

Response:
{
    "job_id": "uuid",
    "status": "processing",
    "progress": 45,
    "current_step": "applying_transitions",
    "output_url": null,
    "error": null
}

# POST /search-images
# Google Custom Search proxy (optional - can be done in Next.js)

Request:
{
    "keywords": ["BTS concert 2024"],
    "max_results": 20,
    "min_width": 720
}

# POST /analyze-audio
# Analyze audio BPM and energy

Request:
{
    "audio_url": "https://s3.../music.mp3"
}

Response:
{
    "bpm": 128,
    "beat_times": [0.0, 0.468, 0.937, ...],
    "energy_curve": [[0, 0.3], [1, 0.5], ...],
    "duration": 180.5,
    "suggested_vibe": "Exciting"
}
```

---

## 4. Python Compose Engine

### 4.1 Directory Structure

```
backend/compose-engine/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry
│   ├── config.py               # Environment configuration
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── render.py           # /render endpoint
│   │   ├── images.py           # /search-images endpoint
│   │   ├── audio.py            # /analyze-audio endpoint
│   │   └── jobs.py             # /job/{id}/status endpoint
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── video_renderer.py   # Main MoviePy rendering logic
│   │   ├── image_fetcher.py    # Google Custom Search wrapper
│   │   ├── image_processor.py  # Image resize, crop, filter
│   │   ├── audio_analyzer.py   # librosa BPM analysis
│   │   └── beat_sync.py        # Beat-to-cut synchronization
│   │
│   ├── effects/
│   │   ├── __init__.py
│   │   ├── transitions.py      # Fade, zoom, slide, bounce
│   │   ├── filters.py          # Color grading, film grain
│   │   ├── text_overlay.py     # Text rendering with styles
│   │   └── motion.py           # Ken Burns effect, shake
│   │
│   ├── presets/
│   │   ├── __init__.py
│   │   ├── base.py             # Base preset class
│   │   ├── exciting.py         # Energetic preset (120-140 BPM)
│   │   ├── emotional.py        # Slow, cinematic preset (60-80 BPM)
│   │   ├── pop.py              # Trendy preset (100-120 BPM)
│   │   └── minimal.py          # Clean, simple preset
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── s3_client.py        # MinIO/S3 operations
│   │   ├── job_queue.py        # Redis job management
│   │   └── temp_files.py       # Temporary file handling
│   │
│   └── models/
│       ├── __init__.py
│       ├── render_job.py       # Pydantic models for render request
│       └── responses.py        # API response models
│
├── tests/
│   ├── __init__.py
│   ├── test_renderer.py
│   ├── test_effects.py
│   └── test_beat_sync.py
│
├── requirements.txt
├── Dockerfile
└── docker-compose.override.yml
```

### 4.2 Core Service: VideoRenderer

```python
# app/services/video_renderer.py

from moviepy.editor import (
    ImageClip, AudioFileClip, CompositeVideoClip,
    concatenate_videoclips, TextClip
)
from .audio_analyzer import AudioAnalyzer
from .beat_sync import BeatSyncEngine
from ..effects import transitions, filters, text_overlay, motion
from ..presets import get_preset
from ..utils.s3_client import S3Client
from ..utils.temp_files import TempFileManager
import asyncio

class VideoRenderer:
    def __init__(self, s3_client: S3Client):
        self.s3 = s3_client
        self.audio_analyzer = AudioAnalyzer()
        self.beat_sync = BeatSyncEngine()
        self.temp = TempFileManager()

    async def render(
        self,
        job_id: str,
        images: list[dict],
        audio: dict,
        script: dict,
        settings: dict,
        progress_callback: callable
    ) -> str:
        """
        Main rendering pipeline.
        Returns S3 URL of rendered video.
        """
        try:
            # Step 1: Download assets
            await progress_callback(job_id, 0, "Downloading images")
            image_paths = await self._download_images(images)

            await progress_callback(job_id, 10, "Downloading audio")
            audio_path = await self._download_audio(audio)

            # Step 2: Analyze audio
            await progress_callback(job_id, 15, "Analyzing audio beats")
            beat_analysis = self.audio_analyzer.analyze(audio_path)
            beat_times = beat_analysis['beat_times']

            # Step 3: Calculate cut timings
            await progress_callback(job_id, 20, "Calculating cut timings")
            preset = get_preset(settings['vibe'])
            cut_times = self.beat_sync.calculate_cuts(
                beat_times=beat_times,
                num_images=len(image_paths),
                target_duration=settings['target_duration'],
                cut_style=preset.cut_style
            )

            # Step 4: Create image clips with effects
            await progress_callback(job_id, 25, "Creating image clips")
            clips = []
            for i, (img_path, (start, end)) in enumerate(zip(image_paths, cut_times)):
                clip = self._create_image_clip(
                    img_path, start, end,
                    preset=preset,
                    aspect_ratio=settings['aspect_ratio'],
                    beat_times=beat_times
                )
                clips.append(clip)
                await progress_callback(
                    job_id,
                    25 + int(30 * (i + 1) / len(image_paths)),
                    f"Processing image {i + 1}/{len(image_paths)}"
                )

            # Step 5: Apply transitions between clips
            await progress_callback(job_id, 55, "Applying transitions")
            video = self._apply_transitions(clips, preset)

            # Step 6: Add text overlays
            await progress_callback(job_id, 65, "Adding text overlays")
            if script and script.get('lines'):
                video = self._add_text_overlays(
                    video, script['lines'],
                    style=settings.get('text_style', preset.text_style)
                )

            # Step 7: Add audio
            await progress_callback(job_id, 75, "Adding audio track")
            audio_clip = AudioFileClip(audio_path)
            if audio.get('start_time') or audio.get('duration'):
                start = audio.get('start_time', 0)
                duration = audio.get('duration', settings['target_duration'])
                audio_clip = audio_clip.subclip(start, start + duration)
            video = video.set_audio(audio_clip)

            # Step 8: Apply color grading
            await progress_callback(job_id, 80, "Applying color grading")
            color_grade = settings.get('color_grade', preset.color_grade)
            video = filters.apply_color_grade(video, color_grade)

            # Step 9: Render to file
            await progress_callback(job_id, 85, "Rendering final video")
            output_path = self.temp.get_path(f"{job_id}.mp4")
            video.write_videofile(
                output_path,
                fps=30,
                codec='libx264',
                audio_codec='aac',
                threads=4,
                preset='medium'
            )

            # Step 10: Upload to S3
            await progress_callback(job_id, 95, "Uploading to storage")
            s3_key = f"compose/renders/{job_id}.mp4"
            s3_url = await self.s3.upload_file(output_path, s3_key)

            # Cleanup
            self.temp.cleanup(job_id)

            await progress_callback(job_id, 100, "Completed")
            return s3_url

        except Exception as e:
            self.temp.cleanup(job_id)
            raise e

    def _create_image_clip(
        self,
        img_path: str,
        start: float,
        end: float,
        preset,
        aspect_ratio: str,
        beat_times: list[float]
    ) -> ImageClip:
        """Create a single image clip with Ken Burns effect"""
        duration = end - start

        # Load and resize image
        clip = ImageClip(img_path).set_duration(duration)
        clip = self._resize_for_aspect(clip, aspect_ratio)

        # Apply motion effect (Ken Burns)
        clip = motion.apply_ken_burns(
            clip,
            style=preset.motion_style,
            beat_times=[t - start for t in beat_times if start <= t < end]
        )

        return clip.set_start(start)

    def _resize_for_aspect(self, clip: ImageClip, aspect_ratio: str) -> ImageClip:
        """Resize and crop image for target aspect ratio"""
        ratios = {
            "9:16": (1080, 1920),
            "16:9": (1920, 1080),
            "1:1": (1080, 1080)
        }
        target_w, target_h = ratios.get(aspect_ratio, (1080, 1920))

        # Calculate crop to fill
        img_w, img_h = clip.size
        img_ratio = img_w / img_h
        target_ratio = target_w / target_h

        if img_ratio > target_ratio:
            # Image is wider - crop sides
            new_w = int(img_h * target_ratio)
            x_offset = (img_w - new_w) // 2
            clip = clip.crop(x1=x_offset, x2=x_offset + new_w)
        else:
            # Image is taller - crop top/bottom
            new_h = int(img_w / target_ratio)
            y_offset = (img_h - new_h) // 2
            clip = clip.crop(y1=y_offset, y2=y_offset + new_h)

        return clip.resize((target_w, target_h))

    def _apply_transitions(self, clips: list, preset) -> CompositeVideoClip:
        """Apply transitions between clips"""
        transition_func = transitions.get_transition(preset.transition_type)
        return transition_func(clips, duration=preset.transition_duration)

    def _add_text_overlays(
        self,
        video: CompositeVideoClip,
        lines: list[dict],
        style: str
    ) -> CompositeVideoClip:
        """Add script text as overlays"""
        text_clips = []
        for line in lines:
            text_clip = text_overlay.create_text_clip(
                text=line['text'],
                start=line['timing'],
                duration=line.get('duration', 3),
                style=style,
                video_size=video.size
            )
            text_clips.append(text_clip)

        return CompositeVideoClip([video] + text_clips)
```

### 4.3 Vibe Presets

```python
# app/presets/base.py

from dataclasses import dataclass
from typing import Literal

@dataclass
class VibePreset:
    name: str
    bpm_range: tuple[int, int]
    cut_style: Literal["fast", "medium", "slow"]
    base_cut_duration: float  # seconds
    transition_type: Literal["zoom_beat", "crossfade", "bounce", "slide", "cut"]
    transition_duration: float
    motion_style: Literal["zoom_in", "zoom_out", "pan", "static"]
    color_grade: Literal["vibrant", "cinematic", "bright", "natural", "bw"]
    text_style: Literal["bold_pop", "fade_in", "slide_in", "minimal"]
    effects: list[str]


# app/presets/exciting.py

from .base import VibePreset

EXCITING_PRESET = VibePreset(
    name="Exciting",
    bpm_range=(120, 140),
    cut_style="fast",
    base_cut_duration=0.5,  # Quick cuts synced to beats
    transition_type="zoom_beat",
    transition_duration=0.1,
    motion_style="zoom_in",
    color_grade="vibrant",
    text_style="bold_pop",
    effects=["shake_on_beat", "flash_transition", "glow"]
)


# app/presets/emotional.py

EMOTIONAL_PRESET = VibePreset(
    name="Emotional",
    bpm_range=(60, 80),
    cut_style="slow",
    base_cut_duration=2.5,  # Long, breathing cuts
    transition_type="crossfade",
    transition_duration=0.8,
    motion_style="pan",
    color_grade="cinematic",
    text_style="fade_in",
    effects=["film_grain", "vignette", "slight_desaturate"]
)


# app/presets/pop.py

POP_PRESET = VibePreset(
    name="Pop",
    bpm_range=(100, 120),
    cut_style="medium",
    base_cut_duration=1.0,
    transition_type="bounce",
    transition_duration=0.2,
    motion_style="zoom_out",
    color_grade="bright",
    text_style="slide_in",
    effects=["color_pop", "soft_glow"]
)


# app/presets/minimal.py

MINIMAL_PRESET = VibePreset(
    name="Minimal",
    bpm_range=(80, 120),
    cut_style="medium",
    base_cut_duration=1.5,
    transition_type="cut",
    transition_duration=0.0,
    motion_style="static",
    color_grade="natural",
    text_style="minimal",
    effects=[]
)


# app/presets/__init__.py

from .exciting import EXCITING_PRESET
from .emotional import EMOTIONAL_PRESET
from .pop import POP_PRESET
from .minimal import MINIMAL_PRESET

PRESETS = {
    "Exciting": EXCITING_PRESET,
    "Emotional": EMOTIONAL_PRESET,
    "Pop": POP_PRESET,
    "Minimal": MINIMAL_PRESET
}

def get_preset(vibe: str) -> VibePreset:
    return PRESETS.get(vibe, MINIMAL_PRESET)
```

### 4.4 Beat Sync Engine

```python
# app/services/beat_sync.py

import librosa
import numpy as np
from typing import Literal

class BeatSyncEngine:
    def calculate_cuts(
        self,
        beat_times: list[float],
        num_images: int,
        target_duration: float,
        cut_style: Literal["fast", "medium", "slow"]
    ) -> list[tuple[float, float]]:
        """
        Calculate image cut timings synced to beat points.
        Returns list of (start_time, end_time) tuples.
        """
        if not beat_times:
            # Fallback: even distribution
            duration_per_image = target_duration / num_images
            return [
                (i * duration_per_image, (i + 1) * duration_per_image)
                for i in range(num_images)
            ]

        # Filter beats within target duration
        valid_beats = [t for t in beat_times if t < target_duration]

        # Calculate beats per image based on style
        beats_per_cut = {
            "fast": 1,    # Cut every beat
            "medium": 2,  # Cut every 2 beats
            "slow": 4     # Cut every 4 beats (one bar)
        }

        step = beats_per_cut.get(cut_style, 2)

        # Select beat points for cuts
        cut_beats = [0.0]  # Start at 0
        for i in range(step - 1, len(valid_beats), step):
            if len(cut_beats) < num_images:
                cut_beats.append(valid_beats[i])

        # Ensure we have enough cuts for all images
        while len(cut_beats) < num_images:
            # Add interpolated points
            last = cut_beats[-1]
            avg_duration = target_duration / num_images
            cut_beats.append(min(last + avg_duration, target_duration))

        # Ensure last cut ends at target duration
        cut_beats.append(target_duration)

        # Create time ranges
        cuts = []
        for i in range(num_images):
            start = cut_beats[i]
            end = cut_beats[i + 1] if i + 1 < len(cut_beats) else target_duration
            cuts.append((start, end))

        return cuts

    def get_beat_intensity(
        self,
        beat_times: list[float],
        energy_curve: list[tuple[float, float]],
        time: float
    ) -> float:
        """
        Get the intensity at a specific time for effect strength.
        Returns 0-1 value.
        """
        # Find nearest energy point
        if not energy_curve:
            return 0.5

        for i, (t, e) in enumerate(energy_curve):
            if t >= time:
                if i == 0:
                    return e
                prev_t, prev_e = energy_curve[i - 1]
                # Linear interpolation
                ratio = (time - prev_t) / (t - prev_t)
                return prev_e + ratio * (e - prev_e)

        return energy_curve[-1][1]
```

### 4.5 Audio Analyzer

```python
# app/services/audio_analyzer.py

import librosa
import numpy as np

class AudioAnalyzer:
    def analyze(self, audio_path: str) -> dict:
        """
        Analyze audio file for BPM, beats, and energy.
        """
        # Load audio
        y, sr = librosa.load(audio_path, sr=22050)
        duration = librosa.get_duration(y=y, sr=sr)

        # Detect tempo and beats
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)

        # Calculate energy curve (RMS)
        hop_length = 512
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
        rms_times = librosa.frames_to_time(
            np.arange(len(rms)), sr=sr, hop_length=hop_length
        )

        # Normalize energy to 0-1
        rms_normalized = (rms - rms.min()) / (rms.max() - rms.min() + 1e-6)

        # Sample energy curve (every 0.5 seconds)
        energy_curve = []
        for t in np.arange(0, duration, 0.5):
            idx = int(t * sr / hop_length)
            if idx < len(rms_normalized):
                energy_curve.append((float(t), float(rms_normalized[idx])))

        # Suggest vibe based on tempo
        if tempo >= 120:
            suggested_vibe = "Exciting"
        elif tempo >= 100:
            suggested_vibe = "Pop"
        elif tempo >= 80:
            suggested_vibe = "Minimal"
        else:
            suggested_vibe = "Emotional"

        return {
            "bpm": int(round(tempo)),
            "beat_times": beat_times.tolist(),
            "energy_curve": energy_curve,
            "duration": float(duration),
            "suggested_vibe": suggested_vibe
        }

    def find_best_segment(
        self,
        audio_path: str,
        target_duration: float = 15.0
    ) -> tuple[float, float]:
        """
        Find the best segment of audio for the target duration.
        Returns (start_time, end_time) of highest energy segment.
        """
        y, sr = librosa.load(audio_path, sr=22050)
        total_duration = librosa.get_duration(y=y, sr=sr)

        if total_duration <= target_duration:
            return (0.0, total_duration)

        # Calculate RMS energy
        hop_length = 512
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

        # Find segment with highest average energy
        samples_per_segment = int(target_duration * sr / hop_length)
        best_start = 0
        best_energy = 0

        for i in range(len(rms) - samples_per_segment):
            segment_energy = np.mean(rms[i:i + samples_per_segment])
            if segment_energy > best_energy:
                best_energy = segment_energy
                best_start = i

        start_time = librosa.frames_to_time(best_start, sr=sr, hop_length=hop_length)
        end_time = start_time + target_duration

        return (float(start_time), float(end_time))
```

### 4.6 Docker Configuration

```dockerfile
# backend/compose-engine/Dockerfile

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/

# Create temp directory
RUN mkdir -p /tmp/compose

ENV PYTHONPATH=/app
ENV TEMP_DIR=/tmp/compose

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```txt
# backend/compose-engine/requirements.txt

fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# Video processing
moviepy==1.0.3
Pillow==10.2.0
numpy==1.26.3

# Audio processing
librosa==0.10.1
soundfile==0.12.1

# AWS/MinIO
boto3==1.34.14
aioboto3==12.2.0

# Redis for job queue
redis==5.0.1

# Utilities
python-dotenv==1.0.0
pydantic==2.5.3
pydantic-settings==2.1.0
httpx==0.26.0
aiofiles==23.2.1
```

```yaml
# docker-compose.override.yml (extends main docker-compose.yml)

version: '3.8'

services:
  compose-engine:
    build:
      context: ./backend/compose-engine
      dockerfile: Dockerfile
    ports:
      - "8001:8000"
    environment:
      - REDIS_URL=redis://redis:6379/1
      - S3_ENDPOINT=http://minio:9000
      - S3_ACCESS_KEY=${MINIO_ACCESS_KEY:-minioadmin}
      - S3_SECRET_KEY=${MINIO_SECRET_KEY:-minioadmin}
      - S3_BUCKET=${MINIO_BUCKET_NAME:-hydra-assets}
      - GOOGLE_SEARCH_API_KEY=${GOOGLE_SEARCH_API_KEY}
      - GOOGLE_SEARCH_CX=${GOOGLE_SEARCH_CX}
      - TEMP_DIR=/tmp/compose
    volumes:
      - ./backend/compose-engine:/app
      - compose-temp:/tmp/compose
    depends_on:
      - redis
      - minio
    restart: unless-stopped

volumes:
  compose-temp:
```

---

## 5. Frontend Implementation

### 5.1 Page Structure

```
app/(dashboard)/campaigns/[id]/compose/
└── page.tsx                    # Main compose wizard page

components/features/compose/
├── compose-wizard.tsx          # Wizard container with steps
├── compose-store.ts            # Zustand state management
├── steps/
│   ├── script-step.tsx         # Step 1: Script generation
│   ├── image-step.tsx          # Step 2: Image selection
│   ├── music-step.tsx          # Step 3: Music matching
│   └── render-step.tsx         # Step 4: Rendering
├── image-grid.tsx              # Selectable image grid
├── image-card.tsx              # Individual image with checkbox
├── music-list.tsx              # Audio list with preview
├── music-player.tsx            # Audio preview player
├── render-progress.tsx         # Rendering progress display
└── compose-preview.tsx         # Final video preview
```

### 5.2 State Management (Zustand)

```typescript
// components/features/compose/compose-store.ts

import { create } from 'zustand';

interface ScriptLine {
  text: string;
  timing: number;
  duration: number;
}

interface ImageCandidate {
  id: string;
  sourceUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  isSelected: boolean;
  sortOrder: number;
  qualityScore?: number;
}

interface AudioMatch {
  id: string;
  filename: string;
  s3Url: string;
  bpm: number;
  vibe: string;
  duration: number;
  matchScore: number;
}

interface ComposeState {
  // Current step (1-4)
  currentStep: number;

  // Step 1: Script
  artistName: string;
  trendKeywords: string[];
  userPrompt: string;
  script: {
    lines: ScriptLine[];
    totalDuration: number;
  } | null;
  vibe: string;
  searchKeywords: string[];
  suggestedBpmRange: { min: number; max: number };

  // Step 2: Images
  imageCandidates: ImageCandidate[];
  isLoadingImages: boolean;

  // Step 3: Music
  audioMatches: AudioMatch[];
  selectedAudioId: string | null;
  isLoadingMusic: boolean;

  // Step 4: Render
  effectPreset: string;
  aspectRatio: string;
  targetDuration: number;
  renderStatus: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
  renderProgress: number;
  renderStep: string;
  outputUrl: string | null;

  // Generation ID
  generationId: string | null;

  // Actions
  setCurrentStep: (step: number) => void;
  setScript: (script: any, vibe: string, keywords: string[], bpmRange: any) => void;
  setImageCandidates: (candidates: ImageCandidate[]) => void;
  toggleImageSelection: (id: string) => void;
  reorderImages: (fromIndex: number, toIndex: number) => void;
  setAudioMatches: (matches: AudioMatch[]) => void;
  setSelectedAudio: (id: string) => void;
  setRenderSettings: (settings: Partial<{ effectPreset: string; aspectRatio: string; targetDuration: number }>) => void;
  setRenderStatus: (status: string, progress: number, step: string, outputUrl?: string) => void;
  reset: () => void;
}

export const useComposeStore = create<ComposeState>((set) => ({
  // Initial state
  currentStep: 1,
  artistName: '',
  trendKeywords: [],
  userPrompt: '',
  script: null,
  vibe: '',
  searchKeywords: [],
  suggestedBpmRange: { min: 100, max: 120 },
  imageCandidates: [],
  isLoadingImages: false,
  audioMatches: [],
  selectedAudioId: null,
  isLoadingMusic: false,
  effectPreset: 'zoom_beat',
  aspectRatio: '9:16',
  targetDuration: 15,
  renderStatus: 'idle',
  renderProgress: 0,
  renderStep: '',
  outputUrl: null,
  generationId: null,

  // Actions
  setCurrentStep: (step) => set({ currentStep: step }),

  setScript: (script, vibe, keywords, bpmRange) => set({
    script,
    vibe,
    searchKeywords: keywords,
    suggestedBpmRange: bpmRange
  }),

  setImageCandidates: (candidates) => set({ imageCandidates: candidates }),

  toggleImageSelection: (id) => set((state) => ({
    imageCandidates: state.imageCandidates.map((img) =>
      img.id === id ? { ...img, isSelected: !img.isSelected } : img
    )
  })),

  reorderImages: (fromIndex, toIndex) => set((state) => {
    const images = [...state.imageCandidates];
    const [moved] = images.splice(fromIndex, 1);
    images.splice(toIndex, 0, moved);
    return {
      imageCandidates: images.map((img, idx) => ({ ...img, sortOrder: idx }))
    };
  }),

  setAudioMatches: (matches) => set({ audioMatches: matches }),

  setSelectedAudio: (id) => set({ selectedAudioId: id }),

  setRenderSettings: (settings) => set(settings),

  setRenderStatus: (status, progress, step, outputUrl) => set({
    renderStatus: status as any,
    renderProgress: progress,
    renderStep: step,
    outputUrl: outputUrl || null
  }),

  reset: () => set({
    currentStep: 1,
    script: null,
    vibe: '',
    searchKeywords: [],
    imageCandidates: [],
    audioMatches: [],
    selectedAudioId: null,
    renderStatus: 'idle',
    renderProgress: 0,
    outputUrl: null,
    generationId: null
  })
}));
```

### 5.3 Compose API Client

```typescript
// lib/compose-api.ts

import { apiClient } from './api';

export interface ScriptGenerationRequest {
  campaignId: string;
  artistName: string;
  artistContext?: string;
  trendKeywords: string[];
  userPrompt: string;
  targetDuration: number;
}

export interface ImageSearchRequest {
  generationId: string;
  keywords: string[];
  maxImages?: number;
  minWidth?: number;
  minHeight?: number;
}

export interface MusicMatchRequest {
  campaignId: string;
  vibe: string;
  bpmRange: { min: number; max: number };
  minDuration?: number;
}

export interface RenderRequest {
  generationId: string;
  audioAssetId: string;
  effectPreset: string;
  aspectRatio: string;
  targetDuration: number;
  textStyle?: string;
  colorGrade?: string;
}

export const composeApi = {
  // Step 1: Generate script
  generateScript: async (data: ScriptGenerationRequest) => {
    const response = await apiClient.post('/compose/script', data);
    return response.data;
  },

  // Step 2: Search images
  searchImages: async (data: ImageSearchRequest) => {
    const response = await apiClient.post('/compose/images/search', data);
    return response.data;
  },

  // Step 2: Update image selections
  updateImageSelections: async (
    generationId: string,
    selections: { id: string; isSelected: boolean; sortOrder: number }[]
  ) => {
    const response = await apiClient.patch('/compose/images/selection', {
      generationId,
      selections
    });
    return response.data;
  },

  // Step 2: Upload user images
  uploadImages: async (generationId: string, files: File[]) => {
    const formData = new FormData();
    formData.append('generationId', generationId);
    files.forEach((file) => formData.append('files', file));

    const response = await apiClient.post('/compose/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Step 3: Match music
  matchMusic: async (data: MusicMatchRequest) => {
    const response = await apiClient.post('/compose/music/match', data);
    return response.data;
  },

  // Step 3: Analyze audio BPM
  analyzeAudio: async (assetId: string) => {
    const response = await apiClient.post('/compose/music/analyze', { assetId });
    return response.data;
  },

  // Step 4: Start rendering
  startRender: async (data: RenderRequest) => {
    const response = await apiClient.post('/compose/render', data);
    return response.data;
  },

  // Step 4: Check render status
  getRenderStatus: async (generationId: string) => {
    const response = await apiClient.get(`/compose/${generationId}/status`);
    return response.data;
  },

  // Create compose generation record
  createComposeGeneration: async (campaignId: string, data: any) => {
    const response = await apiClient.post(`/campaigns/${campaignId}/compose`, data);
    return response.data;
  }
};
```

---

## 6. Environment Variables

### 6.1 New Variables to Add

```bash
# .env (add to existing file)

# ========== Compose Engine ==========

# Google Custom Search API (for image search)
GOOGLE_SEARCH_API_KEY=your-google-search-api-key
GOOGLE_SEARCH_CX=your-custom-search-engine-id

# Python Compose Engine URL
COMPOSE_ENGINE_URL=http://localhost:8001

# Compose Engine internal settings (for docker)
COMPOSE_REDIS_DB=1
COMPOSE_TEMP_DIR=/tmp/compose
```

### 6.2 Getting Google Custom Search API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable "Custom Search API"
4. Create credentials → API Key
5. Go to [Programmable Search Engine](https://programmablesearchengine.google.com/)
6. Create a new search engine
7. Set "Search the entire web" option
8. Get the Search Engine ID (cx)

---

## 7. Implementation Phases

### Phase 1: Python Video Rendering Engine (Week 1-2)

**Deliverables:**
- [ ] FastAPI project setup with Docker
- [ ] Basic MoviePy rendering pipeline
- [ ] Effect system (transitions, filters)
- [ ] BPM sync with librosa
- [ ] S3 upload integration

**Testing:**
```bash
# Test basic rendering
curl -X POST http://localhost:8001/render \
  -H "Content-Type: application/json" \
  -d '{"job_id": "test-1", "images": [...], "audio": {...}, "settings": {...}}'
```

### Phase 2: Image Search System (Week 2-3)

**Deliverables:**
- [ ] Google Custom Search API integration
- [ ] Image quality filtering
- [ ] S3 caching for images
- [ ] Thumbnail generation

### Phase 3: Next.js API & Database (Week 3-4)

**Deliverables:**
- [ ] Prisma schema migration
- [ ] All compose API routes
- [ ] Audio asset BPM tagging
- [ ] Python service proxy

### Phase 4: Frontend UI (Week 4-5)

**Deliverables:**
- [ ] Compose wizard page
- [ ] 4-step UI components
- [ ] Image grid with selection
- [ ] Music matching UI
- [ ] Render progress display

---

## 8. Testing Checklist

### 8.1 Unit Tests

- [ ] BeatSyncEngine.calculate_cuts()
- [ ] AudioAnalyzer.analyze()
- [ ] VideoRenderer._resize_for_aspect()
- [ ] All effect functions

### 8.2 Integration Tests

- [ ] Full render pipeline (images → video)
- [ ] Google Image Search API
- [ ] S3 upload/download
- [ ] API endpoint responses

### 8.3 E2E Tests

- [ ] Complete wizard flow
- [ ] Image selection and reordering
- [ ] Music preview and selection
- [ ] Render status polling
- [ ] Final video playback

---

## 9. Monitoring & Logging

### 9.1 Metrics to Track

- Render job queue depth
- Average render time per video
- API response times
- Image search cache hit rate
- Error rates by step

### 9.2 Log Format

```python
# Python logging
import structlog

logger = structlog.get_logger()

logger.info(
    "render_started",
    job_id=job_id,
    num_images=len(images),
    target_duration=settings['target_duration'],
    vibe=settings['vibe']
)
```

---

## 10. Future Enhancements

### 10.1 Short-term (V1.5)

- Image quality scoring with CLIP
- User-uploaded audio BPM auto-detection
- Multiple output format support (MP4, WebM)
- Render templates/presets saving

### 10.2 Long-term (V2.0)

- AI-assisted image selection
- Custom effect builder UI
- Batch compose generation
- A/B testing for different vibes
- Integration with existing Publishing pipeline

---

## Appendix A: API Error Codes

| Code | Description |
|------|-------------|
| COMPOSE_001 | Script generation failed |
| COMPOSE_002 | Image search returned no results |
| COMPOSE_003 | No matching audio found |
| COMPOSE_004 | Render job failed |
| COMPOSE_005 | Invalid aspect ratio |
| COMPOSE_006 | Audio asset not found |
| COMPOSE_007 | Python service unavailable |

---

## Appendix B: Vibe-Effect Reference

| Vibe | BPM | Cut Speed | Transition | Color | Text |
|------|-----|-----------|------------|-------|------|
| Exciting | 120-140 | 0.5s | Zoom Beat | Vibrant | Bold Pop |
| Emotional | 60-80 | 2.5s | Crossfade | Cinematic | Fade In |
| Pop | 100-120 | 1.0s | Bounce | Bright | Slide In |
| Minimal | 80-120 | 1.5s | Cut | Natural | Minimal |
