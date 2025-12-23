"""AWS S3 client for file operations with optimized parallel downloads.

Last update: 2025-12-12 - Added 403 fallback with placeholder image generation.
"""

import boto3
from botocore.config import Config
import aiofiles
import httpx
import asyncio
import os
import logging
from typing import Optional, List, Tuple
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont
import io

from ..config import get_settings

logger = logging.getLogger(__name__)

# User-Agent rotation for bypassing hotlink protection
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Googlebot-Image/1.0",  # Some sites allow Googlebot
    "facebookexternalhit/1.1",  # Facebook crawler - often allowed
]


def is_valid_image(data: bytes) -> bool:
    """Check if data is a valid image file."""
    try:
        # Try to open as image
        img = Image.open(io.BytesIO(data))
        img.verify()  # Verify it's a valid image
        return True
    except Exception:
        return False


def is_html_response(data: bytes) -> bool:
    """Check if response is HTML (common for hotlink protection blocks)."""
    try:
        text = data[:1000].decode('utf-8', errors='ignore').lower()
        return '<html' in text or '<!doctype' in text or '<head' in text
    except Exception:
        return False


def create_placeholder_image(
    local_path: str,
    width: int = 1080,
    height: int = 1920,
    message: str = "Image Unavailable",
) -> str:
    """Create a placeholder image when download fails.

    Args:
        local_path: Path to save the placeholder image
        width: Image width
        height: Image height
        message: Text to display on placeholder

    Returns:
        Path to the created placeholder image
    """
    # Create a dark gradient background
    img = Image.new("RGB", (width, height), (30, 30, 40))
    draw = ImageDraw.Draw(img)

    # Add subtle gradient effect
    for y in range(height):
        # Gradient from top (darker) to bottom (slightly lighter)
        shade = int(30 + (y / height) * 20)
        for x in range(width):
            # Add some noise for texture
            noise = (x + y) % 5
            draw.point((x, y), fill=(shade + noise, shade + noise, shade + noise + 5))

    # Try to load a font, fallback to default
    font = None
    font_size = max(32, int(height * 0.025))
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for font_path in font_paths:
        if os.path.exists(font_path):
            try:
                font = ImageFont.truetype(font_path, font_size)
                break
            except Exception:
                continue

    if font is None:
        font = ImageFont.load_default()

    # Draw centered text
    bbox = draw.textbbox((0, 0), message, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) // 2
    y = (height - text_height) // 2

    # Draw text shadow
    draw.text((x + 2, y + 2), message, font=font, fill=(0, 0, 0, 128))
    # Draw main text
    draw.text((x, y), message, font=font, fill=(150, 150, 160))

    # Save as JPEG
    img.save(local_path, "JPEG", quality=85)
    logger.info(f"[S3Client] Created placeholder image: {local_path}")
    return local_path

# Shared thread pool for S3 operations (connection pooling)
_s3_executor: Optional[ThreadPoolExecutor] = None


def get_s3_executor() -> ThreadPoolExecutor:
    """Get or create shared thread pool for S3 operations."""
    global _s3_executor
    if _s3_executor is None:
        _s3_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="s3_pool")
    return _s3_executor


class S3Client:
    """AWS S3 client with optimized parallel operations."""

    def __init__(self):
        settings = get_settings()
        self.bucket = settings.aws_s3_bucket
        self.region = settings.aws_region

        # Debug: Log settings
        print(f"[S3Client] Initializing with bucket={self.bucket}, region={self.region}")
        print(f"[S3Client] Access key (first 4 chars): {settings.aws_access_key_id[:4] if settings.aws_access_key_id else 'EMPTY (using IAM role)'}")

        # Build kwargs - only include credentials if explicitly set
        # This allows IAM role to be used on EC2
        client_kwargs = {
            "region_name": settings.aws_region,
            "config": Config(
                signature_version="s3v4",
                max_pool_connections=20,  # Connection pooling
                retries={"max_attempts": 3, "mode": "adaptive"}
            )
        }

        # Only add explicit credentials if they're actually set (non-empty)
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            client_kwargs["aws_access_key_id"] = settings.aws_access_key_id
            client_kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
            print("[S3Client] Using explicit AWS credentials")
        else:
            print("[S3Client] Using default credential chain (IAM role/environment)")

        # Create S3 client with connection pooling
        self.client = boto3.client("s3", **client_kwargs)

        # Shared HTTP client for external URLs
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create shared HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                follow_redirects=True,
                timeout=60.0,
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10)
            )
        return self._http_client

    def get_public_url(self, s3_key: str) -> str:
        """Generate public URL for AWS S3."""
        return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{s3_key}"

    async def download_file(self, url: str, local_path: str) -> str:
        """
        Download a file from URL to local path.
        Supports both S3 URLs and external URLs.
        """
        # Check if it's an S3 URL from our bucket (AWS S3 format)
        s3_url_prefix = f"https://{self.bucket}.s3.{self.region}.amazonaws.com/"

        # Debug: Log URL matching
        print(f"[S3Client] download_file: url={url[:80]}...")
        print(f"[S3Client] s3_url_prefix={s3_url_prefix}")
        print(f"[S3Client] startswith={url.startswith(s3_url_prefix)}")

        if url.startswith(s3_url_prefix):
            # Extract key from URL (strip query params - presigned URL params don't belong in key)
            key = url[len(s3_url_prefix):].split('?')[0]
            print(f"[S3Client] Using S3 SDK download: bucket={self.bucket}, key={key}")
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                get_s3_executor(),
                lambda k=key: self.client.download_file(self.bucket, k, local_path)
            )
            # Validate downloaded file exists and is not empty
            if not os.path.exists(local_path):
                raise ValueError(f"S3 download failed - file not created: {local_path}")
            file_size = os.path.getsize(local_path)
            if file_size == 0:
                os.remove(local_path)
                raise ValueError(f"S3 download failed - empty file: {key}")
            print(f"[S3Client] Downloaded {file_size} bytes to {local_path}")

            # Log a warning if image file seems invalid (don't throw - image processor will handle it)
            if local_path.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')):
                with open(local_path, 'rb') as f:
                    data = f.read()
                if is_html_response(data):
                    print(f"[S3Client] WARNING: S3 file appears to be HTML (error page?): {key}")
                elif not is_valid_image(data):
                    print(f"[S3Client] WARNING: S3 file may not be a valid image: {key} (size={file_size})")
        elif ".s3." in url and ".amazonaws.com" in url:
            # S3 URL from any bucket - parse and use SDK download for IAM role access
            # URL formats:
            #   - https://BUCKET.s3.REGION.amazonaws.com/KEY (with region)
            #   - https://BUCKET.s3.amazonaws.com/KEY (without region, uses us-east-1)
            import re
            # Try with region first
            match = re.match(r'https://([^.]+)\.s3\.([^.]+)\.amazonaws\.com/(.+)', url)
            if match and match.group(2) != 'amazonaws':
                other_bucket = match.group(1)
                other_region = match.group(2)
                other_key = match.group(3).split('?')[0]  # Strip query params from key
                print(f"[S3Client] Cross-bucket S3 download: bucket={other_bucket}, region={other_region}, key={other_key[:50]}...")
            else:
                # Try without region (bucket.s3.amazonaws.com format)
                match_no_region = re.match(r'https://([^.]+)\.s3\.amazonaws\.com/(.+)', url)
                if match_no_region:
                    other_bucket = match_no_region.group(1)
                    other_region = self.region  # Use configured region as default
                    other_key = match_no_region.group(2).split('?')[0]  # Strip query params from key
                    print(f"[S3Client] Cross-bucket S3 download (no region in URL): bucket={other_bucket}, using region={other_region}, key={other_key[:50]}...")
                else:
                    # Fallback to HTTP for unparseable S3 URLs
                    print(f"[S3Client] S3 URL pattern not matched, falling back to HTTP download")
                    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                    client = await self._get_http_client()
                    response = await client.get(url, headers=headers)
                    response.raise_for_status()
                    async with aiofiles.open(local_path, "wb") as f:
                        await f.write(response.content)
                    return local_path

            # Use S3 SDK with the other bucket (relies on IAM role permissions or configured credentials)
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                get_s3_executor(),
                lambda b=other_bucket, k=other_key: self.client.download_file(b, k, local_path)
            )
            file_size = os.path.getsize(local_path) if os.path.exists(local_path) else 0
            print(f"[S3Client] Downloaded {file_size} bytes from {other_bucket}")
        else:
            # External URL - download via HTTP with browser-like headers
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": url.split('/')[0] + '//' + url.split('/')[2] + '/',
            }
            client = await self._get_http_client()

            # Retry logic for transient errors (503, 502, 429, connection errors)
            max_retries = 3
            last_error = None
            for attempt in range(max_retries):
                try:
                    response = await client.get(url, headers=headers)
                    response.raise_for_status()
                    break  # Success
                except httpx.HTTPStatusError as e:
                    last_error = e
                    if e.response.status_code in (502, 503, 429):
                        # Transient error - retry with exponential backoff
                        wait_time = (attempt + 1) * 2  # 2s, 4s, 6s
                        print(f"[S3Client] Retry {attempt + 1}/{max_retries} after {e.response.status_code} error, waiting {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    raise  # Non-transient error - don't retry
                except (httpx.ConnectError, httpx.ReadTimeout) as e:
                    last_error = e
                    wait_time = (attempt + 1) * 2
                    print(f"[S3Client] Retry {attempt + 1}/{max_retries} after connection error, waiting {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
            else:
                # All retries exhausted
                raise last_error or ValueError(f"Failed to download after {max_retries} retries")

            # Validate content - only check image validity for image files
            content = response.content
            content_type = response.headers.get('content-type', 'unknown')

            if is_html_response(content):
                raise ValueError(f"URL returned HTML (likely hotlink protected): {url[:60]}...")

            # Only validate as image if content-type indicates an image
            is_image_content = content_type.startswith('image/') or local_path.lower().endswith(
                ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg')
            )
            if is_image_content and not is_valid_image(content):
                size = len(content)
                raise ValueError(f"Invalid image from {url[:60]}... (type={content_type}, size={size})")

            async with aiofiles.open(local_path, "wb") as f:
                await f.write(content)

        return local_path

    async def download_files_parallel(
        self,
        downloads: List[Tuple[str, str]]
    ) -> List[str]:
        """
        Download multiple files in parallel.

        Args:
            downloads: List of (url, local_path) tuples

        Returns:
            List of local paths (in same order as input)
        """
        tasks = [
            self.download_file(url, local_path)
            for url, local_path in downloads
        ]
        return await asyncio.gather(*tasks)

    async def upload_file(
        self,
        local_path: str,
        s3_key: str,
        content_type: Optional[str] = None
    ) -> str:
        """
        Upload a file to S3.
        Returns the S3 URL.
        """
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            get_s3_executor(),
            lambda: self.client.upload_file(
                local_path,
                self.bucket,
                s3_key,
                ExtraArgs=extra_args
            )
        )

        # Return the public URL (AWS S3 format)
        return self.get_public_url(s3_key)

    def generate_presigned_url(
        self,
        s3_key: str,
        expiration: int = 3600
    ) -> str:
        """Generate a presigned URL for downloading."""
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": s3_key},
            ExpiresIn=expiration
        )

    def delete_file(self, s3_key: str) -> None:
        """Delete a file from S3."""
        self.client.delete_object(Bucket=self.bucket, Key=s3_key)

    async def close(self) -> None:
        """Close HTTP client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
