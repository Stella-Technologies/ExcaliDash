# ============================================
# ExcaliDash Frontend Dockerfile
# Public images by default; add --build-arg for Iron Bank
# ============================================

# ---- Build stage (public image, always available) ----
ARG BUILD_IMAGE=node:22-alpine
ARG RUNTIME_IMAGE=nginx:alpine

FROM ${BUILD_IMAGE} AS builder

WORKDIR /app/frontend

# Install all dependencies (Vite, React, etc.)
COPY frontend/package*.json ./
RUN npm ci && npm cache clean --force

# Copy source, config, and version metadata
COPY frontend/ ./
COPY VERSION ../VERSION

# Build-time metadata (set via Helm or CI)
ARG VITE_APP_VERSION
ARG VITE_APP_BUILD_LABEL
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_APP_BUILD_LABEL=$VITE_APP_BUILD_LABEL

RUN npm run build

# ---- Runtime stage (nginx) ----
# Use --build-arg RUNTIME_IMAGE=registry1.dso.mil/ironbank/opensource/nginx/nginx-alpine:latest
# for Iron Bank production builds.
# (RUNTIME_IMAGE ARG is declared at the top of this file, before the first FROM)

FROM ${RUNTIME_IMAGE}

# The official nginx image (and Iron Bank variant) supports
# /docker-entrypoint.d/ — scripts in this directory run alphabetically
# before nginx starts. This is the Iron Bank-native pattern.
# Our script substitutes __BACKEND_URL__ in the nginx config template
# and validates the result with `nginx -t`.
COPY --chown=nginx:nginx frontend/docker-entrypoint.sh /docker-entrypoint.d/40-excalidash-config.sh
RUN chmod +x /docker-entrypoint.d/40-excalidash-config.sh

# nginx config template (processed by the script above at startup)
COPY --chown=nginx:nginx frontend/nginx.conf.template /etc/nginx/nginx.conf.template

# Built SPA assets
COPY --chown=nginx:nginx --from=builder /app/frontend/dist /usr/share/nginx/html

# Iron Bank nginx runs as non-root (UID 101) → listens on 8080.
# Public nginx:alpine can also bind to 8080 when running as nginx user.
EXPOSE 8080

# Default backend (override in Helm / compose with BACKEND_URL env var)
ENV BACKEND_URL=excalidash-backend:8000

# CMD is just nginx.
# The entrypoint (/docker-entrypoint.sh) auto-runs scripts in
# /docker-entrypoint.d/ (including 40-excalidash-config.sh) before
# starting nginx. No need to manually invoke the config script here.
CMD ["nginx", "-g", "daemon off;"]
