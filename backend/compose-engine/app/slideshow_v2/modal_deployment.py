"""
Modal Deployment Configuration for Slideshow V2.

This module provides Modal-optimized endpoints for the AI-driven
slideshow creation pipeline.

Features:
- GPU acceleration (NVIDIA T4/A10G)
- NVENC video encoding
- Automatic scaling
- S3 integration for file storage
"""

import os
import logging
import tempfile
from typing import List, Optional, Dict, Any

import modal

logger = logging.getLogger(__name__)

# =============================================================================
# Modal Image Definition
# =============================================================================

# Create Modal image with all dependencies
slideshow_v2_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install([
        # FFmpeg with NVENC support
        "ffmpeg",
        # System dependencies
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsm6",
        "libxext6",
        "libxrender-dev",
        "libfontconfig1",
        "fonts-dejavu-core",
        "fonts-noto-cjk",  # Asian fonts for K-pop lyrics
        # Audio processing
        "libsndfile1",
        "libportaudio2",
    ])
    .pip_install([
        # Core
        "numpy>=1.24.0",
        "pillow>=10.0.0",
        "scipy>=1.11.0",

        # Audio analysis
        "librosa>=0.10.1",
        "soundfile>=0.12.1",

        # AI
        "google-genai>=0.3.0",

        # Image processing
        "opencv-python-headless>=4.8.0",

        # GPU acceleration (optional, fallback to CPU)
        "cupy-cuda12x>=12.0.0",

        # Utilities
        "boto3>=1.28.0",  # S3 integration
        "httpx>=0.24.0",
    ])
    .env({
        "NUMBA_CACHE_DIR": "/tmp/numba_cache",
        "LIBROSA_CACHE_DIR": "/tmp/librosa_cache",
    })
)

# Modal App
app = modal.App("slideshow-v2")


# =============================================================================
# Modal Functions
# =============================================================================

@app.function(
    image=slideshow_v2_image,
    gpu="T4",  # or "A10G" for more power
    timeout=600,  # 10 minutes
    memory=8192,  # 8GB RAM
    secrets=[
        modal.Secret.from_name("gemini-api-key"),
        modal.Secret.from_name("aws-s3-credentials"),
    ],
)
def create_slideshow_v2(
    image_urls: List[str],
    audio_url: Optional[str] = None,
    lyrics: Optional[List[str]] = None,
    style_hint: str = "",
    target_duration: Optional[float] = None,
    aspect_ratio: str = "9:16",
    output_s3_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a slideshow video using AI-driven composition.

    This is the main Modal endpoint for creating slideshows.

    Args:
        image_urls: List of S3 URLs or HTTP URLs to images
        audio_url: S3 URL or HTTP URL to audio file
        lyrics: List of lyrics/caption lines
        style_hint: Style description for AI
        target_duration: Target video duration (auto from audio if not set)
        aspect_ratio: Output aspect ratio
        output_s3_key: S3 key for output (auto-generated if not provided)

    Returns:
        Dictionary with output URL and metadata
    """
    import boto3
    from urllib.parse import urlparse

    # Import our engine (after image is set up)
    from app.slideshow_v2.engine import SlideshowEngineSync
    from app.slideshow_v2.renderer.engine import RenderConfig

    logger.info(f"Starting slideshow creation: {len(image_urls)} images")

    # Create temp directory
    with tempfile.TemporaryDirectory() as temp_dir:
        # Download images
        image_paths = []
        for i, url in enumerate(image_urls):
            local_path = os.path.join(temp_dir, f"image_{i:03d}.jpg")
            _download_file(url, local_path)
            image_paths.append(local_path)

        logger.info(f"Downloaded {len(image_paths)} images")

        # Download audio if provided
        audio_path = None
        if audio_url:
            audio_path = os.path.join(temp_dir, "audio.mp3")
            _download_file(audio_url, audio_path)
            logger.info("Downloaded audio")

        # Output path
        output_path = os.path.join(temp_dir, "output.mp4")

        # Configure renderer for GPU
        render_config = RenderConfig(
            output_size=_parse_aspect_ratio(aspect_ratio),
            fps=30,
            video_bitrate="8M",
            codec="h264_nvenc",  # GPU encoding
            use_gpu=True,
            max_workers=2,  # Parallel segment rendering
        )

        # Create engine
        engine = SlideshowEngineSync(
            gemini_api_key=os.environ.get("GEMINI_API_KEY"),
            render_config=render_config,
        )

        # Create slideshow
        result = engine.create_slideshow(
            image_paths=image_paths,
            audio_path=audio_path,
            lyrics=lyrics,
            style_hint=style_hint,
            target_duration=target_duration,
            aspect_ratio=aspect_ratio,
            output_path=output_path,
        )

        if not result.success:
            raise RuntimeError(f"Slideshow creation failed: {result.error}")

        # Upload to S3
        if output_s3_key is None:
            import uuid
            output_s3_key = f"slideshows/{uuid.uuid4()}.mp4"

        output_url = _upload_to_s3(output_path, output_s3_key)

        logger.info(f"Slideshow created: {output_url}")

        return {
            "success": True,
            "output_url": output_url,
            "duration": result.duration,
            "composition": {
                "title": result.composition_plan.title if result.composition_plan else "",
                "mood": result.composition_plan.mood if result.composition_plan else "",
                "segments": len(result.timeline.segments) if result.timeline else 0,
                "captions": len(result.timeline.captions) if result.timeline else 0,
            },
        }


@app.function(
    image=slideshow_v2_image,
    timeout=120,
    secrets=[modal.Secret.from_name("gemini-api-key")],
)
def analyze_for_composition(
    image_urls: List[str],
    audio_url: Optional[str] = None,
    lyrics: Optional[List[str]] = None,
    style_hint: str = "",
    target_duration: float = 15.0,
) -> Dict[str, Any]:
    """
    Analyze content and generate composition plan without rendering.

    Useful for previewing what the AI will do before committing to render.

    Returns:
        Composition plan as dictionary
    """
    import asyncio

    from app.slideshow_v2.conductor import GeminiConductor
    from app.slideshow_v2.conductor.schemas import ConductorInput
    from app.slideshow_v2.analyzers.audio_analyzer import AdvancedAudioAnalyzer

    with tempfile.TemporaryDirectory() as temp_dir:
        # Download images
        image_paths = []
        for i, url in enumerate(image_urls):
            local_path = os.path.join(temp_dir, f"image_{i:03d}.jpg")
            _download_file(url, local_path)
            image_paths.append(local_path)

        # Download and analyze audio
        audio_context = None
        if audio_url:
            audio_path = os.path.join(temp_dir, "audio.mp3")
            _download_file(audio_url, audio_path)

            analyzer = AdvancedAudioAnalyzer()
            analysis = analyzer.analyze(audio_path)
            audio_context = analyzer.to_conductor_context(analysis)

        # Initialize conductor
        conductor = GeminiConductor(api_key=os.environ.get("GEMINI_API_KEY"))

        async def run_analysis():
            # Analyze images
            image_contexts = await conductor.analyze_images(image_paths)

            # Analyze lyrics
            lyrics_context = None
            if lyrics:
                lyrics_context = await conductor.analyze_lyrics(lyrics)

            # Generate plan
            context = ConductorInput(
                images=image_contexts,
                lyrics=lyrics_context,
                audio=audio_context,
                target_duration=target_duration,
                style_hint=style_hint,
            )

            plan = await conductor.compose(context)
            return plan

        plan = asyncio.run(run_analysis())

        return plan.to_dict()


@app.function(
    image=slideshow_v2_image,
    timeout=60,
)
def analyze_audio(audio_url: str) -> Dict[str, Any]:
    """
    Analyze audio file and return analysis results.

    Args:
        audio_url: URL to audio file

    Returns:
        Audio analysis results
    """
    from app.slideshow_v2.analyzers.audio_analyzer import AdvancedAudioAnalyzer

    with tempfile.TemporaryDirectory() as temp_dir:
        audio_path = os.path.join(temp_dir, "audio.mp3")
        _download_file(audio_url, audio_path)

        analyzer = AdvancedAudioAnalyzer()
        result = analyzer.analyze(audio_path)

        return {
            "duration": result.duration,
            "bpm": result.bpm,
            "bpm_confidence": result.bpm_confidence,
            "beat_count": len(result.beat_times),
            "mood": [m.value for m in result.mood],
            "genre": result.genre.value,
            "has_drops": bool(result.structure and result.structure.drops),
            "drop_times": result.structure.drops[:5] if result.structure else [],
            "suggested_settings": {
                "cut_style": result.suggested_cut_style,
                "transition_duration": result.suggested_transition_duration,
                "motion_intensity": result.suggested_motion_intensity,
            },
        }


# =============================================================================
# Helper Functions
# =============================================================================

def _download_file(url: str, local_path: str):
    """Download a file from URL or S3."""
    import boto3
    import httpx
    from urllib.parse import urlparse

    parsed = urlparse(url)

    if parsed.scheme == "s3":
        # S3 URL
        s3 = boto3.client("s3")
        bucket = parsed.netloc
        key = parsed.path.lstrip("/")
        s3.download_file(bucket, key, local_path)

    elif parsed.scheme in ("http", "https"):
        # HTTP URL
        with httpx.Client() as client:
            response = client.get(url)
            response.raise_for_status()
            with open(local_path, "wb") as f:
                f.write(response.content)

    else:
        raise ValueError(f"Unsupported URL scheme: {parsed.scheme}")


def _upload_to_s3(local_path: str, s3_key: str) -> str:
    """Upload file to S3 and return URL."""
    import boto3

    bucket = os.environ.get("S3_BUCKET", "hydra-media")

    s3 = boto3.client("s3")
    s3.upload_file(
        local_path,
        bucket,
        s3_key,
        ExtraArgs={"ContentType": "video/mp4"},
    )

    # Return presigned URL
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": s3_key},
        ExpiresIn=86400,  # 24 hours
    )

    return url


def _parse_aspect_ratio(ratio: str) -> tuple:
    """Parse aspect ratio string to output dimensions."""
    ratios = {
        "9:16": (1080, 1920),
        "16:9": (1920, 1080),
        "1:1": (1080, 1080),
        "4:5": (1080, 1350),
    }
    return ratios.get(ratio, (1080, 1920))


# =============================================================================
# Local Testing Entry Point
# =============================================================================

@app.local_entrypoint()
def main():
    """Test the slideshow creation locally."""
    # Test with sample data
    result = create_slideshow_v2.remote(
        image_urls=[
            "https://example.com/image1.jpg",
            "https://example.com/image2.jpg",
        ],
        audio_url="https://example.com/music.mp3",
        lyrics=["Line 1", "Line 2"],
        style_hint="energetic K-pop",
    )

    print(f"Result: {result}")


# =============================================================================
# Webhook Handler (for async processing)
# =============================================================================

@app.function(
    image=slideshow_v2_image,
    timeout=30,
)
def trigger_slideshow_async(
    request_id: str,
    image_urls: List[str],
    audio_url: Optional[str] = None,
    lyrics: Optional[List[str]] = None,
    style_hint: str = "",
    webhook_url: Optional[str] = None,
) -> Dict[str, str]:
    """
    Trigger async slideshow creation and return immediately.

    The actual processing happens in the background, and results
    are sent to the webhook URL when complete.
    """
    # Spawn the actual work
    create_slideshow_v2.spawn(
        image_urls=image_urls,
        audio_url=audio_url,
        lyrics=lyrics,
        style_hint=style_hint,
    )

    return {
        "request_id": request_id,
        "status": "processing",
        "message": "Slideshow creation started",
    }
