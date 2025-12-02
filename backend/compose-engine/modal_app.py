"""
Modal App for Video Rendering with GPU Acceleration.

This is the ONLY backend needed for video composition.
Next.js calls Modal directly - no Railway needed.

Architecture:
  Next.js (Vercel) → Modal (GPU) → S3

Deploy:
  cd backend/compose-engine
  modal deploy modal_app.py

Setup:
  1. modal token new
  2. modal secret create aws-s3-secret \
       AWS_ACCESS_KEY_ID=xxx \
       AWS_SECRET_ACCESS_KEY=xxx \
       AWS_REGION=ap-southeast-2 \
       AWS_S3_BUCKET=hydra-assets-hybe
  3. modal deploy modal_app.py

Endpoints (auto-generated):
  - POST https://modawnai--hydra-compose-engine-submit-render.modal.run
  - GET  https://modawnai--hydra-compose-engine-get-render-status.modal.run
"""

import modal
from pathlib import Path

# ============================================================================
# Modal App Configuration
# ============================================================================

# Define the container image with all dependencies
video_image = (
    modal.Image.debian_slim(python_version="3.11")
    # System dependencies - FFmpeg with NVENC support
    .apt_install(
        "ffmpeg",
        "libsm6",
        "libxext6",
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsndfile1",  # Audio file support
        "libmpg123-0",  # MP3 decoding
        "fonts-noto-cjk",  # Korean/CJK font support
        "fonts-dejavu",
    )
    # Python dependencies
    .pip_install(
        "moviepy==2.1.1",  # Pin exact version - 2.x has different imports than 1.x
        "Pillow>=10.0.0",
        "numpy>=1.26.0",
        "librosa==0.10.1",
        "soundfile==0.12.1",
        "audioread==3.0.1",
        "scipy>=1.11.0,<1.13.0",  # Pin scipy for librosa compatibility
        "boto3==1.35.0",
        "botocore==1.35.0",
        "httpx==0.26.0",
        "aiofiles==23.2.1",
        "pydantic==2.5.3",
        "pydantic-settings==2.1.0",
        "fastapi[standard]",
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


# ============================================================================
# Video Rendering Function (GPU-Accelerated)
# ============================================================================

@app.function(
    gpu="T4",  # NVIDIA T4 for NVENC hardware encoding (cost-effective)
    timeout=600,  # 10 minutes max per video
    memory=8192,  # 8GB RAM
    secrets=[modal.Secret.from_name("aws-s3-secret")],
    retries=1,
)
def render_video(request_data: dict) -> dict:
    """
    Render a video using MoviePy with GPU-accelerated encoding.

    Args:
        request_data: Dictionary containing RenderRequest fields

    Returns:
        Dictionary with status, output_url, and metadata
    """
    import sys
    import os
    import asyncio
    import traceback

    # Enable GPU encoding (NVENC) - Modal has T4 GPU
    os.environ["GPU_AVAILABLE"] = "true"

    # Add app to path
    sys.path.insert(0, "/root")

    from app.models.render_job import RenderRequest
    from app.services.video_renderer import VideoRenderer

    # Parse request
    request = RenderRequest(**request_data)
    job_id = request.job_id

    print(f"[{job_id}] === Starting GPU-accelerated render on Modal ===")
    print(f"[{job_id}] Images: {len(request.images)}")
    print(f"[{job_id}] Vibe: {request.settings.vibe.value}")
    print(f"[{job_id}] Aspect Ratio: {request.settings.aspect_ratio.value}")
    print(f"[{job_id}] Target Duration: {request.settings.target_duration}s")

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

        return {
            "status": "failed",
            "job_id": job_id,
            "output_url": None,
            "error": error_msg,
        }


@app.function(
    timeout=600,
    memory=4096,  # 4GB RAM for CPU rendering
    secrets=[modal.Secret.from_name("aws-s3-secret")],
    retries=1,
)
def render_video_cpu(request_data: dict) -> dict:
    """
    Render a video using CPU (fallback for cost savings on simple videos).

    Args:
        request_data: Dictionary containing RenderRequest fields

    Returns:
        Dictionary with status, output_url, and metadata
    """
    import sys
    import os
    import asyncio
    import traceback

    # CPU mode - no GPU_AVAILABLE
    os.environ["GPU_AVAILABLE"] = "false"

    # Add app to path
    sys.path.insert(0, "/root")

    from app.models.render_job import RenderRequest
    from app.services.video_renderer import VideoRenderer

    # Parse request
    request = RenderRequest(**request_data)
    job_id = request.job_id

    print(f"[{job_id}] Starting CPU render on Modal")

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
        "gpu": "T4",
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
