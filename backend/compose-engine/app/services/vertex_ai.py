"""
Vertex AI Client for Video and Image Generation.

Provides high-level interface for:
- Veo 3.1: Video generation from text/image prompts
- Imagen 4.0: Image generation from text prompts
- Gemini 3 Pro Image: Advanced image generation with reasoning

Uses GCP WIF authentication via gcp_auth module.

VERSION: v8 (2024-12-30) - Added Gemini 3 Pro Image support
"""

import os
import json
import time
import logging
import asyncio
import base64
from typing import Optional, Literal
from dataclasses import dataclass
from enum import Enum

import httpx

from .gcp_auth import get_auth_manager, GCPAuthManager

logger = logging.getLogger(__name__)


class VideoAspectRatio(str, Enum):
    """Supported video aspect ratios for Veo."""
    LANDSCAPE_16_9 = "16:9"
    PORTRAIT_9_16 = "9:16"
    SQUARE_1_1 = "1:1"


class ImageAspectRatio(str, Enum):
    """Supported image aspect ratios for Imagen."""
    LANDSCAPE_16_9 = "16:9"
    PORTRAIT_9_16 = "9:16"
    SQUARE_1_1 = "1:1"
    LANDSCAPE_4_3 = "4:3"
    PORTRAIT_3_4 = "3:4"


class GeminiImageAspectRatio(str, Enum):
    """
    Supported image aspect ratios for Gemini 3 Pro Image.

    Gemini supports more aspect ratios than Imagen.
    """
    SQUARE_1_1 = "1:1"
    LANDSCAPE_3_2 = "3:2"
    PORTRAIT_2_3 = "2:3"
    LANDSCAPE_4_3 = "4:3"
    PORTRAIT_3_4 = "3:4"
    LANDSCAPE_4_5 = "4:5"
    PORTRAIT_5_4 = "5:4"
    PORTRAIT_9_16 = "9:16"
    LANDSCAPE_16_9 = "16:9"
    ULTRAWIDE_21_9 = "21:9"


@dataclass
class VideoGenerationConfig:
    """Configuration for video generation."""
    prompt: str
    aspect_ratio: VideoAspectRatio = VideoAspectRatio.PORTRAIT_9_16  # Default for TikTok/Shorts/Reels
    duration_seconds: int = 8  # 4, 6, or 8 seconds for Veo 3.1
    negative_prompt: Optional[str] = None
    seed: Optional[int] = None
    reference_image_uri: Optional[str] = None  # GCS URI for image-to-video
    reference_image_base64: Optional[str] = None  # Base64 encoded image for image-to-video
    reference_image_mime_type: Optional[str] = None  # Mime type for base64 image (e.g., "image/png")
    person_generation: str = "allow_adult"  # allow_adult, dont_allow
    generate_audio: bool = True  # Veo 3 supports audio


@dataclass
class ImageGenerationConfig:
    """Configuration for image generation with Imagen."""
    prompt: str
    aspect_ratio: ImageAspectRatio = ImageAspectRatio.PORTRAIT_9_16  # Default for Veo 3.1 video previews
    negative_prompt: Optional[str] = None
    seed: Optional[int] = None
    number_of_images: int = 1
    safety_filter_level: str = "block_some"
    person_generation: str = "allow_adult"


@dataclass
class GeminiImageConfig:
    """
    Configuration for image generation with Gemini 3 Pro Image.

    Gemini 3 Pro Image provides:
    - Higher quality images with reasoning
    - More aspect ratio options
    - Text rendering capabilities
    - Multi-turn image editing
    """
    prompt: str
    aspect_ratio: GeminiImageAspectRatio = GeminiImageAspectRatio.SQUARE_1_1
    number_of_images: int = 1
    include_reasoning: bool = False  # Include model's reasoning in response


@dataclass
class VideoExtendConfig:
    """
    Configuration for video extension.

    Veo 3.1 supports extending previously generated videos by up to 7 seconds
    per extension, with a maximum of 20 extensions total.

    Requirements:
    - Source video must be from a previous Veo generation (GCS URI)
    - Resolution is fixed at 720p for extensions
    - Aspect ratio must be 9:16 or 16:9
    - Last 1 second of video should contain audio for best results
    """
    source_video_gcs_uri: str  # GCS URI of the video to extend
    prompt: Optional[str] = None  # Optional prompt for continuation
    aspect_ratio: VideoAspectRatio = VideoAspectRatio.PORTRAIT_9_16


@dataclass
class GenerationResult:
    """Result of a generation operation."""
    success: bool
    operation_name: Optional[str] = None  # For async operations
    video_uri: Optional[str] = None  # GCS URI of generated video
    image_uri: Optional[str] = None  # GCS URI of generated image
    image_base64: Optional[str] = None  # Base64 encoded image
    error: Optional[str] = None
    metadata: Optional[dict] = None


class VertexAIClient:
    """
    Client for Vertex AI generative models (Veo, Imagen).

    Usage:
        client = VertexAIClient()

        # Generate video
        config = VideoGenerationConfig(prompt="A cat playing piano")
        result = await client.generate_video(config, output_gcs_uri="gs://bucket/video.mp4")

        # Generate image
        config = ImageGenerationConfig(prompt="A futuristic city")
        result = await client.generate_image(config)
    """

    # Model endpoints
    VEO_MODEL = "veo-3.1-generate-001"  # Veo 3.1
    IMAGE_MODEL = "imagen-4.0-generate-001"  # Imagen 4.0
    GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview"  # Gemini 3 Pro Image (global endpoint only)

    def __init__(
        self,
        auth_manager: Optional[GCPAuthManager] = None,
        timeout: float = 300.0,  # 5 minutes for long operations
    ):
        """
        Initialize Vertex AI client.

        Args:
            auth_manager: GCP auth manager (uses singleton if not provided)
            timeout: HTTP request timeout in seconds
        """
        self.auth = auth_manager or get_auth_manager()
        self.timeout = timeout
        self.project_id = self.auth.project_id
        self.location = self.auth.location

        logger.info(f"VertexAIClient initialized for {self.project_id}/{self.location}")

    def _get_model_endpoint(self, model: str, action: str = "predict") -> str:
        """Get the full endpoint URL for a model."""
        base = self.auth.get_vertex_ai_endpoint()
        return f"{base}/publishers/google/models/{model}:{action}"

    async def _make_request(
        self,
        method: str,
        url: str,
        json_data: Optional[dict] = None,
        timeout: Optional[float] = None,
    ) -> dict:
        """Make an authenticated HTTP request."""
        headers = self.auth.get_auth_headers()
        timeout = timeout or self.timeout

        async with httpx.AsyncClient(timeout=timeout) as client:
            if method.upper() == "GET":
                response = await client.get(url, headers=headers)
            elif method.upper() == "POST":
                response = await client.post(url, headers=headers, json=json_data)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            if response.status_code >= 400:
                error_detail = response.text
                logger.error(f"API error {response.status_code}: {error_detail}")
                raise RuntimeError(f"Vertex AI API error: {response.status_code} - {error_detail}")

            return response.json()

    async def generate_video(
        self,
        config: VideoGenerationConfig,
        output_gcs_uri: str,
        poll_interval: float = 10.0,
        max_wait_time: float = 600.0,  # 10 minutes
    ) -> GenerationResult:
        """
        Generate a video using Veo 3.

        Args:
            config: Video generation configuration
            output_gcs_uri: GCS URI for output video (gs://bucket/path/video.mp4)
            poll_interval: Seconds between status checks
            max_wait_time: Maximum wait time for completion

        Returns:
            GenerationResult with video URI or error
        """
        logger.info(f"Starting video generation: {config.prompt[:50]}...")

        # Build request payload for Veo 3
        instances = [{
            "prompt": config.prompt,
        }]

        # Add reference image for image-to-video (base64 takes priority over GCS URI)
        if config.reference_image_base64 and config.reference_image_mime_type:
            instances[0]["image"] = {
                "bytesBase64Encoded": config.reference_image_base64,
                "mimeType": config.reference_image_mime_type,
            }
            logger.info(f"Using base64 reference image ({config.reference_image_mime_type})")
        elif config.reference_image_uri:
            instances[0]["image"] = {
                "gcsUri": config.reference_image_uri,
            }
            logger.info(f"Using GCS URI reference image: {config.reference_image_uri[:50]}...")

        parameters = {
            "aspectRatio": config.aspect_ratio.value,
            "durationSeconds": config.duration_seconds,
            "personGeneration": config.person_generation,
            "storageUri": output_gcs_uri,
            "sampleCount": 1,
        }

        if config.negative_prompt:
            parameters["negativePrompt"] = config.negative_prompt

        if config.seed is not None:
            parameters["seed"] = config.seed

        request_body = {
            "instances": instances,
            "parameters": parameters,
        }

        try:
            # Start generation (returns long-running operation)
            endpoint = self._get_model_endpoint(self.VEO_MODEL, "predictLongRunning")
            logger.info(f"Calling Veo endpoint: {endpoint}")

            response = await self._make_request("POST", endpoint, request_body)

            # Get operation name for polling
            operation_name = response.get("name")
            if not operation_name:
                return GenerationResult(
                    success=False,
                    error="No operation name returned from Veo API",
                )

            logger.info(f"Video generation started: {operation_name}")

            # Poll for completion
            result = await self._poll_operation(
                operation_name,
                poll_interval=poll_interval,
                max_wait_time=max_wait_time,
            )

            if result.get("done"):
                if "error" in result:
                    error_msg = str(result["error"])
                    logger.error(f"Video generation error: {error_msg}")
                    return GenerationResult(
                        success=False,
                        operation_name=operation_name,
                        error=error_msg,
                    )

                # Extract video URI from response
                # Response format: {"videos": [{"gcsUri": "...", "mimeType": "video/mp4"}]}
                response_data = result.get("response", {})
                videos = response_data.get("videos", [])

                logger.info(f"Veo response data: {response_data}")
                logger.info(f"Veo videos array: {videos}")

                if videos and len(videos) > 0:
                    video_uri = videos[0].get("gcsUri", output_gcs_uri)
                    logger.info(f"Video URI from Veo: {video_uri}")
                    return GenerationResult(
                        success=True,
                        operation_name=operation_name,
                        video_uri=video_uri,
                        metadata=response_data,
                    )

                # No videos returned - log the full response for debugging
                logger.error(f"No videos in response. Full result: {result}")
                # Check for RAI (Responsible AI) filtering
                rai_result = response_data.get("raiMediaFilteredReasons", [])
                if rai_result:
                    return GenerationResult(
                        success=False,
                        operation_name=operation_name,
                        error=f"Video blocked by content filter: {rai_result}",
                        metadata=response_data,
                    )

            return GenerationResult(
                success=False,
                operation_name=operation_name,
                error=f"Video generation did not complete. Response: {result}",
            )

        except Exception as e:
            logger.error(f"Video generation failed: {e}")
            return GenerationResult(
                success=False,
                error=str(e),
            )

    async def extend_video(
        self,
        config: VideoExtendConfig,
        output_gcs_uri: str,
        poll_interval: float = 10.0,
        max_wait_time: float = 600.0,  # 10 minutes
    ) -> GenerationResult:
        """
        Extend a previously generated Veo video by up to 7 seconds.

        Uses the same generate_videos endpoint but with a 'video' parameter
        instead of 'image' to reference the source video.

        Args:
            config: Video extension configuration
            output_gcs_uri: GCS URI for output video (gs://bucket/path/video.mp4)
            poll_interval: Seconds between status checks
            max_wait_time: Maximum wait time for completion

        Returns:
            GenerationResult with extended video URI or error

        Note:
            - Source video must be from a previous Veo generation
            - Extensions are fixed at 720p resolution
            - Maximum 20 extensions per video chain
            - Last 1 second should have audio for best results
        """
        logger.info(f"Starting video extension from: {config.source_video_gcs_uri[:50]}...")

        # Build request payload for video extension
        # Key difference: use 'video' parameter instead of 'image'
        instances = [{
            "video": {
                "gcsUri": config.source_video_gcs_uri,
                "mimeType": "video/mp4",
            }
        }]

        # Add optional continuation prompt
        if config.prompt:
            instances[0]["prompt"] = config.prompt
            logger.info(f"Extension prompt: {config.prompt[:50]}...")

        parameters = {
            "aspectRatio": config.aspect_ratio.value,
            "resolution": "720p",  # Extension only supports 720p
            "storageUri": output_gcs_uri,
            "sampleCount": 1,
        }

        request_body = {
            "instances": instances,
            "parameters": parameters,
        }

        try:
            # Start extension (returns long-running operation)
            endpoint = self._get_model_endpoint(self.VEO_MODEL, "predictLongRunning")
            logger.info(f"Calling Veo extend endpoint: {endpoint}")
            logger.info(f"Extend request body: {request_body}")

            response = await self._make_request("POST", endpoint, request_body)

            # Get operation name for polling
            operation_name = response.get("name")
            if not operation_name:
                return GenerationResult(
                    success=False,
                    error="No operation name returned from Veo API for extension",
                )

            logger.info(f"Video extension started: {operation_name}")

            # Poll for completion
            result = await self._poll_operation(
                operation_name,
                poll_interval=poll_interval,
                max_wait_time=max_wait_time,
            )

            if result.get("done"):
                if "error" in result:
                    error_msg = str(result["error"])
                    logger.error(f"Video extension error: {error_msg}")
                    return GenerationResult(
                        success=False,
                        operation_name=operation_name,
                        error=error_msg,
                    )

                # Extract video URI from response
                response_data = result.get("response", {})
                videos = response_data.get("videos", [])

                logger.info(f"Veo extension response data: {response_data}")

                if videos and len(videos) > 0:
                    video_uri = videos[0].get("gcsUri", output_gcs_uri)
                    logger.info(f"Extended video URI: {video_uri}")
                    return GenerationResult(
                        success=True,
                        operation_name=operation_name,
                        video_uri=video_uri,
                        metadata=response_data,
                    )

                # No videos returned - check for content filter
                logger.error(f"No videos in extension response. Full result: {result}")
                rai_result = response_data.get("raiMediaFilteredReasons", [])
                if rai_result:
                    return GenerationResult(
                        success=False,
                        operation_name=operation_name,
                        error=f"Video extension blocked by content filter: {rai_result}",
                        metadata=response_data,
                    )

            return GenerationResult(
                success=False,
                operation_name=operation_name,
                error=f"Video extension did not complete. Response: {result}",
            )

        except Exception as e:
            logger.error(f"Video extension failed: {e}")
            return GenerationResult(
                success=False,
                error=str(e),
            )

    async def generate_image(
        self,
        config: ImageGenerationConfig,
        output_gcs_uri: Optional[str] = None,
    ) -> GenerationResult:
        """
        Generate an image using Imagen 4.0.

        Uses Vertex AI predict API with service account authentication.

        Args:
            config: Image generation configuration
            output_gcs_uri: Optional GCS URI for output (not used, always returns base64)

        Returns:
            GenerationResult with image data or error
        """
        logger.info(f"[vertex_ai v7] Starting image generation with Imagen 4.0: {config.prompt[:50]}...")

        try:
            # Get auth headers with self-signed JWT
            headers = self.auth.get_auth_headers()

            # Build endpoint URL for Imagen 4.0
            endpoint = f"https://{self.location}-aiplatform.googleapis.com/v1/projects/{self.project_id}/locations/{self.location}/publishers/google/models/{self.IMAGE_MODEL}:predict"

            logger.info(f"Calling Imagen 4.0 endpoint: {endpoint}")

            # Build request payload for Imagen predict API
            request_body = {
                "instances": [
                    {"prompt": config.prompt}
                ],
                "parameters": {
                    "sampleCount": config.number_of_images,
                    "aspectRatio": config.aspect_ratio.value,
                    "safetyFilterLevel": config.safety_filter_level,
                    "personGeneration": config.person_generation,
                },
            }

            # Add negative prompt if provided
            if config.negative_prompt:
                request_body["parameters"]["negativePrompt"] = config.negative_prompt

            # Add seed if provided
            if config.seed is not None:
                request_body["parameters"]["seed"] = config.seed

            # Make direct HTTP request
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(endpoint, headers=headers, json=request_body)

                logger.info(f"HTTP Response: {response.status_code}")

                if response.status_code >= 400:
                    error_detail = response.text
                    logger.error(f"API error {response.status_code}: {error_detail}")
                    return GenerationResult(
                        success=False,
                        error=f"Vertex AI API error: {response.status_code} - {error_detail}",
                    )

                result = response.json()

            # Parse response - extract image from predictions
            predictions = result.get("predictions", [])
            if predictions and len(predictions) > 0:
                image_data = predictions[0].get("bytesBase64Encoded")
                mime_type = predictions[0].get("mimeType", "image/png")

                if image_data:
                    logger.info(f"Image generated successfully (base64, {mime_type})")
                    return GenerationResult(
                        success=True,
                        image_base64=image_data,
                        metadata={"model": self.IMAGE_MODEL, "mimeType": mime_type},
                    )

                # Check for RAI filtering
                rai_reasons = predictions[0].get("raiFilteredReason")
                if rai_reasons:
                    return GenerationResult(
                        success=False,
                        error=f"Image generation blocked by safety filters: {rai_reasons}",
                        metadata={"raiFilteredReason": rai_reasons},
                    )

            return GenerationResult(
                success=False,
                error="No image data returned from Imagen API",
                metadata={"response": result},
            )

        except Exception as e:
            logger.error(f"Image generation failed: {e}")
            return GenerationResult(
                success=False,
                error=str(e),
            )

    async def generate_image_gemini(
        self,
        config: GeminiImageConfig,
    ) -> GenerationResult:
        """
        Generate an image using Gemini 3 Pro Image.

        Uses google.genai SDK with Vertex AI backend.
        Requires global endpoint (not regional).

        Args:
            config: Gemini image generation configuration

        Returns:
            GenerationResult with image data or error

        Note:
            Gemini 3 Pro Image returns both reasoning text and image.
            The image is extracted and returned as base64.
        """
        logger.info(f"[vertex_ai v8] Starting image generation with Gemini 3 Pro Image: {config.prompt[:50]}...")

        try:
            # Import google.genai SDK
            from google import genai
            from google.genai.types import GenerateContentConfig, Modality

            # Get credentials from auth manager
            credentials = self.auth.get_credentials()

            # Create Gemini client with Vertex AI backend
            # Gemini 3 requires global endpoint
            client = genai.Client(
                vertexai=True,
                project=self.project_id,
                location="global",  # Gemini 3 Pro Image requires global endpoint
                credentials=credentials,
            )

            logger.info(f"Calling Gemini 3 Pro Image model: {self.GEMINI_IMAGE_MODEL}")
            logger.info(f"Prompt: {config.prompt[:100]}...")

            # Build generation config
            gen_config = GenerateContentConfig(
                response_modalities=[Modality.TEXT, Modality.IMAGE],
            )

            # Generate content
            response = client.models.generate_content(
                model=self.GEMINI_IMAGE_MODEL,
                contents=config.prompt,
                config=gen_config,
            )

            logger.info("Gemini response received, parsing...")

            # Parse response - extract image and optionally reasoning
            reasoning_texts = []
            image_data = None
            mime_type = None

            for part in response.candidates[0].content.parts:
                if part.text:
                    reasoning_texts.append(part.text)
                if part.inline_data:
                    image_data = part.inline_data.data
                    mime_type = part.inline_data.mime_type

            if image_data:
                # Encode to base64
                image_base64 = base64.b64encode(image_data).decode('utf-8')

                metadata = {
                    "model": self.GEMINI_IMAGE_MODEL,
                    "mimeType": mime_type or "image/png",
                }

                # Include reasoning if requested
                if config.include_reasoning and reasoning_texts:
                    metadata["reasoning"] = reasoning_texts

                logger.info(f"Gemini image generated successfully ({mime_type}, {len(image_base64)} chars)")

                return GenerationResult(
                    success=True,
                    image_base64=image_base64,
                    metadata=metadata,
                )

            # No image in response
            return GenerationResult(
                success=False,
                error="No image data returned from Gemini API",
                metadata={"reasoning": reasoning_texts} if reasoning_texts else None,
            )

        except ImportError as e:
            logger.error(f"google-genai SDK not installed: {e}")
            return GenerationResult(
                success=False,
                error="google-genai SDK not installed. Run: pip install google-genai",
            )
        except Exception as e:
            logger.error(f"Gemini image generation failed: {e}")
            return GenerationResult(
                success=False,
                error=str(e),
            )

    async def _poll_operation(
        self,
        operation_name: str,
        poll_interval: float = 10.0,
        max_wait_time: float = 600.0,
    ) -> dict:
        """
        Poll a long-running operation until completion.

        Args:
            operation_name: Full operation name from initial request
            poll_interval: Seconds between polls
            max_wait_time: Maximum total wait time

        Returns:
            dict: Final operation status
        """
        # Build fetchPredictOperation URL for Veo
        # Veo uses POST to fetchPredictOperation endpoint instead of GET to operation URL
        fetch_url = self._get_model_endpoint(self.VEO_MODEL, "fetchPredictOperation")

        start_time = time.time()

        while True:
            elapsed = time.time() - start_time

            if elapsed > max_wait_time:
                logger.warning(f"Operation timed out after {elapsed:.1f}s")
                return {"done": False, "error": "Timeout"}

            try:
                # Use POST with operationName in body for Veo
                result = await self._make_request("POST", fetch_url, {"operationName": operation_name})

                if result.get("done"):
                    logger.info(f"Operation completed after {elapsed:.1f}s")
                    # Log full result for debugging
                    logger.info(f"Operation result: done={result.get('done')}, has_error={'error' in result}, has_response={'response' in result}")
                    if 'error' in result:
                        logger.error(f"Operation error details: {result.get('error')}")
                    return result

                # Log progress if available
                metadata = result.get("metadata", {})
                progress = metadata.get("progressPercentage", 0)
                logger.info(f"Operation progress: {progress}% (elapsed: {elapsed:.1f}s)")

            except Exception as e:
                logger.warning(f"Poll error (will retry): {e}")

            await asyncio.sleep(poll_interval)

    async def check_operation_status(self, operation_name: str) -> dict:
        """
        Check the status of a long-running operation.

        Args:
            operation_name: Full operation name

        Returns:
            dict: Current operation status
        """
        base_url = f"https://{self.location}-aiplatform.googleapis.com/v1"
        operation_url = f"{base_url}/{operation_name}"

        return await self._make_request("GET", operation_url)


# Factory function for easy instantiation
def create_vertex_ai_client(
    auth_manager: Optional[GCPAuthManager] = None,
) -> VertexAIClient:
    """
    Create a Vertex AI client instance.

    Args:
        auth_manager: Optional custom auth manager

    Returns:
        VertexAIClient: Configured client
    """
    return VertexAIClient(auth_manager=auth_manager)


# Convenience functions for common operations
async def generate_video(
    prompt: str,
    output_gcs_uri: str,
    aspect_ratio: str = "16:9",
    duration_seconds: int = 8,
    **kwargs,
) -> GenerationResult:
    """
    Convenience function for video generation.

    Args:
        prompt: Text prompt for video
        output_gcs_uri: GCS URI for output
        aspect_ratio: Video aspect ratio
        duration_seconds: Video duration (5 or 8)
        **kwargs: Additional config options

    Returns:
        GenerationResult
    """
    client = create_vertex_ai_client()
    config = VideoGenerationConfig(
        prompt=prompt,
        aspect_ratio=VideoAspectRatio(aspect_ratio),
        duration_seconds=duration_seconds,
        **kwargs,
    )
    return await client.generate_video(config, output_gcs_uri)


async def generate_image(
    prompt: str,
    aspect_ratio: str = "1:1",
    output_gcs_uri: Optional[str] = None,
    **kwargs,
) -> GenerationResult:
    """
    Convenience function for image generation with Imagen 4.0.

    Args:
        prompt: Text prompt for image
        aspect_ratio: Image aspect ratio
        output_gcs_uri: Optional GCS URI for output
        **kwargs: Additional config options

    Returns:
        GenerationResult
    """
    client = create_vertex_ai_client()
    config = ImageGenerationConfig(
        prompt=prompt,
        aspect_ratio=ImageAspectRatio(aspect_ratio),
        **kwargs,
    )
    return await client.generate_image(config, output_gcs_uri)


async def generate_image_gemini(
    prompt: str,
    aspect_ratio: str = "1:1",
    include_reasoning: bool = False,
    **kwargs,
) -> GenerationResult:
    """
    Convenience function for image generation with Gemini 3 Pro Image.

    Args:
        prompt: Text prompt for image
        aspect_ratio: Image aspect ratio (supports more ratios than Imagen)
        include_reasoning: Include model's reasoning in metadata
        **kwargs: Additional config options

    Returns:
        GenerationResult with image_base64 and optional reasoning

    Example:
        result = await generate_image_gemini(
            prompt="A futuristic city with flying cars",
            aspect_ratio="16:9",
            include_reasoning=True,
        )
        if result.success:
            print(f"Image: {len(result.image_base64)} chars")
            if result.metadata.get("reasoning"):
                print(f"Reasoning: {result.metadata['reasoning']}")
    """
    client = create_vertex_ai_client()
    config = GeminiImageConfig(
        prompt=prompt,
        aspect_ratio=GeminiImageAspectRatio(aspect_ratio),
        include_reasoning=include_reasoning,
        **kwargs,
    )
    return await client.generate_image_gemini(config)


# For testing
if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)

    async def test():
        print("Testing Vertex AI Client (v8)...")
        print("-" * 50)

        client = create_vertex_ai_client()
        print(f"Project: {client.project_id}")
        print(f"Location: {client.location}")
        print(f"Models:")
        print(f"  - Veo: {client.VEO_MODEL}")
        print(f"  - Imagen: {client.IMAGE_MODEL}")
        print(f"  - Gemini Image: {client.GEMINI_IMAGE_MODEL}")

        # Test Gemini image generation
        print("\n" + "=" * 50)
        print("Testing Gemini 3 Pro Image...")
        config = GeminiImageConfig(
            prompt="A beautiful sunset over mountains with purple and orange sky",
            include_reasoning=True,
        )
        print(f"Prompt: {config.prompt}")
        result = await client.generate_image_gemini(config)
        print(f"Success: {result.success}")
        if result.success:
            print(f"Image size: {len(result.image_base64)} chars")
            if result.metadata.get("reasoning"):
                print(f"Reasoning steps: {len(result.metadata['reasoning'])}")
        else:
            print(f"Error: {result.error}")

    asyncio.run(test())
