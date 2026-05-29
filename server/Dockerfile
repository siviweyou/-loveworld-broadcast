# ── Loveworld Networks — Broadcast Server ──────────────────────────
# Multi-stage build: installs ffmpeg + node deps, runs the server.
#
# Build:  docker build -t loveworld-broadcast .
# Run:    docker run -d \
#           -p 1935:1935 \
#           -p 8000:8000 \
#           -p 3001:3001 \
#           -e SERVER_HOST=your.domain.com \
#           -v $(pwd)/media:/app/media \
#           -v $(pwd)/credentials.json:/app/credentials.json \
#           --name loveworld-broadcast \
#           --restart unless-stopped \
#           loveworld-broadcast

FROM node:20-alpine AS base

# Install ffmpeg (needed for HLS transcoding)
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY index.js ecosystem.config.js ./

# Create directories
RUN mkdir -p media logs

# Expose ports
# 1935 — RTMP ingest (OBS connects here)
# 8000 — HLS playback + HTTP-FLV
# 3001 — Platform REST API
EXPOSE 1935
EXPOSE 8000
EXPOSE 3001

# Health check — verifies the API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/status || exit 1

# Use the bundled ffmpeg from the OS, not the npm package
ENV FFMPEG_PATH=/usr/bin/ffmpeg

CMD ["node", "index.js"]
