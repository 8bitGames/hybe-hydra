@echo off
echo ===============================================
echo MinIO to AWS S3 Migration Script
echo ===============================================

:: Configure rclone for MinIO (source)
echo.
echo [1/4] Configuring rclone for MinIO...
rclone config create minio s3 provider=Minio endpoint=http://localhost:9000 access_key_id=minioadmin secret_access_key=minioadmin

:: Configure rclone for AWS S3 (destination)
echo.
echo [2/4] Configuring rclone for AWS S3...
rclone config create aws s3 provider=AWS region=ap-northeast-2 access_key_id=AKIASBF5YXJFHLVFVGQR secret_access_key=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

:: List files in MinIO (dry run)
echo.
echo [3/4] Listing files in MinIO...
rclone ls minio:hydra-assets

:: Sync data from MinIO to AWS S3
echo.
echo [4/4] Syncing data from MinIO to AWS S3...
echo This may take a while depending on the amount of data.
rclone sync minio:hydra-assets aws:hydra-assets-hybe --progress --transfers 8

echo.
echo ===============================================
echo Migration complete!
echo ===============================================
pause
