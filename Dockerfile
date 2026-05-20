# ── Build stage: install dependencies on Linux (fetches correct native binaries) ──
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./

# npm install resolves platform-specific binaries:
#   @neplex/vectorizer-linux-x64-musl or -linux-arm64-musl (Alpine/musl)
#   sharp prebuilt Linux binary via @img/sharp-linux-x64 or -arm64
RUN npm install --omit=dev

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
