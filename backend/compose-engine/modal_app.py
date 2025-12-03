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
       AWS_ACCESS_KEY_ID=AKIASBF5YXJFHLVFVGQR \
       AWS_SECRET_ACCESS_KEY=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 \
       AWS_REGION=ap-southeast-2 \
       AWS_S3_BUCKET=hydra-assets-hybe
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

# Define the container image with NVIDIA CUDA + Jellyfin FFmpeg (NVENC support)
video_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.0-devel-ubuntu22.04",
        add_python="3.11"
    )
    .entrypoint([])  # Remove chatty NVIDIA prints on container start
    # System dependencies
    .apt_install(
        "wget",
        "gnupg",
        "libsm6",
        "libxext6",
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsndfile1",
        "libmpg123-0",
        "fonts-noto-cjk",
        "fonts-dejavu",
    )
    # Install Jellyfin FFmpeg (has NVENC h264_nvenc/hevc_nvenc baked in)
    .run_commands(
        # Step 1: Add Jellyfin repo
        "echo '=== STEP 1: Adding Jellyfin GPG key ===' && wget -O - https://repo.jellyfin.org/jellyfin_team.gpg.key | gpg --dearmor -o /usr/share/keyrings/jellyfin.gpg && echo 'GPG key added successfully'",
        "echo '=== STEP 2: Adding Jellyfin apt repo ===' && echo 'deb [signed-by=/usr/share/keyrings/jellyfin.gpg] https://repo.jellyfin.org/ubuntu jammy main' > /etc/apt/sources.list.d/jellyfin.list && cat /etc/apt/sources.list.d/jellyfin.list",
        # Step 2: Install jellyfin-ffmpeg6
        "echo '=== STEP 3: Installing jellyfin-ffmpeg6 ===' && apt-get update && apt-get install -y jellyfin-ffmpeg6 && echo 'jellyfin-ffmpeg6 installed'",
        # Step 3: Check what was installed
        "echo '=== STEP 4: Checking installed files ===' && ls -la /usr/lib/jellyfin-ffmpeg/ || echo 'ERROR: /usr/lib/jellyfin-ffmpeg/ not found'",
        # Step 4: Create symlinks
        "echo '=== STEP 5: Creating symlinks ===' && ln -sf /usr/lib/jellyfin-ffmpeg/ffmpeg /usr/local/bin/ffmpeg && ln -sf /usr/lib/jellyfin-ffmpeg/ffprobe /usr/local/bin/ffprobe && ls -la /usr/local/bin/ffmpeg /usr/local/bin/ffprobe",
        # Step 5: Verify ffmpeg
        "echo '=== STEP 6: Verifying ffmpeg ===' && which ffmpeg && ffmpeg -version 2>&1 | head -10",
        # Step 6: Check for NVENC encoders
        "echo '=== STEP 7: Checking NVENC encoders ===' && ffmpeg -encoders 2>&1 | grep -i nvenc || echo 'WARNING: No NVENC encoders found in ffmpeg'",
        # Step 7: Check NVIDIA driver
        "echo '=== STEP 8: Checking NVIDIA ===' && nvidia-smi --query-gpu=name,driver_version --format=csv,noheader 2>&1 || echo 'nvidia-smi not available during build (expected - GPU only at runtime)'",
    )
    # Set environment for jellyfin-ffmpeg with NVENC
    .env({
        # CRITICAL: Tell imageio/MoviePy to use jellyfin-ffmpeg instead of bundled ffmpeg
        "IMAGEIO_FFMPEG_EXE": "/usr/lib/jellyfin-ffmpeg/ffmpeg",
        # Library path for NVENC runtime libs
        "LD_LIBRARY_PATH": "/usr/lib/jellyfin-ffmpeg/lib:/usr/local/cuda/lib64:${LD_LIBRARY_PATH}",
    })
    # Python dependencies
    .pip_install(
        "moviepy==2.1.1",
        "Pillow>=10.0.0",
        "numpy>=1.26.0",
        "librosa==0.10.1",
        "soundfile==0.12.1",
        "audioread==3.0.1",
        "scipy>=1.11.0,<1.13.0",
        "boto3==1.35.0",
        "botocore==1.35.0",
        "httpx==0.26.0",
        "aiofiles==23.2.1",
        "pydantic==2.5.3",
        "pydantic-settings==2.1.0",
        "fastapi[standard]",
        "redis>=5.0.0",
    )
    # Add the entire app source code
    .add_local_dir(
        Path(__file__).parent / "app",
        remote_path="/root/app",
        copy=True
    )
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

        with httpx.Client(timeout=10.0) as client:
            response = client.post(callback_url, json=payload)
            print(f"[{job_id}] Callback response: {response.status_code}")
            if response.status_code != 200:
                print(f"[{job_id}] Callback body: {response.text[:200]}")
    except Exception as e:
        print(f"[{job_id}] Callback failed (non-fatal): {e}")


@app.function(
    gpu="T4",  # NVIDIA T4 GPU for NVENC hardware encoding
    timeout=600,  # 10 minutes max per video
    memory=8192,  # 8GB RAM
    cpu=4.0,  # More CPU cores for parallel image processing
    secrets=[modal.Secret.from_name("aws-s3-secret")],
    retries=2,  # Auto-retry on failure
    scaledown_window=300,  # Keep container warm for 5 minutes (faster cold starts)
    volumes={"/cache": cache_volume},  # Persistent cache for audio/image analysis
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
    secrets=[modal.Secret.from_name("aws-s3-secret")],
    retries=2,
    scaledown_window=300,  # Keep container warm for 5 minutes
    volumes={"/cache": cache_volume},
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
    secrets=[modal.Secret.from_name("aws-s3-secret")],
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


@app.function()
@modal.fastapi_endpoint(method="GET")
def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Hydra Compose Engine (Modal)",
        "encoding": "h264_nvenc (GPU NVENC)",
        "gpu": "T4",
        "ffmpeg": "jellyfin-ffmpeg6",
        "optimizations": [
            "parallel_image_downloads",
            "parallel_image_processing",
            "container_warmup",
            "nvenc_gpu_encoding",
            "retry_logic",
        ],
    }


# ============================================================================
# Batch Processing (For Variations)
# ============================================================================

@app.function(
    secrets=[modal.Secret.from_name("aws-s3-secret")],
)
@modal.fastapi_endpoint(method="POST")
def submit_batch_render(batch_data: dict):
    """
    Submit multiple render jobs in parallel for batch processing.
    Ideal for compose variations - spawns all jobs at once.

    POST /submit_batch_render
    Body: { jobs: [RenderRequest, ...], use_gpu: bool }
    Returns: { batch_id, call_ids: [{job_id, call_id}, ...], status }
    """
    import uuid

    jobs = batch_data.get("jobs", [])
    use_gpu = batch_data.get("use_gpu", True)
    batch_id = str(uuid.uuid4())[:8]

    print(f"[Batch {batch_id}] Received {len(jobs)} render jobs (GPU: {use_gpu})")

    call_ids = []
    for job_data in jobs:
        job_id = job_data.get("job_id", "unknown")

        # Spawn render function (all jobs start in parallel)
        if use_gpu:
            call = render_video.spawn(job_data)
        else:
            call = render_video_cpu.spawn(job_data)

        call_ids.append({
            "job_id": job_id,
            "call_id": call.object_id,
        })
        print(f"[Batch {batch_id}] Spawned {job_id}: {call.object_id}")

    return {
        "batch_id": batch_id,
        "total_jobs": len(jobs),
        "call_ids": call_ids,
        "status": "queued",
        "message": f"Batch of {len(jobs)} jobs queued (GPU: {use_gpu})",
    }


@app.function()
@modal.fastapi_endpoint(method="GET")
def get_batch_status(call_ids: str):
    """
    Poll status for multiple render jobs.

    GET /get_batch_status?call_ids=id1,id2,id3
    Returns: { results: [{call_id, status, result}, ...] }
    """
    import fastapi

    ids = call_ids.split(",")
    results = []

    for call_id in ids:
        try:
            function_call = modal.FunctionCall.from_id(call_id.strip())
            result = function_call.get(timeout=0)
            results.append({
                "call_id": call_id,
                "status": result.get("status", "completed"),
                "result": result,
            })
        except TimeoutError:
            results.append({
                "call_id": call_id,
                "status": "processing",
            })
        except Exception as e:
            results.append({
                "call_id": call_id,
                "status": "error",
                "error": str(e),
            })

    # Check if all are complete
    all_complete = all(r["status"] in ["completed", "failed", "error"] for r in results)
    processing_count = sum(1 for r in results if r["status"] == "processing")

    return {
        "total": len(results),
        "processing": processing_count,
        "all_complete": all_complete,
        "results": results,
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
    print("Endpoints after deploy:")
    print("  POST /submit_render   - Start a render job")
    print("  GET  /get_render_status?call_id=xxx - Poll status")
    print("  GET  /health          - Health check")
    print()
    print("Test locally:")
    print("  modal run modal_app.py::render_video --input '{...}'")
    print()
