#!/bin/bash
# Compose Engine Sync Script
# Usage: ./scripts/sync-compose.sh [push|pull]

EC2_HOST="hydra-compose"
LOCAL_PATH="./backend/compose-engine/"
REMOTE_PATH="~/compose-engine/"
EXCLUDES="--exclude __pycache__ --exclude .git --exclude *.pyc --exclude .env"

case "${1:-pull}" in
  push)
    echo -e "\033[36mPushing local -> EC2...\033[0m"
    rsync -avz $EXCLUDES "$LOCAL_PATH" "${EC2_HOST}:${REMOTE_PATH}"
    echo -e "\033[33mRestarting Docker container...\033[0m"
    ssh $EC2_HOST "docker restart hydra-compose"
    echo -e "\033[32mDone! Push complete.\033[0m"
    ;;
  pull)
    echo -e "\033[36mPulling EC2 -> local...\033[0m"
    rsync -avz $EXCLUDES "${EC2_HOST}:${REMOTE_PATH}app/" "${LOCAL_PATH}app/"
    echo -e "\033[32mDone! Now you can: git add . && git commit\033[0m"
    ;;
  *)
    echo "Usage: $0 [push|pull]"
    exit 1
    ;;
esac
