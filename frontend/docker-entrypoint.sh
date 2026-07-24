#!/bin/sh
# ============================================
# ExcaliDash Frontend Init Script
# ============================================
# This runs as part of the nginx entrypoint sequence
# (/docker-entrypoint.d/40-excalidash-config.sh).
# The nginx entrypoint runs all .sh files in /docker-entrypoint.d/
# alphabetically, then executes CMD (nginx).
#
# This script:
#  1. Reads BACKEND_URL env var
#  2. Substitutes __BACKEND_URL__ in the nginx config template
#  3. Validates the generated config with `nginx -t`
#  4. Must succeed — if it fails, the entrypoint will exit
#
set -e

BACKEND_URL="${BACKEND_URL:-excalidash-backend:8000}"
echo "[excalidash] Backend URL: ${BACKEND_URL}"

# Escape sed-special characters in the backend URL
ESCAPED_URL="$(printf '%s\n' "${BACKEND_URL}" | sed 's/[\/&]/\\&/g')"

# Generate final nginx config from template
sed "s/__BACKEND_URL__/${ESCAPED_URL}/g" \
    /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Validate before starting nginx
echo "[excalidash] Validating nginx configuration..."
if ! nginx -t -c /etc/nginx/nginx.conf; then
    echo "[excalidash] FATAL: nginx config validation failed" >&2
    exit 1
fi

echo "[excalidash] nginx config OK"
