# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Compose Engine** is a video composition engine for the HYDRA platform. It creates AI-powered music video slideshows with beat-synchronized transitions, text overlays, and visual effects. The engine processes images, audio, and scripts to generate short-form social media videos optimized for TikTok and other platforms.

## Architecture

### Core Components

1. **FastAPI Application** (`app/main.py`)
   - Main entry point with router registration
   - Redis-based job queue for async rendering
   - Semaphore-based concurrency control (max 8 parallel jobs)
   - Health check and lifecycle management

2. **Rendering Pipeline** (`app/renderers/`)
   - **FFmpeg Renderer** (`ffmpeg_renderer.py`): Primary rendering engine using FFmpeg with GPU acceleration (NVENC)
   - **Smart Beat Sync** (`smart_beat_sync.py`): Adaptive slide duration algorithm that syncs transitions to music beats
   - **FFmpeg Pipeline** (`ffmpeg_pipeline.py`): Low-level FFmpeg command execution
   - **Filters**: Text overlays, color grading, Ken Burns effects

3. **Slideshow V2 Engine** (`app/slideshow_v2/`)
   - AI-powered composition system using Gemini API
   - **Conductor**: Orchestrates AI-based creative decisions
   - **Analyzers**: Audio analysis (BPM, beat detection with librosa), image analysis
   - **Generators**: Timeline generation based on music and content
   - **Renderer**: Executes the composition plan

4. **API Routers** (`app/routers/`)
   - `auto_compose.py`: Main endpoint for auto-generating videos from search queries
   - `ai.py`: AI-powered effect selection and optimization
   - `audio.py`: Audio analysis and processing
   - `video_edit.py`: Video editing operations
   - `publishing.py`: Publishing to social platforms

### Deployment Modes

1. **Local Development (Docker)**
   - CPU mode: `docker-compose --profile cpu up --build`
   - GPU mode: `docker-compose --profile gpu up --build` (requires NVIDIA Container Toolkit)
   - Native: `./run-local.sh --native`

2. **Modal Serverless** (`modal_app.py`)
   - GPU-accelerated rendering on Modal.com with NVIDIA T4 GPUs
   - NVENC hardware encoding (5-10x faster than CPU)
   - Direct deployment: `modal deploy modal_app.py`

3. **AWS Batch** (deprecated, files removed)

### Key Features

- **Smart Beat-Sync**: Automatically adapts slide duration (1.0-1.5s) to match music BPM while ensuring transitions occur exactly on beats
- **GPU Acceleration**: NVENC encoding with CUDA-accelerated image processing (cupy)
- **AI Composition**: Gemini-powered creative decisions for effects, timing, and visual flow
- **Audio Analysis**: Librosa-based BPM detection, beat tracking, and energy curve analysis
- **Text Overlays**: Subtitle/caption rendering with multiple styles (bold_pop, fade_in, slide_in, minimal)
- **Visual Effects**: Ken Burns motion, color grading, GL Transitions (OpenGL-based transitions)
- **TikTok Optimization**: Duration ranges, hooks, and engagement patterns optimized for TikTok

## Development Commands

### Running the Server

```bash
# Docker (CPU mode)
docker-compose --profile cpu up --build

# Docker (GPU mode, requires NVIDIA Container Toolkit)
docker-compose --profile gpu up --build

# Native (requires Python 3.11+, FFmpeg)
./run-local.sh --native

# Or directly with uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_beat_sync.py

# Run tests with output
pytest -v -s

# Local integration test (uses public Unsplash images)
python test_local.py

# Smart beat-sync test with different durations
python test-data/smart-beat-sync.py 15  # 15 second video
python test-data/smart-beat-sync.py 8   # 8 second video
```

### Modal Deployment

```bash
# Setup (one-time)
modal token new
modal secret create aws-s3-secret \
  AWS_ACCESS_KEY_ID=<key> \
  AWS_SECRET_ACCESS_KEY=<secret> \
  AWS_REGION=ap-northeast-2 \
  AWS_S3_BUCKET=hydra-assets-seoul

# Deploy to Modal
modal deploy modal_app.py

# Validate before deploy
python scripts/validate_before_deploy.py

# Test Docker image locally
python scripts/test_docker_image.py
```

### Docker Commands

```bash
# Build image
docker build -t hydra-compose .

# Run with GPU access
docker run --gpus all -it hydra-compose bash

# Inside container: test imports
python3 -c "import moviepy; print('OK')"
python3 -c "import cupy; print('GPU OK')"
```

## Important Implementation Details

### Smart Beat-Sync Algorithm

See `SMART_BEAT_SYNC_IMPLEMENTATION.md` for full details. Key points:

- Analyzes audio BPM and beat times using librosa
- Scores different beats-per-image options (1 beat, 2 beats, 3 beats, etc.)
- Selects optimal configuration to keep slides in 1.0-1.5s range
- Ensures transitions always occur exactly on beats
- Adapts to any BPM (40-200+) and any target duration (6s, 8s, 13s, 15s, 30s, etc.)

Usage in renderer:
```python
from .smart_beat_sync import SmartBeatSync

sync = SmartBeatSync(
    bpm=audio_analysis.bpm,
    beat_times=audio_analysis.beat_times,
    target_duration=target_duration,
    num_images=len(images),
    min_slide_duration=1.0,
    max_slide_duration=1.5,
)
sync_info = sync.get_sync_info()
clip_durations = sync_info['durations']  # Per-clip durations
```

### Audio Analysis

The `audio_analyzer.py` uses librosa for:
- BPM detection (tempo estimation)
- Beat tracking (exact beat timestamps)
- Energy curve analysis
- Optimal segment selection for target duration

### Text Overlays

Text rendering uses Pillow to generate PNG images, then overlays them with FFmpeg's `overlay` filter. This avoids FFmpeg's drawtext filter (which has font rendering issues in some builds).

Location: `app/renderers/filters/text_overlay.py`

### GPU Acceleration

- **NVENC**: Hardware video encoding (h264_nvenc encoder)
- **CUDA**: GPU-accelerated image operations via cupy
- **Requirements**: NVIDIA GPU with CUDA 12.4+, NVIDIA Container Toolkit for Docker

### Configuration

Environment variables (`.env`):
```bash
# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=hydra-assets-seoul

# Redis
REDIS_URL=redis://localhost:6379/1

# Database (Supabase PostgreSQL)
DATABASE_URL=

# Google APIs
GEMINI_API_KEY=
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=

# Rendering
MAX_CONCURRENT_JOBS=8
TEMP_DIR=/tmp/compose
USE_FFMPEG_PIPELINE=1
```

### GCP Authentication

The engine uses Google Cloud Platform for Vertex AI (video generation with Veo) via Centralized Workload Identity Federation (WIF):

**Authentication Flow (2-hop impersonation):**
```
AWS EC2 IAM Role → GCP Workload Identity Pool → Central SA (hyb-mgmt-prod) → Target SA (hyb-hydra-dev)
```

**Configuration:**
- **WIF Config**: `central-credential-config.json`
- **Central SA**: `sa-wif-hyb-hydra-dev@hyb-mgmt-prod.iam.gserviceaccount.com` (1st hop, auto via config)
- **Target SA**: `sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com` (2nd hop, via TARGET_SERVICE_ACCOUNT)
- **Project**: hyb-hydra-dev
- **Location**: us-central1

**Environment Variables:**
```bash
GOOGLE_APPLICATION_CREDENTIALS=/root/gcp-wif-config.json
TARGET_SERVICE_ACCOUNT=sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com
TARGET_PROJECT_ID=hyb-hydra-dev
```

**Benefits:**
- No service account key files to manage
- Automatic credential rotation
- Centralized access control via hyb-mgmt-prod
- Supports multi-project deployments

## Common Pitfalls

1. **FFmpeg Text Rendering**: Don't use FFmpeg's `drawtext` filter directly - it has font rendering issues. Use the Pillow-based text overlay system instead.

2. **Beat Sync**: Always use `SmartBeatSync` when audio analysis is available. Don't use simple fixed durations or naive BPM division.

3. **Concurrency**: The render semaphore limits parallel jobs to prevent OOM. Respect this in all render endpoints.

4. **Transitions**: Use direct cuts (no crossfade) for beat-synced videos. The `concatenate_clips_simple` function is used instead of transition-based concatenation.

5. **Image Cropping**: Use `crop` filter to fill aspect ratio (no black bars). The scale filter should be: `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`

6. **Audio Fades**: Use 0.75s fade in/out (defined in `AUDIO_FADE_IN` and `AUDIO_FADE_OUT` constants).

## API Request Format

Main rendering endpoint: `POST /api/v1/compose/auto-compose`

```json
{
  "job_id": "unique-id",
  "search_query": "sunset beach",
  "search_tags": ["ocean", "waves"],
  "audio_url": "s3://...",
  "vibe": "Pop",
  "effect_preset": "zoom_beat",
  "color_grade": "vibrant",
  "text_style": "bold_pop",
  "aspect_ratio": "9:16",
  "target_duration": 15,
  "callback_url": "https://...",
  "script_lines": [
    {"text": "Line 1", "timing": 0.0, "duration": 2.0},
    {"text": "Line 2", "timing": 2.0, "duration": 2.0}
  ]
}
```

## Code Style

- Async/await for all I/O operations
- Comprehensive logging with structured job IDs: `logger.info(f"[{job_id}] message")`
- Type hints using Pydantic models
- Error handling with try/except and proper cleanup
- Resource cleanup using context managers and finally blocks
