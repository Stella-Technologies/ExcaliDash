# ============================================
# ExcaliDash Backend Dockerfile
# Public images by default; add --build-arg for Iron Bank
# ============================================

# ---- Build stage (public image, always available) ----
ARG BUILD_IMAGE=node:22-alpine
ARG RUNTIME_IMAGE=node:22-alpine

FROM ${BUILD_IMAGE} AS builder

WORKDIR /app

# Native build deps for better-sqlite3 (compiles from C++ addon)
RUN apk add --no-cache python3 make g++

# Full install: all deps including type-safety and Prisma CLI, then apply security patches
COPY package*.json tsconfig.json ./
RUN npm ci && npm audit fix --audit-level=moderate && npm cache clean --force

# Generate Prisma client at build time (default: sqlite).
# The schema has `provider = "sqlite"` hardcoded because Prisma does not
# support env() in the provider field (only in the url field).
# For PostgreSQL, the Helm migration Job handles:
#   1. sed swap of provider in schema.prisma
#   2. npx prisma generate
#   3. npx prisma migrate deploy
COPY prisma ./prisma/
ENV DATABASE_PROVIDER=sqlite
RUN npx prisma generate

# Compile TypeScript
COPY src ./src
RUN npx tsc

# Strip dev-only packages from node_modules so we only ship
# production dependencies in the runtime image (smaller, safer).
RUN npm prune --production

# ---- Runtime stage ----
# Use --build-arg RUNTIME_IMAGE=registry1.dso.mil/ironbank/opensource/nodejs/nodejs-slim/nodejs22-slim:latest
# for Iron Bank production builds.
# (RUNTIME_IMAGE ARG is declared at the top of this file, before the first FROM)

FROM ${RUNTIME_IMAGE}

WORKDIR /app

# All supported images have user 'node' (UID 1000).
# Iron Bank slim has 'node' in group 0 (root group).
# Set files to UID 1000 / GID 0 for maximum compatibility.
COPY --chown=node:0 --from=builder /app/package*.json ./
COPY --chown=node:0 --from=builder /app/node_modules ./node_modules
COPY --chown=node:0 --from=builder /app/dist ./dist
COPY --chown=node:0 --from=builder /app/src/generated ./dist/generated
COPY --chown=node:0 --from=builder /app/prisma ./prisma

# Create writable directories and set up entrypoint
USER root
RUN mkdir -p uploads prisma backups && chown -R node:0 /app
COPY docker-entrypoint.sh default_library.json ./
RUN chmod +x docker-entrypoint.sh && chown node:0 docker-entrypoint.sh default_library.json
USER node

# Default database provider (override in Helm ConfigMap for PG on AKS)
ENV DATABASE_PROVIDER=sqlite

EXPOSE 8000

# Non-root user
#   - node:22-alpine:     USER node (UID 1000)
#   - Iron Bank slim:     USER node:0 (UID 1000, group 0)
USER node

ENTRYPOINT ["./docker-entrypoint.sh"]
