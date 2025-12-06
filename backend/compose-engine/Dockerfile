# =============================================================================
# Hydra Compose Engine - GPU Video Rendering with NVENC
# =============================================================================
# Local Testing:
#   docker build -t hydra-compose .
#   docker run --gpus all -it hydra-compose bash
#   # Inside container: python3 -c "import moviepy; print('OK')"
#
# Modal uses this via: modal.Image.from_dockerfile("Dockerfile")
# =============================================================================

FROM nvidia/cuda:12.4.0-devel-ubuntu22.04

# Prevent interactive prompts during apt-get
ENV DEBIAN_FRONTEND=noninteractive

# =============================================================================
# STEP 1: Install Jellyfin FFmpeg FIRST (before anything else)
# =============================================================================
# Critical: FFmpeg must be installed before any Python packages that might
# try to bundle or link against a different ffmpeg version

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Add Jellyfin repository
RUN wget -O - https://repo.jellyfin.org/jellyfin_team.gpg.key | gpg --dearmor -o /usr/share/keyrings/jellyfin.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/jellyfin.gpg] https://repo.jellyfin.org/ubuntu jammy main" > /etc/apt/sources.list.d/jellyfin.list

# Install jellyfin-ffmpeg6 (has h264_nvenc, hevc_nvenc baked in)
RUN apt-get update \
    && apt-get install -y --no-install-recommends jellyfin-ffmpeg6 \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks so ffmpeg/ffprobe are in PATH
RUN ln -sf /usr/lib/jellyfin-ffmpeg/ffmpeg /usr/local/bin/ffmpeg \
    && ln -sf /usr/lib/jellyfin-ffmpeg/ffprobe /usr/local/bin/ffprobe

# Set FFmpeg environment variables IMMEDIATELY after installation
ENV IMAGEIO_FFMPEG_EXE=/usr/lib/jellyfin-ffmpeg/ffmpeg
ENV FFMPEG_BINARY=/usr/lib/jellyfin-ffmpeg/ffmpeg
ENV LD_LIBRARY_PATH=/usr/lib/jellyfin-ffmpeg/lib:/usr/local/cuda/lib64
ENV PATH=/usr/lib/jellyfin-ffmpeg:/usr/local/bin:/usr/bin:/bin

# Verify FFmpeg is correctly installed
RUN echo "=== Jellyfin FFmpeg Verification ===" \
    && which ffmpeg \
    && ffmpeg -version | head -3 \
    && echo "=== Checking for NVENC encoders ===" \
    && ffmpeg -encoders 2>&1 | grep -i nvenc || echo "(NVENC will be available at runtime with GPU)"

# =============================================================================
# STEP 2: Install Python 3.11
# =============================================================================

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel

# =============================================================================
# STEP 3: System dependencies for video/image/audio processing
# =============================================================================

RUN apt-get update && apt-get install -y --no-install-recommends \
    # Image processing (OpenCV, Pillow dependencies)
    libsm6 \
    libxext6 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    # Audio processing (librosa, soundfile)
    libsndfile1 \
    libmpg123-0 \
    # Fonts for text overlays
    fonts-noto-cjk \
    fonts-dejavu \
    fontconfig \
    # OpenGL/EGL for GL Transitions
    libegl1-mesa \
    libegl1-mesa-dev \
    libglew-dev \
    libglfw3-dev \
    mesa-utils \
    # OSMesa for headless GL rendering (software)
    libosmesa6 \
    libosmesa6-dev \
    # ImageMagick for MoviePy text
    imagemagick \
    libmagic1 \
    # Useful tools
    curl \
    && rm -rf /var/lib/apt/lists/*

# Configure ImageMagick policy for MoviePy text rendering
RUN sed -i 's/rights="none" pattern="@\*"/rights="read|write" pattern="@*"/' /etc/ImageMagick-6/policy.xml 2>/dev/null || true

# Rebuild font cache
RUN fc-cache -f -v

# =============================================================================
# STEP 4: Python dependencies (pinned versions, installed in dependency order)
# =============================================================================

# Core numerical libraries first
RUN pip3 install --no-cache-dir \
    numpy==1.26.4 \
    scipy==1.12.0

# Image processing
RUN pip3 install --no-cache-dir \
    Pillow==10.4.0 \
    imageio==2.34.0 \
    imageio-ffmpeg==0.4.9

# Audio processing
RUN pip3 install --no-cache-dir \
    librosa==0.10.1 \
    soundfile==0.12.1 \
    audioread==3.0.1

# Video editing (MoviePy)
RUN pip3 install --no-cache-dir \
    moviepy==2.1.1

# GPU acceleration (cupy for CUDA-accelerated numpy operations)
# This enables GPU-accelerated image processing and color grading
RUN pip3 install --no-cache-dir \
    cupy-cuda12x==13.3.0

# AWS S3 and HTTP
RUN pip3 install --no-cache-dir \
    boto3==1.35.0 \
    botocore==1.35.0 \
    httpx==0.26.0 \
    aiofiles==23.2.1

# API framework
RUN pip3 install --no-cache-dir \
    pydantic==2.5.3 \
    pydantic-settings==2.1.0 \
    "fastapi[standard]" \
    uvicorn==0.27.0

# Cache
RUN pip3 install --no-cache-dir \
    redis==5.0.1

# PyOpenGL for GL Transitions (with OSMesa backend for headless rendering)
RUN pip3 install --no-cache-dir \
    PyOpenGL==3.1.7
ENV PYOPENGL_PLATFORM=osmesa

# AI Effect Selection (Gemini API)
RUN pip3 install --no-cache-dir \
    google-generativeai==0.8.3

# =============================================================================
# STEP 5: Verify all installations work together
# =============================================================================

RUN echo "=== Final Verification ===" \
    && python3 --version \
    && echo "FFmpeg: $(which ffmpeg)" \
    && python3 -c "import moviepy; print(f'moviepy: {moviepy.__version__}')" \
    && python3 -c "from moviepy import VideoFileClip; print('moviepy VideoFileClip: OK')" \
    && python3 -c "import PIL; print(f'Pillow: {PIL.__version__}')" \
    && python3 -c "import numpy; print(f'numpy: {numpy.__version__}')" \
    && python3 -c "import cupy; print(f'cupy: {cupy.__version__} (GPU acceleration enabled)')" \
    && python3 -c "import librosa; print(f'librosa: {librosa.__version__}')" \
    && python3 -c "import imageio_ffmpeg; exe=imageio_ffmpeg.get_ffmpeg_exe(); print(f'imageio_ffmpeg: {exe}')" \
    && python3 -c "import boto3; print('boto3: OK')" \
    && python3 -c "import fastapi; print('fastapi: OK')" \
    && echo "=== All verifications passed ==="

# =============================================================================
# STEP 6: Setup working directory and environment
# =============================================================================

WORKDIR /root

# Runtime environment
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/root
ENV TEMP_DIR=/tmp/compose

# Create temp directory
RUN mkdir -p /tmp/compose

# Copy application code (for local Docker testing)
# Modal uses add_local_dir() instead, so this is optional
COPY app/ /root/app/

EXPOSE 8000

CMD ["python3", "-c", "print('Hydra Compose Engine ready. Run: uvicorn app.main:app --host 0.0.0.0 --port 8000')"]
