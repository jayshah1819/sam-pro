#!/bin/bash
# Runs on the EC2 host via SSM. Usage: deploy.sh [image-tag]  (default: latest)
set -euo pipefail
TAG="${1:-latest}"
REGION="us-east-2"
REGISTRY="353548850592.dkr.ecr.${REGION}.amazonaws.com"
IMAGE="${REGISTRY}/sam-tracker-backend:${TAG}"
cd /opt/sam-tracker

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
docker pull "$IMAGE"

PREV=$(docker inspect -f '{{.Image}}' sam-tracker-app-1 2>/dev/null || true)
# compose file references :latest, so retag the pulled image
docker tag "$IMAGE" "${REGISTRY}/sam-tracker-backend:latest"
docker compose up -d app

for i in $(seq 1 30); do
  if docker logs --tail 200 sam-tracker-app-1 2>&1 | grep -q "Started .* in "; then
    echo "healthy"; docker image prune -f; exit 0
  fi
  sleep 5
done

echo "startup check failed, rolling back"
if [ -n "$PREV" ]; then
  docker tag "$PREV" "${REGISTRY}/sam-tracker-backend:latest"
  docker compose up -d app
fi
exit 1
