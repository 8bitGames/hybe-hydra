"""
Lambda function to submit render jobs to AWS Batch.

This replaces the Modal submit_render endpoint.
Deploy to AWS Lambda with API Gateway trigger.
"""

import json
import os
import uuid
import boto3
from datetime import datetime

batch_client = boto3.client("batch", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))

JOB_QUEUE = os.environ.get("BATCH_JOB_QUEUE", "hydra-compose-queue")
JOB_DEFINITION = os.environ.get("BATCH_JOB_DEFINITION", "hydra-compose-engine")
JOBS_TABLE = os.environ.get("DYNAMODB_JOBS_TABLE", "hydra-compose-jobs")


def lambda_handler(event, context):
    """
    Handle render job submission.

    POST /render
    Body: RenderRequest JSON

    Returns:
    {
        "job_id": "...",
        "status": "submitted",
        "batch_job_id": "..."
    }
    """
    try:
        # Parse request body
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        else:
            body = event.get("body", event)

        # Generate job ID if not provided
        job_id = body.get("job_id") or f"render-{uuid.uuid4().hex[:8]}"
        body["job_id"] = job_id

        # Store initial job status in DynamoDB
        table = dynamodb.Table(JOBS_TABLE)
        table.put_item(Item={
            "job_id": job_id,
            "status": "submitted",
            "created_at": datetime.utcnow().isoformat(),
            "request": json.dumps(body)[:10000],  # Truncate for storage
        })

        # Submit to AWS Batch
        response = batch_client.submit_job(
            jobName=f"compose-{job_id}",
            jobQueue=JOB_QUEUE,
            jobDefinition=JOB_DEFINITION,
            containerOverrides={
                "environment": [
                    {
                        "name": "BATCH_JOB_PARAMETERS",
                        "value": json.dumps(body)
                    }
                ]
            },
            retryStrategy={"attempts": 2},
            timeout={"attemptDurationSeconds": 900},
        )

        batch_job_id = response["jobId"]

        # Update DynamoDB with Batch job ID
        table.update_item(
            Key={"job_id": job_id},
            UpdateExpression="SET batch_job_id = :bjid, #s = :status",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":bjid": batch_job_id,
                ":status": "queued"
            }
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "job_id": job_id,
                "status": "queued",
                "batch_job_id": batch_job_id,
                "message": "Job submitted to AWS Batch"
            })
        }

    except Exception as e:
        print(f"Error submitting job: {e}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "error": str(e),
                "status": "failed"
            })
        }


def get_job_status(event, context):
    """
    Get render job status.

    GET /render/status?job_id=xxx

    Returns:
    {
        "job_id": "...",
        "status": "queued|processing|completed|failed",
        "output_url": "...",
        "error": "..."
    }
    """
    try:
        # Get job_id from query params
        params = event.get("queryStringParameters", {}) or {}
        job_id = params.get("job_id")

        if not job_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "job_id is required"})
            }

        # Get from DynamoDB
        table = dynamodb.Table(JOBS_TABLE)
        response = table.get_item(Key={"job_id": job_id})

        if "Item" not in response:
            return {
                "statusCode": 404,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Job not found"})
            }

        item = response["Item"]

        # If job is queued/processing, check AWS Batch for updates
        if item.get("status") in ["queued", "submitted", "processing"] and item.get("batch_job_id"):
            batch_response = batch_client.describe_jobs(jobs=[item["batch_job_id"]])
            if batch_response["jobs"]:
                batch_job = batch_response["jobs"][0]
                batch_status = batch_job["status"]

                # Map Batch status to our status
                status_map = {
                    "SUBMITTED": "queued",
                    "PENDING": "queued",
                    "RUNNABLE": "queued",
                    "STARTING": "processing",
                    "RUNNING": "processing",
                    "SUCCEEDED": "completed",
                    "FAILED": "failed",
                }
                item["status"] = status_map.get(batch_status, item["status"])
                item["batch_status"] = batch_status

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "job_id": item["job_id"],
                "status": item.get("status", "unknown"),
                "output_url": item.get("output_url"),
                "error": item.get("error"),
                "batch_job_id": item.get("batch_job_id"),
                "created_at": item.get("created_at"),
            })
        }

    except Exception as e:
        print(f"Error getting status: {e}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }
