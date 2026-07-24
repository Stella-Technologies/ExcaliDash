#!/bin/sh
# ============================================
# ExcaliDash Backend Entrypoint
# Corporate fork — rootless, Iron Bank compatible
# ============================================
#
# This entrypoint is intentionally minimal. It only:
#  1. Loads secrets from CSI mount paths (Azure Key Vault)
#  2. Validates required production secrets are present
#  3. Starts the application
#
# Prisma client generation → done at Docker build time
# Database migrations → handled by Helm init-container / Job
# Secret auto-generation → handled by Helm + Azure Key Vault CSI
#
set -e

# ---- Load secrets from Azure Key Vault CSI mount ----
# Standard mount path when using secrets-store.csi.k8s.io
load_secret() {
    secret_file="$1"
    env_var="$2"
    if [ -f "${secret_file}" ] && [ -z "${!env_var:-}" ]; then
        export "${env_var}=$(cat "${secret_file}")"
    fi
}

load_secret /mnt/secrets/jwt-secret          JWT_SECRET
load_secret /mnt/secrets/csrf-secret         CSRF_SECRET
load_secret /mnt/secrets/api-key-pepper      API_KEY_HASH_PEPPER

# ---- Production validation ----
if [ "${NODE_ENV}" = "production" ]; then
    fail=0
    for secret in JWT_SECRET CSRF_SECRET API_KEY_HASH_PEPPER; do
        if [ -z "$(eval echo \${${secret}})" ]; then
            echo "[FATAL] ${secret} is required in production" >&2
            fail=1
        fi
    done
    if [ $fail -ne 0 ]; then
        exit 1
    fi
fi

echo "[entrypoint] Provider: ${DATABASE_PROVIDER:-sqlite}"
echo "[entrypoint] Environment: ${NODE_ENV:-development}"

exec node dist/index.js
