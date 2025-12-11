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
# STEP 1: Install build dependencies and compile NVIDIA-compatible FFmpeg
# =============================================================================
# We compile FFmpeg from source with NVENC support using the NVIDIA Video Codec SDK
# This ensures compatibility with the CUDA version in the container

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    git \
    build-essential \
    pkg-config \
    yasm \
    nasm \
    cmake \
    # FFmpeg dependencies
    libx264-dev \
    libx265-dev \
    libvpx-dev \
    libfdk-aac-dev \
    libmp3lame-dev \
    libopus-dev \
    libvorbis-dev \
    libass-dev \
    libfreetype6-dev \
    libfontconfig1-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install nv-codec-headers (NVIDIA Video Codec SDK headers for FFmpeg)
# This must match the CUDA/driver version
RUN git clone https://git.videolan.org/git/ffmpeg/nv-codec-headers.git /tmp/nv-codec-headers \
    && cd /tmp/nv-codec-headers \
    && git checkout n12.1.14.0 \
    && make install \
    && rm -rf /tmp/nv-codec-headers

# Set CUDA PATH for nvcc compiler (required for FFmpeg NVENC build)
ENV PATH=/usr/local/cuda/bin:${PATH}

# Compile FFmpeg with NVENC support (runtime-only, no CUDA compile needed)
# Note: --enable-nvenc/nvdec only need nv-codec-headers at build time
# The actual encoding uses libnvidia-encode.so at runtime on GPU instances
RUN git clone --depth 1 --branch n6.1 https://git.ffmpeg.org/ffmpeg.git /tmp/ffmpeg \
    && cd /tmp/ffmpeg \
    && ./configure \
        --prefix=/usr/local \
        --enable-gpl \
        --enable-nonfree \
        --enable-nvenc \
        --enable-nvdec \
        --enable-libx264 \
        --enable-libx265 \
        --enable-libvpx \
        --enable-libfdk-aac \
        --enable-libmp3lame \
        --enable-libopus \
        --enable-libvorbis \
        --enable-libass \
        --enable-libfreetype \
        --enable-libfontconfig \
        --enable-openssl \
    && make -j$(nproc) \
    && make install \
    && ldconfig \
    && rm -rf /tmp/ffmpeg

# Set FFmpeg environment variables
ENV IMAGEIO_FFMPEG_EXE=/usr/local/bin/ffmpeg
ENV FFMPEG_BINARY=/usr/local/bin/ffmpeg
# Include NVIDIA runtime library paths for NVENC support on AWS ECS
# - /usr/local/nvidia/lib64: NVIDIA container runtime mounts driver libs here
ENV LD_LIBRARY_PATH=/usr/local/nvidia/lib64:/usr/local/cuda/lib64:/usr/lib/x86_64-linux-gnu
ENV PATH=/usr/local/nvidia/bin:/usr/local/bin:/usr/bin:/bin
# Force NVIDIA driver to be used for NVENC - critical for AWS ECS
ENV NVIDIA_DRIVER_CAPABILITIES=video,compute,utility
ENV NVIDIA_VISIBLE_DEVICES=all

# Verify FFmpeg is correctly installed with NVENC
RUN echo "=== FFmpeg NVENC Verification ===" \
    && which ffmpeg \
    && ffmpeg -version | head -5 \
    && echo "=== Checking for NVENC encoders ===" \
    && ffmpeg -encoders 2>&1 | grep -i nvenc \
    && echo "=== NVENC encoders found ==="

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
# PyOpenGL-accelerate improves performance and stability
RUN pip3 install --no-cache-dir \
    PyOpenGL==3.1.7 \
    PyOpenGL-accelerate==3.1.7
ENV PYOPENGL_PLATFORM=osmesa

# Verify PyOpenGL can find OSMesa
RUN echo "=== Verifying PyOpenGL + OSMesa ===" \
    && python3 -c "import os; os.environ['PYOPENGL_PLATFORM']='osmesa'; from OpenGL import GL; print('OpenGL import: OK')" \
    && python3 -c "import os; os.environ['PYOPENGL_PLATFORM']='osmesa'; from OpenGL.osmesa import OSMesaCreateContext; print('OSMesa import: OK')" \
    && echo "=== PyOpenGL + OSMesa verification passed ==="

# AI Effect Selection (Gemini API)
RUN pip3 install --no-cache-dir \
    google-generativeai==0.8.3

# GCP Workload Identity Federation (WIF) for Vertex AI
RUN pip3 install --no-cache-dir \
    google-auth>=2.36.0 \
    google-auth-httplib2>=0.2.0 \
    requests>=2.31.0

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
    && python3 -c "from OpenGL import GL; from OpenGL.osmesa import OSMesaCreateContext, OSMESA_RGBA; print('GL Transitions (OSMesa): OK')" \
    && python3 -c "import google.auth; print(f'google-auth: {google.auth.__version__} (GCP WIF ready)')" \
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

# Copy AWS Batch worker scripts
COPY aws-batch/batch_worker.py /root/batch_worker.py
COPY aws-batch/ai_worker.py /root/ai_worker.py

# Copy GCP WIF credential config files (for Vertex AI authentication)
# This file is used by google-auth to exchange AWS credentials for GCP tokens
#
# Code-based 2-hop Authentication Flow (all impersonation in Python code):
#   WIF (STS only) → Central SA (code) → Target SA (code) → Vertex AI
#
# Config files:
# - clientLibraryConfig-wif-only.json: WIF-only (no SA impersonation) - DEFAULT for code-based 2-hop
# - clientLibraryConfig-2hop-central.json: WIF → Central SA via config (config-based)
# - clientLibraryConfig-hyb-hydra-dev.json: WIF → Target SA direct (hyb-hydra-dev)
# - clientLibraryConfig-hyb-hydra-dev-direct.json: Direct config variant
COPY clientLibraryConfig-wif-only.json /root/clientLibraryConfig.json
COPY clientLibraryConfig-2hop-central.json /root/clientLibraryConfig-2hop-central.json
COPY clientLibraryConfig-hyb-hydra-dev.json /root/clientLibraryConfig-hyb-hydra-dev.json
COPY clientLibraryConfig-hyb-hydra-dev-direct.json /root/clientLibraryConfig-hyb-hydra-dev-direct.json
ENV GOOGLE_APPLICATION_CREDENTIALS=/root/clientLibraryConfig.json

# Code-based 2-hop authentication: Both impersonations done in gcp_auth.py
# Central SA (1st hop): WIF → Central SA (hyb-mgmt-prod)
ENV GCP_CENTRAL_SERVICE_ACCOUNT=sa-wif-hyb-hydra-dev@hyb-mgmt-prod.iam.gserviceaccount.com
# Target SA (2nd hop): Central SA → Target SA (hyb-hydra-dev) → Vertex AI
ENV GCP_TARGET_SERVICE_ACCOUNT=sa-wif-hyb-hydra-dev@hyb-hydra-dev.iam.gserviceaccount.com
ENV GCP_PROJECT_ID=hyb-hydra-dev

EXPOSE 8000

# Default command (for local testing / FastAPI mode)
# AWS Batch overrides this with the batch_worker.py entry point
CMD ["python3", "-c", "print('Hydra Compose Engine ready. Run: uvicorn app.main:app --host 0.0.0.0 --port 8000')"]
