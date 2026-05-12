#!/usr/bin/env bash
#
# build-push.sh — Build, tag, and push dutychart backend and frontend images to Nexus
#
# Usage Examples:
#   Interactive release mode (prompts for release yes/no and major/minor bump):
#     ./build-push.sh
#   Direct version mode (no prompt):
#     ./build-push.sh v1.0.0
#   Custom registry and image name:
#     ./build-push.sh v1.0.0 nexus.ntc.net.np dutychart
#
# Positional arguments (all optional):
#   [1] VERSION      - vX.Y.Z (default: v1.0.0)
#   [2] REGISTRY     - Nexus Docker registry (default: nexus.ntc.net.np)
#   [3] PROJECT_NAME - Project namespace (default: dutychart)
#
# Builds and pushes:
#   $REGISTRY/$PROJECT_NAME/dcms-backend:$VERSION
#   $REGISTRY/$PROJECT_NAME/dcms-frontend:$VERSION
#
# Tags pushed to Nexus:
#   - Versioned:  $REGISTRY/$PROJECT_NAME/<component>:$VERSION
#   - Immutable:  $REGISTRY/$PROJECT_NAME/<component>:$VERSION-BUILDNO-NPTTIME-GITSHA
#   - Latest:     $REGISTRY/$PROJECT_NAME/<component>:latest (skipped for prerelease)
#
set -euo pipefail

DEFAULT_VERSION="v0.0.0"
DEFAULT_REGISTRY="nexus.ntc.net.np"
DEFAULT_PROJECT_NAME="dutychart"
DEFAULT_PLATFORMS="linux/amd64"
DEFAULT_API_BASE_URL="https://dutychart.ntc.net.np"

REGISTRY="${2:-$DEFAULT_REGISTRY}"
PROJECT_NAME="${3:-$DEFAULT_PROJECT_NAME}"
PLATFORMS="${PLATFORMS:-$DEFAULT_PLATFORMS}"
API_BASE_URL="${API_BASE_URL:-$DEFAULT_API_BASE_URL}"

prompt_with_default() {
  local prompt_text="$1"
  local default_value="$2"
  local input_value
  read -r -p "$prompt_text [$default_value]: " input_value
  if [[ -z "$input_value" ]]; then
    echo "$default_value"
  else
    echo "$input_value"
  fi
}

# Accept optional 4th argument for bump type: major, minor, bugfix
VERSION="${1:-}"
BUMP_TYPE="${4:-}"

# Interactive release mode if no version
if [[ -z "$VERSION" ]]; then
  # 1. Always get the latest tag for context
  LATEST_TAG=$(git tag --list 'v*' --sort=-v:refname | head -n1)
  [[ -z "$LATEST_TAG" ]] && LATEST_TAG="$DEFAULT_VERSION"
  echo "Latest version: $LATEST_TAG"

  # 2. Parse MAJOR, MINOR, PATCH
  MAJOR=$(echo "$LATEST_TAG" | sed -E 's/^v?([0-9]+)\.[0-9]+\.[0-9]+.*/\1/')
  MINOR=$(echo "$LATEST_TAG" | sed -E 's/^v?[0-9]+\.([0-9]+)\.[0-9]+.*/\1/')
  PATCH=$(echo "$LATEST_TAG" | sed -E 's/^v?[0-9]+\.[0-9]+\.([0-9]+).*/\1/')

  [[ ! "$MAJOR" =~ ^[0-9]+$ ]] && MAJOR=1
  [[ ! "$MINOR" =~ ^[0-9]+$ ]] && MINOR=0
  [[ ! "$PATCH" =~ ^[0-9]+$ ]] && PATCH=0

  read -r -p "Is this a release build? (y/N): " IS_RELEASE
  if [[ "$IS_RELEASE" =~ ^[Yy]$ ]]; then
    if [[ -z "$BUMP_TYPE" ]]; then
      read -r -p "Bump (major/minor/bugfix)? [bugfix]: " BUMP_TYPE
      BUMP_TYPE=${BUMP_TYPE:-bugfix}
    fi

    if [[ "$BUMP_TYPE" == "major" ]]; then
      SUGGESTED_VER="v$((MAJOR+1)).0.0"
    elif [[ "$BUMP_TYPE" == "minor" ]]; then
      SUGGESTED_VER="v${MAJOR}.$((MINOR+1)).0"
    else
      SUGGESTED_VER="v${MAJOR}.${MINOR}.$((PATCH+1))"
    fi
    VERSION=$(prompt_with_default "Confirm or edit release version" "$SUGGESTED_VER")
    echo "Using version: $VERSION"
  else
    SUGGESTED_DEV="v${MAJOR}.${MINOR}.$((PATCH+1))-dev"
    VERSION=$(prompt_with_default "Enter image version" "$SUGGESTED_DEV")
  fi
fi

# Validate version
if [[ ! "$VERSION" =~ ^(v|release\.)?[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?(-[A-Za-z0-9.]+)?$ ]]; then
  echo "Error: VERSION must look like v1.0.0, v1.0.0.1, or v1.0.1-rc1"
  exit 1
fi

# Git tag logic
if ! git tag --list | grep -q "^$VERSION$"; then
  if [[ "${SKIP_GIT_TAG:-}" != "1" ]]; then
    git tag "$VERSION"
    read -r -p "Push git tag $VERSION to origin now? (y/N): " PUSH_TAG
    if [[ "$PUSH_TAG" =~ ^[Yy]$ ]]; then
      git push origin "$VERSION"
    fi
  fi
fi

# Build and push backend and frontend
for COMPONENT in backend frontend; do
  if [[ "$COMPONENT" == "backend" ]]; then
    DOCKERFILE="backend/Dockerfile"
    CONTEXT="./backend"
    IMAGE_PATH="$REGISTRY/$PROJECT_NAME/dcms-backend"
  else
    DOCKERFILE="frontend/Dockerfile"
    CONTEXT="./frontend"
    IMAGE_PATH="$REGISTRY/$PROJECT_NAME/dcms-frontend"
  fi

  # Docker login
  if [[ "${SKIP_LOGIN:-}" != "1" ]]; then
    if [[ -n "${NEXUS_USER:-}" && -n "${NEXUS_PASSWORD:-}" ]]; then
      echo "$NEXUS_PASSWORD" | docker login "$REGISTRY" -u "$NEXUS_USER" --password-stdin
    else
      docker login "$REGISTRY"
    fi
  fi

  BUILD_NO="${BUILD_NO:-$(date +%s)}"
  NPTTIME=$(TZ=Asia/Kathmandu date +%Y%m%d%H%M%S)
  GITSHA=$(git rev-parse --short HEAD)
  IMMUTABLE_TAG="$VERSION-$BUILD_NO-$NPTTIME-$GITSHA"

  echo "============================================="
  echo " Building & Publishing $COMPONENT image"
  echo " Registry: $REGISTRY"
  echo " Image:    $IMAGE_PATH"
  echo " Version:  $VERSION"
  echo " Platforms: $PLATFORMS"
  echo "============================================="

  docker buildx create --name dutychart-builder --use 2>/dev/null || docker buildx use dutychart-builder
  # Ensure multi-arch emulators are running
  docker run --privileged --rm tonistiigi/binfmt --install all || true

  if [[ "$COMPONENT" == "frontend" ]]; then
    docker buildx build \
      --platform "$PLATFORMS" \
      -t "$IMAGE_PATH:$VERSION" \
      -t "$IMAGE_PATH:$IMMUTABLE_TAG" \
      $( [[ ! "$VERSION" =~ - ]] && echo "-t $IMAGE_PATH:latest" ) \
      --build-arg VITE_BACKEND_HOST="$API_BASE_URL" \
      --build-arg VITE_APP_VERSION="$VERSION" \
      --build-arg VITE_BUILD_TIMESTAMP="$NPTTIME" \
      -f "$DOCKERFILE" \
      --push "$CONTEXT"
  else
    docker buildx build \
      --platform "$PLATFORMS" \
      -t "$IMAGE_PATH:$VERSION" \
      -t "$IMAGE_PATH:$IMMUTABLE_TAG" \
      $( [[ ! "$VERSION" =~ - ]] && echo "-t $IMAGE_PATH:latest" ) \
      -f "$DOCKERFILE" \
      --push "$CONTEXT"
  fi

  echo "============================================="
  echo " Successfully pushed $IMAGE_PATH:$VERSION"
  echo "============================================="
done