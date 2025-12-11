import boto3
import json

try:
    client = boto3.client('logs', region_name='ap-northeast-2')
    response = client.get_log_events(
        logGroupName='/aws/batch/hydra-compose-engine',
        logStreamName='wif-diagnostic/default/e3cf1706099049c4bc92beb07175070f',
        startFromHead=True,
        limit=100
    )

    with open('clean_logs.json', 'w', encoding='utf-8') as f:
        json.dump(response, f, ensure_ascii=False, indent=2)
    
    print("Successfully wrote clean_logs.json")

except Exception as e:
    print(f"Error: {e}")
