#!/bin/bash

# Exit on any error
set -e

# Setup Variables
# Change version manually or use git tags e.g. VERSION=$(git describe --tags --abbrev=0)
VERSION=${1:-"v1.0.0"} 
REGISTRY="nexus.ntc.net.np"
PROJECT="dutychart"
# You can pass the platform as the second argument, e.g., ./push_to_nexus.sh v1.0.0 linux/amd64
PLATFORMS=${2:-"linux/amd64,linux/arm64"}
API_BASE_URL=${3:-"https://dutychart.ntc.net.np"}

echo "=================================="
echo " Building & Publishing Dutychart images "
echo " Registry: $REGISTRY               "
echo " Version:  $VERSION                 "
echo " API URL:  $API_BASE_URL            "
echo "=================================="

# 1. Login to Nexus
echo "Logging into Nexus $REGISTRY"
docker login $REGISTRY
# Note: To avoid prompting for password, you can pipe it in like:
# echo "your_password" | docker login $REGISTRY -u your_username --password-stdin

# 2. Setup Buildx Builder
echo "Setting up Docker Buildx..."
# Create a new builder if one doesn't exist, and set it as default
docker buildx create --name dutychart-builder --use 2>/dev/null || docker buildx use dutychart-builder
# Ensure multi-arch emulators are running (if not already handled by Docker Desktop)
docker run --privileged --rm tonistiigi/binfmt --install all || true

# 3. Build and Push Backend (Multi-Arch)
echo "Building & Pushing Multi-Arch Backend Image..."
docker buildx build \
  --platform $PLATFORMS \
  -t $REGISTRY/$PROJECT/dcms-backend:$VERSION \
  -t $REGISTRY/$PROJECT/dcms-backend:latest \
  -f backend/Dockerfile \
  --push ./backend

# 4. Build and Push Frontend (Multi-Arch)
echo "Building & Pushing Multi-Arch Frontend Image..."
docker buildx build \
  --platform $PLATFORMS \
  -t $REGISTRY/$PROJECT/dcms-frontend:$VERSION \
  -t $REGISTRY/$PROJECT/dcms-frontend:latest \
  -f frontend/Dockerfile \
  --build-arg VITE_BACKEND_HOST=$API_BASE_URL \
  --push ./frontend

echo "=================================="
echo " Successfully built and pushed Multi-Arch Backend & Frontend images for version $VERSION! "
echo " (Note: Celery and Redis images are not pushed to Nexus as they can be pulled from Docker Hub on the server)"
echo "=================================="
