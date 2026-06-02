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

EXPOSE 1935
EXPOSE 8000
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3001}/api/status" || exit 1

CMD ["node", "index.js"]
