"""
Vertex AI Client for Video and Image Generation.

Provides high-level interface for:
- Veo 3: Video generation from text/image prompts
- Imagen 3: Image generation from text prompts

Uses GCP WIF authentication via gcp_auth module.
"""

import os
import json
import time
import logging
import asyncio
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


@dataclass
class VideoGenerationConfig:
    """Configuration for video generation."""
    prompt: str
    aspect_ratio: VideoAspectRatio = VideoAspectRatio.LANDSCAPE_16_9
    duration_seconds: int = 8  # 5 or 8 seconds for Veo 3
    negative_prompt: Optional[str] = None
    seed: Optional[int] = None
    reference_image_uri: Optional[str] = None  # GCS URI for image-to-video
    person_generation: str = "allow_adult"  # allow_adult, dont_allow
    generate_audio: bool = True  # Veo 3 supports audio


@dataclass
class ImageGenerationConfig:
    """Configuration for image generation."""
    prompt: str
    aspect_ratio: ImageAspectRatio = ImageAspectRatio.SQUARE_1_1
    negative_prompt: Optional[str] = None
    seed: Optional[int] = None
    number_of_images: int = 1
    safety_filter_level: str = "block_some"
    person_generation: str = "allow_adult"


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
    VEO_MODEL = "veo-3.0-generate-preview"  # Veo 3
    IMAGEN_MODEL = "imagen-3.0-generate-002"  # Imagen 3

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

        if config.reference_image_uri:
            instances[0]["image"] = {
                "gcsUri": config.reference_image_uri,
            }

        parameters = {
            "aspectRatio": config.aspect_ratio.value,
            "durationSeconds": config.duration_seconds,
            "personGeneration": config.person_generation,
            "generateAudio": config.generate_audio,
            "outputOptions": {
                "gcsUri": output_gcs_uri,
            },
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
                    return GenerationResult(
                        success=False,
                        operation_name=operation_name,
                        error=str(result["error"]),
                    )

                # Extract video URI from response
                response_data = result.get("response", {})
                predictions = response_data.get("predictions", [])

                if predictions and len(predictions) > 0:
                    video_uri = predictions[0].get("gcsUri", output_gcs_uri)
                    return GenerationResult(
                        success=True,
                        operation_name=operation_name,
                        video_uri=video_uri,
                        metadata=response_data,
                    )

            return GenerationResult(
                success=False,
                operation_name=operation_name,
                error="Video generation did not complete within timeout",
            )

        except Exception as e:
            logger.error(f"Video generation failed: {e}")
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
        Generate an image using Imagen 3.

        Args:
            config: Image generation configuration
            output_gcs_uri: Optional GCS URI for output (if not provided, returns base64)

        Returns:
            GenerationResult with image data or error
        """
        logger.info(f"Starting image generation: {config.prompt[:50]}...")

        # Build request payload for Imagen 3
        instances = [{
            "prompt": config.prompt,
        }]

        parameters = {
            "aspectRatio": config.aspect_ratio.value,
            "sampleCount": config.number_of_images,
            "safetyFilterLevel": config.safety_filter_level,
            "personGeneration": config.person_generation,
        }

        if config.negative_prompt:
            parameters["negativePrompt"] = config.negative_prompt

        if config.seed is not None:
            parameters["seed"] = config.seed

        if output_gcs_uri:
            parameters["outputOptions"] = {
                "gcsUri": output_gcs_uri,
            }

        request_body = {
            "instances": instances,
            "parameters": parameters,
        }

        try:
            endpoint = self._get_model_endpoint(self.IMAGEN_MODEL, "predict")
            logger.info(f"Calling Imagen endpoint: {endpoint}")

            response = await self._make_request("POST", endpoint, request_body)

            predictions = response.get("predictions", [])

            if predictions and len(predictions) > 0:
                prediction = predictions[0]

                # Check for GCS output
                if "gcsUri" in prediction:
                    return GenerationResult(
                        success=True,
                        image_uri=prediction["gcsUri"],
                        metadata=response,
                    )

                # Check for base64 output
                if "bytesBase64Encoded" in prediction:
                    return GenerationResult(
                        success=True,
                        image_base64=prediction["bytesBase64Encoded"],
                        metadata=response,
                    )

            return GenerationResult(
                success=False,
                error="No predictions returned from Imagen API",
            )

        except Exception as e:
            logger.error(f"Image generation failed: {e}")
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
        # Build operation status URL
        base_url = f"https://{self.location}-aiplatform.googleapis.com/v1"
        operation_url = f"{base_url}/{operation_name}"

        start_time = time.time()

        while True:
            elapsed = time.time() - start_time

            if elapsed > max_wait_time:
                logger.warning(f"Operation timed out after {elapsed:.1f}s")
                return {"done": False, "error": "Timeout"}

            try:
                result = await self._make_request("GET", operation_url)

                if result.get("done"):
                    logger.info(f"Operation completed after {elapsed:.1f}s")
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
    Convenience function for image generation.

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


# For testing
if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)

    async def test():
        print("Testing Vertex AI Client...")
        print("-" * 50)

        client = create_vertex_ai_client()
        print(f"Project: {client.project_id}")
        print(f"Location: {client.location}")

        # Test image generation
        config = ImageGenerationConfig(prompt="A beautiful sunset over mountains")
        print(f"\nTesting image generation with prompt: {config.prompt}")
        # result = await client.generate_image(config)
        # print(f"Result: {result}")

    asyncio.run(test())
