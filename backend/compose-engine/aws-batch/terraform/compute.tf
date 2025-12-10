# =============================================================================
# AWS Batch Compute Environments - GPU and CPU with Spot Instances
# =============================================================================
#
# Two compute environments:
# 1. GPU Spot (g4dn) - For video rendering with NVENC
# 2. CPU Spot (c5/m5) - For fallback or CPU-only tasks
#
# Both scale to ZERO when idle - pay only for actual compute time
# =============================================================================

# =============================================================================
# GPU Compute Environment (Primary - for NVENC video rendering)
# =============================================================================

resource "aws_batch_compute_environment" "gpu_spot" {
  compute_environment_name = "${var.project_name}-compose-gpu-spot"
  type                     = "MANAGED"
  state                    = "ENABLED"

  compute_resources {
    type                = "SPOT"
    allocation_strategy = "SPOT_CAPACITY_OPTIMIZED"

    # Keep 1 instance warm to avoid cold starts (4 vCPU = 1x g4dn.xlarge)
    # Cost: ~$0.16/hr Spot (~$115/month if 24/7)
    # Set to 0 for pure serverless (cold starts but cheaper)
    min_vcpus     = 4
    max_vcpus     = var.gpu_max_vcpus
    desired_vcpus = 4

    instance_type = var.gpu_instance_types

    subnets            = [aws_subnet.private.id]
    security_group_ids = [aws_security_group.batch.id]

    instance_role       = aws_iam_instance_profile.batch_instance.arn
    spot_iam_fleet_role = aws_iam_role.spot_fleet.arn
    bid_percentage      = var.spot_bid_percentage

    # Use Amazon ECS-optimized AMI with NVIDIA drivers
    ec2_configuration {
      image_type = "ECS_AL2_NVIDIA"
    }

    tags = {
      Name        = "${var.project_name}-gpu-spot-instance"
      Project     = var.project_name
      Environment = var.environment
      Type        = "GPU"
    }
  }

  service_role = aws_iam_role.batch_service.arn

  tags = {
    Name        = "${var.project_name}-compose-gpu-spot"
    Project     = var.project_name
    Environment = var.environment
  }

  depends_on = [aws_iam_role_policy_attachment.batch_service]
}

# =============================================================================
# CPU Compute Environment (Fallback - for non-GPU or CPU-intensive tasks)
# =============================================================================

resource "aws_batch_compute_environment" "cpu_spot" {
  compute_environment_name = "${var.project_name}-compose-cpu-spot"
  type                     = "MANAGED"
  state                    = "ENABLED"

  compute_resources {
    type                = "SPOT"
    allocation_strategy = "SPOT_CAPACITY_OPTIMIZED"

    # Scale to ZERO when idle
    min_vcpus     = 0
    max_vcpus     = var.cpu_max_vcpus
    desired_vcpus = 0

    instance_type = var.cpu_instance_types

    subnets            = [aws_subnet.private.id]
    security_group_ids = [aws_security_group.batch.id]

    instance_role       = aws_iam_instance_profile.batch_instance.arn
    spot_iam_fleet_role = aws_iam_role.spot_fleet.arn
    bid_percentage      = var.spot_bid_percentage

    # Standard ECS-optimized AMI (no GPU drivers needed)
    ec2_configuration {
      image_type = "ECS_AL2"
    }

    tags = {
      Name        = "${var.project_name}-cpu-spot-instance"
      Project     = var.project_name
      Environment = var.environment
      Type        = "CPU"
    }
  }

  service_role = aws_iam_role.batch_service.arn

  tags = {
    Name        = "${var.project_name}-compose-cpu-spot"
    Project     = var.project_name
    Environment = var.environment
  }

  depends_on = [aws_iam_role_policy_attachment.batch_service]
}

# =============================================================================
# Job Queues - GPU and CPU with priority routing
# =============================================================================

# GPU Job Queue (Primary - for video rendering)
resource "aws_batch_job_queue" "gpu" {
  name     = "${var.project_name}-compose-gpu-queue"
  state    = "ENABLED"
  priority = 10  # Higher priority

  compute_environment_order {
    order               = 1
    compute_environment = aws_batch_compute_environment.gpu_spot.arn
  }

  # Fallback to CPU if GPU unavailable (longer queue times)
  compute_environment_order {
    order               = 2
    compute_environment = aws_batch_compute_environment.cpu_spot.arn
  }

  tags = {
    Name        = "${var.project_name}-compose-gpu-queue"
    Project     = var.project_name
    Environment = var.environment
  }
}

# CPU Job Queue (for CPU-only tasks like audio analysis)
resource "aws_batch_job_queue" "cpu" {
  name     = "${var.project_name}-compose-cpu-queue"
  state    = "ENABLED"
  priority = 5  # Lower priority than GPU

  compute_environment_order {
    order               = 1
    compute_environment = aws_batch_compute_environment.cpu_spot.arn
  }

  tags = {
    Name        = "${var.project_name}-compose-cpu-queue"
    Project     = var.project_name
    Environment = var.environment
  }
}

# =============================================================================
# Job Definitions - GPU and CPU variants
# =============================================================================

# GPU Job Definition (with NVENC encoding)
resource "aws_batch_job_definition" "gpu_render" {
  name = "${var.project_name}-compose-gpu-render"
  type = "container"

  platform_capabilities = ["EC2"]

  container_properties = jsonencode({
    image = "${aws_ecr_repository.compose_engine.repository_url}:latest"

    resourceRequirements = [
      { type = "VCPU", value = "4" },
      { type = "MEMORY", value = "14000" },
      { type = "GPU", value = "1" }
    ]

    jobRoleArn       = aws_iam_role.batch_job.arn
    executionRoleArn = aws_iam_role.ecs_execution.arn

    environment = [
      { name = "AWS_REGION", value = var.aws_region },
      { name = "AWS_S3_BUCKET", value = var.s3_bucket },
      { name = "USE_NVENC", value = "1" },
      { name = "RENDER_MODE", value = "GPU" },
      { name = "DYNAMODB_JOBS_TABLE", value = aws_dynamodb_table.jobs.name }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.batch.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "gpu-render"
      }
    }

    command = ["python3", "-c", "import sys; sys.path.insert(0, '/root'); from batch_worker import process_job; process_job()"]
  })

  retry_strategy {
    attempts = 2
    evaluate_on_exit {
      on_status_reason = "Host EC2*"
      action           = "RETRY"
    }
    evaluate_on_exit {
      on_reason = "CannotInspectContainerError*"
      action    = "RETRY"
    }
    evaluate_on_exit {
      on_exit_code = "137"  # OOM killed
      action       = "RETRY"
    }
  }

  timeout {
    attempt_duration_seconds = 1800  # 30 minutes (GPU cold start + rendering)
  }

  tags = {
    Name        = "${var.project_name}-compose-gpu-render"
    Project     = var.project_name
    Environment = var.environment
    Type        = "GPU"
  }
}

# CPU Job Definition (fallback with libx264 encoding)
resource "aws_batch_job_definition" "cpu_render" {
  name = "${var.project_name}-compose-cpu-render"
  type = "container"

  platform_capabilities = ["EC2"]

  container_properties = jsonencode({
    image = "${aws_ecr_repository.compose_engine.repository_url}:latest"

    resourceRequirements = [
      { type = "VCPU", value = "4" },
      { type = "MEMORY", value = "8000" }
      # No GPU requirement
    ]

    jobRoleArn       = aws_iam_role.batch_job.arn
    executionRoleArn = aws_iam_role.ecs_execution.arn

    environment = [
      { name = "AWS_REGION", value = var.aws_region },
      { name = "AWS_S3_BUCKET", value = var.s3_bucket },
      { name = "USE_NVENC", value = "0" },  # Use libx264 instead
      { name = "RENDER_MODE", value = "CPU" },
      { name = "DYNAMODB_JOBS_TABLE", value = aws_dynamodb_table.jobs.name }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.batch.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "cpu-render"
      }
    }

    command = ["python3", "-c", "import sys; sys.path.insert(0, '/root'); from batch_worker import process_job; process_job()"]
  })

  retry_strategy {
    attempts = 2
    evaluate_on_exit {
      on_status_reason = "Host EC2*"
      action           = "RETRY"
    }
    evaluate_on_exit {
      on_exit_code = "137"
      action       = "RETRY"
    }
  }

  timeout {
    attempt_duration_seconds = 1800  # 30 minutes (CPU is slower)
  }

  tags = {
    Name        = "${var.project_name}-compose-cpu-render"
    Project     = var.project_name
    Environment = var.environment
    Type        = "CPU"
  }
}

# Audio Analysis Job Definition (CPU only - no video)
resource "aws_batch_job_definition" "audio_analysis" {
  name = "${var.project_name}-audio-analysis"
  type = "container"

  platform_capabilities = ["EC2"]

  container_properties = jsonencode({
    image = "${aws_ecr_repository.compose_engine.repository_url}:latest"

    resourceRequirements = [
      { type = "VCPU", value = "2" },
      { type = "MEMORY", value = "4000" }
    ]

    jobRoleArn       = aws_iam_role.batch_job.arn
    executionRoleArn = aws_iam_role.ecs_execution.arn

    environment = [
      { name = "AWS_REGION", value = var.aws_region },
      { name = "AWS_S3_BUCKET", value = var.s3_bucket },
      { name = "TASK_TYPE", value = "AUDIO_ANALYSIS" },
      { name = "DYNAMODB_JOBS_TABLE", value = aws_dynamodb_table.jobs.name }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.batch.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "audio-analysis"
      }
    }

    command = ["python3", "-c", "import sys; sys.path.insert(0, '/root'); from batch_worker import process_audio_analysis; process_audio_analysis()"]
  })

  retry_strategy {
    attempts = 2
  }

  timeout {
    attempt_duration_seconds = 300  # 5 minutes
  }

  tags = {
    Name        = "${var.project_name}-audio-analysis"
    Project     = var.project_name
    Environment = var.environment
    Type        = "CPU"
  }
}

# =============================================================================
# AI Generation Job Queue (Veo 3, Imagen 3 via Vertex AI)
# =============================================================================

resource "aws_batch_job_queue" "ai_gpu" {
  name     = "${var.project_name}-ai-gpu-queue"
  state    = "ENABLED"
  priority = 15  # Highest priority for AI generation

  compute_environment_order {
    order               = 1
    compute_environment = aws_batch_compute_environment.gpu_spot.arn
  }

  tags = {
    Name        = "${var.project_name}-ai-gpu-queue"
    Project     = var.project_name
    Environment = var.environment
    Type        = "AI"
  }
}

# AI Generation Job Definition (Veo 3 / Imagen 3)
resource "aws_batch_job_definition" "ai_generation" {
  name = "${var.project_name}-ai-gpu-worker"
  type = "container"

  platform_capabilities = ["EC2"]

  container_properties = jsonencode({
    image = "${aws_ecr_repository.compose_engine.repository_url}:latest"

    resourceRequirements = [
      { type = "VCPU", value = "4" },
      { type = "MEMORY", value = "14000" },
      { type = "GPU", value = "1" }
    ]

    jobRoleArn       = aws_iam_role.batch_job.arn
    executionRoleArn = aws_iam_role.ecs_execution.arn

    environment = [
      { name = "AWS_REGION", value = var.aws_region },
      { name = "SECRETS_NAME", value = "hydra/compose-engine" },
      { name = "GCP_SECRETS_NAME", value = "hydra/gcp-config" },
      { name = "GCP_PROJECT_ID", value = var.gcp_project_id },
      { name = "GCP_LOCATION", value = var.gcp_location },
      { name = "GOOGLE_APPLICATION_CREDENTIALS", value = "/root/clientLibraryConfig.json" }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.batch.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ai-generation"
      }
    }

    # Use ai_worker.py for AI generation jobs
    command = ["python3", "/root/ai_worker.py"]
  })

  retry_strategy {
    attempts = 2
    evaluate_on_exit {
      on_status_reason = "Host EC2*"
      action           = "RETRY"
    }
    evaluate_on_exit {
      on_reason = "CannotInspectContainerError*"
      action    = "RETRY"
    }
  }

  timeout {
    attempt_duration_seconds = 900  # 15 minutes (Veo can take 5-10 min)
  }

  tags = {
    Name        = "${var.project_name}-ai-gpu-worker"
    Project     = var.project_name
    Environment = var.environment
    Type        = "AI"
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "ai_job_queue_arn" {
  description = "ARN of AI generation job queue"
  value       = aws_batch_job_queue.ai_gpu.arn
}

output "ai_job_definition_arn" {
  description = "ARN of AI generation job definition"
  value       = aws_batch_job_definition.ai_generation.arn
}

output "gpu_job_queue_arn" {
  description = "ARN of GPU job queue"
  value       = aws_batch_job_queue.gpu.arn
}

output "cpu_job_queue_arn" {
  description = "ARN of CPU job queue"
  value       = aws_batch_job_queue.cpu.arn
}

output "gpu_job_definition_arn" {
  description = "ARN of GPU render job definition"
  value       = aws_batch_job_definition.gpu_render.arn
}

output "cpu_job_definition_arn" {
  description = "ARN of CPU render job definition"
  value       = aws_batch_job_definition.cpu_render.arn
}

output "audio_job_definition_arn" {
  description = "ARN of audio analysis job definition"
  value       = aws_batch_job_definition.audio_analysis.arn
}
