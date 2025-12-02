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
    && rm -rf /var/lib/apt/lists/*

# Configure ImageMagick policy for MoviePy text rendering
RUN sed -i 's/rights="none" pattern="@\*"/rights="read|write" pattern="@*"/' /etc/ImageMagick-6/policy.xml || true

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/
COPY start.py ./start.py

# Create temp directory
RUN mkdir -p /tmp/compose

ENV PYTHONPATH=/app
ENV TEMP_DIR=/tmp/compose

# Railway provides PORT env variable dynamically
CMD ["python", "start.py"]
