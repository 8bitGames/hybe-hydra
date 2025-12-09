# =============================================================================
# Variables for Hydra Compose Engine AWS Batch Infrastructure
# =============================================================================

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-southeast-2"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "hydra"
}

variable "environment" {
  description = "Environment (production, staging, development)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# GPU Compute Environment Settings
variable "gpu_max_vcpus" {
  description = "Maximum vCPUs for GPU compute environment (controls scaling)"
  type        = number
  default     = 32  # 8x g4dn.xlarge (4 vCPU each)
}

variable "gpu_instance_types" {
  description = "GPU instance types for rendering"
  type        = list(string)
  default     = ["g4dn.xlarge", "g4dn.2xlarge"]
}

# CPU Compute Environment Settings (for fallback/non-GPU tasks)
variable "cpu_max_vcpus" {
  description = "Maximum vCPUs for CPU compute environment"
  type        = number
  default     = 16
}

variable "cpu_instance_types" {
  description = "CPU instance types for non-GPU tasks"
  type        = list(string)
  default     = ["c5.xlarge", "c5.2xlarge", "m5.xlarge"]
}

# S3 Settings
variable "s3_bucket" {
  description = "S3 bucket for assets"
  type        = string
  default     = "hydra-assets-hybe"
}

# Spot Settings
variable "spot_bid_percentage" {
  description = "Maximum percentage of on-demand price to bid for Spot (100 = up to on-demand price)"
  type        = number
  default     = 100
}
