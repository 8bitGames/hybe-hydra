# Compose Engine Sync Script
# Usage: .\scripts\sync-compose.ps1 [push|pull]

param(
    [Parameter(Position=0)]
    [ValidateSet("push", "pull")]
    [string]$Direction = "pull"
)

$EC2_HOST = "hydra-compose"
$LOCAL_PATH = ".\backend\compose-engine\"
$REMOTE_PATH = "~/compose-engine/"
$EXCLUDES = "--exclude '__pycache__' --exclude '.git' --exclude '*.pyc' --exclude '.env'"

if ($Direction -eq "push") {
    Write-Host "Pushing local -> EC2..." -ForegroundColor Cyan
    rsync -avz $EXCLUDES.Split(' ') "$LOCAL_PATH" "${EC2_HOST}:${REMOTE_PATH}"
    Write-Host "Restarting Docker container..." -ForegroundColor Yellow
    ssh $EC2_HOST "docker restart hydra-compose"
    Write-Host "Done! Push complete." -ForegroundColor Green
}
else {
    Write-Host "Pulling EC2 -> local..." -ForegroundColor Cyan
    rsync -avz $EXCLUDES.Split(' ') "${EC2_HOST}:${REMOTE_PATH}app/" "${LOCAL_PATH}app/"
    Write-Host "Done! Now you can: git add . && git commit" -ForegroundColor Green
}
