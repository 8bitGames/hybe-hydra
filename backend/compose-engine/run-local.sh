#!/bin/bash
# Run compose engine locally for development
#
# Usage:
#   ./run-local.sh          # Run with Docker
#   ./run-local.sh --native # Run directly with Python (requires dependencies)

set -e

cd "$(dirname "$0")"

if [ "$1" = "--native" ]; then
    echo "Running compose engine natively..."
    echo "Make sure you have Python 3.11+ and ffmpeg installed"

    # Load environment variables
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
    fi

    # Run with uvicorn
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
    echo "Running compose engine with Docker..."

    # Build and run with docker-compose
    docker-compose up --build
fi
