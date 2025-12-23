#!/bin/bash
# Simple test script using curl to test the compose engine via local Docker

echo "============================================================"
echo "Custom Fast-Cut Video Test"
echo "============================================================"
echo ""
echo "Settings:"
echo "  - 9:16 aspect ratio (vertical)"
echo "  - BPM-based slide duration"
echo "  - No transitions (direct cuts)"
echo "  - Audio fade: 0.75s in/out"
echo "  - Text: White, Noto Sans, centered"
echo ""

# Test if compose engine is running locally
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✗ Compose engine not running on localhost:8000"
    echo ""
    echo "To start the compose engine locally:"
    echo "  cd /Users/paksungho/hybe-hydra/backend/compose-engine"
    echo "  docker-compose up"
    echo ""
    exit 1
fi

echo "✓ Compose engine is running"
echo ""

# Create request JSON with local file paths
cat > /tmp/test_request.json <<'EOF'
{
  "job_id": "test-local-custom",
  "images": [
    {"url": "/app/test-data/0C1A6965-scaled.jpg", "order": 0},
    {"url": "/app/test-data/4ff14bd3fc0cb99640f90bf0566bb1da.jpg", "order": 1},
    {"url": "/app/test-data/8048e99f2d5753a219b9c5783708b4dd.jpg", "order": 2},
    {"url": "/app/test-data/Hannah-Lylene-Dallas-Fort-Worth-Photographer-4179.jpg", "order": 3},
    {"url": "/app/test-data/MG_4780-Edit-683x1024.jpg", "order": 4},
    {"url": "/app/test-data/rs_634x1024-181114165856-634-kane-brown-katelyn-cmas-2018.avif", "order": 5}
  ],
  "audio": {
    "url": "/app/test-data/music.mp3",
    "start_time": 0,
    "duration": null
  },
  "script": {
    "lines": [
      {"text": "Welcome to our story", "timing": 0, "duration": 3},
      {"text": "Beautiful moments", "timing": 3, "duration": 2.5},
      {"text": "Together forever", "timing": 5.5, "duration": 2.5},
      {"text": "Love is in the air", "timing": 8, "duration": 3},
      {"text": "Making memories", "timing": 11, "duration": 2}
    ]
  },
  "settings": {
    "vibe": "Pop",
    "effect_preset": "minimal",
    "aspect_ratio": "9:16",
    "target_duration": 15,
    "text_style": "minimal",
    "color_grade": "natural",
    "use_ai_effects": false
  },
  "output": {
    "s3_bucket": "local-test",
    "s3_key": "test-output/test-local-custom.mp4"
  }
}
EOF

echo "📤 Submitting render request..."
curl -X POST http://localhost:8000/render \
  -H "Content-Type: application/json" \
  -d @/tmp/test_request.json

echo ""
echo ""
echo "============================================================"
