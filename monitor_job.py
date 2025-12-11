import boto3
import time
import json
import sys

job_id = "12e0a981-88e5-4a2c-8ee6-98e64935cd8b"
client = boto3.client('batch', region_name='ap-northeast-2')
logs = boto3.client('logs', region_name='ap-northeast-2')

print(f"Monitoring job {job_id}...")

while True:
    response = client.describe_jobs(jobs=[job_id])
    if not response['jobs']:
        print("Job not found")
        sys.exit(1)
        
    job = response['jobs'][0]
    status = job['status']
    print(f"Status: {status}")
    
    if status in ['SUCCEEDED', 'FAILED']:
        log_stream = job['container'].get('logStreamName')
        if not log_stream:
            print("No log stream found yet (maybe still flushing?)")
            time.sleep(5)
            continue
            
        print(f"Job finished. Fetching logs from {log_stream}...")
        
        # Wait a bit for logs to flush
        time.sleep(5)
        
        # Fetch logs
        try:
            log_events = logs.get_log_events(
                logGroupName='/aws/batch/hydra-compose-engine',
                logStreamName=log_stream,
                startFromHead=True,
                limit=100
            )
            
            with open('verification_logs.json', 'w', encoding='utf-8') as f:
                json.dump(log_events, f, ensure_ascii=False, indent=2)
                
            print("Logs saved to verification_logs.json")
            sys.exit(0)
            
        except Exception as e:
            print(f"Error fetching logs: {e}")
            sys.exit(1)
            
    time.sleep(5)
