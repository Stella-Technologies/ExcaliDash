#!/bin/sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
IB_REPOS_DIR="${IB_REPOS_DIR:-${HOME}/ironbank-repos}"
ALPINE_VER="${ALPINE_VER:-3.24}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${REPO_ROOT}/logs/build-ironbank-${TIMESTAMP}.log"
mkdir -p "${REPO_ROOT}/logs"

echo "Build log: ${LOG_FILE}"

# Step 1: Alpine
ALPINE_REPO=""
for dir in "${IB_REPOS_DIR}/alpine_${ALPINE_VER}" "${IB_REPOS_DIR}/alpine_${ALPINE_VER}-main" "${IB_REPOS_DIR}/alpinelinux/alpine_${ALPINE_VER}" "${IB_REPOS_DIR}/alpinelinux"; do
    if [ -d "$dir" ] && [ -f "$dir/Dockerfile" ]; then ALPINE_REPO="$dir"; break; fi
done
if [ -z "$ALPINE_REPO" ]; then
    echo "Alpine repo not found at ${IB_REPOS_DIR}/alpine_${ALPINE_VER}"
    echo "Contents of ${IB_REPOS_DIR}:"
    ls "${IB_REPOS_DIR}" 2>/dev/null || echo "  (directory not found)"
    echo "Set IB_REPOS_DIR to the folder containing the unzipped repos."
    exit 1
fi
echo "Building ib-alpine:${ALPINE_VER} from ${ALPINE_REPO}..."
docker build -t "ib-alpine:${ALPINE_VER}" "$ALPINE_REPO" 2>&1 | tee -a "${LOG_FILE}"
echo "ib-alpine:${ALPINE_VER} done"

# Step 2: Node.js
NODEJS_REPO=""
for dir in "${IB_REPOS_DIR}/nodejs22-slim" "${IB_REPOS_DIR}/nodejs/nodejs-slim/nodejs22-slim" "${IB_REPOS_DIR}/nodejs22"; do
    if [ -d "$dir" ] && [ -f "$dir/Dockerfile" ]; then NODEJS_REPO="$dir"; break; fi
done
if [ -z "$NODEJS_REPO" ]; then
    echo "Node.js repo not found. Skipping."
    exit 1
fi
echo "Building ib-nodejs:22 from ${NODEJS_REPO}..."
cat > /tmp/ib-nodejs.Dockerfile << 'DOCKERFILE'
ARG ALPINE_IMAGE=ib-alpine:3.24
FROM node:22-alpine AS node-bin
FROM ${ALPINE_IMAGE}
COPY --from=node-bin /usr/local/bin/node /usr/local/bin/
COPY --from=node-bin /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
COPY --from=node-bin /usr/local/bin/docker-entrypoint.sh /usr/local/bin/
RUN set -ex && \
    apk add --no-cache libstdc++ linux-headers && \
    ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    ln -s /usr/local/bin/node /usr/local/bin/nodejs && \
    addgroup -g 1000 node 2>/dev/null; true && \
    adduser -u 1000 -G node -s /bin/sh -D node 2>/dev/null; true && \
    mkdir -p /home/node/.npm && \
    chown -R node:node /home/node
WORKDIR /home/node
USER node
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node"]
DOCKERFILE
docker build -f /tmp/ib-nodejs.Dockerfile -t "ib-nodejs:22" "$NODEJS_REPO" 2>&1 | tee -a "${LOG_FILE}"
rm -f /tmp/ib-nodejs.Dockerfile
echo "ib-nodejs:22 done"

# Step 3: nginx
NGINX_REPO=""
for dir in "${IB_REPOS_DIR}/nginx-alpine" "${IB_REPOS_DIR}/nginx/nginx-alpine" "${IB_REPOS_DIR}/nginx"; do
    if [ -d "$dir" ] && [ -f "$dir/Dockerfile" ]; then NGINX_REPO="$dir"; break; fi
done
if [ -z "$NGINX_REPO" ]; then
    echo "nginx repo not found. Skipping."
    exit 1
fi
echo "Building ib-nginx:alpine from ${NGINX_REPO}..."
cat > /tmp/ib-nginx.Dockerfile << 'DOCKERFILE'
ARG ALPINE_IMAGE=ib-alpine:3.24
FROM nginx:alpine AS nginx-bin
FROM ${ALPINE_IMAGE}
RUN set -ex && \
    apk add --no-cache nginx pcre2 gettext-envsubst && \
    mkdir -p /var/cache/nginx /var/log/nginx /docker-entrypoint.d /etc/nginx/templates && \
    addgroup -g 101 nginx 2>/dev/null; true && \
    adduser -u 101 -G nginx -s /sbin/nologin -D nginx 2>/dev/null; true && \
    chown -R nginx:nginx /var/log/nginx /var/cache/nginx /etc/nginx && \
    ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log
USER nginx
EXPOSE 8080 8443
CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE
docker build -f /tmp/ib-nginx.Dockerfile -t "ib-nginx:alpine" "$NGINX_REPO" 2>&1 | tee -a "${LOG_FILE}"
rm -f /tmp/ib-nginx.Dockerfile
echo "ib-nginx:alpine done"

echo ""
echo "All done. Images:"
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "^ib-"
echo ""
echo "Log: ${LOG_FILE}"