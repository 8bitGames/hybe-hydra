import boto3
import json

client = boto3.client('batch', region_name='ap-northeast-2')

def update_job_definition():
    # Get current definition
    response = client.describe_job_definitions(
        jobDefinitionName='hydra-wif-diagnostic',
        status='ACTIVE'
    )
    
    if not response['jobDefinitions']:
        print("Error: Job definition not found")
        return

    # Sort by revision descending
    defs = sorted(response['jobDefinitions'], key=lambda x: x['revision'], reverse=True)
    current_def = defs[0]
    
    print(f"Current revision: {current_def['revision']}")
    
    # Prepare new definition
    new_def = {
        'jobDefinitionName': 'hydra-wif-diagnostic',
        'type': current_def['type'],
        'containerProperties': current_def['containerProperties'],
    }
    
    # Copy optional fields if present
    for field in ['retryStrategy', 'timeout', 'tags', 'platformCapabilities', 'nodeProperties']:
        if field in current_def:
            new_def[field] = current_def[field]

    # Update image
    old_image = new_def['containerProperties']['image']
    new_image = old_image.split(':')[0] + ':v5'
    new_def['containerProperties']['image'] = new_image
    
    print(f"Updating image: {old_image} -> {new_image}")
    
    # Register new definition
    response = client.register_job_definition(**new_def)
    
    print(f"Registered new revision: {response['jobDefinitionArn']}")
    print(f"Revision: {response['revision']}")
    
    return response['revision']

if __name__ == '__main__':
    update_job_definition()
