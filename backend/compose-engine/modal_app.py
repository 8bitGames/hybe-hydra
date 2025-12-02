"""
Modal App for Video Rendering with GPU Acceleration.

This module defines the Modal serverless functions for video rendering,
enabling GPU-accelerated FFmpeg encoding with NVENC.

Deploy: modal deploy modal_app.py
Run locally: modal run modal_app.py

Setup:
1. modal token new
2. modal secret create aws-s3-secret \
     AWS_ACCESS_KEY_ID=xxx \
     AWS_SECRET_ACCESS_KEY=xxx \
     AWS_REGION=ap-southeast-2 \
     AWS_S3_BUCKET=hydra-assets-hybe
3. modal deploy modal_app.py
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
    # Python dependencies (matching requirements.txt)
    .pip_install(
        "moviepy>=2.0.0",
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
        "fastapi[standard]",  # Include FastAPI here for webhooks
    )
    # Add the app source code LAST (or use copy=True)
    .add_local_dir(
        Path(__file__).parent / "app",
        remote_path="/root/app",
        copy=True  # Copy into image so we can add more steps if needed
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
    import asyncio

    # Add app to path (added via add_local_dir)
    sys.path.insert(0, "/root")

    from app.models.render_job import RenderRequest
    from app.services.video_renderer import VideoRenderer

    # Parse request
    request = RenderRequest(**request_data)
    job_id = request.job_id

    print(f"[{job_id}] Starting GPU-accelerated render on Modal")
    print(f"[{job_id}] Images: {len(request.images)}, Vibe: {request.settings.vibe.value}")

    try:
        # Create renderer
        renderer = VideoRenderer()

        # Progress callback (logs only in Modal environment)
        async def progress_callback(job_id: str, progress: int, step: str):
            print(f"[{job_id}] [{progress}%] {step}")

        # Run the async render
        output_url = asyncio.get_event_loop().run_until_complete(
            renderer.render(request, progress_callback)
        )

        print(f"[{job_id}] Render complete: {output_url}")

        return {
            "status": "completed",
            "job_id": job_id,
            "output_url": output_url,
            "error": None,
        }

    except Exception as e:
        print(f"[{job_id}] Render failed: {str(e)}")
        return {
            "status": "failed",
            "job_id": job_id,
            "output_url": None,
            "error": str(e),
        }


@app.function(
    timeout=600,
    memory=4096,  # 4GB RAM for CPU rendering
    secrets=[modal.Secret.from_name("aws-s3-secret")],
    retries=1,
)
def render_video_cpu(request_data: dict) -> dict:
    """
    Render a video using CPU (fallback when GPU is unavailable or for cost savings).

    Args:
        request_data: Dictionary containing RenderRequest fields

    Returns:
        Dictionary with status, output_url, and metadata
    """
    import sys
    import asyncio

    # Add app to path (added via add_local_dir)
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
            print(f"[{job_id}] [{progress}%] {step}")

        output_url = asyncio.get_event_loop().run_until_complete(
            renderer.render(request, progress_callback)
        )

        print(f"[{job_id}] Render complete: {output_url}")

        return {
            "status": "completed",
            "job_id": job_id,
            "output_url": output_url,
            "error": None,
        }

    except Exception as e:
        print(f"[{job_id}] Render failed: {str(e)}")
        return {
            "status": "failed",
            "job_id": job_id,
            "output_url": None,
            "error": str(e),
        }


# ============================================================================
# Webhook Endpoint for External Calls
# ============================================================================

@app.function(
    secrets=[modal.Secret.from_name("aws-s3-secret")],
)
@modal.fastapi_endpoint(method="POST")
def submit_render(request_data: dict):
    """
    Submit a render job and return immediately with a call ID for polling.

    POST /submit_render
    Body: RenderRequest JSON
    Returns: { "call_id": "...", "job_id": "..." }
    """
    job_id = request_data.get("job_id", "unknown")
    use_gpu = request_data.pop("use_gpu", True)

    # Spawn the render function (async)
    if use_gpu:
        call = render_video.spawn(request_data)
    else:
        call = render_video_cpu.spawn(request_data)

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

    GET /get_render_status?call_id=...
    Returns: { "status": "processing|completed|failed", "result": ... }
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
        # Still processing
        return fastapi.responses.JSONResponse(
            {"status": "processing", "call_id": call_id},
            status_code=202
        )
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


# ============================================================================
# Local Entrypoint for Testing
# ============================================================================

@app.local_entrypoint()
def main():
    """Test the Modal app locally."""
    print("Modal Compose Engine ready!")
    print("Deploy with: modal deploy modal_app.py")
    print("Test GPU render with: modal run modal_app.py::render_video")
