"""
Modal App for Video Rendering with GPU Acceleration (NVENC).

This is the ONLY backend needed for video composition.
Next.js calls Modal directly - no Railway needed.

Architecture:
  Next.js (Vercel) → Modal (GPU T4 + NVENC) → S3

GPU Stack:
  - Base: nvidia/cuda:12.4.0-devel-ubuntu22.04
  - FFmpeg: jellyfin-ffmpeg6 (has h264_nvenc/hevc_nvenc baked in)
  - Encoder: h264_nvenc (NVIDIA GPU encoder, 5-10x faster than CPU)

Deploy:
  cd backend/compose-engine
  modal deploy modal_app.py

Setup:
  1. modal token new
  2. modal secret create aws-s3-secret \
       AWS_ACCESS_KEY_ID=<your-access-key> \
       AWS_SECRET_ACCESS_KEY=<your-secret-key> \
       AWS_REGION=ap-northeast-2 \
       AWS_S3_BUCKET=hydra-assets-seoul
  3. modal deploy modal_app.py

Endpoints (auto-generated):
  - POST https://modawnai--hydra-compose-engine-submit-render.modal.run
  - GET  https://modawnai--hydra-compose-engine-get-render-status.modal.run

Performance Optimizations:
  - NVENC GPU encoding (h264_nvenc) - 5-10x faster than CPU
  - Parallel image downloads (asyncio.gather)
  - Parallel image processing (ThreadPoolExecutor)
  - Container warmup with scaledown_window
  - Connection pooling for S3 operations
  - Retry logic with exponential backoff
"""

import modal
from pathlib import Path

# ============================================================================
# Modal App Configuration
# ============================================================================

# Use custom Dockerfile for reproducible builds
# This ensures the same environment locally (docker build) and on Modal
# Jellyfin FFmpeg is installed FIRST, before any Python packages
video_image = (
    modal.Image.from_dockerfile(
        Path(__file__).parent / "Dockerfile",
        # Context directory for Dockerfile's COPY commands
        context_dir=Path(__file__).parent,
        # Ignore unnecessary files to speed up build
        ignore=["__pycache__", "*.pyc", ".git", "scripts/test_*.py"],
    )
    .entrypoint([])  # Remove chatty NVIDIA prints on container start
)

# Create the Modal app
app = modal.App(name="hydra-compose-engine", image=video_image)

# Create a cache volume for faster subsequent renders
cache_volume = modal.Volume.from_name("hydra-render-cache", create_if_missing=True)


# ============================================================================
# Video Rendering Function (GPU with NVENC h264_nvenc)
# ============================================================================

def send_callback(callback_url: str, callback_secret: str, job_id: str, status: str, output_url: str | None, error: str | None):
    """Send completion callback to Next.js. Fire-and-forget, never fails the render."""
    import httpx

    try:
        payload = {
            "job_id": job_id,
            "status": status,
            "output_url": output_url,
            "error": error,
            "secret": callback_secret,
        }
        print(f"[{job_id}] Sending callback to {callback_url}")

        with httpx.Client(timeout=30.0) as client:  # 30s to handle Vercel cold starts
            response = client.post(callback_url, json=payload)
            print(f"[{job_id}] Callback response: {response.status_code}")
            if response.status_code != 200:
                print(f"[{job_id}] Callback body: {response.text[:200]}")
    except Exception as e:
        print(f"[{job_id}] Callback failed (non-fatal): {e}")


@app.function(
    gpu="T4",  # NVIDIA T4 GPU - NVENC encoder + CUDA for cupy
    timeout=600,  # 10 minutes max per video
    memory=16384,  # 16GB RAM for parallel processing
    cpu=8.0,  # 8 CPU cores for parallel image/audio processing
    secrets=[modal.Secret.from_name("aws-s3-secret"), modal.Secret.from_name("custom-secret")],
    retries=2,  # Auto-retry on failure
    scaledown_window=300,  # Keep container warm for 5 minutes (faster cold starts)
    volumes={"/cache": cache_volume},  # Persistent cache for audio/image analysis
    max_containers=8,  # Limit to max 8 concurrent GPU workers
)
def render_video(request_data: dict) -> dict:
    """
    Render a video using MoviePy with GPU encoding (NVENC h264_nvenc).

    Args:
        request_data: Dictionary containing RenderRequest fields
            - callback_url: Optional URL to POST completion status
            - callback_secret: Secret for callback authentication

    Returns:
        Dictionary with status, output_url, and metadata
    """
    import sys
    import os
    import asyncio
    import traceback

    # Extract callback info before parsing request
    callback_url = request_data.pop("callback_url", None)
    callback_secret = request_data.pop("callback_secret", "")

    # Enable GPU encoding (NVENC)
    os.environ["USE_NVENC"] = "1"

    # Add app to path
    sys.path.insert(0, "/root")

    from app.models.render_job import RenderRequest
    from app.services.video_renderer import VideoRenderer

    # Parse request
    request = RenderRequest(**request_data)
    job_id = request.job_id

    print(f"[{job_id}] === Starting GPU render on Modal (NVENC h264_nvenc) ===")
    print(f"[{job_id}] Images: {len(request.images)}")
    print(f"[{job_id}] Vibe: {request.settings.vibe.value}")
    print(f"[{job_id}] Aspect Ratio: {request.settings.aspect_ratio.value}")
    print(f"[{job_id}] Target Duration: {request.settings.target_duration}s")
    print(f"[{job_id}] Script: {request.script}")
    print(f"[{job_id}] Script lines: {len(request.script.lines) if request.script and request.script.lines else 0}")
    print(f"[{job_id}] Callback: {'enabled' if callback_url else 'disabled'}")

    try:
        # Create renderer
        renderer = VideoRenderer()

        # Progress callback (logs only in Modal environment)
        async def progress_callback(job_id: str, progress: int, step: str):
            print(f"[{job_id}] [{progress:3d}%] {step}")

        # Run the async render
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            output_url = loop.run_until_complete(
                renderer.render(request, progress_callback)
            )
        finally:
            loop.close()

        print(f"[{job_id}] === Render complete ===")
        print(f"[{job_id}] Output: {output_url}")

        # Send callback on success
        if callback_url:
            send_callback(callback_url, callback_secret, job_id, "completed", output_url, None)

        return {
            "status": "completed",
            "job_id": job_id,
            "output_url": output_url,
            "error": None,
        }

    except Exception as e:
        error_msg = str(e)
        print(f"[{job_id}] === Render FAILED ===")
        print(f"[{job_id}] Error: {error_msg}")
        print(f"[{job_id}] Traceback:\n{traceback.format_exc()}")

        # Send callback on failure
        if callback_url:
            send_callback(callback_url, callback_secret, job_id, "failed", None, error_msg)

        return {
            "status": "failed",
            "job_id": job_id,
            "output_url": None,
            "error": error_msg,
        }


@app.function(
    timeout=600,
    memory=4096,  # 4GB RAM for CPU rendering
    cpu=4.0,  # More CPU cores for parallel processing
    secrets=[modal.Secret.from_name("aws-s3-secret"), modal.Secret.from_name("custom-secret")],
    retries=2,
    scaledown_window=300,  # Keep container warm for 5 minutes
    volumes={"/cache": cache_volume},
    max_containers=8,  # Limit to max 8 concurrent CPU workers
)
def render_video_cpu(request_data: dict) -> dict:
    """
    Render a video using CPU (fallback for cost savings on simple videos).

    Args:
        request_data: Dictionary containing RenderRequest fields
            - callback_url: Optional URL to POST completion status
            - callback_secret: Secret for callback authentication

    Returns:
        Dictionary with status, output_url, and metadata
    """
    import sys
    import os
    import asyncio
    import traceback

    # Extract callback info before parsing request
    callback_url = request_data.pop("callback_url", None)
    callback_secret = request_data.pop("callback_secret", "")

    # Add app to path
    sys.path.insert(0, "/root")

    from app.models.render_job import RenderRequest
    from app.services.video_renderer import VideoRenderer

    # Parse request
    request = RenderRequest(**request_data)
    job_id = request.job_id

    print(f"[{job_id}] Starting CPU render on Modal")
    print(f"[{job_id}] Callback: {'enabled' if callback_url else 'disabled'}")

    try:
        renderer = VideoRenderer()

        async def progress_callback(job_id: str, progress: int, step: str):
            print(f"[{job_id}] [{progress:3d}%] {step}")

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            output_url = loop.run_until_complete(
                renderer.render(request, progress_callback)
            )
        finally:
            loop.close()

        print(f"[{job_id}] Render complete: {output_url}")

        # Send callback on success
        if callback_url:
            send_callback(callback_url, callback_secret, job_id, "completed", output_url, None)

        return {
            "status": "completed",
            "job_id": job_id,
            "output_url": output_url,
            "error": None,
        }

    except Exception as e:
        error_msg = str(e)
        print(f"[{job_id}] Render failed: {error_msg}")
        print(f"[{job_id}] Traceback:\n{traceback.format_exc()}")

        # Send callback on failure
        if callback_url:
            send_callback(callback_url, callback_secret, job_id, "failed", None, error_msg)

        return {
            "status": "failed",
            "job_id": job_id,
            "output_url": None,
            "error": error_msg,
        }


# ============================================================================
# Web Endpoints (Called by Next.js)
# ============================================================================

@app.function(
    secrets=[modal.Secret.from_name("aws-s3-secret"), modal.Secret.from_name("custom-secret")],
)
@modal.fastapi_endpoint(method="POST")
def submit_render(request_data: dict):
    """
    Submit a render job and return immediately with a call ID for polling.

    Called by: Next.js /api/v1/compose/render

    POST /submit_render
    Body: RenderRequest JSON + { use_gpu: bool }
    Returns: { call_id, job_id, status, message }
    """
    job_id = request_data.get("job_id", "unknown")
    use_gpu = request_data.pop("use_gpu", True)

    print(f"[{job_id}] Received render request (GPU: {use_gpu})")

    # Spawn the render function (async - returns immediately)
    if use_gpu:
        call = render_video.spawn(request_data)
    else:
        call = render_video_cpu.spawn(request_data)

    print(f"[{job_id}] Spawned Modal function: {call.object_id}")

    return {
        "call_id": call.object_id,
        "job_id": job_id,
        "status": "queued",
        "message": f"Render job queued (GPU: {use_gpu})",
    }


@app.function()
@modal.fastapi_endpoint(method="GET")
def get_render_status(call_id: str):
    """
    Poll for render job status.

    Called by: Next.js /api/v1/compose/[id]/status

    GET /get_render_status?call_id=xxx
    Returns: { status, result } or 202 if still processing
    """
    import fastapi

    try:
        function_call = modal.FunctionCall.from_id(call_id)
        result = function_call.get(timeout=0)

        return {
            "status": result.get("status", "completed"),
            "result": result,
        }
    except TimeoutError:
        # Still processing - return 202 Accepted
        return fastapi.responses.JSONResponse(
            {"status": "processing", "call_id": call_id},
            status_code=202
        )
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


# Health check removed to save web endpoint quota
# Batch processing endpoints removed - use individual submit_render calls instead


# ============================================================================
# TikTok Trends Scraping (RapidAPI - ScrapTik)
# ============================================================================

# Lightweight image for API-based scraping (no browser needed)
scraper_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "httpx==0.26.0",
        "pydantic==2.5.3",
        "fastapi[standard]",
    )
    .run_commands(
        "mkdir -p /root/app/services",
    )
    .add_local_file(
        Path(__file__).parent / "app" / "services" / "tiktok_scraper.py",
        remote_path="/root/app/services/tiktok_scraper.py",
        copy=True
    )
)


@app.function(
    image=scraper_image,
    timeout=60,  # 1 minute max (API calls are fast)
    memory=512,  # 512MB RAM (no browser needed)
    cpu=0.5,
    retries=2,
    scaledown_window=60,
)
def scrape_tiktok_trends(request_data: dict) -> dict:
    """
    Scrape TikTok trends using RapidAPI (ScrapTik).

    Args:
        request_data: Dictionary containing:
            - action: 'collect' | 'search' | 'hashtag'
            - keywords: list of keywords (for collect/search)
            - hashtags: list of hashtags (for collect/hashtag)
            - include_explore: bool (for collect)
            - keyword: single keyword (for search)
            - hashtag: single hashtag (for hashtag)
            - limit: max results (for search)

    Returns:
        Dictionary with scraping results
    """
    import sys
    import asyncio

    sys.path.insert(0, "/root")

    from app.services.tiktok_scraper import (
        collect_tiktok_trends,
        search_tiktok,
        scrape_hashtag_page,
    )

    action = request_data.get("action", "collect")

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        if action == "collect":
            result = loop.run_until_complete(
                collect_tiktok_trends(
                    keywords=request_data.get("keywords", []),
                    hashtags=request_data.get("hashtags", []),
                    include_explore=request_data.get("include_explore", True),
                )
            )
            return {
                "success": result.success,
                "method": result.method,
                "trends": result.trends,
                "error": result.error,
            }

        elif action == "search":
            keyword = request_data.get("keyword", "")
            limit = request_data.get("limit", 40)
            result = loop.run_until_complete(search_tiktok(keyword, limit))
            return {
                "success": result.success,
                "keyword": keyword,
                "videos": result.videos,
                "related_hashtags": result.related_hashtags,
                "error": result.error,
            }

        elif action == "hashtag":
            hashtag = request_data.get("hashtag", "")
            result = loop.run_until_complete(scrape_hashtag_page(hashtag))
            return {
                "success": result.success,
                "hashtag": hashtag,
                "info": result.info,
                "videos": result.videos,
                "error": result.error,
            }

        else:
            return {"success": False, "error": f"Unknown action: {action}"}

    except Exception as e:
        import traceback
        print(f"[TIKTOK] Scraping failed: {e}")
        print(traceback.format_exc())
        return {"success": False, "error": str(e)}
    finally:
        loop.close()


@app.function(image=scraper_image)
@modal.fastapi_endpoint(method="POST")
def collect_trends_endpoint(request_data: dict):
    """
    Unified TikTok trends endpoint - handles collect, search, and hashtag actions.

    POST /collect_trends_endpoint
    Body: {
        action: 'collect' | 'search' | 'hashtag',
        keywords: [] (for collect),
        hashtags: [] (for collect),
        include_explore: bool (for collect),
        keyword: str (for search),
        hashtag: str (for hashtag),
        limit: int (for search, default 40),
        secret: str (optional auth)
    }
    Returns: varies by action
    """
    action = request_data.get("action", "collect")
    print(f"[TIKTOK] {action} request: {request_data}")

    # Run the scraper
    result = scrape_tiktok_trends.remote(request_data)

    return result


# ============================================================================
# Audio Processing (FFmpeg-based)
# ============================================================================

# Reuse the video_image which has FFmpeg installed
@app.function(
    timeout=300,  # 5 minutes max
    memory=4096,  # 4GB RAM
    cpu=2.0,
    secrets=[modal.Secret.from_name("aws-s3-secret"), modal.Secret.from_name("custom-secret")],
    retries=2,
    scaledown_window=120,
)
def compose_audio(request_data: dict) -> dict:
    """
    Compose video with audio track using FFmpeg.
    Optionally adds subtitles/captions overlay.

    Args:
        request_data: Dictionary containing:
            - video_url: URL of the video file
            - audio_url: URL of the audio file
            - audio_start_time: Start time in audio (seconds)
            - audio_volume: Volume level (0.0 - 1.0)
            - fade_in: Fade in duration (seconds)
            - fade_out: Fade out duration (seconds)
            - mix_original_audio: Whether to mix with original audio
            - original_audio_volume: Original audio volume if mixing
            - output_s3_bucket: S3 bucket for output
            - output_s3_key: S3 key for output
            - subtitles: Optional list of subtitle entries:
                [{ "text": "가사 텍스트", "start": 0.0, "end": 3.0 }, ...]

    Returns:
        Dictionary with status, output_url, duration, error
    """
    import os
    import subprocess
    import tempfile
    import httpx
    import boto3
    from pathlib import Path

    job_id = request_data.get("job_id", "audio-compose")
    print(f"[{job_id}] Starting audio composition on Modal")

    try:
        # Extract parameters
        video_url = request_data["video_url"]
        audio_url = request_data["audio_url"]
        audio_start_time = request_data.get("audio_start_time", 0)
        audio_volume = request_data.get("audio_volume", 1.0)
        fade_in = request_data.get("fade_in", 0)
        fade_out = request_data.get("fade_out", 0)
        mix_original_audio = request_data.get("mix_original_audio", False)
        original_audio_volume = request_data.get("original_audio_volume", 0.3)
        output_s3_bucket = request_data.get("output_s3_bucket")
        output_s3_key = request_data.get("output_s3_key")
        subtitles = request_data.get("subtitles", [])  # [{"text": "...", "start": 0.0, "end": 3.0}]

        # FFmpeg path (jellyfin-ffmpeg)
        ffmpeg_path = os.environ.get("FFMPEG_BINARY", "/usr/lib/jellyfin-ffmpeg/ffmpeg")
        ffprobe_path = os.environ.get("FFPROBE_BINARY", "/usr/lib/jellyfin-ffmpeg/ffprobe")

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir = Path(temp_dir)
            video_path = temp_dir / "input_video.mp4"
            audio_path = temp_dir / "input_audio.mp3"
            output_path = temp_dir / "output.mp4"

            # Download video and audio
            print(f"[{job_id}] Downloading video and audio...")
            with httpx.Client(timeout=60.0) as client:
                # Download video
                response = client.get(video_url, follow_redirects=True)
                response.raise_for_status()
                video_path.write_bytes(response.content)

                # Download audio
                response = client.get(audio_url, follow_redirects=True)
                response.raise_for_status()
                audio_path.write_bytes(response.content)

            # Get video duration using ffprobe
            print(f"[{job_id}] Getting video duration...")
            probe_cmd = [
                ffprobe_path, "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(video_path)
            ]
            result = subprocess.run(probe_cmd, capture_output=True, text=True)
            video_duration = float(result.stdout.strip()) if result.stdout.strip() else 0
            print(f"[{job_id}] Video duration: {video_duration}s")

            # Build FFmpeg command
            print(f"[{job_id}] Building FFmpeg command...")

            # Audio filters
            audio_filters = []

            # Trim audio if start time specified
            if audio_start_time > 0:
                audio_filters.append(f"atrim=start={audio_start_time}")
                audio_filters.append("asetpts=PTS-STARTPTS")

            # Apply volume
            if audio_volume != 1.0:
                audio_filters.append(f"volume={audio_volume}")

            # Apply fade in
            if fade_in > 0:
                audio_filters.append(f"afade=t=in:st=0:d={fade_in}")

            # Apply fade out
            if fade_out > 0:
                fade_out_start = video_duration - fade_out
                audio_filters.append(f"afade=t=out:st={fade_out_start}:d={fade_out}")

            # Trim audio to video duration
            audio_filters.append(f"atrim=duration={video_duration}")

            # Build complex filter
            if mix_original_audio:
                complex_filter = f"[0:a]volume={original_audio_volume}[oa];[1:a]{','.join(audio_filters)}[na];[oa][na]amix=inputs=2:duration=first[aout]"
            else:
                complex_filter = f"[1:a]{','.join(audio_filters)}[aout]"

            # Build video filter for subtitles if provided
            video_filters = []
            if subtitles:
                print(f"[{job_id}] Adding {len(subtitles)} subtitle lines")
                # Noto Sans CJK for Korean/CJK support (installed via fonts-noto-cjk)
                font_path = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
                fallback_font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

                # Check which font exists
                import os.path
                if os.path.exists(font_path):
                    selected_font = font_path
                elif os.path.exists(fallback_font):
                    selected_font = fallback_font
                else:
                    selected_font = "Sans"  # System default

                print(f"[{job_id}] Using font: {selected_font}")

                for idx, sub in enumerate(subtitles):
                    text = sub.get("text", "").replace("'", "\\'").replace(":", "\\:")
                    start = float(sub.get("start", 0))
                    end = float(sub.get("end", start + 3))

                    # FFmpeg drawtext filter for each subtitle
                    # Position at bottom 18% (TikTok safe zone)
                    # White text with black outline for visibility
                    drawtext = (
                        f"drawtext=fontfile='{selected_font}'"
                        f":text='{text}'"
                        f":fontsize=48"
                        f":fontcolor=white"
                        f":borderw=3"
                        f":bordercolor=black"
                        f":x=(w-text_w)/2"
                        f":y=h-h*0.18"
                        f":enable='between(t,{start},{end})'"
                    )
                    video_filters.append(drawtext)

            # FFmpeg command
            if video_filters:
                # When adding subtitles, we need to re-encode video
                # Note: drawtext filter needs CPU frames, so we decode on CPU
                # but use GPU (h264_nvenc) for encoding which is the slow part
                video_filter_str = ",".join(video_filters)
                full_complex_filter = f"[0:v]{video_filter_str}[vout];{complex_filter}"

                cmd = [
                    ffmpeg_path, "-y",
                    "-i", str(video_path),
                    "-i", str(audio_path),
                    "-filter_complex", full_complex_filter,
                    "-map", "[vout]",
                    "-map", "[aout]",
                    "-c:v", "h264_nvenc",  # GPU encoding (5-10x faster than CPU)
                    "-preset", "p4",  # Balanced speed/quality
                    "-b:v", "8M",  # 8 Mbps video bitrate
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-shortest",
                    str(output_path)
                ]
            else:
                # No subtitles - just copy video (fast)
                cmd = [
                    ffmpeg_path, "-y",
                    "-i", str(video_path),
                    "-i", str(audio_path),
                    "-filter_complex", complex_filter,
                    "-map", "0:v",
                    "-map", "[aout]",
                    "-c:v", "copy",  # Copy video codec (fast)
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-shortest",
                    str(output_path)
                ]

            print(f"[{job_id}] Running FFmpeg...")
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode != 0:
                print(f"[{job_id}] FFmpeg error: {result.stderr}")
                return {
                    "status": "failed",
                    "job_id": job_id,
                    "output_url": None,
                    "duration": None,
                    "error": f"FFmpeg failed: {result.stderr[:500]}",
                }

            print(f"[{job_id}] FFmpeg completed, uploading to S3...")

            # Upload to S3
            if output_s3_bucket and output_s3_key:
                s3 = boto3.client(
                    "s3",
                    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
                    region_name=os.environ.get("AWS_REGION", "ap-northeast-2"),
                )

                s3.upload_file(
                    str(output_path),
                    output_s3_bucket,
                    output_s3_key,
                    ExtraArgs={"ContentType": "video/mp4"}
                )

                output_url = f"https://{output_s3_bucket}.s3.{os.environ.get('AWS_REGION', 'ap-northeast-2')}.amazonaws.com/{output_s3_key}"
            else:
                output_url = None

            print(f"[{job_id}] Composition complete: {output_url}")

            return {
                "status": "completed",
                "job_id": job_id,
                "output_url": output_url,
                "duration": video_duration,
                "error": None,
            }

    except Exception as e:
        import traceback
        print(f"[{job_id}] Composition failed: {e}")
        print(traceback.format_exc())
        return {
            "status": "failed",
            "job_id": job_id,
            "output_url": None,
            "duration": None,
            "error": str(e),
        }


@app.function(
    timeout=300,
    memory=4096,
    cpu=2.0,
    retries=2,
    scaledown_window=120,
)
def analyze_audio(request_data: dict) -> dict:
    """
    Analyze audio file for BPM, energy curves, and segments using FFmpeg.

    Args:
        request_data: Dictionary containing:
            - audio_url: URL of the audio file
            - target_duration: Target clip duration for finding best segment (default: 15)

    Returns:
        Dictionary with analysis results
    """
    import os
    import subprocess
    import tempfile
    import httpx
    import json
    from pathlib import Path

    job_id = request_data.get("job_id", "audio-analyze")
    print(f"[{job_id}] Starting audio analysis on Modal")

    try:
        audio_url = request_data["audio_url"]
        target_duration = request_data.get("target_duration", 15)

        # FFmpeg paths
        ffmpeg_path = os.environ.get("FFMPEG_BINARY", "/usr/lib/jellyfin-ffmpeg/ffmpeg")
        ffprobe_path = os.environ.get("FFPROBE_BINARY", "/usr/lib/jellyfin-ffmpeg/ffprobe")

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir = Path(temp_dir)
            audio_path = temp_dir / "input_audio.mp3"

            # Download audio
            print(f"[{job_id}] Downloading audio...")
            with httpx.Client(timeout=60.0) as client:
                response = client.get(audio_url, follow_redirects=True)
                response.raise_for_status()
                audio_path.write_bytes(response.content)

            # Get audio metadata using ffprobe
            print(f"[{job_id}] Getting audio metadata...")
            probe_cmd = [
                ffprobe_path, "-v", "quiet",
                "-print_format", "json",
                "-show_format", "-show_streams",
                str(audio_path)
            ]
            result = subprocess.run(probe_cmd, capture_output=True, text=True)
            metadata = json.loads(result.stdout)

            duration = float(metadata["format"].get("duration", 0))
            audio_stream = next((s for s in metadata.get("streams", []) if s.get("codec_type") == "audio"), {})
            sample_rate = int(audio_stream.get("sample_rate", 44100))
            channels = int(audio_stream.get("channels", 2))
            bitrate = int(metadata["format"].get("bit_rate", 128000))

            print(f"[{job_id}] Duration: {duration}s, Sample rate: {sample_rate}")

            # Extract energy levels (1 sample per second)
            print(f"[{job_id}] Extracting energy levels...")
            energy_curve = []

            for start_time in range(int(duration)):
                segment_duration = min(1.0, duration - start_time)

                # Use volumedetect filter
                cmd = [
                    ffmpeg_path, "-y",
                    "-ss", str(start_time),
                    "-t", str(segment_duration),
                    "-i", str(audio_path),
                    "-af", "volumedetect",
                    "-f", "null", "-"
                ]
                result = subprocess.run(cmd, capture_output=True, text=True)

                # Parse mean_volume from stderr
                mean_volume = -60  # Default very quiet
                for line in result.stderr.split("\n"):
                    if "mean_volume:" in line:
                        try:
                            mean_volume = float(line.split("mean_volume:")[1].split("dB")[0].strip())
                        except:
                            pass

                # Normalize to 0-1 scale
                normalized = max(0, min(1, (mean_volume + 60) / 60))
                energy_curve.append(normalized)

            # Calculate statistics
            peak_energy = max(energy_curve) if energy_curve else 0
            avg_energy = sum(energy_curve) / len(energy_curve) if energy_curve else 0

            # Detect segments based on energy changes
            print(f"[{job_id}] Detecting segments...")
            segments = []
            window_size = 4  # 4 second windows

            current_start = 0
            current_energy = 0
            sample_count = 0

            for i, energy in enumerate(energy_curve):
                current_energy += energy
                sample_count += 1

                if sample_count >= window_size or i == len(energy_curve) - 1:
                    avg = current_energy / sample_count
                    segment_end = min(i + 1, duration)

                    # Classify segment type
                    if current_start == 0 and avg < 0.4:
                        seg_type = "intro"
                    elif segment_end >= duration - 4 and avg < 0.4:
                        seg_type = "outro"
                    elif avg > 0.7:
                        seg_type = "chorus"
                    elif avg > 0.4:
                        seg_type = "verse"
                    else:
                        seg_type = "bridge"

                    segments.append({
                        "start": current_start,
                        "end": segment_end,
                        "energy": avg,
                        "type": seg_type,
                    })

                    current_start = segment_end
                    current_energy = 0
                    sample_count = 0

            # Find best segment for target duration
            print(f"[{job_id}] Finding best {target_duration}s segment...")
            best_start = 0
            best_energy = 0

            if duration > target_duration:
                for start in range(int(duration - target_duration) + 1):
                    end_idx = min(start + target_duration, len(energy_curve))
                    window_energy = energy_curve[start:end_idx]
                    avg = sum(window_energy) / len(window_energy) if window_energy else 0

                    if avg > best_energy:
                        best_energy = avg
                        best_start = start
            else:
                best_energy = avg_energy

            # Estimate BPM (simplified - count energy peaks)
            print(f"[{job_id}] Estimating BPM...")
            analysis_length = min(30, duration)
            threshold = avg_energy * 1.2
            peak_count = 0

            for i in range(1, min(int(analysis_length), len(energy_curve) - 1)):
                if (energy_curve[i] > threshold and
                    energy_curve[i] > energy_curve[i-1] and
                    energy_curve[i] > energy_curve[i+1]):
                    peak_count += 1

            bpm = int(max(60, min(200, (peak_count / analysis_length) * 60))) if analysis_length > 0 else 120

            print(f"[{job_id}] Analysis complete: BPM={bpm}, best_start={best_start}s")

            return {
                "status": "completed",
                "job_id": job_id,
                "analysis": {
                    "duration": duration,
                    "bpm": bpm,
                    "energy_curve": energy_curve,
                    "peak_energy": peak_energy,
                    "avg_energy": avg_energy,
                    "segments": segments,
                    "best_15s_start": best_start,
                    "best_15s_energy": best_energy,
                    "metadata": {
                        "sample_rate": sample_rate,
                        "channels": channels,
                        "bitrate": bitrate,
                    }
                },
                "error": None,
            }

    except Exception as e:
        import traceback
        print(f"[{job_id}] Analysis failed: {e}")
        print(traceback.format_exc())
        return {
            "status": "failed",
            "job_id": job_id,
            "analysis": None,
            "error": str(e),
        }


@app.function(
    timeout=60,
    memory=2048,
    cpu=1.0,
    retries=2,
)
def get_media_duration(request_data: dict) -> dict:
    """
    Get duration of a media file (video or audio) using ffprobe.

    Args:
        request_data: Dictionary containing:
            - url: URL of the media file
            - media_type: 'video' or 'audio'

    Returns:
        Dictionary with duration
    """
    import os
    import subprocess
    import tempfile
    import httpx
    from pathlib import Path

    try:
        url = request_data["url"]
        media_type = request_data.get("media_type", "video")

        ffprobe_path = os.environ.get("FFPROBE_BINARY", "/usr/lib/jellyfin-ffmpeg/ffprobe")

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir = Path(temp_dir)
            ext = ".mp4" if media_type == "video" else ".mp3"
            file_path = temp_dir / f"input{ext}"

            # Download file
            with httpx.Client(timeout=60.0) as client:
                response = client.get(url, follow_redirects=True)
                response.raise_for_status()
                file_path.write_bytes(response.content)

            # Get duration
            cmd = [
                ffprobe_path, "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(file_path)
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            duration = float(result.stdout.strip()) if result.stdout.strip() else 0

            return {
                "status": "completed",
                "duration": duration,
                "error": None,
            }

    except Exception as e:
        return {
            "status": "failed",
            "duration": None,
            "error": str(e),
        }


# ============================================================================
# Audio Web Endpoint (Unified)
# ============================================================================
# Consolidated into a single endpoint to save on web endpoint quota (limit: 8)

@app.function(
    secrets=[modal.Secret.from_name("aws-s3-secret"), modal.Secret.from_name("custom-secret")],
)
@modal.fastapi_endpoint(method="POST")
def audio_endpoint(request_data: dict):
    """
    Unified audio processing endpoint - handles compose, analyze, status, and duration.

    POST /audio_endpoint
    Body: {
        action: 'compose' | 'analyze' | 'status' | 'duration',
        ... action-specific fields
    }

    Actions:
    - compose: Submit audio composition job
        Body: { action: 'compose', video_url, audio_url, audio_start_time?, audio_volume?, fade_in?, fade_out?, mix_original_audio?, original_audio_volume?, output_s3_bucket?, output_s3_key?, job_id? }
        Returns: { call_id, job_id, status, message }

    - analyze: Submit audio analysis job
        Body: { action: 'analyze', audio_url, target_duration?, job_id? }
        Returns: { call_id, job_id, status, message }

    - status: Poll for job status
        Body: { action: 'status', call_id }
        Returns: { status, result } or 202 if still processing

    - duration: Get media duration (synchronous)
        Body: { action: 'duration', url, media_type? }
        Returns: { status, duration, error }
    """
    import fastapi

    action = request_data.get("action", "")

    if action == "compose":
        job_id = request_data.get("job_id", "audio-compose")
        print(f"[{job_id}] Received audio compose request")

        # Spawn the compose function (async - returns immediately)
        call = compose_audio.spawn(request_data)

        print(f"[{job_id}] Spawned Modal function: {call.object_id}")

        return {
            "call_id": call.object_id,
            "job_id": job_id,
            "status": "queued",
            "message": "Audio composition job queued",
        }

    elif action == "analyze":
        job_id = request_data.get("job_id", "audio-analyze")
        print(f"[{job_id}] Received audio analyze request")

        # Spawn the analyze function (async - returns immediately)
        call = analyze_audio.spawn(request_data)

        print(f"[{job_id}] Spawned Modal function: {call.object_id}")

        return {
            "call_id": call.object_id,
            "job_id": job_id,
            "status": "queued",
            "message": "Audio analysis job queued",
        }

    elif action == "status":
        call_id = request_data.get("call_id", "")
        if not call_id:
            return {"status": "error", "error": "call_id is required"}

        try:
            function_call = modal.FunctionCall.from_id(call_id)
            result = function_call.get(timeout=0)

            return {
                "status": result.get("status", "completed"),
                "result": result,
            }
        except TimeoutError:
            # Still processing - return 202 Accepted
            return fastapi.responses.JSONResponse(
                {"status": "processing", "call_id": call_id},
                status_code=202
            )
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
            }

    elif action == "duration":
        url = request_data.get("url", "")
        print(f"[DURATION] Getting duration for: {url[:60]}...")

        # Run synchronously since it's fast
        result = get_media_duration.remote(request_data)
        return result

    else:
        return {
            "status": "error",
            "error": f"Unknown action: {action}. Use 'compose', 'analyze', 'status', or 'duration'.",
        }


# ============================================================================
# Local Development
# ============================================================================

@app.local_entrypoint()
def main():
    """Test the Modal app locally."""
    print("=" * 60)
    print("Hydra Compose Engine - Modal Serverless GPU")
    print("=" * 60)
    print()
    print("Deploy:")
    print("  modal deploy modal_app.py")
    print()
    print("Web Endpoints (4 total - within free tier limit):")
    print()
    print("  Video Rendering:")
    print("    POST /submit_render              - Start a render job")
    print("    GET  /get_render_status?call_id  - Poll render status")
    print()
    print("  TikTok Scraping:")
    print("    POST /collect_trends_endpoint    - Unified trends endpoint")
    print("         Body: { action: 'collect'|'search'|'hashtag', ... }")
    print()
    print("  Audio Processing (unified):")
    print("    POST /audio_endpoint             - Unified audio endpoint")
    print("         Body: { action: 'compose'|'analyze'|'status'|'duration', ... }")
    print()
    print("Internal Functions (call via .remote()):")
    print("  - render_video / render_video_cpu  - Video rendering")
    print("  - scrape_tiktok_trends             - TikTok scraping")
    print("  - compose_audio                    - Audio composition")
    print("  - analyze_audio                    - Audio analysis")
    print("  - get_media_duration               - Media duration")
    print()
    print("Test locally:")
    print("  modal run modal_app.py::render_video --input '{...}'")
    print()
