"""
AWS Batch Worker for Video Rendering.

This script runs inside the AWS Batch container.
It receives job parameters from environment variables and renders the video.
Secrets are loaded from AWS Secrets Manager.
"""

import os
import sys
import json
import asyncio
import traceback
import httpx
import boto3
from botocore.exceptions import ClientError

# Add app to path
sys.path.insert(0, "/root")

from app.models.render_job import RenderRequest
from app.services.video_renderer import VideoRenderer


def load_secrets_from_aws():
    """Load secrets from AWS Secrets Manager and set as environment variables."""
    region = os.environ.get("AWS_REGION", "ap-southeast-2")
    secret_name = os.environ.get("SECRETS_NAME", "hydra/compose-engine")

    print(f"Loading secrets from AWS Secrets Manager: {secret_name}")

    try:
        client = boto3.client("secretsmanager", region_name=region)
        response = client.get_secret_value(SecretId=secret_name)
        secrets = json.loads(response["SecretString"])

        # Set secrets as environment variables
        for key, value in secrets.items():
            if value and value != "REPLACE_ME":
                os.environ[key] = value
                print(f"  Loaded: {key}")

        print(f"Loaded {len(secrets)} secrets from AWS Secrets Manager")

    except ClientError as e:
        print(f"Warning: Could not load secrets from AWS Secrets Manager: {e}")
        # Continue anyway - some secrets might be set via environment

    # Also load S3 config if available
    try:
        s3_secret_name = os.environ.get("S3_SECRETS_NAME", "hydra/s3-config")
        response = client.get_secret_value(SecretId=s3_secret_name)
        s3_config = json.loads(response["SecretString"])

        for key, value in s3_config.items():
            if value:
                os.environ[key] = value

    except ClientError:
        pass  # S3 config is optional


def get_job_parameters() -> dict:
    """Get job parameters from AWS Batch environment."""
    # AWS Batch passes parameters via environment variable
    params_json = os.environ.get("BATCH_JOB_PARAMETERS", "{}")
    return json.loads(params_json)


def send_callback(callback_url: str, callback_secret: str, job_id: str, status: str, output_url: str = None, error: str = None):
    """Send completion callback to Next.js."""
    if not callback_url:
        return

    try:
        payload = {
            "job_id": job_id,
            "status": status,
            "output_url": output_url,
            "error": error,
            "secret": callback_secret,  # Required for authentication
        }
        print(f"[{job_id}] Sending callback to {callback_url}")

        with httpx.Client(timeout=30.0) as client:
            response = client.post(callback_url, json=payload)
            print(f"[{job_id}] Callback response: {response.status_code}")
    except Exception as e:
        print(f"[{job_id}] Callback failed (non-fatal): {e}")


def update_dynamodb_status(job_id: str, status: str, output_url: str = None, error: str = None):
    """Update job status in DynamoDB (optional - for status polling)."""
    try:
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
        table = dynamodb.Table("hydra-compose-jobs")

        item = {
            "job_id": job_id,
            "status": status,
            "updated_at": int(asyncio.get_event_loop().time()),
        }
        if output_url:
            item["output_url"] = output_url
        if error:
            item["error"] = error

        table.put_item(Item=item)
    except Exception as e:
        print(f"[{job_id}] DynamoDB update failed (non-fatal): {e}")


async def render_video(request_data: dict) -> dict:
    """Main render function."""
    # Extract callback info
    callback_url = request_data.pop("callback_url", None)
    callback_secret = request_data.pop("callback_secret", os.environ.get("CALLBACK_SECRET", ""))
    job_id = request_data.get("job_id", "unknown")

    # Enable GPU encoding
    os.environ["USE_NVENC"] = "1"

    print(f"[{job_id}] === Starting GPU render on AWS Batch (NVENC) ===")
    print(f"[{job_id}] Images: {len(request_data.get('images', []))}")

    try:
        # Parse request
        request = RenderRequest(**request_data)

        # Update status to processing
        update_dynamodb_status(job_id, "processing")

        # Create renderer
        renderer = VideoRenderer()

        # Progress callback (logs only)
        async def progress_callback(job_id: str, progress: int, step: str):
            print(f"[{job_id}] [{progress:3d}%] {step}")

        # Render
        output_url = await renderer.render(request, progress_callback)

        print(f"[{job_id}] === Render complete ===")
        print(f"[{job_id}] Output: {output_url}")

        # Update status
        update_dynamodb_status(job_id, "completed", output_url=output_url)
        send_callback(callback_url, callback_secret, job_id, "completed", output_url)

        return {
            "status": "completed",
            "job_id": job_id,
            "output_url": output_url,
        }

    except Exception as e:
        error_msg = str(e)
        print(f"[{job_id}] === Render FAILED ===")
        print(f"[{job_id}] Error: {error_msg}")
        print(traceback.format_exc())

        update_dynamodb_status(job_id, "failed", error=error_msg)
        send_callback(callback_url, callback_secret, job_id, "failed", error=error_msg)

        return {
            "status": "failed",
            "job_id": job_id,
            "error": error_msg,
        }


def diagnose_gpu():
    """Run GPU diagnostics at startup."""
    import subprocess

    print("=== GPU Diagnostics ===")

    # Check nvidia-smi
    try:
        result = subprocess.run(
            ["nvidia-smi"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            print(result.stdout)
        else:
            print(f"nvidia-smi failed: {result.stderr}")
    except FileNotFoundError:
        print("nvidia-smi not found - no NVIDIA driver installed")
    except Exception as e:
        print(f"nvidia-smi error: {e}")

    # Check for NVENC libraries
    print("\n=== NVENC Library Check ===")
    try:
        result = subprocess.run(
            ["find", "/usr", "-name", "libnvidia-encode*", "-type", "f"],
            capture_output=True, text=True, timeout=10
        )
        if result.stdout.strip():
            print(f"Found libnvidia-encode: {result.stdout.strip()}")
        else:
            print("libnvidia-encode.so NOT FOUND in /usr")

        # Also check /opt/nvidia
        result2 = subprocess.run(
            ["find", "/opt", "-name", "libnvidia-encode*", "-type", "f"],
            capture_output=True, text=True, timeout=10
        )
        if result2.stdout.strip():
            print(f"Found in /opt: {result2.stdout.strip()}")
    except Exception as e:
        print(f"Library search error: {e}")

    # Check LD_LIBRARY_PATH
    print(f"\nLD_LIBRARY_PATH: {os.environ.get('LD_LIBRARY_PATH', 'not set')}")

    # Test FFmpeg NVENC capability
    # Note: NVENC requires minimum 128x128 frame size, using 256x256 to be safe
    print("\n=== FFmpeg NVENC Test ===")
    try:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-f", "lavfi", "-i", "color=black:s=256x256:d=0.1",
             "-c:v", "h264_nvenc", "-f", "null", "-"],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            print("FFmpeg NVENC test: SUCCESS")
        else:
            print(f"FFmpeg NVENC test: FAILED")
            print(f"stderr: {result.stderr}")
    except Exception as e:
        print(f"FFmpeg test error: {e}")

    print("=== End GPU Diagnostics ===\n")


def process_job():
    """Entry point for AWS Batch job."""
    print("=== AWS Batch Worker Starting ===")

    # Run GPU diagnostics first
    diagnose_gpu()

    # Load secrets from AWS Secrets Manager
    load_secrets_from_aws()

    # Get parameters
    params = get_job_parameters()

    if not params:
        # Try reading from stdin (for testing)
        print("No BATCH_JOB_PARAMETERS found, checking stdin...")
        try:
            input_data = sys.stdin.read()
            if input_data:
                params = json.loads(input_data)
        except:
            pass

    if not params:
        print("ERROR: No job parameters provided")
        sys.exit(1)

    print(f"Job ID: {params.get('job_id', 'unknown')}")
    print(f"Images: {len(params.get('images', []))}")

    # Run async render
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(render_video(params))
        if result["status"] == "failed":
            sys.exit(1)
    finally:
        loop.close()

    print("=== AWS Batch Worker Complete ===")


if __name__ == "__main__":
    process_job()
