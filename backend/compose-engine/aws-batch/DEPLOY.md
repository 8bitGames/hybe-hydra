# AWS Batch Deployment Guide

Serverless GPU video rendering with AWS Batch + Spot Instances.
Scales to zero when idle - pay only for actual compute time.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│  API Gateway    │────▶│  Lambda Submit  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │   DynamoDB      │◀─────────────┤
                        │  (Job Status)   │              │
                        └─────────────────┘              ▼
                                               ┌─────────────────┐
                                               │   AWS Batch     │
                                               │   Job Queue     │
                                               └────────┬────────┘
                                                        │
                        ┌───────────────────────────────┴───────────────────────────────┐
                        │                                                               │
               ┌────────▼────────┐                                            ┌────────▼────────┐
               │  GPU Spot Pool  │                                            │  CPU Spot Pool  │
               │  (g4dn.xlarge)  │                                            │  (c5.xlarge)    │
               │  NVENC Encoding │                                            │  libx264 Encode │
               └────────┬────────┘                                            └────────┬────────┘
                        │                                                              │
                        └──────────────────────────┬───────────────────────────────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │   S3 Bucket     │
                                          │ (Final Videos)  │
                                          └─────────────────┘
```

## Cost Estimate

| Component | Cost |
|-----------|------|
| GPU Spot (g4dn.xlarge) | ~$0.16/hour (70% off on-demand) |
| CPU Spot (c5.xlarge) | ~$0.05/hour |
| Lambda | ~$0.20/million requests |
| API Gateway | ~$1.00/million requests |
| DynamoDB | Pay-per-request (~$0) |
| **Idle Cost** | **~$0** (NAT Gateway: ~$32/month) |

## Prerequisites

1. **AWS CLI** configured with admin permissions
2. **Terraform** v1.0+
3. **Docker** for building images

```bash
# Verify tools
aws --version
terraform --version
docker --version

# Verify AWS credentials
aws sts get-caller-identity
```

## Deployment Steps

### 1. Initialize Terraform

```bash
cd backend/compose-engine/aws-batch
chmod +x deploy.sh
./deploy.sh init
```

### 2. Review Infrastructure Plan

```bash
./deploy.sh plan
```

This will create:
- VPC with public/private subnets
- NAT Gateway for outbound internet
- ECR repository for Docker images
- AWS Batch compute environments (GPU + CPU)
- Job queues and definitions
- Lambda functions for API
- API Gateway HTTP endpoint
- DynamoDB for job tracking
- Secrets Manager for API keys
- IAM roles and policies

### 3. Deploy Infrastructure

```bash
./deploy.sh apply
```

Note the outputs:
- `api_endpoint`: Your REST API URL
- `ecr_repository_url`: Where to push Docker images

### 4. Build and Push Docker Image

```bash
./deploy.sh build
```

This builds the compose engine image and pushes to ECR.

### 5. Configure Secrets

After deployment, populate API keys:

```bash
aws secretsmanager put-secret-value \
  --secret-id hydra/compose-engine \
  --secret-string '{
    "OPENAI_API_KEY": "sk-xxx",
    "GEMINI_API_KEY": "xxx",
    "SUPABASE_URL": "https://xxx.supabase.co",
    "SUPABASE_KEY": "eyJxxx",
    "REDIS_URL": "redis://xxx",
    "CALLBACK_SECRET": "your-webhook-secret"
  }'
```

### 6. Test Job Submission

```bash
./deploy.sh test
```

Or manually:

```bash
# Submit a render job
curl -X POST https://YOUR_API_ENDPOINT/render \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test-001",
    "images": [{"url": "https://example.com/image1.jpg"}],
    "settings": {
      "vibe": "Pop",
      "aspect_ratio": "9:16",
      "target_duration": 15
    }
  }'

# Check status
curl "https://YOUR_API_ENDPOINT/render/status?job_id=test-001"
```

## Updating Next.js Frontend

Update your Next.js app to use the new AWS endpoints:

```typescript
// lib/compose-api.ts

const AWS_COMPOSE_API = process.env.NEXT_PUBLIC_AWS_COMPOSE_API || 'https://xxx.execute-api.ap-southeast-2.amazonaws.com';

export async function submitRenderJob(request: RenderRequest) {
  const response = await fetch(`${AWS_COMPOSE_API}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function getRenderStatus(jobId: string) {
  const response = await fetch(`${AWS_COMPOSE_API}/render/status?job_id=${jobId}`);
  return response.json();
}
```

## Operations

### View Logs

```bash
# Batch job logs
aws logs tail /aws/batch/hydra-compose-engine --follow

# Lambda logs
aws logs tail /aws/lambda/hydra-compose-submit --follow
```

### Monitor Jobs

```bash
# List recent jobs
aws batch list-jobs --job-queue hydra-compose-gpu-queue --job-status RUNNING

# Describe specific job
aws batch describe-jobs --jobs JOB_ID
```

### Scale Configuration

Edit `terraform/variables.tf`:

```hcl
# Increase max concurrent GPU renders
variable "gpu_max_vcpus" {
  default = 64  # 16x g4dn.xlarge
}

# Increase max concurrent CPU renders
variable "cpu_max_vcpus" {
  default = 32
}
```

Then apply:

```bash
./deploy.sh plan
./deploy.sh apply
```

### Destroy Everything

```bash
./deploy.sh destroy
```

**Warning**: This deletes all resources including the ECR repository and DynamoDB table.

## Troubleshooting

### Job Stuck in RUNNABLE

- Check Spot capacity in region
- Verify instance types are available
- Check compute environment status

```bash
aws batch describe-compute-environments --compute-environments hydra-compose-gpu-spot
```

### Container Fails to Start

- Check CloudWatch logs for errors
- Verify ECR image exists and is valid
- Check IAM permissions

### NVENC Not Available

- Ensure GPU instance (g4dn) is used
- Check `ECS_AL2_NVIDIA` AMI is selected
- Verify `USE_NVENC=1` environment variable

## Files

```
aws-batch/
├── DEPLOY.md              # This file
├── deploy.sh              # Deployment script
├── batch_worker.py        # Batch job entry point
├── lambda_submitter.py    # Lambda functions
└── terraform/
    ├── main.tf            # Core infrastructure
    ├── compute.tf         # Batch compute & job definitions
    ├── api.tf             # API Gateway & Lambda
    ├── secrets.tf         # Secrets Manager
    └── variables.tf       # Configuration variables
```
