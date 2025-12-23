#!/usr/bin/env python3
"""
Test script to verify the Docker image has all dependencies correctly installed.

Run inside the Docker container:
    docker build -t hydra-compose .
    docker run --gpus all -it hydra-compose python3 /root/app/scripts/test_docker_image.py

Or without GPU:
    docker run -it hydra-compose python3 /root/app/scripts/test_docker_image.py
"""

import sys
import os
import subprocess


def test_ffmpeg():
    """Verify FFmpeg is correctly installed and has expected codecs."""
    print("\n" + "=" * 60)
    print("FFMPEG VERIFICATION")
    print("=" * 60)

    # Check which ffmpeg
    result = subprocess.run(["which", "ffmpeg"], capture_output=True, text=True)
    ffmpeg_path = result.stdout.strip()
    print(f"FFmpeg path: {ffmpeg_path}")

    # Check version
    result = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True)
    version_lines = result.stdout.split("\n")[:3]
    for line in version_lines:
        print(f"  {line}")

    # Check NVENC encoders
    result = subprocess.run(["ffmpeg", "-encoders"], capture_output=True, text=True)
    nvenc_encoders = [line for line in result.stdout.split("\n") if "nvenc" in line.lower()]

    if nvenc_encoders:
        print(f"\nNVENC encoders found ({len(nvenc_encoders)}):")
        for enc in nvenc_encoders:
            print(f"  {enc.strip()}")
    else:
        print("\nWARNING: No NVENC encoders found (expected if no GPU)")

    # Check environment variable
    imageio_ffmpeg = os.environ.get("IMAGEIO_FFMPEG_EXE", "NOT SET")
    print(f"\nIMAGEIO_FFMPEG_EXE: {imageio_ffmpeg}")

    return ffmpeg_path == "/usr/local/bin/ffmpeg" or ffmpeg_path == "/usr/lib/jellyfin-ffmpeg/ffmpeg"


def test_python_imports():
    """Verify all Python packages can be imported."""
    print("\n" + "=" * 60)
    print("PYTHON IMPORTS")
    print("=" * 60)

    packages = [
        ("numpy", "numpy"),
        ("scipy", "scipy"),
        ("PIL", "Pillow"),
        ("moviepy", "moviepy"),
        ("moviepy.editor", "moviepy.editor"),
        ("librosa", "librosa"),
        ("soundfile", "soundfile"),
        ("imageio", "imageio"),
        ("imageio_ffmpeg", "imageio_ffmpeg"),
        ("boto3", "boto3"),
        ("httpx", "httpx"),
        ("aiofiles", "aiofiles"),
        ("pydantic", "pydantic"),
        ("fastapi", "fastapi"),
        ("redis", "redis"),
    ]

    all_passed = True
    for module_name, display_name in packages:
        try:
            module = __import__(module_name)
            version = getattr(module, "__version__", "N/A")
            print(f"  ✓ {display_name}: {version}")
        except ImportError as e:
            print(f"  ✗ {display_name}: FAILED - {e}")
            all_passed = False

    return all_passed


def test_imageio_ffmpeg():
    """Verify imageio-ffmpeg uses the correct FFmpeg binary."""
    print("\n" + "=" * 60)
    print("IMAGEIO-FFMPEG")
    print("=" * 60)

    import imageio_ffmpeg

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"imageio_ffmpeg.get_ffmpeg_exe(): {ffmpeg_exe}")

    expected = "/usr/lib/jellyfin-ffmpeg/ffmpeg"
    if ffmpeg_exe == expected:
        print(f"  ✓ Correct! Using Jellyfin FFmpeg")
        return True
    else:
        print(f"  ✗ WARNING: Expected {expected}")
        print(f"    This might cause issues with NVENC encoding")
        return False


def test_moviepy():
    """Test MoviePy can create a simple video."""
    print("\n" + "=" * 60)
    print("MOVIEPY VIDEO CREATION")
    print("=" * 60)

    from moviepy.editor import ColorClip

    try:
        # Create a simple 1-second red clip
        clip = ColorClip(size=(320, 240), color=(255, 0, 0), duration=1)

        # Try to write it (CPU encoding, no GPU needed for test)
        test_output = "/tmp/test_moviepy.mp4"
        clip.write_videofile(
            test_output,
            fps=24,
            codec="libx264",
            audio=False,
            verbose=False,
            logger=None,
        )
        clip.close()

        # Check if file was created
        if os.path.exists(test_output):
            size = os.path.getsize(test_output)
            print(f"  ✓ Created test video: {test_output} ({size} bytes)")
            os.remove(test_output)
            return True
        else:
            print(f"  ✗ Video file not created")
            return False

    except Exception as e:
        print(f"  ✗ MoviePy test failed: {e}")
        return False


def test_nvidia_gpu():
    """Check if NVIDIA GPU is available."""
    print("\n" + "=" * 60)
    print("NVIDIA GPU")
    print("=" * 60)

    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        print(f"  ✓ GPU available: {result.stdout.strip()}")
        return True
    else:
        print(f"  ⚠ No GPU detected (running in CPU-only mode)")
        return None  # Not a failure, just informational


def main():
    print("=" * 60)
    print("HYDRA COMPOSE ENGINE - ENVIRONMENT VERIFICATION")
    print("=" * 60)
    print(f"Python: {sys.version}")
    print(f"Working directory: {os.getcwd()}")

    results = {
        "FFmpeg": test_ffmpeg(),
        "Python imports": test_python_imports(),
        "imageio-ffmpeg": test_imageio_ffmpeg(),
        "MoviePy": test_moviepy(),
        "NVIDIA GPU": test_nvidia_gpu(),
    }

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    all_passed = True
    for name, result in results.items():
        if result is True:
            print(f"  ✓ {name}: PASSED")
        elif result is False:
            print(f"  ✗ {name}: FAILED")
            all_passed = False
        else:
            print(f"  ⚠ {name}: SKIPPED (optional)")

    print()
    if all_passed:
        print("✓ All required tests passed! Ready for Modal deployment.")
        return 0
    else:
        print("✗ Some tests failed. Fix issues before deploying.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
