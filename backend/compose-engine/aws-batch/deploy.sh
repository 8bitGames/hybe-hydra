#!/bin/bash
# =============================================================================
# Hydra Compose Engine - AWS Batch Deployment Script
# =============================================================================
#
# Usage:
#   ./deploy.sh init      - Initialize Terraform
#   ./deploy.sh plan      - Preview infrastructure changes
#   ./deploy.sh apply     - Deploy infrastructure
#   ./deploy.sh build     - Build and push Docker image
#   ./deploy.sh all       - Full deployment (infra + image)
#   ./deploy.sh destroy   - Tear down all infrastructure
#
# Prerequisites:
#   - AWS CLI configured with appropriate permissions
#   - Terraform installed
#   - Docker installed
#
# =============================================================================

set -e

# Configuration
AWS_REGION="${AWS_REGION:-ap-northeast-2}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
PROJECT_NAME="hydra"
ECR_REPO="${PROJECT_NAME}-compose-engine"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Install: https://aws.amazon.com/cli/"
        exit 1
    fi

    if ! command -v terraform &> /dev/null; then
        log_error "Terraform not found. Install: https://www.terraform.io/downloads"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Install: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if [ -z "$AWS_ACCOUNT_ID" ]; then
        log_error "AWS credentials not configured. Run: aws configure"
        exit 1
    fi

    log_info "AWS Account: $AWS_ACCOUNT_ID"
    log_info "AWS Region: $AWS_REGION"
}

# Initialize Terraform
init_terraform() {
    log_info "Initializing Terraform..."
    cd terraform
    terraform init
    cd ..
}

# Plan infrastructure
plan_infrastructure() {
    log_info "Planning infrastructure..."
    cd terraform
    terraform plan -out=tfplan
    cd ..
}

# Apply infrastructure
apply_infrastructure() {
    log_info "Applying infrastructure..."
    cd terraform
    terraform apply tfplan
    cd ..
}

# Build and push Docker image
build_and_push() {
    log_info "Building Docker image..."

    ECR_URL="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

    # Login to ECR
    log_info "Logging into ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

    # Build image for amd64 (AWS Batch uses x86_64 EC2 instances)
    log_info "Building image for linux/amd64..."
    cd ..
    docker build --platform linux/amd64 -t ${ECR_REPO}:latest .

    # Tag and push
    log_info "Pushing to ECR..."
    docker tag ${ECR_REPO}:latest ${ECR_URL}:latest
    docker push ${ECR_URL}:latest

    log_info "Image pushed: ${ECR_URL}:latest"
    cd aws-batch
}

# Full deployment
deploy_all() {
    check_prerequisites
    init_terraform
    plan_infrastructure
    apply_infrastructure
    build_and_push
    log_info "Deployment complete!"
    show_outputs
}

# Show outputs
show_outputs() {
    log_info "Infrastructure outputs:"
    cd terraform
    terraform output
    cd ..
}

# Destroy infrastructure
destroy_infrastructure() {
    log_warn "This will destroy ALL infrastructure!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        cd terraform
        terraform destroy
        cd ..
    else
        log_info "Destroy cancelled"
    fi
}

# Test job submission (video rendering)
test_submit_job() {
    log_info "Submitting test render job..."

    JOB_ID="test-$(date +%s)"

    # Test images - using public domain images from Unsplash (requires at least 3)
    TEST_IMAGE_1="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=720"
    TEST_IMAGE_2="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=720"
    TEST_IMAGE_3="https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=720"

    # Build proper RenderRequest payload
    PAYLOAD=$(cat <<EOF
{
    "job_id": "${JOB_ID}",
    "images": [
        {"url": "${TEST_IMAGE_1}", "order": 0},
        {"url": "${TEST_IMAGE_2}", "order": 1},
        {"url": "${TEST_IMAGE_3}", "order": 2}
    ],
    "settings": {
        "vibe": "Pop",
        "aspect_ratio": "9:16",
        "target_duration": 5
    },
    "output": {
        "s3_bucket": "hydra-assets-seoul",
        "s3_key": "renders/test/${JOB_ID}.mp4"
    }
}
EOF
)

    # Escape for JSON in environment variable
    ESCAPED_PAYLOAD=$(echo "$PAYLOAD" | jq -c .)

    aws batch submit-job \
        --job-name "test-render-${JOB_ID}" \
        --job-queue "${PROJECT_NAME}-compose-gpu-queue" \
        --job-definition "${PROJECT_NAME}-compose-gpu-render" \
        --container-overrides "{
            \"environment\": [
                {
                    \"name\": \"BATCH_JOB_PARAMETERS\",
                    \"value\": $(echo "$ESCAPED_PAYLOAD" | jq -Rs .)
                }
            ]
        }" \
        --region $AWS_REGION

    log_info "Job submitted: ${JOB_ID}"
    log_info "Monitor in AWS Console: https://${AWS_REGION}.console.aws.amazon.com/batch/home?region=${AWS_REGION}#jobs"
}

# Test AI generation job (Veo 3 / Imagen 3)
test_ai_job() {
    local JOB_TYPE="${1:-video_generation}"
    log_info "Submitting test AI job (${JOB_TYPE})..."

    JOB_ID="ai-test-$(date +%s)"

    if [ "$JOB_TYPE" = "image_generation" ]; then
        PAYLOAD=$(cat <<EOF
{
    "job_id": "${JOB_ID}",
    "job_type": "image_generation",
    "image_settings": {
        "prompt": "A stylish K-pop album cover with neon lights and abstract geometric shapes, professional photography, 8k quality",
        "aspect_ratio": "1:1",
        "number_of_images": 1,
        "safety_filter_level": "block_some",
        "person_generation": "dont_allow"
    },
    "output": {
        "s3_bucket": "hydra-assets-seoul",
        "s3_key": "ai/images/${JOB_ID}/output.png"
    }
}
EOF
)
    else
        PAYLOAD=$(cat <<EOF
{
    "job_id": "${JOB_ID}",
    "job_type": "video_generation",
    "video_settings": {
        "prompt": "A dynamic cinematic shot of city lights at night with smooth camera movement, professional videography, 4k quality",
        "aspect_ratio": "9:16",
        "duration_seconds": 5,
        "person_generation": "dont_allow",
        "generate_audio": true
    },
    "output": {
        "s3_bucket": "hydra-assets-seoul",
        "s3_key": "ai/videos/${JOB_ID}/output.mp4"
    }
}
EOF
)
    fi

    ESCAPED_PAYLOAD=$(echo "$PAYLOAD" | jq -c .)

    aws batch submit-job \
        --job-name "ai-${JOB_TYPE}-${JOB_ID}" \
        --job-queue "${PROJECT_NAME}-ai-gpu-queue" \
        --job-definition "${PROJECT_NAME}-ai-gpu-worker" \
        --container-overrides "{
            \"environment\": [
                {
                    \"name\": \"BATCH_JOB_PARAMETERS\",
                    \"value\": $(echo "$ESCAPED_PAYLOAD" | jq -Rs .)
                }
            ]
        }" \
        --region $AWS_REGION

    log_info "AI Job submitted: ${JOB_ID}"
    log_info "Job type: ${JOB_TYPE}"
    log_info "Monitor in AWS Console: https://${AWS_REGION}.console.aws.amazon.com/batch/home?region=${AWS_REGION}#jobs"
}

# Main
case "$1" in
    init)
        check_prerequisites
        init_terraform
        ;;
    plan)
        check_prerequisites
        plan_infrastructure
        ;;
    apply)
        check_prerequisites
        apply_infrastructure
        ;;
    build)
        check_prerequisites
        build_and_push
        ;;
    all)
        deploy_all
        ;;
    destroy)
        check_prerequisites
        destroy_infrastructure
        ;;
    outputs)
        show_outputs
        ;;
    test)
        check_prerequisites
        test_submit_job
        ;;
    test-ai)
        check_prerequisites
        test_ai_job "${2:-video_generation}"
        ;;
    test-ai-video)
        check_prerequisites
        test_ai_job "video_generation"
        ;;
    test-ai-image)
        check_prerequisites
        test_ai_job "image_generation"
        ;;
    *)
        echo "Usage: $0 {init|plan|apply|build|all|destroy|outputs|test|test-ai|test-ai-video|test-ai-image}"
        echo ""
        echo "Commands:"
        echo "  init           - Initialize Terraform"
        echo "  plan           - Preview infrastructure changes"
        echo "  apply          - Deploy infrastructure"
        echo "  build          - Build and push Docker image"
        echo "  all            - Full deployment (init + plan + apply + build)"
        echo "  destroy        - Tear down all infrastructure"
        echo "  outputs        - Show Terraform outputs"
        echo "  test           - Submit a test render job"
        echo ""
        echo "AI Generation (Vertex AI):"
        echo "  test-ai        - Submit a test AI job (default: video)"
        echo "  test-ai-video  - Submit a test Veo 3 video generation job"
        echo "  test-ai-image  - Submit a test Imagen 3 image generation job"
        exit 1
        ;;
esac
