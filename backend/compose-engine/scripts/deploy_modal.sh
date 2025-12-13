#!/bin/bash
# Deploy Compose Engine to Modal

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "  HYDRA Compose Engine - Modal Deployment"
echo "=========================================="

# Check if modal CLI is installed
if ! command -v modal &> /dev/null; then
    echo "Error: Modal CLI not installed. Install with: pip install modal"
    exit 1
fi

# Check if logged in
if ! modal token check &> /dev/null; then
    echo "Not logged into Modal. Running: modal token new"
    modal token new
fi

echo ""
echo "Step 1: Creating Modal secret for AWS S3..."
echo "-------------------------------------------"

# Check if secret exists
if modal secret list | grep -q "aws-s3-secret"; then
    echo "Secret 'aws-s3-secret' already exists. Skipping..."
else
    echo "Creating secret 'aws-s3-secret'..."
    echo "Please provide your AWS credentials:"
    read -p "AWS_ACCESS_KEY_ID: " AWS_KEY
    read -sp "AWS_SECRET_ACCESS_KEY: " AWS_SECRET
    echo ""
    read -p "AWS_REGION [ap-northeast-2]: " AWS_REGION
    AWS_REGION=${AWS_REGION:-ap-northeast-2}
    read -p "AWS_S3_BUCKET [hydra-assets-hybe]: " AWS_BUCKET
    AWS_BUCKET=${AWS_BUCKET:-hydra-assets-hybe}

    modal secret create aws-s3-secret \
        AWS_ACCESS_KEY_ID="$AWS_KEY" \
        AWS_SECRET_ACCESS_KEY="$AWS_SECRET" \
        AWS_REGION="$AWS_REGION" \
        AWS_S3_BUCKET="$AWS_BUCKET"

    echo "Secret created successfully!"
fi

echo ""
echo "Step 2: Deploying Modal app..."
echo "------------------------------"

cd "$PROJECT_DIR"
modal deploy modal_app.py

echo ""
echo "Step 3: Getting webhook URLs..."
echo "-------------------------------"

# Get the deployed URL
MODAL_URL=$(modal app logs hydra-compose-engine 2>&1 | grep -o 'https://[^ ]*modal.run' | head -1)

if [ -z "$MODAL_URL" ]; then
    echo "Could not auto-detect Modal URL."
    echo "Please check your Modal dashboard for the webhook URL."
    echo ""
    echo "Typical format: https://YOUR_WORKSPACE--hydra-compose-engine.modal.run"
else
    echo "Modal webhook URL: $MODAL_URL"
fi

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update your .env file with:"
echo "   MODAL_ENABLED=true"
echo "   MODAL_WEBHOOK_URL=<your-modal-url>"
echo ""
echo "2. Test the deployment:"
echo "   curl \$MODAL_WEBHOOK_URL/get_render_status?call_id=test"
echo ""
echo "3. Use the /render/modal endpoint in your API"
echo ""
