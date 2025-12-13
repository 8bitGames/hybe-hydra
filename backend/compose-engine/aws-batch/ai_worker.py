"""
AWS Batch Worker for AI Generation (Veo 3.1, Gemini 3 Pro Image).

This script runs inside the AWS Batch container for AI generation jobs.
It uses GCP Workload Identity Federation to authenticate with Vertex AI.

Job Flow:
1. Load credentials from AWS Secrets Manager
2. Authenticate with GCP via WIF
3. Generate content via Vertex AI
4. Upload result from GCS to S3
5. Send callback to Next.js

Required Environment Variables:
- GOOGLE_APPLICATION_CREDENTIALS: Path to WIF credential config
- GCP_TARGET_SERVICE_ACCOUNT: Target SA for Vertex AI
- GCP_PROJECT_ID: GCP project ID
- AWS_REGION: AWS region for S3
"""

import os
import sys
import json
import asyncio
import traceback
import time
import logging
import base64
from typing import Optional, Tuple

import httpx
import boto3
from botocore.exceptions import ClientError

# Add app to path
sys.path.insert(0, "/root")

from app.models.ai_job import (
    AIJobType,
    AIJobRequest,
    AIJobResponse,
    AIJobStatus,
    AIJobCallback,
    AudioOverlaySettings,
)
from app.services.gcp_auth import GCPAuthManager
from app.services.vertex_ai import (
    VertexAIClient,
    VideoGenerationConfig,
    ImageGenerationConfig,
    VideoAspectRatio,
    ImageAspectRatio,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_secrets_from_aws():
    """Load secrets from AWS Secrets Manager and set as environment variables."""
    region = os.environ.get("AWS_REGION", "ap-northeast-2")
    secret_name = os.environ.get("SECRETS_NAME", "hydra/compose-engine")

    logger.info(f"Loading secrets from AWS Secrets Manager: {secret_name}")

    try:
        client = boto3.client("secretsmanager", region_name=region)
        response = client.get_secret_value(SecretId=secret_name)
        secrets = json.loads(response["SecretString"])

        # Set secrets as environment variables
        for key, value in secrets.items():
            if value and value != "REPLACE_ME":
                os.environ[key] = value
                logger.info(f"  Loaded: {key}")

        logger.info(f"Loaded {len(secrets)} secrets from AWS Secrets Manager")

    except ClientError as e:
        logger.warning(f"Could not load secrets from AWS Secrets Manager: {e}")

    # Load GCP Service Account JSON from Secrets Manager (preferred method)
    try:
        gcp_sa_secret_name = os.environ.get("GCP_SERVICE_ACCOUNT_SECRET", "hydra/gcp-service-account")
        response = client.get_secret_value(SecretId=gcp_sa_secret_name)
        gcp_sa_config = json.loads(response["SecretString"])

        # Set GOOGLE_SERVICE_ACCOUNT_JSON from the secret
        if "GOOGLE_SERVICE_ACCOUNT_JSON" in gcp_sa_config:
            sa_json = gcp_sa_config["GOOGLE_SERVICE_ACCOUNT_JSON"]
            if sa_json and sa_json != "REPLACE_ME_WITH_SERVICE_ACCOUNT_JSON":
                os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"] = sa_json
                logger.info("  Loaded GCP: GOOGLE_SERVICE_ACCOUNT_JSON (service account)")

    except ClientError as e:
        logger.info(f"GCP service account secret not found ({gcp_sa_secret_name}), trying legacy config...")

        # Fall back to legacy GCP config
        try:
            gcp_secret_name = os.environ.get("GCP_SECRETS_NAME", "hydra/gcp-config")
            response = client.get_secret_value(SecretId=gcp_secret_name)
            gcp_config = json.loads(response["SecretString"])

            for key, value in gcp_config.items():
                if value:
                    os.environ[key] = value
                    logger.info(f"  Loaded GCP (legacy): {key}")

        except ClientError:
            logger.info("GCP secrets not found, using WIF defaults")


def setup_gcp_credentials():
    """Setup GCP WIF credentials file."""
    # Check if credential file path is set
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    if not cred_path:
        # Default path in container
        cred_path = "/root/clientLibraryConfig.json"
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

    # Check if file exists
    if os.path.exists(cred_path):
        logger.info(f"GCP credentials file found: {cred_path}")
    else:
        logger.warning(f"GCP credentials file not found: {cred_path}")
        # Try to create from environment variable
        cred_json = os.environ.get("GCP_WIF_CREDENTIALS_JSON")
        if cred_json:
            with open(cred_path, "w") as f:
                f.write(cred_json)
            logger.info(f"Created credentials file from environment")


def get_job_parameters() -> dict:
    """Get job parameters from AWS Batch environment."""
    params_json = os.environ.get("BATCH_JOB_PARAMETERS", "{}")
    return json.loads(params_json)


def send_callback(
    callback_url: str,
    callback_secret: str,
    payload: AIJobCallback,
):
    """Send completion callback to Next.js."""
    if not callback_url:
        return

    try:
        headers = {
            "Content-Type": "application/json",
        }
        if callback_secret:
            headers["X-Callback-Secret"] = callback_secret

        logger.info(f"Sending callback to {callback_url}")

        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                callback_url,
                json=payload.model_dump(),
                headers=headers,
            )
            logger.info(f"Callback response: {response.status_code}")

    except Exception as e:
        logger.error(f"Callback failed (non-fatal): {e}")


async def upload_gcs_to_s3(
    gcs_uri: str,
    s3_bucket: str,
    s3_key: str,
    auth_manager: GCPAuthManager,
) -> str:
    """
    Download content from GCS and upload to S3.

    Args:
        gcs_uri: GCS URI (gs://bucket/path)
        s3_bucket: Target S3 bucket
        s3_key: Target S3 key
        auth_manager: GCP auth manager for GCS access

    Returns:
        S3 URL of uploaded content
    """
    logger.info(f"Transferring {gcs_uri} → s3://{s3_bucket}/{s3_key}")

    # Parse GCS URI
    if not gcs_uri.startswith("gs://"):
        raise ValueError(f"Invalid GCS URI: {gcs_uri}")

    gcs_path = gcs_uri[5:]  # Remove gs://
    gcs_bucket = gcs_path.split("/")[0]
    gcs_object = "/".join(gcs_path.split("/")[1:])

    # Download from GCS using REST API
    gcs_url = f"https://storage.googleapis.com/storage/v1/b/{gcs_bucket}/o/{gcs_object.replace('/', '%2F')}?alt=media"
    # Use GCS-specific auth headers (different audience from Vertex AI)
    headers = auth_manager.get_gcs_auth_headers()

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.get(gcs_url, headers=headers)
        response.raise_for_status()
        content = response.content

    logger.info(f"Downloaded {len(content)} bytes from GCS")

    # Upload to S3
    s3_client = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ap-northeast-2"))

    # Determine content type
    content_type = "video/mp4" if s3_key.endswith(".mp4") else "image/png"

    s3_client.put_object(
        Bucket=s3_bucket,
        Key=s3_key,
        Body=content,
        ContentType=content_type,
    )

    aws_region = os.environ.get("AWS_REGION", "ap-northeast-2")
    s3_url = f"https://{s3_bucket}.s3.{aws_region}.amazonaws.com/{s3_key}"
    logger.info(f"Uploaded to S3: {s3_url}")

    return s3_url


async def download_image_as_base64(image_url: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Download an image from URL and convert to base64.

    Args:
        image_url: HTTP/HTTPS URL of the image

    Returns:
        Tuple of (base64_data, mime_type) or (None, None) on failure
    """
    try:
        logger.info(f"Downloading reference image: {image_url[:80]}...")

        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.get(image_url)
            response.raise_for_status()

            image_data = response.content

            # Determine mime type from content-type header or URL
            content_type = response.headers.get("content-type", "").split(";")[0].strip()

            if not content_type or content_type == "binary/octet-stream":
                # Fallback: detect from URL extension
                url_lower = image_url.lower()
                if ".png" in url_lower:
                    content_type = "image/png"
                elif ".jpg" in url_lower or ".jpeg" in url_lower:
                    content_type = "image/jpeg"
                elif ".webp" in url_lower:
                    content_type = "image/webp"
                elif ".gif" in url_lower:
                    content_type = "image/gif"
                else:
                    # Default to PNG
                    content_type = "image/png"

            # Encode to base64
            base64_data = base64.b64encode(image_data).decode("utf-8")

            logger.info(f"Reference image downloaded: {len(image_data)} bytes, {content_type}")
            return base64_data, content_type

    except Exception as e:
        logger.error(f"Failed to download reference image: {e}")
        return None, None


async def process_video_generation(
    request: AIJobRequest,
    client: VertexAIClient,
    auth_manager: GCPAuthManager,
) -> AIJobResponse:
    """Process video generation job with Veo 3, with optional audio overlay."""
    settings = request.video_settings
    if not settings:
        return AIJobResponse(
            job_id=request.job_id,
            job_type=request.job_type,
            status=AIJobStatus.FAILED,
            error="video_settings is required for video generation",
        )

    job_id = request.job_id

    # Build GCS output URI
    gcs_bucket = request.output.gcs_bucket or os.environ.get("GCS_BUCKET", "hyb-hydra-dev-ai-output")
    gcs_key = f"veo/{job_id}/output.mp4"
    gcs_uri = f"gs://{gcs_bucket}/{gcs_key}"

    # Check if this is an image-to-video request (has reference_image_url)
    reference_image_base64 = None
    reference_image_mime_type = None
    reference_image_uri = None

    if hasattr(settings, 'reference_image_url') and settings.reference_image_url:
        ref_url = settings.reference_image_url
        logger.info(f"[{job_id}] Image-to-video mode with reference: {ref_url[:80]}...")

        # Check if it's already a GCS URI (gs://)
        if ref_url.startswith("gs://"):
            reference_image_uri = ref_url
            logger.info(f"[{job_id}] Using GCS URI directly")
        else:
            # It's an HTTP URL (S3 or other) - download and convert to base64
            reference_image_base64, reference_image_mime_type = await download_image_as_base64(ref_url)
            if not reference_image_base64:
                return AIJobResponse(
                    job_id=job_id,
                    job_type=request.job_type,
                    status=AIJobStatus.FAILED,
                    error=f"Failed to download reference image from: {ref_url[:80]}",
                )
            logger.info(f"[{job_id}] Reference image converted to base64 ({reference_image_mime_type})")

    # Create config
    config = VideoGenerationConfig(
        prompt=settings.prompt,
        aspect_ratio=VideoAspectRatio(settings.aspect_ratio.value),
        duration_seconds=settings.duration_seconds.value,
        negative_prompt=settings.negative_prompt,
        seed=settings.seed,
        person_generation=settings.person_generation.value,
        generate_audio=settings.generate_audio,
        reference_image_uri=reference_image_uri,
        reference_image_base64=reference_image_base64,
        reference_image_mime_type=reference_image_mime_type,
    )

    logger.info(f"[{job_id}] Starting Veo generation: {settings.prompt[:50]}...")

    # Generate video
    result = await client.generate_video(config, gcs_uri)

    if not result.success:
        return AIJobResponse(
            job_id=job_id,
            job_type=request.job_type,
            status=AIJobStatus.FAILED,
            error=result.error,
            operation_name=result.operation_name,
        )

    logger.info(f"[{job_id}] Video generated: {result.video_uri}")

    # Download video from GCS
    try:
        logger.info(f"[{job_id}] Downloading video from GCS...")

        # Parse GCS URI and download
        gcs_path = result.video_uri[5:]  # Remove gs://
        gcs_bucket_name = gcs_path.split("/")[0]
        gcs_object = "/".join(gcs_path.split("/")[1:])

        gcs_url = f"https://storage.googleapis.com/storage/v1/b/{gcs_bucket_name}/o/{gcs_object.replace('/', '%2F')}?alt=media"
        # Use GCS-specific auth headers (different audience from Vertex AI)
        headers = auth_manager.get_gcs_auth_headers()

        async with httpx.AsyncClient(timeout=300.0) as http_client:
            response = await http_client.get(gcs_url, headers=headers)
            response.raise_for_status()
            video_data = response.content

        logger.info(f"[{job_id}] Video downloaded: {len(video_data)} bytes")

        # Check if audio overlay is requested
        if settings.audio_overlay:
            logger.info(f"[{job_id}] Audio overlay requested, composing with FFmpeg...")
            try:
                video_data = await apply_audio_overlay(
                    video_data=video_data,
                    audio_overlay=settings.audio_overlay,
                    job_id=job_id,
                )
                logger.info(f"[{job_id}] Audio overlay applied: {len(video_data)} bytes")
            except Exception as e:
                logger.error(f"[{job_id}] Audio overlay failed: {e}")
                return AIJobResponse(
                    job_id=job_id,
                    job_type=request.job_type,
                    status=AIJobStatus.FAILED,
                    error=f"Audio overlay failed: {e}",
                    gcs_url=result.video_uri,
                )
        else:
            logger.info(f"[{job_id}] No audio overlay requested, using original video")

        # Upload to S3
        logger.info(f"[{job_id}] Uploading to S3...")
        s3_client = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ap-northeast-2"))

        s3_client.put_object(
            Bucket=request.output.s3_bucket,
            Key=request.output.s3_key,
            Body=video_data,
            ContentType="video/mp4",
        )

        aws_region = os.environ.get("AWS_REGION", "ap-northeast-2")
        s3_url = f"https://{request.output.s3_bucket}.s3.{aws_region}.amazonaws.com/{request.output.s3_key}"
        logger.info(f"[{job_id}] Uploaded to S3: {s3_url}")

        return AIJobResponse(
            job_id=job_id,
            job_type=request.job_type,
            status=AIJobStatus.COMPLETED,
            output_url=s3_url,
            gcs_url=result.video_uri,
            operation_name=result.operation_name,
            metadata={"audio_overlay_applied": settings.audio_overlay is not None},
        )

    except Exception as e:
        logger.error(f"[{job_id}] Processing failed: {e}")
        logger.error(traceback.format_exc())
        return AIJobResponse(
            job_id=job_id,
            job_type=request.job_type,
            status=AIJobStatus.FAILED,
            error=f"Processing failed: {e}",
            gcs_url=result.video_uri,
        )


async def process_image_generation(
    request: AIJobRequest,
    client: VertexAIClient,
    auth_manager: GCPAuthManager,
) -> AIJobResponse:
    """Process image generation job with Gemini 3 Pro Image."""
    settings = request.image_settings
    if not settings:
        return AIJobResponse(
            job_id=request.job_id,
            job_type=request.job_type,
            status=AIJobStatus.FAILED,
            error="image_settings is required for image generation",
        )

    # Build GCS output URI (optional for Imagen)
    gcs_bucket = request.output.gcs_bucket or os.environ.get("GCS_BUCKET", "hyb-hydra-dev-ai-output")
    gcs_key = f"imagen/{request.job_id}/output.png"
    gcs_uri = f"gs://{gcs_bucket}/{gcs_key}"

    # Create config
    config = ImageGenerationConfig(
        prompt=settings.prompt,
        aspect_ratio=ImageAspectRatio(settings.aspect_ratio.value),
        negative_prompt=settings.negative_prompt,
        number_of_images=settings.number_of_images,
        seed=settings.seed,
        safety_filter_level=settings.safety_filter_level.value,
        person_generation=settings.person_generation.value,
    )

    logger.info(f"Starting Imagen generation: {settings.prompt[:50]}...")

    # Generate image (with GCS output)
    result = await client.generate_image(config, gcs_uri)

    if not result.success:
        return AIJobResponse(
            job_id=request.job_id,
            job_type=request.job_type,
            status=AIJobStatus.FAILED,
            error=result.error,
        )

    # Handle base64 response (if no GCS output)
    if result.image_base64:
        # Upload base64 to S3 directly
        import base64
        image_data = base64.b64decode(result.image_base64)

        s3_client = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ap-northeast-2"))
        s3_client.put_object(
            Bucket=request.output.s3_bucket,
            Key=request.output.s3_key,
            Body=image_data,
            ContentType="image/png",
        )

        aws_region = os.environ.get("AWS_REGION", "ap-northeast-2")
        s3_url = f"https://{request.output.s3_bucket}.s3.{aws_region}.amazonaws.com/{request.output.s3_key}"

        return AIJobResponse(
            job_id=request.job_id,
            job_type=request.job_type,
            status=AIJobStatus.COMPLETED,
            output_url=s3_url,
        )

    # Transfer from GCS to S3
    if result.image_uri:
        try:
            s3_url = await upload_gcs_to_s3(
                result.image_uri,
                request.output.s3_bucket,
                request.output.s3_key,
                auth_manager,
            )

            return AIJobResponse(
                job_id=request.job_id,
                job_type=request.job_type,
                status=AIJobStatus.COMPLETED,
                output_url=s3_url,
                gcs_url=result.image_uri,
            )

        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            return AIJobResponse(
                job_id=request.job_id,
                job_type=request.job_type,
                status=AIJobStatus.FAILED,
                error=f"S3 upload failed: {e}",
                gcs_url=result.image_uri,
            )

    return AIJobResponse(
        job_id=request.job_id,
        job_type=request.job_type,
        status=AIJobStatus.FAILED,
        error="No output returned from Imagen",
    )


async def apply_audio_overlay(
    video_data: bytes,
    audio_overlay: AudioOverlaySettings,
    job_id: str,
) -> bytes:
    """
    Apply audio overlay to video using FFmpeg.

    Args:
        video_data: Raw video bytes
        audio_overlay: Audio overlay settings
        job_id: Job ID for logging

    Returns:
        Composed video bytes with audio overlay
    """
    import subprocess
    import tempfile
    from pathlib import Path

    logger.info(f"[{job_id}] Starting audio overlay composition...")

    # FFmpeg paths (compiled to /usr/local/bin/ in Docker container)
    ffmpeg_path = os.environ.get("FFMPEG_BINARY", "/usr/local/bin/ffmpeg")
    ffprobe_path = os.environ.get("FFPROBE_BINARY", "/usr/local/bin/ffprobe")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir = Path(temp_dir)
        video_path = temp_dir / "input_video.mp4"
        audio_path = temp_dir / "input_audio.mp3"
        output_path = temp_dir / "output.mp4"

        # Write video data to temp file
        video_path.write_bytes(video_data)
        logger.info(f"[{job_id}] Video written: {len(video_data)} bytes")

        # Download audio
        logger.info(f"[{job_id}] Downloading audio from {audio_overlay.audio_url[:50]}...")
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(audio_overlay.audio_url, follow_redirects=True)
            response.raise_for_status()
            audio_path.write_bytes(response.content)
            logger.info(f"[{job_id}] Audio downloaded: {len(response.content)} bytes")

        # Get video duration using ffprobe
        probe_cmd = [
            ffprobe_path, "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path)
        ]
        result = subprocess.run(probe_cmd, capture_output=True, text=True)
        video_duration = float(result.stdout.strip()) if result.stdout.strip() else 0
        logger.info(f"[{job_id}] Video duration: {video_duration}s")

        # Build audio filters
        audio_filters = []

        # Trim audio if start time specified
        if audio_overlay.audio_start_time > 0:
            audio_filters.append(f"atrim=start={audio_overlay.audio_start_time}")
            audio_filters.append("asetpts=PTS-STARTPTS")

        # Apply volume
        if audio_overlay.audio_volume != 1.0:
            audio_filters.append(f"volume={audio_overlay.audio_volume}")

        # Apply fade in
        if audio_overlay.fade_in > 0:
            audio_filters.append(f"afade=t=in:st=0:d={audio_overlay.fade_in}")

        # Apply fade out
        if audio_overlay.fade_out > 0:
            fade_out_start = max(0, video_duration - audio_overlay.fade_out)
            audio_filters.append(f"afade=t=out:st={fade_out_start}:d={audio_overlay.fade_out}")

        # Trim audio to video duration
        audio_filters.append(f"atrim=duration={video_duration}")

        # Build complex filter
        if audio_overlay.mix_original_audio:
            complex_filter = f"[0:a]volume={audio_overlay.original_audio_volume}[oa];[1:a]{','.join(audio_filters)}[na];[oa][na]amix=inputs=2:duration=first[aout]"
        else:
            complex_filter = f"[1:a]{','.join(audio_filters)}[aout]"

        # Build video filter for subtitles if provided
        video_filters = []
        if audio_overlay.subtitles:
            logger.info(f"[{job_id}] Adding {len(audio_overlay.subtitles)} subtitle lines")
            # Font paths for Korean/CJK support
            font_paths = [
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
                "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            ]
            selected_font = "Sans"
            for fp in font_paths:
                if os.path.exists(fp):
                    selected_font = fp
                    break

            logger.info(f"[{job_id}] Using font: {selected_font}")

            for sub in audio_overlay.subtitles:
                text = sub.text.replace("'", "\\'").replace(":", "\\:")
                drawtext = (
                    f"drawtext=fontfile='{selected_font}'"
                    f":text='{text}'"
                    f":fontsize=48"
                    f":fontcolor=white"
                    f":borderw=3"
                    f":bordercolor=black"
                    f":x=(w-text_w)/2"
                    f":y=h-h*0.18"
                    f":enable='between(t,{sub.start},{sub.end})'"
                )
                video_filters.append(drawtext)

        # Build FFmpeg command
        if video_filters:
            # With subtitles - need to re-encode video
            video_filter_str = ",".join(video_filters)
            full_complex_filter = f"[0:v]{video_filter_str}[vout];{complex_filter}"

            cmd = [
                ffmpeg_path, "-y",
                "-i", str(video_path),
                "-i", str(audio_path),
                "-filter_complex", full_complex_filter,
                "-map", "[vout]",
                "-map", "[aout]",
                "-c:v", "libx264",  # CPU encoding (no GPU in Batch)
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(output_path)
            ]
        else:
            # No subtitles - copy video stream (fast)
            cmd = [
                ffmpeg_path, "-y",
                "-i", str(video_path),
                "-i", str(audio_path),
                "-filter_complex", complex_filter,
                "-map", "0:v",
                "-map", "[aout]",
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(output_path)
            ]

        logger.info(f"[{job_id}] Running FFmpeg for audio overlay...")
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            logger.error(f"[{job_id}] FFmpeg error: {result.stderr}")
            raise RuntimeError(f"FFmpeg failed: {result.stderr[:500]}")

        logger.info(f"[{job_id}] Audio overlay composition completed")

        # Read output file
        return output_path.read_bytes()


async def process_ai_job(params: dict) -> AIJobResponse:
    """Process an AI generation job."""
    start_time = time.time()

    # Parse request
    request = AIJobRequest(**params)
    job_id = request.job_id
    job_type = request.job_type

    logger.info(f"[{job_id}] === Starting AI Job: {job_type.value} ===")

    try:
        # Initialize GCP auth for AI generation jobs
        auth_manager = GCPAuthManager()
        validation = auth_manager.validate_auth()

        if not validation["valid"]:
            raise RuntimeError(f"GCP authentication failed: {validation['error']}")

        logger.info(f"[{job_id}] GCP auth validated for project: {validation['project_id']}")

        # Initialize Vertex AI client
        client = VertexAIClient(auth_manager=auth_manager)

        # Process based on job type
        if job_type == AIJobType.VIDEO_GENERATION:
            response = await process_video_generation(request, client, auth_manager)

        elif job_type == AIJobType.IMAGE_GENERATION:
            response = await process_image_generation(request, client, auth_manager)

        elif job_type == AIJobType.IMAGE_TO_VIDEO:
            # Image-to-video uses video generation with reference image
            # process_video_generation checks for reference_image_url attribute
            if request.i2v_settings:
                request.video_settings = request.i2v_settings
            response = await process_video_generation(request, client, auth_manager)

        else:
            response = AIJobResponse(
                job_id=job_id,
                job_type=job_type,
                status=AIJobStatus.FAILED,
                error=f"Unknown job type: {job_type}",
            )

        # Calculate duration
        duration_ms = int((time.time() - start_time) * 1000)

        logger.info(f"[{job_id}] === Job Complete: {response.status.value} ({duration_ms}ms) ===")

        # Send callback
        if request.callback_url:
            callback = AIJobCallback(
                job_id=job_id,
                job_type=job_type,
                status=response.status,
                output_url=response.output_url,
                error=response.error,
                duration_ms=duration_ms,
            )
            send_callback(request.callback_url, request.callback_secret, callback)

        return response

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[{job_id}] === Job FAILED ===")
        logger.error(f"[{job_id}] Error: {error_msg}")
        logger.error(traceback.format_exc())

        duration_ms = int((time.time() - start_time) * 1000)

        # Send failure callback
        if request.callback_url:
            callback = AIJobCallback(
                job_id=job_id,
                job_type=job_type,
                status=AIJobStatus.FAILED,
                error=error_msg,
                duration_ms=duration_ms,
            )
            send_callback(request.callback_url, request.callback_secret, callback)

        return AIJobResponse(
            job_id=job_id,
            job_type=job_type,
            status=AIJobStatus.FAILED,
            error=error_msg,
        )


def check_aws_identity():
    """Check AWS IAM identity for WIF debugging."""
    logger.info("=== Checking AWS Identity for WIF ===")

    try:
        import boto3
        sts = boto3.client('sts')
        identity = sts.get_caller_identity()

        aws_arn = identity.get('Arn', 'unknown')
        aws_account = identity.get('Account', 'unknown')
        aws_user_id = identity.get('UserId', 'unknown')

        logger.info(f"AWS Account: {aws_account}")
        logger.info(f"AWS ARN: {aws_arn}")
        logger.info(f"AWS UserId: {aws_user_id}")

        # Extract role name from ARN for WIF matching
        # Format: arn:aws:sts::ACCOUNT:assumed-role/ROLE_NAME/SESSION_NAME
        if 'assumed-role/' in aws_arn:
            parts = aws_arn.split('assumed-role/')
            if len(parts) > 1:
                role_session = parts[1]
                role_name = role_session.split('/')[0]
                logger.info(f"Role Name (for WIF): {role_name}")
                logger.info(f"Expected WIF attribute: arn:aws:sts::{aws_account}:assumed-role/{role_name}")

        return aws_arn

    except Exception as e:
        logger.error(f"Failed to get AWS identity: {e}")
        return None


def test_wif_sts_only():
    """
    Test 1: WIF STS token exchange ONLY (no impersonation).
    This tests if the WIF pool/provider is correctly configured.
    """
    logger.info("=== Test 1: WIF STS Token Exchange (No Impersonation) ===")

    # Use the config without impersonation URL
    wif_only_config = "/root/clientLibraryConfig-wif-only.json"

    if not os.path.exists(wif_only_config):
        logger.warning(f"WIF-only config not found: {wif_only_config}")
        logger.info("Creating WIF-only config...")

        # Read current config and remove impersonation URL
        current_config = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "/root/clientLibraryConfig.json")
        try:
            with open(current_config, 'r') as f:
                config = json.load(f)

            # Remove impersonation URL
            if 'service_account_impersonation_url' in config:
                del config['service_account_impersonation_url']

            with open(wif_only_config, 'w') as f:
                json.dump(config, f, indent=2)

            logger.info("Created WIF-only config")
        except Exception as e:
            logger.error(f"Failed to create WIF-only config: {e}")
            return False

    # Temporarily use WIF-only config
    original_cred = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = wif_only_config

    try:
        import google.auth
        from google.auth.transport.requests import Request

        credentials, project = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])

        logger.info(f"Credential type: {type(credentials).__name__}")
        logger.info(f"Detected project: {project}")

        # Try to refresh token
        request = Request()
        credentials.refresh(request)

        if credentials.token:
            logger.info(f"✅ WIF STS Token acquired: {credentials.token[:30]}...")
            logger.info("✅ Test 1 PASSED: WIF STS token exchange works!")
            return True
        else:
            logger.error("❌ No token returned")
            return False

    except Exception as e:
        logger.error(f"❌ Test 1 FAILED: {e}")
        return False
    finally:
        # Restore original config
        if original_cred:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = original_cred


def test_wif_with_impersonation():
    """
    Test 2: WIF with built-in impersonation (current config).
    Tests if WIF can impersonate sa-wif-hyb-hydra-dev@hyb-mgmt-prod.
    """
    logger.info("=== Test 2: WIF + Auto Impersonation (hyb-mgmt-prod SA) ===")

    try:
        import google.auth
        from google.auth.transport.requests import Request

        credentials, project = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])

        logger.info(f"Credential type: {type(credentials).__name__}")

        # Try to refresh token (this triggers impersonation)
        request = Request()
        credentials.refresh(request)

        if credentials.token:
            logger.info(f"✅ Impersonated Token acquired: {credentials.token[:30]}...")
            logger.info("✅ Test 2 PASSED: WIF + hyb-mgmt-prod impersonation works!")
            return True
        else:
            logger.error("❌ No token returned")
            return False

    except Exception as e:
        logger.error(f"❌ Test 2 FAILED: {e}")
        # Parse error for more details
        error_str = str(e)
        if "iam.serviceAccounts.getAccessToken" in error_str:
            logger.error("→ Root cause: WIF principal lacks 'Service Account Token Creator' role")
            logger.error("→ Check: sa-wif-hyb-hydra-dev@hyb-mgmt-prod.iam.gserviceaccount.com permissions")
        return False


def test_wif_direct_to_hydra_dev():
    """
    Test 2b: WIF direct impersonation to hyb-hydra-dev SA.
    This tests if WIF can directly impersonate sa-wif-hyb-hydra-dev@hyb-hydra-dev.
    Uses clientLibraryConfig-hyb-hydra-dev-direct.json config.
    """
    logger.info("=== Test 2b: WIF Direct to hyb-hydra-dev SA ===")

    # Use the direct config that points to hyb-hydra-dev SA
    direct_config = "/root/clientLibraryConfig-hyb-hydra-dev-direct.json"

    if not os.path.exists(direct_config):
        logger.warning(f"Direct config not found: {direct_config}")
        logger.info("Creating direct config for hyb-hydra-dev...")

        # Read current config and change impersonation URL
        current_config = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "/root/clientLibraryConfig.json")
        try:
            with open(current_config, 'r') as f:
                config = json.load(f)

            # Change impersonation URL to hyb-hydra-dev SA
            config['service_account_impersonation_url'] = \
                "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com:generateAccessToken"

            with open(direct_config, 'w') as f:
                json.dump(config, f, indent=2)

            logger.info("Created direct config for hyb-hydra-dev")
        except Exception as e:
            logger.error(f"Failed to create direct config: {e}")
            return False

    # Temporarily use direct config
    original_cred = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = direct_config

    try:
        import google.auth
        from google.auth.transport.requests import Request

        credentials, project = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])

        logger.info(f"Credential type: {type(credentials).__name__}")

        # Try to refresh token (this triggers impersonation)
        request = Request()
        credentials.refresh(request)

        if credentials.token:
            logger.info(f"[PASS] Direct Token acquired: {credentials.token[:30]}...")
            logger.info("[PASS] Test 2b PASSED: WIF direct to hyb-hydra-dev works!")
            return True
        else:
            logger.error("[FAIL] No token returned")
            return False

    except Exception as e:
        logger.error(f"[FAIL] Test 2b FAILED: {e}")
        error_str = str(e)
        if "iam.serviceAccounts.getAccessToken" in error_str:
            logger.error("-> Root cause: WIF principal lacks 'Service Account Token Creator' role")
            logger.error("-> Need: Grant Token Creator to WIF principal on hyb-hydra-dev SA")
        return False
    finally:
        # Restore original config
        if original_cred:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = original_cred


def test_manual_impersonation(target_sa: str):
    """
    Test 3: Manual impersonation to another SA.
    After getting WIF token, try to impersonate another SA.
    """
    logger.info(f"=== Test 3: Manual Impersonation to {target_sa} ===")

    try:
        import google.auth
        from google.auth import impersonated_credentials
        from google.auth.transport.requests import Request

        # First get source credentials (from WIF with mgmt-prod impersonation)
        source_credentials, project = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])

        # Refresh source credentials
        request = Request()
        source_credentials.refresh(request)

        logger.info(f"Source credential type: {type(source_credentials).__name__}")
        logger.info(f"Source token acquired: {source_credentials.token[:20]}...")

        # Now try to impersonate target SA
        logger.info(f"Attempting to impersonate: {target_sa}")

        target_credentials = impersonated_credentials.Credentials(
            source_credentials=source_credentials,
            target_principal=target_sa,
            target_scopes=["https://www.googleapis.com/auth/cloud-platform"],
            lifetime=3600,
        )

        target_credentials.refresh(request)

        if target_credentials.token:
            logger.info(f"✅ Target Token acquired: {target_credentials.token[:30]}...")
            logger.info(f"✅ Test 3 PASSED: Can impersonate {target_sa}!")
            return True
        else:
            logger.error("❌ No token returned")
            return False

    except Exception as e:
        logger.error(f"❌ Test 3 FAILED: {e}")
        return False


def run_wif_diagnostics():
    """Run comprehensive WIF diagnostics."""
    logger.info("")
    logger.info("=" * 60)
    logger.info("    WIF COMPREHENSIVE DIAGNOSTIC TEST v5")
    logger.info("=" * 60)
    logger.info("")

    results = {}

    # Test 1: WIF STS only (no impersonation)
    results['wif_sts'] = test_wif_sts_only()
    logger.info("")

    # Test 2: WIF + mgmt-prod impersonation (current config)
    results['wif_mgmt_prod'] = test_wif_with_impersonation()
    logger.info("")

    # Test 2b: WIF + direct hyb-hydra-dev impersonation (THIS IS WHAT WE NEED)
    results['wif_hydra_dev_direct'] = test_wif_direct_to_hydra_dev()
    logger.info("")

    # Test 3: Manual impersonation chain (only if Test 2 passes)
    if results['wif_mgmt_prod']:
        target_sa = "sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com"
        results['manual_impersonation'] = test_manual_impersonation(target_sa)
    else:
        logger.info("=== Test 3: Skipped (Test 2 failed) ===")
        results['manual_impersonation'] = None

    # Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("    DIAGNOSTIC SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Test 1  (WIF STS Token):           {'[PASS]' if results['wif_sts'] else '[FAIL]'}")
    logger.info(f"Test 2  (WIF -> mgmt-prod SA):     {'[PASS]' if results['wif_mgmt_prod'] else '[FAIL]'}")
    logger.info(f"Test 2b (WIF -> hyb-hydra-dev):    {'[PASS]' if results['wif_hydra_dev_direct'] else '[FAIL]'}")
    if results['manual_impersonation'] is not None:
        logger.info(f"Test 3  (mgmt-prod -> hydra-dev):  {'[PASS]' if results['manual_impersonation'] else '[FAIL]'}")
    else:
        logger.info(f"Test 3  (mgmt-prod -> hydra-dev):  [SKIP]")
    logger.info("=" * 60)

    # Recommendations based on results
    logger.info("")
    if not results['wif_sts']:
        logger.info("[FIX] RECOMMENDATION: WIF Pool/Provider configuration issue")
        logger.info("   - Check WIF Pool audience matches config")
        logger.info("   - Check WIF Provider attribute mapping")
        logger.info("   - Verify AWS Role ARN in attribute conditions")
    elif results['wif_hydra_dev_direct']:
        # Test 2b passed - this is the correct path!
        logger.info("[OK] SUCCESS: WIF direct to hyb-hydra-dev works!")
        logger.info("   - Use clientLibraryConfig-hyb-hydra-dev-direct.json for production")
        logger.info("   - Target SA: sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com")
    elif not results['wif_hydra_dev_direct']:
        logger.info("[FIX] RECOMMENDATION: Need Token Creator on hyb-hydra-dev SA")
        logger.info("   - Grant 'Service Account Token Creator' role to WIF principal")
        logger.info("   - Principal: principal://iam.googleapis.com/projects/1087943557989/locations/global/workloadIdentityPools/hyb-hydra-dev/subject/arn:aws:sts::139984419402:assumed-role/hydra-batch-job-role")
        logger.info("   - Target: sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com")
        logger.info("")
        logger.info("   GCloud command:")
        logger.info("   gcloud iam service-accounts add-iam-policy-binding \\")
        logger.info("     sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com \\")
        logger.info("     --role='roles/iam.serviceAccountTokenCreator' \\")
        logger.info("     --member='principal://iam.googleapis.com/projects/1087943557989/locations/global/workloadIdentityPools/hyb-hydra-dev/subject/arn:aws:sts::139984419402:assumed-role/hydra-batch-job-role'")

    return results.get('wif_hydra_dev_direct', False)


def test_gcp_auth():
    """Test GCP authentication."""
    logger.info("=== Testing GCP WIF Authentication ===")

    try:
        auth_manager = GCPAuthManager()
        result = auth_manager.validate_auth()

        logger.info(f"Valid: {result['valid']}")
        logger.info(f"Project: {result['project_id']}")
        logger.info(f"Target SA: {result['target_sa']}")
        logger.info(f"Location: {result['location']}")

        if result['error']:
            logger.error(f"Error: {result['error']}")
        else:
            logger.info(f"Token: {result['token_preview']}")

        return result['valid']

    except Exception as e:
        logger.error(f"Auth test failed: {e}")
        logger.error(traceback.format_exc())
        return False


def process_job():
    """Entry point for AWS Batch AI job."""
    logger.info("=== AWS Batch AI Worker Starting ===")

    # Load secrets
    load_secrets_from_aws()

    # Setup GCP credentials
    setup_gcp_credentials()

    # Check AWS identity first (for WIF debugging)
    check_aws_identity()

    # Check if this is a diagnostic test
    job_type = os.environ.get("JOB_TYPE", "")
    if job_type == "WIF_DIAGNOSTIC":
        logger.info("Running WIF diagnostic mode...")
        run_wif_diagnostics()
        logger.info("Diagnostic complete - exiting")
        sys.exit(0)

    # Test authentication first
    if not test_gcp_auth():
        logger.error("GCP authentication failed - running diagnostics...")
        run_wif_diagnostics()
        logger.error("GCP authentication failed - exiting")
        sys.exit(1)

    # Get job parameters
    params = get_job_parameters()

    if not params:
        # Try stdin for testing
        logger.info("No BATCH_JOB_PARAMETERS found, checking stdin...")
        try:
            input_data = sys.stdin.read()
            if input_data:
                params = json.loads(input_data)
        except:
            pass

    if not params:
        logger.error("ERROR: No job parameters provided")
        sys.exit(1)

    logger.info(f"Job ID: {params.get('job_id', 'unknown')}")
    logger.info(f"Job Type: {params.get('job_type', 'unknown')}")

    # Run async job processing
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        result = loop.run_until_complete(process_ai_job(params))
        if result.status == AIJobStatus.FAILED:
            sys.exit(1)
    finally:
        loop.close()

    logger.info("=== AWS Batch AI Worker Complete ===")


if __name__ == "__main__":
    process_job()
