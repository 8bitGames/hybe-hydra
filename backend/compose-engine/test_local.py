"""
Local test script for Compose Engine (CPU/libx264).
Run: python test_local.py
"""

import sys
import os
import asyncio

# Set up paths
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Force CPU encoding (libx264)
os.environ["USE_NVENC"] = "0"

# Set AWS credentials
os.environ.setdefault("AWS_ACCESS_KEY_ID", "AKIASBF5YXJFHLVFVGQR")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "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")
os.environ.setdefault("AWS_REGION", "ap-northeast-2")
os.environ.setdefault("AWS_S3_BUCKET", "hydra-assets-hybe")


async def main():
    print("=" * 60)
    print("Local Test - Hydra Compose Engine (CPU/libx264)")
    print("=" * 60)

    from app.models.render_job import RenderRequest
    from app.services.video_renderer import VideoRenderer

    # Use sample images from Unsplash (free, no auth needed)
    test_request = RenderRequest(
        job_id="test-local-001",
        images=[
            {"url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800", "order": 0},
            {"url": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800", "order": 1},
            {"url": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800", "order": 2},
        ],
        audio={
            # Public domain sample audio (Internet Archive)
            "url": "https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg",
            "start_time": 0,
            "duration": None
        },
        script=None,
        settings={
            "vibe": "Pop",
            "effect_preset": "zoom_beat",
            "aspect_ratio": "9:16",
            "target_duration": 5,
            "text_style": "bold_pop",
            "color_grade": "vibrant"
        },
        output={
            "s3_bucket": "hydra-assets-hybe",
            "s3_key": "compose/renders/test-local/output.mp4"
        }
    )

    # Progress callback
    async def progress_callback(job_id: str, progress: int, step: str):
        print(f"[{job_id}] [{progress:3d}%] {step}")

    # Create renderer and run
    renderer = VideoRenderer()

    print("\nStarting render...")
    print(f"Images: {len(test_request.images)}")
    print(f"Vibe: {test_request.settings.vibe.value}")
    print(f"Encoding: libx264 (CPU)")
    print()

    try:
        output_url = await renderer.render(test_request, progress_callback)
        print("\n" + "=" * 60)
        print("SUCCESS!")
        print(f"Output: {output_url}")
        print("=" * 60)
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"FAILED: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
