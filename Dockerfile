# ── Build stage: run npm on native build platform to avoid QEMU SIGILL crash ──
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

ARG TARGETARCH

WORKDIR /app

COPY package.json ./

# npm_config_arch tells sharp/@neplex/vectorizer which prebuilt binary to fetch.
# Running on $BUILDPLATFORM (amd64) avoids QEMU; the correct target binaries are
# still downloaded because npm_config_arch overrides the host CPU detection.
RUN ARCH=$([ "$TARGETARCH" = "amd64" ] && echo "x64" || echo "arm64") && \
    npm_config_platform=linux \
    npm_config_arch=$ARCH \
    npm_config_libc=musl \
    npm install --omit=dev

# ── Runtime stage ──
FROM node:20-alpine

# tini: proper PID 1 signal handling inside containers
RUN apk add --no-cache tini

WORKDIR /app

# Copy installed node_modules (with correct Linux binaries) from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY cli.js server.js ./
COPY lib/ ./lib/
COPY public/ ./public/

EXPOSE 5173

# Run as non-root user
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5173/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

#docker build -t land007/image-to-svg:latest .
