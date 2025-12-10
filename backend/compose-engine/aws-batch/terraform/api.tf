# =============================================================================
# API Gateway and Lambda - REST API for Job Submission
# =============================================================================
#
# Endpoints:
#   POST /render        - Submit a new render job
#   GET  /render/status - Get job status
#
# =============================================================================

# =============================================================================
# Lambda Functions
# =============================================================================

# Archive the Lambda code
data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/../lambda_submitter.py"
  output_path = "${path.module}/lambda_submitter.zip"
}

# Submit Job Lambda
resource "aws_lambda_function" "submit_job" {
  filename         = data.archive_file.lambda.output_path
  function_name    = "${var.project_name}-compose-submit"
  role             = aws_iam_role.lambda.arn
  handler          = "lambda_submitter.lambda_handler"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      AWS_REGION_NAME       = var.aws_region
      BATCH_JOB_QUEUE       = aws_batch_job_queue.gpu.name
      BATCH_JOB_DEFINITION  = aws_batch_job_definition.gpu_render.name
      DYNAMODB_JOBS_TABLE   = aws_dynamodb_table.jobs.name
    }
  }

  tags = {
    Name        = "${var.project_name}-compose-submit"
    Project     = var.project_name
    Environment = var.environment
  }
}

# Get Status Lambda
resource "aws_lambda_function" "get_status" {
  filename         = data.archive_file.lambda.output_path
  function_name    = "${var.project_name}-compose-status"
  role             = aws_iam_role.lambda.arn
  handler          = "lambda_submitter.get_job_status"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      AWS_REGION_NAME     = var.aws_region
      DYNAMODB_JOBS_TABLE = aws_dynamodb_table.jobs.name
    }
  }

  tags = {
    Name        = "${var.project_name}-compose-status"
    Project     = var.project_name
    Environment = var.environment
  }
}

# =============================================================================
# API Gateway
# =============================================================================

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-compose-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Api-Key"]
    max_age       = 300
  }

  tags = {
    Name        = "${var.project_name}-compose-api"
    Project     = var.project_name
    Environment = var.environment
  }
}

# API Gateway Stage
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  tags = {
    Name        = "${var.project_name}-compose-api-stage"
    Project     = var.project_name
    Environment = var.environment
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-compose-api"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-api-gateway-logs"
    Project     = var.project_name
    Environment = var.environment
  }
}

# =============================================================================
# Lambda Integrations
# =============================================================================

# Submit Job Integration
resource "aws_apigatewayv2_integration" "submit_job" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.submit_job.invoke_arn
  payload_format_version = "2.0"
}

# Get Status Integration
resource "aws_apigatewayv2_integration" "get_status" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_status.invoke_arn
  payload_format_version = "2.0"
}

# =============================================================================
# Routes
# =============================================================================

# POST /render - Submit job
resource "aws_apigatewayv2_route" "submit_job" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /render"
  target    = "integrations/${aws_apigatewayv2_integration.submit_job.id}"
}

# GET /render/status - Get status
resource "aws_apigatewayv2_route" "get_status" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /render/status"
  target    = "integrations/${aws_apigatewayv2_integration.get_status.id}"
}

# =============================================================================
# Lambda Permissions (Allow API Gateway to invoke Lambda)
# =============================================================================

resource "aws_lambda_permission" "submit_job" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.submit_job.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "get_status" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_status.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# =============================================================================
# Outputs
# =============================================================================

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "submit_endpoint" {
  description = "Submit render job endpoint"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/render"
}

output "status_endpoint" {
  description = "Get job status endpoint"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/render/status"
}

output "lambda_submit_arn" {
  description = "Lambda function ARN for job submission"
  value       = aws_lambda_function.submit_job.arn
}

output "lambda_status_arn" {
  description = "Lambda function ARN for status check"
  value       = aws_lambda_function.get_status.arn
}
