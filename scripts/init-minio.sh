#!/bin/sh
set -e

MINIO_HOST="${MINIO_HOST:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin123}"

echo "Configuring MinIO client alias for $MINIO_HOST..."
mc alias set local "$MINIO_HOST" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

echo "Creating buckets..."
mc mb --ignore-existing local/cloudvault-primary
mc mb --ignore-existing local/cloudvault-replica
mc mb --ignore-existing local/cloudvault-backups

echo "Enabling bucket versioning..."
mc version enable local/cloudvault-primary
mc version enable local/cloudvault-replica
mc version enable local/cloudvault-backups

echo "Configuring anonymous/CORS policies if needed..."
mc anonymous set download local/cloudvault-primary 2>/dev/null || true

echo "MinIO buckets and versioning successfully initialized!"
