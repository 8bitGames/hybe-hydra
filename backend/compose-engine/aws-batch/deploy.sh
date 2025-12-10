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

    # Force job definitions to use new image
    log_info "Updating job definitions to use new image..."
    force_new_image
}

# Force AWS Batch to use the new image by updating job definitions
force_new_image() {
    log_info "Getting new image digest..."
    IMAGE_DIGEST=$(aws ecr describe-images \
        --repository-name ${ECR_REPO} \
        --image-ids imageTag=latest \
        --region ${AWS_REGION} \
        --query 'imageDetails[0].imageDigest' \
        --output text)

    if [ -z "$IMAGE_DIGEST" ] || [ "$IMAGE_DIGEST" = "None" ]; then
        log_error "Failed to get image digest"
        return 1
    fi

    log_info "New image digest: ${IMAGE_DIGEST}"

    ECR_URL="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
    IMAGE_WITH_DIGEST="${ECR_URL}@${IMAGE_DIGEST}"

    # Update GPU job definition
    log_info "Registering new GPU job definition..."
    aws batch register-job-definition \
        --job-definition-name "${PROJECT_NAME}-compose-gpu-render" \
        --type container \
        --platform-capabilities EC2 \
        --container-properties "{
            \"image\": \"${IMAGE_WITH_DIGEST}\",
            \"resourceRequirements\": [
                {\"type\": \"VCPU\", \"value\": \"4\"},
                {\"type\": \"MEMORY\", \"value\": \"14000\"},
                {\"type\": \"GPU\", \"value\": \"1\"}
            ],
            \"jobRoleArn\": \"arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT_NAME}-batch-job-role\",
            \"executionRoleArn\": \"arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT_NAME}-ecs-execution-role\",
            \"environment\": [
                {\"name\": \"AWS_REGION\", \"value\": \"${AWS_REGION}\"},
                {\"name\": \"AWS_S3_BUCKET\", \"value\": \"hydra-assets-seoul\"},
                {\"name\": \"USE_NVENC\", \"value\": \"1\"},
                {\"name\": \"RENDER_MODE\", \"value\": \"GPU\"},
                {\"name\": \"DYNAMODB_JOBS_TABLE\", \"value\": \"${PROJECT_NAME}-compose-jobs\"},
                {\"name\": \"USE_FFMPEG_PIPELINE\", \"value\": \"1\"}
            ],
            \"logConfiguration\": {
                \"logDriver\": \"awslogs\",
                \"options\": {
                    \"awslogs-group\": \"/aws/batch/${PROJECT_NAME}-compose-engine\",
                    \"awslogs-region\": \"${AWS_REGION}\",
                    \"awslogs-stream-prefix\": \"gpu-render\"
                }
            },
            \"command\": [\"python3\", \"-c\", \"import sys; sys.path.insert(0, '/root'); from batch_worker import process_job; process_job()\"]
        }" \
        --retry-strategy "attempts=2,evaluateOnExit=[{onStatusReason=Host EC2*,action=RETRY},{onReason=CannotInspectContainerError*,action=RETRY},{onExitCode=137,action=RETRY}]" \
        --timeout "attemptDurationSeconds=1800" \
        --region ${AWS_REGION} > /dev/null

    # Update CPU job definition
    log_info "Registering new CPU job definition..."
    aws batch register-job-definition \
        --job-definition-name "${PROJECT_NAME}-compose-cpu-render" \
        --type container \
        --platform-capabilities EC2 \
        --container-properties "{
            \"image\": \"${IMAGE_WITH_DIGEST}\",
            \"resourceRequirements\": [
                {\"type\": \"VCPU\", \"value\": \"4\"},
                {\"type\": \"MEMORY\", \"value\": \"8000\"}
            ],
            \"jobRoleArn\": \"arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT_NAME}-batch-job-role\",
            \"executionRoleArn\": \"arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT_NAME}-ecs-execution-role\",
            \"environment\": [
                {\"name\": \"AWS_REGION\", \"value\": \"${AWS_REGION}\"},
                {\"name\": \"AWS_S3_BUCKET\", \"value\": \"hydra-assets-seoul\"},
                {\"name\": \"USE_NVENC\", \"value\": \"0\"},
                {\"name\": \"RENDER_MODE\", \"value\": \"CPU\"},
                {\"name\": \"DYNAMODB_JOBS_TABLE\", \"value\": \"${PROJECT_NAME}-compose-jobs\"},
                {\"name\": \"USE_FFMPEG_PIPELINE\", \"value\": \"1\"}
            ],
            \"logConfiguration\": {
                \"logDriver\": \"awslogs\",
                \"options\": {
                    \"awslogs-group\": \"/aws/batch/${PROJECT_NAME}-compose-engine\",
                    \"awslogs-region\": \"${AWS_REGION}\",
                    \"awslogs-stream-prefix\": \"cpu-render\"
                }
            },
            \"command\": [\"python3\", \"-c\", \"import sys; sys.path.insert(0, '/root'); from batch_worker import process_job; process_job()\"]
        }" \
        --retry-strategy "attempts=2,evaluateOnExit=[{onStatusReason=Host EC2*,action=RETRY},{onExitCode=137,action=RETRY}]" \
        --timeout "attemptDurationSeconds=1800" \
        --region ${AWS_REGION} > /dev/null

    # Terminate running instances to force fresh pull
    log_info "Terminating GPU spot instances to force fresh image pull..."
    INSTANCE_IDS=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=${PROJECT_NAME}-gpu-spot-instance" "Name=instance-state-name,Values=running" \
        --region ${AWS_REGION} \
        --query 'Reservations[].Instances[].InstanceId' \
        --output text)

    if [ -n "$INSTANCE_IDS" ] && [ "$INSTANCE_IDS" != "None" ]; then
        aws ec2 terminate-instances --instance-ids $INSTANCE_IDS --region ${AWS_REGION} > /dev/null
        log_info "Terminated instances: $INSTANCE_IDS"
    else
        log_info "No running GPU spot instances to terminate"
    fi

    # Deregister old job definition revisions
    log_info "Deregistering old job definition revisions..."

    # GPU render - keep only the latest
    OLD_GPU_REVISIONS=$(aws batch describe-job-definitions \
        --job-definition-name "${PROJECT_NAME}-compose-gpu-render" \
        --status ACTIVE \
        --region ${AWS_REGION} \
        --query 'jobDefinitions[?revision!=`'$(aws batch describe-job-definitions --job-definition-name "${PROJECT_NAME}-compose-gpu-render" --status ACTIVE --region ${AWS_REGION} --query 'max(jobDefinitions[].revision)' --output text)'`].jobDefinitionArn' \
        --output text)

    for arn in $OLD_GPU_REVISIONS; do
        if [ -n "$arn" ] && [ "$arn" != "None" ]; then
            aws batch deregister-job-definition --job-definition "$arn" --region ${AWS_REGION} 2>/dev/null || true
        fi
    done

    # CPU render - keep only the latest
    OLD_CPU_REVISIONS=$(aws batch describe-job-definitions \
        --job-definition-name "${PROJECT_NAME}-compose-cpu-render" \
        --status ACTIVE \
        --region ${AWS_REGION} \
        --query 'jobDefinitions[?revision!=`'$(aws batch describe-job-definitions --job-definition-name "${PROJECT_NAME}-compose-cpu-render" --status ACTIVE --region ${AWS_REGION} --query 'max(jobDefinitions[].revision)' --output text)'`].jobDefinitionArn' \
        --output text)

    for arn in $OLD_CPU_REVISIONS; do
        if [ -n "$arn" ] && [ "$arn" != "None" ]; then
            aws batch deregister-job-definition --job-definition "$arn" --region ${AWS_REGION} 2>/dev/null || true
        fi
    done

    log_info "Job definitions updated with digest: ${IMAGE_DIGEST}"
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
    force-image)
        check_prerequisites
        force_new_image
        ;;
    *)
        echo "Usage: $0 {init|plan|apply|build|all|destroy|outputs|test|test-ai|test-ai-video|test-ai-image|force-image}"
        echo ""
        echo "Commands:"
        echo "  init           - Initialize Terraform"
        echo "  plan           - Preview infrastructure changes"
        echo "  apply          - Deploy infrastructure"
        echo "  build          - Build and push Docker image (+ force new image)"
        echo "  all            - Full deployment (init + plan + apply + build)"
        echo "  destroy        - Tear down all infrastructure"
        echo "  outputs        - Show Terraform outputs"
        echo "  test           - Submit a test render job"
        echo "  force-image    - Force job definitions to use latest image"
        echo ""
        echo "AI Generation (Vertex AI):"
        echo "  test-ai        - Submit a test AI job (default: video)"
        echo "  test-ai-video  - Submit a test Veo 3 video generation job"
        echo "  test-ai-image  - Submit a test Imagen 3 image generation job"
        exit 1
        ;;
esac
