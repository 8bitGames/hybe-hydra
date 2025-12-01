"""AWS S3 client for file operations."""

import boto3
from botocore.config import Config
import aiofiles
import httpx
import os
from typing import Optional

from ..config import get_settings


class S3Client:
    """AWS S3 client for uploading and downloading files."""

    def __init__(self):
        settings = get_settings()
        self.bucket = settings.aws_s3_bucket
        self.region = settings.aws_region

        # Create S3 client for AWS (no endpoint_url for AWS S3)
        self.client = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
            config=Config(signature_version="s3v4")
        )

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
        if url.startswith(s3_url_prefix):
            # Extract key from URL
            key = url[len(s3_url_prefix):]
            self.client.download_file(self.bucket, key, local_path)
        elif f".s3.{self.region}.amazonaws.com" in url or f".s3.amazonaws.com" in url:
            # Alternative S3 URL format
            key = url.split(f"{self.bucket}/")[-1]
            self.client.download_file(self.bucket, key, local_path)
        else:
            # External URL - download via HTTP with browser-like headers
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": url.split('/')[0] + '//' + url.split('/')[2] + '/',
            }
            async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                async with aiofiles.open(local_path, "wb") as f:
                    await f.write(response.content)

        return local_path

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

        self.client.upload_file(
            local_path,
            self.bucket,
            s3_key,
            ExtraArgs=extra_args
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
