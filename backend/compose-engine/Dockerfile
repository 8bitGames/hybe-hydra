# Compose Engine Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    libmagic1 \
    imagemagick \
    fonts-dejavu \
    fonts-liberation \
    # OpenGL/EGL for future GL Transitions support
    libegl1-mesa \
    libegl1-mesa-dev \
    libglew-dev \
    libglfw3-dev \
    mesa-utils \
    && rm -rf /var/lib/apt/lists/*

# Configure ImageMagick policy for MoviePy text rendering
RUN sed -i 's/rights="none" pattern="@\*"/rights="read|write" pattern="@*"/' /etc/ImageMagick-6/policy.xml || true

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/

# Create temp directory
RUN mkdir -p /tmp/compose

ENV PYTHONPATH=/app
ENV TEMP_DIR=/tmp/compose

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
