# Railway backend image for Loveworld Networks Live.
FROM node:20-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server ./server

WORKDIR /app/server

ENV NODE_ENV=production
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV SERVER_HOST=0.0.0.0
ENV PUBLIC_HOST=streaming-server-production-d33c.up.railway.app
ENV PUBLIC_SCHEME=https
ENV PUBLIC_HLS_BASE=https://streaming-server-production-d33c.up.railway.app/live
ENV PUBLIC_RTMP_URL=rtmp://turntable.proxy.rlwy.net:35297/live
ENV STREAM_PROVIDER=platform

EXPOSE 1935
EXPOSE 8000
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3001}/api/status" || exit 1

CMD ["node", "index.js"]
