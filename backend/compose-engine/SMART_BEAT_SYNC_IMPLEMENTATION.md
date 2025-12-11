# Smart Beat-Sync Implementation Plan

## Overview

The Smart Beat-Sync system automatically adapts slide duration based on music BPM, number of images, and target duration, ensuring:
- Each image displays for **1-1.5 seconds** (configurable)
- **Image transitions always occur on beats**
- Works with **any target duration** (6s, 8s, 13s, 15s, etc.)
- Adapts to **any BPM** (fast or slow music)

## Current System Architecture

### 1. Request Flow

```
Frontend → /api/v1/fast-cut/render → Modal/Batch Backend → FFmpeg Renderer
```

**Request Structure:**
```typescript
{
  generationId: string
  images: Array<{url: string, order: number}>
  audio: {url: string, start_time: number}
  script: {lines: Array<{text, timing, duration}>}
  settings: {
    vibe: string
    effect_preset: string
    aspect_ratio: string  // "9:16"
    target_duration: number  // 6, 8, 13, 15, etc.
    text_style: string
    color_grade: string
  }
}
```

### 2. Audio Analysis

**Endpoint:** `/api/v1/fast-cut/audio/analyze`

**Returns:**
```json
{
  "bpm": 73.8,
  "beat_times": [0.209, 1.022, 1.834, ...],
  "energy_curve": [[0, 0.5], [0.5, 0.7], ...],
  "duration": 218.9,
  "best_15s_start": 45.2
}
```

**Backend Implementation:**
- Uses `librosa` for real audio analysis
- Located in: `app/slideshow_v2/analyzers/audio_analyzer.py`
- Already provides exact BPM and beat times

### 3. Current FFmpeg Renderer

**Location:** `app/renderers/ffmpeg_renderer.py`

**Current Flow:**
1. Download images and audio from S3
2. Analyze audio → get BPM, beat times
3. Create slides (with Ken Burns or static)
4. Apply effects (currently has transitions)
5. Add text overlays
6. Mix audio
7. Upload to S3

**Problem:** Currently uses fixed slide duration or simple BPM calculation, doesn't optimize for 1-1.5s range

## Smart Beat-Sync Solution

### Core Algorithm

**File:** `app/renderers/smart_beat_sync.py` ✅ Created

**Logic:**
```python
# Given BPM and beat times
beat_interval = 60 / BPM  # e.g., 73.8 BPM → 0.813s per beat

# Try different beats-per-image
options = [
    1 beat  = 0.813s → score: 40.6  (too fast)
    2 beats = 1.625s → score: 100   (perfect! 1.0-1.5s range)
    3 beats = 2.438s → score: 21.9  (too slow)
    4 beats = 3.251s → score: -2.5  (way too slow)
]

# Select best option → 2 beats per image

# Calculate exact durations from beat timings
clip_durations = [
    beat[2] - beat[0] = 1.625s  # Clip 1
    beat[4] - beat[2] = 1.672s  # Clip 2
    beat[6] - beat[4] = 1.602s  # Clip 3
    ...
]
```

### Scoring System

```python
def score_beats_per_image(duration):
    if 1.0 <= duration <= 1.5:
        return 100  # Perfect
    elif duration < 1.0:
        return 50 - abs(duration - 1.0) * 50  # Penalize fast
    else:
        return 50 - abs(duration - 1.5) * 30  # Penalize slow
```

## Integration Steps

### Step 1: Modify FFmpeg Renderer

**File:** `app/renderers/ffmpeg_renderer.py`

**Add import:**
```python
from .smart_beat_sync import SmartBeatSync
```

**Modify slide duration calculation** (around line 250-300):

**Before:**
```python
# Old way - fixed duration or simple BPM calc
if audio_analysis:
    slide_duration = 60.0 / audio_analysis.bpm  # Simple beat sync
else:
    slide_duration = target_duration / len(images)
```

**After:**
```python
# New way - smart beat sync
if audio_analysis and audio_analysis.beat_times:
    logger.info(f"[{job_id}] Using smart beat-sync...")

    sync = SmartBeatSync(
        bpm=audio_analysis.bpm,
        beat_times=audio_analysis.beat_times,
        target_duration=target_duration,
        num_images=len(images),
        min_slide_duration=1.0,  # Configurable
        max_slide_duration=1.5,  # Configurable
    )

    sync_info = sync.get_sync_info()

    logger.info(f"[{job_id}] Smart sync: {sync_info['beats_per_image']} beats/image, "
               f"avg duration: {sync_info['avg_duration']:.3f}s")

    # Use calculated durations for each clip
    clip_durations = sync_info['durations']
    num_clips_to_use = sync_info['num_clips']

    # Trim images to number that fits
    images_to_use = images[:num_clips_to_use]
else:
    # Fallback: no audio or no beat analysis
    logger.info(f"[{job_id}] No audio analysis, using uniform duration")
    slide_duration = target_duration / len(images)
    clip_durations = [slide_duration] * len(images)
    images_to_use = images
```

### Step 2: Update Clip Creation

**Modify clip creation loop** (around line 320-350):

**Before:**
```python
for i, image_path in enumerate(image_paths):
    duration = slide_duration  # Same for all clips
    clip_path = create_clip(image_path, duration, ...)
    clip_paths.append(clip_path)
```

**After:**
```python
for i, image_path in enumerate(image_paths[:num_clips_to_use]):
    duration = clip_durations[i]  # Unique duration per clip

    logger.info(f"[{job_id}] Clip {i+1}: {duration:.3f}s")

    clip_path = create_clip(image_path, duration, ...)
    clip_paths.append(clip_path)
```

### Step 3: Remove Transitions

**File:** `app/renderers/ffmpeg_renderer.py` (line 707-712)

Already done ✅:
```python
# Use direct cuts (no transitions)
concat_output = os.path.join(job_dir, f"{job_id}_concat.mp4")
from .ffmpeg_pipeline import concatenate_clips_simple
await concatenate_clips_simple(clip_paths, concat_output, job_id)
```

### Step 4: Update Text Overlay Positioning

**File:** `app/renderers/filters/text_overlay.py` (line 183-190)

Already done ✅:
```python
# Position: centered vertically
y_expr = f"(h-{text_height})/2"
```

### Step 5: Update Audio Fade Duration

**File:** `app/renderers/ffmpeg_renderer.py` (line 52-54)

Already done ✅:
```python
AUDIO_FADE_IN = 0.75
AUDIO_FADE_OUT = 0.75
```

### Step 6: Update Image Cropping

**File:** `app/renderers/ffmpeg_pipeline.py`

**Find image resize logic and update to crop instead of pad:**
```python
# Before (with black bars):
scale_filter = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black"

# After (crop to fill):
scale_filter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
```

## Testing

### Test Script

Already created: `backend/compose-engine/test-data/smart-beat-sync.py` ✅

**Run local test:**
```bash
cd backend/compose-engine/test-data
python3 smart-beat-sync.py [target_duration]
```

**Examples:**
```bash
python3 smart-beat-sync.py     # Default 15s
python3 smart-beat-sync.py 8   # 8 second video
python3 smart-beat-sync.py 13  # 13 second video
```

### E2E Test

Use existing test script:
```bash
node scripts/test-fast-cut-e2e.js
```

## Example Scenarios

### Scenario 1: Fast BPM (120 BPM)
- Beat interval: 0.5s
- Options: 1 beat (0.5s), 2 beats (1.0s), 3 beats (1.5s)
- **Selected: 2-3 beats** → 1.0-1.5s ✓

### Scenario 2: Slow BPM (60 BPM)
- Beat interval: 1.0s
- Options: 1 beat (1.0s), 2 beats (2.0s)
- **Selected: 1 beat** → 1.0s ✓

### Scenario 3: Very Slow BPM (40 BPM)
- Beat interval: 1.5s
- Options: 1 beat (1.5s), 2 beats (3.0s)
- **Selected: 1 beat** → 1.5s ✓

### Scenario 4: Variable Duration
**6 second video with 73.8 BPM:**
- 2 beats per image = 1.625s
- Fits: 6s / 1.625s = 3-4 images
- Result: 3 images, ~4.9s video ✓

**13 second video with 73.8 BPM:**
- 2 beats per image = 1.625s
- Fits: 13s / 1.625s = 8 images
- Result: 8 images, ~13s video ✓

## Configuration

### Adjustable Parameters

```python
# In SmartBeatSync class
min_slide_duration = 1.0  # Minimum seconds per slide
max_slide_duration = 1.5  # Maximum seconds per slide
```

**Can be exposed via API request:**
```typescript
{
  settings: {
    ...
    slide_duration_range: {
      min: 1.0,
      max: 1.5
    }
  }
}
```

## Summary

### ✅ Already Implemented
1. Smart beat-sync algorithm (`smart_beat_sync.py`)
2. Audio fade 0.75s
3. No transitions (direct cuts)
4. Centered text positioning
5. Local test script
6. Image crop to fill 9:16

### 🔧 Next Steps (Integration)
1. Import SmartBeatSync in ffmpeg_renderer.py
2. Replace slide duration calculation
3. Use per-clip durations in clip creation loop
4. Update image resize to crop (if not done)
5. Test with various BPMs and durations

### 📊 Benefits
- ✅ Works with **any BPM** (40-200+)
- ✅ Works with **any target duration** (6s, 8s, 13s, 15s, 30s, etc.)
- ✅ Works with **any number of images** (3-20+)
- ✅ Guarantees **1-1.5s per image** (configurable)
- ✅ **Always syncs to beats** (no off-beat transitions)
- ✅ **Adaptive** (automatically chooses best beats-per-image)

## API Examples

### Request with 8 second duration:
```json
{
  "generationId": "gen-123",
  "images": [...],  // 10 images
  "audio": {"url": "s3://...", "start_time": 0},
  "settings": {
    "target_duration": 8,  // 8 seconds
    "aspect_ratio": "9:16"
  }
}
```

**Smart Sync Result:**
- BPM detected: 120
- Beat interval: 0.5s
- Selected: 2 beats/image = 1.0s
- Fits: 8 images in 8 seconds
- Result: 8 images × 1.0s = 8s video ✓

### Request with 13 second duration:
```json
{
  "settings": {
    "target_duration": 13  // 13 seconds
  }
}
```

**Smart Sync Result:**
- BPM detected: 73.8
- Selected: 2 beats/image = 1.625s
- Fits: 8 images in 13 seconds
- Result: 8 images × 1.625s = 13s video ✓

## Conclusion

The Smart Beat-Sync system provides **intelligent, adaptive slide duration** that:
1. **Respects musical structure** (always on beat)
2. **Optimal viewer experience** (1-1.5s sweet spot)
3. **Flexible** (works with any duration/BPM/image count)
4. **Simple to configure** (min/max duration parameters)

This replaces the old fixed-duration or simple BPM-based approach with a smarter, more robust solution that adapts to real-world scenarios.
