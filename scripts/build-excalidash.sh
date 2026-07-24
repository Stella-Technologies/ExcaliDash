#!/bin/sh
# ==============================================================
# build-excalidash.sh
# Build ExcaliDash backend + frontend against locally-built
# Iron Bank base images (or public images as fallback).
# ==============================================================
# Usage:
#   sh scripts/build-excalidash.sh              # Public images
#   sh scripts/build-excalidash.sh --ironbank   # Iron Bank images
# ==============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODE="public"

if [ "${1:-}" = "--ironbank" ]; then
    MODE="ironbank"
fi

# Set up logging
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${REPO_ROOT}/logs/build-excalidash-${TIMESTAMP}.log"
mkdir -p "${REPO_ROOT}/logs"

exec > "${LOG_FILE}" 2>&1

tail -f "${LOG_FILE}" &
TAIL_PID=$!
sleep 0.3

echo "============================================"
echo " ExcaliDash Builder"
echo "============================================"
echo "Mode:         ${MODE}"
echo "Log file:     ${LOG_FILE}"
echo ""

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running or not accessible."
    kill $TAIL_PID 2>/dev/null; exit 1
fi

if [ "$MODE" = "ironbank" ]; then
    for img in "ib-alpine:3.24" "ib-nodejs:22" "ib-nginx:alpine"; do
        if ! docker image inspect "$img" > /dev/null 2>&1; then
            echo "ERROR: Image '$img' not found."
            echo "  Run 'sh scripts/build-ironbank.sh' first."
            kill $TAIL_PID 2>/dev/null; exit 1
        fi
    done
    BACKEND_RUNTIME="ib-nodejs:22"
    FRONTEND_RUNTIME="ib-nginx:alpine"
    BACKEND_TAG="excalidash-backend:ironbank"
    FRONTEND_TAG="excalidash-frontend:ironbank"
else
    BACKEND_RUNTIME="node:22-alpine"
    FRONTEND_RUNTIME="nginx:alpine"
    BACKEND_TAG="excalidash-backend:test"
    FRONTEND_TAG="excalidash-frontend:test"
fi

echo "Backend runtime:  ${BACKEND_RUNTIME}"
echo "Frontend runtime: ${FRONTEND_RUNTIME}"
echo ""

# Build Backend
echo "--- Building backend ---"
docker build \
    --build-arg RUNTIME_IMAGE="${BACKEND_RUNTIME}" \
    -t "${BACKEND_TAG}" \
    -f "${REPO_ROOT}/backend/Dockerfile" \
    "${REPO_ROOT}/backend" 2>&1
rc=$?
if [ $rc -ne 0 ]; then
    echo "ERROR: Backend build failed (exit ${rc})"
    kill $TAIL_PID 2>/dev/null; exit 1
fi
echo "Backend: ${BACKEND_TAG} OK"

# Build Frontend
echo ""
echo "--- Building frontend ---"
docker build \
    --build-arg RUNTIME_IMAGE="${FRONTEND_RUNTIME}" \
    -t "${FRONTEND_TAG}" \
    -f "${REPO_ROOT}/frontend/Dockerfile" \
    "${REPO_ROOT}" 2>&1
rc=$?
if [ $rc -ne 0 ]; then
    echo "ERROR: Frontend build failed (exit ${rc})"
    kill $TAIL_PID 2>/dev/null; exit 1
fi
echo "Frontend: ${FRONTEND_TAG} OK"

# Smoke test
echo ""
echo "--- Smoke testing backend ---"
container_id="$(docker run -d --rm "${BACKEND_TAG}" 2>/dev/null || true)"
if [ -n "$container_id" ]; then
    sleep 3
    logs="$(docker logs "$container_id" 2>&1 || true)"
    docker rm -f "$container_id" > /dev/null 2>&1 || true
    if echo "$logs" | grep -q "Server running"; then
        echo "Backend: STARTED OK"
    else
        echo "Backend logs (last 20 lines):"
        echo "$logs" | tail -20
    fi
else
    echo "Backend smoke test: skipped (could not start container)"
fi

# Summary
echo ""
echo "============================================"
echo " Build complete"
echo "============================================"
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "excalidash"
echo ""
echo "Full build log: ${LOG_FILE}"
echo ""
echo "Next: docker compose up -d"

kill $TAIL_PID 2>/dev/null