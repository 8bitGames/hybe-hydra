import subprocess
import json
import sys
import os

os.environ['PYTHONIOENCODING'] = 'utf-8'

cmd = [
    r'C:\Program Files\Amazon\AWSCLIV2\aws.exe',
    'logs', 'get-log-events',
    '--log-group-name', '/aws/batch/hydra-compose-engine',
    '--log-stream-name', 'ai-generation/default/cf874b607cdc487ba7cb7d525ad42392',
    '--region', 'ap-northeast-2',
    '--limit', '80',
    '--output', 'json'
]

result = subprocess.run(cmd, capture_output=True, env={**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1'})
if result.returncode == 0:
    stdout = result.stdout.decode('utf-8', errors='replace')
    data = json.loads(stdout)
    events = data.get('events', [])
    print(f'Found {len(events)} log events')
    # Save all to file
    with open('e:/Github/hybe-hydra/all_logs.txt', 'w', encoding='utf-8', errors='replace') as f:
        for event in events:
            f.write(event.get('message', '') + '\n---\n')
    # Show filtered in console
    for event in events:
        msg = event.get('message', '')
        # Only show lines with important info
        if any(kw in msg.lower() for kw in ['error', 'fail', 'wif', 'auth', 'hop', 'impersonat', 'permission', 'denied', 'credential', 'token', 'gcp', 'vertex', 'central', 'target', 'traceback', 'exception']):
            # Remove non-ascii for display
            msg_ascii = msg.encode('ascii', errors='replace').decode('ascii')
            print(msg_ascii[:400])
            print('---')
else:
    stderr = result.stderr.decode('utf-8', errors='replace')
    print('Error:', stderr[:500])
