# =============================================================================
# AWS Secrets Manager - Sensitive Configuration
# =============================================================================
#
# Store API keys and other sensitive configuration here.
# The Batch worker retrieves these at runtime.
#
# After deployment, populate secrets via AWS CLI:
#   aws secretsmanager put-secret-value \
#     --secret-id hydra/compose-engine \
#     --secret-string '{"OPENAI_API_KEY":"sk-xxx","GEMINI_API_KEY":"xxx"}'
#
# =============================================================================

# Main secrets for compose engine
resource "aws_secretsmanager_secret" "compose_engine" {
  name        = "${var.project_name}/compose-engine"
  description = "API keys and configuration for Hydra Compose Engine"

  tags = {
    Name        = "${var.project_name}-compose-engine-secrets"
    Project     = var.project_name
    Environment = var.environment
  }
}

# Placeholder secret value (populate after deployment)
resource "aws_secretsmanager_secret_version" "compose_engine" {
  secret_id = aws_secretsmanager_secret.compose_engine.id
  secret_string = jsonencode({
    OPENAI_API_KEY     = "REPLACE_ME"
    GEMINI_API_KEY     = "REPLACE_ME"
    SUPABASE_URL       = "REPLACE_ME"
    SUPABASE_KEY       = "REPLACE_ME"
    REDIS_URL          = "REPLACE_ME"
    CALLBACK_SECRET    = "REPLACE_ME"
  })

  lifecycle {
    ignore_changes = [secret_string]  # Don't overwrite after initial creation
  }
}

# S3 bucket configuration (non-sensitive, but grouped here)
resource "aws_secretsmanager_secret" "s3_config" {
  name        = "${var.project_name}/s3-config"
  description = "S3 configuration for asset storage"

  tags = {
    Name        = "${var.project_name}-s3-config"
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "s3_config" {
  secret_id = aws_secretsmanager_secret.s3_config.id
  secret_string = jsonencode({
    AWS_S3_BUCKET     = var.s3_bucket
    AWS_S3_REGION     = var.aws_region
    CLOUDFRONT_DOMAIN = ""  # Optional CDN domain
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# =============================================================================
# IAM Policy Update - Allow Batch jobs to read secrets
# =============================================================================

# Add secrets access to batch job role
resource "aws_iam_role_policy" "batch_job_secrets" {
  name = "${var.project_name}-batch-job-secrets"
  role = aws_iam_role.batch_job.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.compose_engine.arn,
          aws_secretsmanager_secret.s3_config.arn
        ]
      }
    ]
  })
}

# =============================================================================
# Outputs
# =============================================================================

output "secrets_arn" {
  description = "ARN of the compose engine secrets"
  value       = aws_secretsmanager_secret.compose_engine.arn
}

output "secrets_name" {
  description = "Name of the compose engine secrets"
  value       = aws_secretsmanager_secret.compose_engine.name
}
